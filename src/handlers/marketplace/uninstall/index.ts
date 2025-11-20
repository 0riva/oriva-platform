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
  const match = url.match(/\/uninstall\/([^/?]+)/);
  return {
    appId: match ? match[1] : null,
  };
}

export async function handleUninstallApp(req: VercelRequest, res: VercelResponse): Promise<void> {
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

    // Check if app is installed
    const { data: installation, error: checkError } = await supabase
      .from('user_app_installs')
      .select('id, plugin_marketplace_apps(name)')
      .eq('user_id', authResult.userId)
      .eq('app_id', appId)
      .eq('is_active', true)
      .single();

    if (checkError || !installation) {
      respondWithError(res, 404, 'APP_NOT_INSTALLED', 'App is not installed');
      return;
    }

    // Uninstall the app (soft delete by setting is_active to false)
    const { error: uninstallError } = await supabase
      .from('user_app_installs')
      .update({ is_active: false })
      .eq('id', installation.id);

    if (uninstallError) {
      logger.error('Failed to uninstall app', { uninstallError, appId, userId: authResult.userId });
      respondWithError(res, 500, 'MARKETPLACE_APPS_ERROR', 'Failed to uninstall app');
      return;
    }

    const appName = (installation.plugin_marketplace_apps as any)?.name || 'App';

    res.json({
      ok: true,
      success: true,
      data: {
        appId,
        message: `Successfully uninstalled ${appName}`,
      },
    });
  } catch (error) {
    logger.error('Uninstall app endpoint error', { error });
    respondWithError(res, 500, 'MARKETPLACE_APPS_ERROR', 'Failed to uninstall app');
  }
}
