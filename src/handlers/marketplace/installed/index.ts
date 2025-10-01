/**
 * Marketplace Installed Apps API Endpoint
 *
 * GET /api/v1/marketplace/installed
 *
 * Retrieve user's installed marketplace apps.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { authenticate } from '../../../middleware/auth';
import { asyncHandler } from '../../../middleware/error-handler';

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface QueryParams {
  limit?: string;
  offset?: string;
}

interface MarketplaceApp {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  category: string;
  icon_url: string | null;
  version: string;
  developer_name: string;
  install_count: number;
}

interface InstallRow {
  id: string;
  app_id: string;
  installed_at: string;
  is_active: boolean;
  app_settings: Record<string, unknown> | null;
  plugin_marketplace_apps: MarketplaceApp;
}

interface InstalledAppSummary {
  installationId: string;
  installedAt: string;
  isActive: boolean;
  settings: Record<string, unknown> | null;
  app: MarketplaceApp;
}

/**
 * Get limit from query param with validation
 */
function getLimit(limitParam: any, defaultLimit: number, maxLimit: number): number {
  if (!limitParam) return defaultLimit;
  const limit = parseInt(limitParam as string, 10);
  if (isNaN(limit) || limit < 0) return defaultLimit;
  return Math.min(limit, maxLimit);
}

/**
 * Get offset from query param with validation
 */
function getOffset(offsetParam: any, defaultOffset: number): number {
  if (!offsetParam) return defaultOffset;
  const offset = parseInt(offsetParam as string, 10);
  if (isNaN(offset) || offset < 0) return defaultOffset;
  return offset;
}

/**
 * Main installed apps handler
 */
async function getInstalledAppsHandler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
    return;
  }

  // Authenticate user
  const user = await authenticate(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    return;
  }

  try {
    const params: QueryParams = req.query;
    const limit = getLimit(params.limit, 50, 100);
    const offset = getOffset(params.offset, 0);

    const { data, error } = await supabase
      .from('user_app_installs')
      .select(`
        id,
        app_id,
        installed_at,
        is_active,
        app_settings,
        plugin_marketplace_apps!user_app_installs_app_id_fkey (
          id,
          name,
          slug,
          tagline,
          description,
          category,
          icon_url,
          version,
          developer_name,
          install_count
        )
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('installed_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Failed to fetch installed apps', { error, userId: user.id });
      res.status(500).json({
        error: 'Failed to fetch apps',
        code: 'MARKETPLACE_APPS_ERROR'
      });
      return;
    }

    const installs: InstalledAppSummary[] = ((data ?? []) as unknown as InstallRow[]).map(install => ({
      installationId: install.id,
      installedAt: install.installed_at,
      isActive: install.is_active,
      settings: install.app_settings,
      app: install.plugin_marketplace_apps
    }));

    const pagination = {
      page: limit === 0 ? 1 : Math.floor(offset / limit) + 1,
      limit,
      total: installs.length,
      totalPages: limit === 0 ? 0 : Math.ceil(installs.length / limit)
    };

    res.status(200).json({
      ok: true,
      success: true,
      data: installs,
      meta: { pagination }
    });
  } catch (error: any) {
    console.error('Installed apps endpoint error', { error, userId: user.id });
    res.status(500).json({
      error: 'Failed to fetch apps',
      code: 'MARKETPLACE_APPS_ERROR'
    });
  }
}

// Export with middleware chain
export const handleInstalledApps = asyncHandler(getInstalledAppsHandler);
