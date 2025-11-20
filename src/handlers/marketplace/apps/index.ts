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
 * Main apps handler
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

    // Apply category filter
    if (params.category) {
      query = query.eq('category', params.category);
    }

    // Apply search filter
    if (params.search) {
      query = query.or(`name.ilike.%${params.search}%,tagline.ilike.%${params.search}%`);
    }

    // Apply pagination
    if (limit > 0) {
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Failed to fetch apps', { error });
      res.status(500).json({
        error: 'Failed to fetch apps',
        code: 'MARKETPLACE_APPS_ERROR',
      });
      return;
    }

    const apps: AppData[] = (data ?? []) as AppData[];

    const pagination = {
      page: limit === 0 ? 1 : Math.floor(offset / limit) + 1,
      limit,
      total: apps.length,
      totalPages: limit === 0 ? 0 : Math.ceil((count || 0) / limit),
    };

    res.status(200).json({
      ok: true,
      success: true,
      data: apps,
      meta: { pagination },
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
