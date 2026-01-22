// @ts-nocheck
/**
 * Plugin Marketplace Apps API Endpoint
 *
 * GET /api/v1/marketplace/apps
 *
 * Retrieve list of available plugin marketplace apps.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { asyncHandler } from '../../../middleware/error-handler';

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface QueryParams {
  limit?: string;
  offset?: string;
  category?: string;
  search?: string;
}

interface AppData {
  id: string;
  name: string;
  slug: string | null;
  tagline: string | null;
  description: string | null;
  category: string;
  icon_url: string | null;
  version: string;
  developer_id: string | null;
  developer_name: string;
  install_count: number;
  rating_average?: number;
  rating_count?: number;
  status: string;
  is_active: boolean;
  pricing_model?: string | null;
  pricing_config?: Record<string, unknown> | null;
  screenshots?: string[] | null;
  created_at: string;
  updated_at: string;
}

function getLimit(limitParam: any, defaultLimit: number, maxLimit: number): number {
  if (!limitParam) return defaultLimit;
  const limit = parseInt(limitParam as string, 10);
  if (isNaN(limit) || limit < 0) return defaultLimit;
  return Math.min(limit, maxLimit);
}

function getOffset(offsetParam: any, defaultOffset: number): number {
  if (!offsetParam) return defaultOffset;
  const offset = parseInt(offsetParam as string, 10);
  if (isNaN(offset) || offset < 0) return defaultOffset;
  return offset;
}

/**
 * Fetch from plugin_marketplace_apps table (extensions/plugins)
 */
async function fetchPluginApps(
  params: QueryParams,
  limit: number,
  offset: number
): Promise<AppData[]> {
  let query = supabase
    .from('plugin_marketplace_apps')
    .select(
      `
      id,
      name,
      slug,
      tagline,
      description,
      category,
      icon_url,
      version,
      developer_id,
      developer_name,
      install_count,
      rating_average,
      rating_count,
      status,
      is_active,
      pricing_model,
      pricing_config,
      screenshots,
      created_at,
      updated_at
    `
    )
    .eq('status', 'approved')
    .eq('is_active', true)
    .order('install_count', { ascending: false });

  if (params.category) {
    query = query.eq('category', params.category);
  }

  if (params.search) {
    query = query.or(`name.ilike.%${params.search}%,tagline.ilike.%${params.search}%`);
  }

  if (limit > 0) {
    query = query.range(offset, offset + limit - 1);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to fetch plugin apps', { error });
    return [];
  }

  return (data ?? []).map((app: any) => ({ ...app, source: 'plugin' })) as AppData[];
}

/**
 * Fetch from marketplace_apps table (products, services, content)
 */
async function fetchMarketplaceApps(
  params: QueryParams,
  limit: number,
  offset: number
): Promise<{ apps: AppData[]; debugInfo: any }> {
  // Check if table exists and what's in it (for debugging)
  const { data: allData, error: allError } = await supabase
    .from('marketplace_apps')
    .select('id, name, status, category')
    .limit(20);

  const debugInfo = {
    tableExists: !allError?.message?.includes('does not exist'),
    totalRows: allData?.length || 0,
    error: allError?.message || null,
    sampleEntries:
      allData?.slice(0, 5).map((a: any) => ({
        name: a.name,
        status: a.status,
        category: a.category,
      })) || [],
  };

  if (allError) {
    console.error('[Marketplace Apps] Error querying marketplace_apps:', allError);
    return { apps: [], debugInfo };
  }

  let query = supabase
    .from('marketplace_apps')
    .select(
      `
      id,
      name,
      slug,
      tagline,
      description,
      category,
      icon_url,
      version,
      developer_id,
      developer_name,
      install_count,
      rating_average,
      rating_count,
      status,
      pricing_model,
      pricing_config,
      screenshots,
      created_at,
      updated_at
    `
    )
    // Include both 'approved' and 'review' statuses
    .in('status', ['approved', 'review'])
    .order('install_count', { ascending: false, nullsFirst: false });

  if (params.category) {
    query = query.eq('category', params.category);
  }

  if (params.search) {
    query = query.or(`name.ilike.%${params.search}%,tagline.ilike.%${params.search}%`);
  }

  if (limit > 0) {
    query = query.range(offset, offset + limit - 1);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to fetch marketplace apps', { error });
    return { apps: [], debugInfo };
  }

  // Add is_active: true for compatibility (marketplace_apps doesn't have this field)
  return {
    apps: (data ?? []).map((app: any) => ({
      ...app,
      is_active: true,
      source: 'marketplace',
    })) as AppData[],
    debugInfo,
  };
}

/**
 * Main apps handler - queries BOTH plugin_marketplace_apps AND marketplace_apps tables
 */
async function getAppsHandler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
    return;
  }

  try {
    const params: QueryParams = req.query;
    const limit = getLimit(params.limit, 50, 100);
    const offset = getOffset(params.offset, 0);

    // Fetch from BOTH tables in parallel
    const [pluginApps, marketplaceResult] = await Promise.all([
      fetchPluginApps(params, limit, offset),
      fetchMarketplaceApps(params, limit, offset),
    ]);

    const { apps: marketplaceApps, debugInfo: marketplaceDebugInfo } = marketplaceResult;

    console.log('[Marketplace Apps] Fetched:', {
      pluginApps: pluginApps.length,
      marketplaceApps: marketplaceApps.length,
      marketplaceDebugInfo,
    });

    // Merge results - marketplace apps first (products/services), then plugins
    const allApps = [...marketplaceApps, ...pluginApps];

    // Deduplicate by id (in case same app exists in both tables)
    const seenIds = new Set<string>();
    const apps: AppData[] = allApps.filter((app) => {
      if (seenIds.has(app.id)) return false;
      seenIds.add(app.id);
      return true;
    });

    const pagination = {
      page: limit === 0 ? 1 : Math.floor(offset / limit) + 1,
      limit,
      total: apps.length,
      totalPages: limit === 0 ? 0 : Math.ceil(apps.length / limit),
    };

    res.status(200).json({
      ok: true,
      success: true,
      data: apps,
      meta: { pagination },
      _debug: {
        pluginAppsCount: pluginApps.length,
        marketplaceAppsCount: marketplaceApps.length,
        totalMerged: allApps.length,
        afterDedup: apps.length,
        marketplaceTable: marketplaceDebugInfo,
      },
    });
  } catch (error: any) {
    console.error('Apps endpoint error', { error });
    res.status(500).json({
      error: 'Failed to fetch apps',
      code: 'MARKETPLACE_APPS_ERROR',
    });
  }
}

// Export with middleware chain
export const handleApps = asyncHandler(getAppsHandler);
