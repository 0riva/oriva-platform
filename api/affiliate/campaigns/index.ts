/**
 * List Affiliate Campaigns Endpoint (T147)
 *
 * GET /api/affiliate/campaigns
 *
 * Lists all affiliate campaigns for the authenticated user.
 *
 * Query Parameters:
 * - status?: 'active' | 'inactive' | 'all' (default: 'all')
 * - page?: number (default: 0)
 * - limit?: number (default: 20, max: 100)
 * - sort?: 'created_at' | 'name' | 'conversions' (default: 'created_at')
 * - order?: 'asc' | 'desc' (default: 'desc')
 *
 * Authorization: Required
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

interface ListCampaignsQuery {
  status?: 'active' | 'inactive' | 'all';
  page?: number;
  limit?: number;
  sort?: 'created_at' | 'name' | 'total_conversions';
  order?: 'asc' | 'desc';
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Initialize Supabase client with user's auth token
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid authentication' });
    }

    // Parse query parameters
    const {
      status = 'all',
      page = 0,
      limit = 20,
      sort = 'created_at',
      order = 'desc',
    } = req.query as Partial<ListCampaignsQuery>;

    // Validate and sanitize pagination
    const pageNum = Math.max(0, Number(page) || 0);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = pageNum * limitNum;

    // Build query
    let query = supabase
      .from('affiliate_campaigns')
      .select(`
        *,
        entries!inner(
          id,
          content,
          marketplace_metadata
        ),
        affiliate_analytics(
          total_clicks,
          total_conversions,
          conversion_rate,
          total_commission_earned
        )
      `, { count: 'exact' })
      .eq('affiliate_id', user.id);

    // Filter by status
    if (status === 'active') {
      query = query.eq('is_active', true);
    } else if (status === 'inactive') {
      query = query.eq('is_active', false);
    }

    // Sort
    const sortField = ['created_at', 'name', 'total_conversions'].includes(String(sort))
      ? String(sort)
      : 'created_at';
    const sortOrder = order === 'asc' ? { ascending: true } : { ascending: false };

    query = query.order(sortField, sortOrder);

    // Pagination
    query = query.range(offset, offset + limitNum - 1);

    // Execute query
    const { data: campaigns, error: queryError, count } = await query;

    if (queryError) {
      console.error('Campaign list error:', queryError);
      return res.status(500).json({ error: 'Failed to fetch campaigns' });
    }

    // Calculate pagination metadata
    const totalPages = count ? Math.ceil(count / limitNum) : 0;
    const hasNext = pageNum < totalPages - 1;
    const hasPrev = pageNum > 0;

    // Return success with campaigns and pagination
    return res.status(200).json({
      success: true,
      campaigns: campaigns || [],
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        totalPages,
        hasNext,
        hasPrev,
      },
    });
  } catch (error) {
    console.error('Campaign list error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
