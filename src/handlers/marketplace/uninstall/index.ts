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
  const match = url.match(/\/uninstall\/([^/?]+)/);
  return {
    appId: match ? match[1] : null,
  };
}

async function uninstallAppHandler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'DELETE') {
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

    // Check if app is installed
    const { data: installation, error: checkError } = await supabase
      .from('user_app_installs')
      .select('id, plugin_marketplace_apps(name)')
      .eq('user_id', user.userId)
      .eq('app_id', appId)
      .eq('is_active', true)
      .single();

    if (checkError || !installation) {
      res.status(404).json({
        error: 'App is not installed',
        code: 'APP_NOT_INSTALLED',
      });
      return;
    }

    // Uninstall the app (soft delete by setting is_active to false)
    const { error: uninstallError } = await supabase
      .from('user_app_installs')
      .update({ is_active: false })
      .eq('id', installation.id);

    if (uninstallError) {
      console.error('Failed to uninstall app', { uninstallError, appId, userId: user.userId });
      res.status(500).json({
        error: 'Failed to uninstall app',
        code: 'MARKETPLACE_APPS_ERROR',
      });
      return;
    }

    const appName = (installation.plugin_marketplace_apps as any)?.name || 'App';

    res.status(200).json({
      ok: true,
      success: true,
      data: {
        appId,
        message: `Successfully uninstalled ${appName}`,
      },
    });
  } catch (error: any) {
    console.error('Uninstall app endpoint error', { error, userId: user.userId });
    res.status(500).json({
      error: 'Failed to uninstall app',
      code: 'MARKETPLACE_APPS_ERROR',
    });
  }
}

// Export with middleware chain
export const handleUninstallApp = asyncHandler(uninstallAppHandler);
