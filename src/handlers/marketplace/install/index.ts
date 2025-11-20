// @ts-nocheck
import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../../../utils/logger';
import { validateAuth } from '../../../middleware/auth';
import { respondWithError } from '../../../utils/response';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getAppParams(req: VercelRequest) {
  const url = req.url || '';
  const match = url.match(/\/install\/([^/?]+)/);
  return {
    appId: match ? match[1] : null,
  };
}

export async function handleInstallApp(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    // Validate authentication
    const authResult = await validateAuth(req);
    if (!authResult.valid || !authResult.userId) {
      respondWithError(res, 401, 'AUTH_INVALID', 'Invalid or missing authentication');
      return;
    }

    const { appId } = getAppParams(req);
    if (!appId) {
      respondWithError(res, 400, 'INVALID_APP_ID', 'App ID is required');
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
      respondWithError(
        res,
        404,
        'APP_NOT_FOUND',
        'App not found or not available for installation'
      );
      return;
    }

    // Check if already installed
    const { data: existingInstall } = await supabase
      .from('user_app_installs')
      .select('id')
      .eq('user_id', authResult.userId)
      .eq('app_id', appId)
      .eq('is_active', true)
      .single();

    if (existingInstall) {
      respondWithError(res, 409, 'APP_ALREADY_INSTALLED', 'App is already installed');
      return;
    }

    // Install the app
    const now = new Date().toISOString();
    const { data: installation, error: installError } = await supabase
      .from('user_app_installs')
      .insert({
        user_id: authResult.userId,
        app_id: appId,
        installed_at: now,
        is_active: true,
        app_settings: settings,
      })
      .select()
      .single();

    if (installError || !installation) {
      logger.error('Failed to install app', { installError, appId, userId: authResult.userId });
      respondWithError(res, 500, 'MARKETPLACE_APPS_ERROR', 'Failed to install app');
      return;
    }

    // Increment install count (non-blocking)
    await supabase.rpc('increment_install_count', { app_id_in: appId }).catch((err) => {
      logger.warn('Failed to increment install count', { error: err, appId });
    });

    res.json({
      ok: true,
      success: true,
      data: {
        installationId: installation.id,
        appId,
        installedAt: installation.installed_at,
        message: `Successfully installed ${app.name}`,
      },
    });
  } catch (error) {
    logger.error('Install app endpoint error', { error });
    respondWithError(res, 500, 'MARKETPLACE_APPS_ERROR', 'Failed to install app');
  }
}
