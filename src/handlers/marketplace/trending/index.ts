// @ts-nocheck
/**
 * Plugin Marketplace Trending Apps API Endpoint
 *
 * GET /api/v1/marketplace/trending?days_back=7&limit=10
 *
 * Retrieve trending apps based on installation count.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { asyncHandler } from '../../../middleware/error-handler';

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface QueryParams {
  days_back?: string;
  limit?: string;
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

function getLimit(limitParam: any, defaultLimit: number): number {
  if (!limitParam) return defaultLimit;
  const limit = parseInt(limitParam as string, 10);
  if (isNaN(limit) || limit < 0) return defaultLimit;
  return limit;
}

/**
 * Main trending apps handler
 */
async function getTrendingAppsHandler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
    return;
  }

  try {
    const params: QueryParams = req.query;
    const limit = getLimit(params.limit, 10);
    // Note: days_back parameter is for future use - currently we just get most installed

    const { data, error } = await supabase
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
      .order('install_count', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch trending apps', { error });
      res.status(500).json({
        error: 'Failed to fetch trending apps',
        code: 'MARKETPLACE_TRENDING_ERROR',
      });
      return;
    }

    const apps: AppData[] = (data ?? []) as AppData[];

    res.status(200).json({
      ok: true,
      success: true,
      data: apps,
    });
  } catch (error: any) {
    console.error('Trending apps endpoint error', { error });
    res.status(500).json({
      error: 'Failed to fetch trending apps',
      code: 'MARKETPLACE_TRENDING_ERROR',
    });
  }
}

// Export with middleware chain
export const handleTrendingApps = asyncHandler(getTrendingAppsHandler);
