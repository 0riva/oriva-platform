// @ts-nocheck
import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { authenticate } from '../../../middleware/auth';
import { asyncHandler } from '../../../middleware/error-handler';

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

function getAppParams(req: VercelRequest) {
  const url = req.url || '';
  const match = url.match(/\/install\/([^/?]+)/);
  return {
    appId: match ? match[1] : null,
  };
}

async function installAppHandler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
    return;
  }

  // Authenticate user
  let authComplete = false;
  await authenticate(req, res, async () => {
    authComplete = true;
  });

  if (!authComplete || !(req as any).authContext) {
    return;
  }

  const user = (req as any).authContext;

  try {
    const { appId } = getAppParams(req);
    if (!appId) {
      res.status(400).json({ error: 'App ID is required', code: 'INVALID_APP_ID' });
      return;
    }

    const { settings = {} } = req.body as { settings?: Record<string, unknown> };

    // Check if app exists and is approved
    const { data: app, error: appError } = await supabase
      .from('plugin_marketplace_apps')
      .select('id, name, status')
      .eq('id', appId)
      .eq('status', 'approved')
      .eq('is_active', true)
      .single();

    if (appError || !app) {
      res.status(404).json({
        error: 'App not found or not available for installation',
        code: 'APP_NOT_FOUND',
      });
      return;
    }

    // Check if already installed
    const { data: existingInstall } = await supabase
      .from('user_app_installs')
      .select('id')
      .eq('user_id', user.userId)
      .eq('app_id', appId)
      .eq('is_active', true)
      .single();

    if (existingInstall) {
      res.status(409).json({
        error: 'App is already installed',
        code: 'APP_ALREADY_INSTALLED',
      });
      return;
    }

    // Install the app
    const now = new Date().toISOString();
    const { data: installation, error: installError } = await supabase
      .from('user_app_installs')
      .insert({
        user_id: user.userId,
        app_id: appId,
        installed_at: now,
        is_active: true,
        app_settings: settings,
      })
      .select()
      .single();

    if (installError || !installation) {
      console.error('Failed to install app', { installError, appId, userId: user.userId });
      res.status(500).json({
        error: 'Failed to install app',
        code: 'MARKETPLACE_APPS_ERROR',
      });
      return;
    }

    // Increment install count (non-blocking)
    await supabase.rpc('increment_install_count', { app_id_in: appId }).catch((err) => {
      console.warn('Failed to increment install count', { error: err, appId });
    });

    res.status(200).json({
      ok: true,
      success: true,
      data: {
        installationId: installation.id,
        appId,
        installedAt: installation.installed_at,
        message: `Successfully installed ${app.name}`,
      },
    });
  } catch (error: any) {
    console.error('Install app endpoint error', { error, userId: user.userId });
    res.status(500).json({
      error: 'Failed to install app',
      code: 'MARKETPLACE_APPS_ERROR',
    });
  }
}

// Export with middleware chain
export const handleInstallApp = asyncHandler(installAppHandler);
