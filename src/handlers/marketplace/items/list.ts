// @ts-nocheck - TODO: Fix type errors
// Task: T041 - GET /api/v1/marketplace/items endpoint
// Description: List and search marketplace items with filtering and pagination

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseClient } from '../../../config/supabase';
import { asyncHandler, validationError } from '../../../middleware/error-handler';
import { rateLimit } from '../../../middleware/rate-limit';

interface QueryParams {
  page?: string;
  limit?: string;
  item_type?: string;
  category_id?: string;
  min_price?: string;
  max_price?: string;
  status?: string;
  seller_id?: string;
  search?: string;
}

async function getMarketplaceItemsHandler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const {
    page = '1',
    limit = '20',
    item_type,
    category_id,
    min_price,
    max_price,
    status,
    seller_id,
    search,
  }: QueryParams = req.query;

  // Validate pagination parameters
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);

  if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
    throw validationError('Invalid pagination parameters. Page must be >= 1, limit must be between 1 and 100');
  }

  // Validate price range
  if (min_price && isNaN(parseFloat(min_price))) {
    throw validationError('Invalid min_price parameter');
  }
  if (max_price && isNaN(parseFloat(max_price))) {
    throw validationError('Invalid max_price parameter');
  }

  const supabase = getSupabaseClient();

  // Build query using marketplace_items table
  // Note: marketplace_items are stored as entries with marketplace_metadata
  let query = supabase
    .from('entries')
    .select('*', { count: 'exact' })
    .not('marketplace_metadata', 'is', null);

  // Apply filters
  if (item_type) {
    query = query.eq('marketplace_metadata->>item_type', item_type);
  }

  if (category_id) {
    query = query.eq('marketplace_metadata->>category_id', category_id);
  }

  if (min_price) {
    query = query.gte('marketplace_metadata->>price', parseFloat(min_price));
  }

  if (max_price) {
    query = query.lte('marketplace_metadata->>price', parseFloat(max_price));
  }

  if (status) {
    query = query.eq('marketplace_metadata->>status', status);
  } else {
    // Default: only show published items to public
    query = query.eq('marketplace_metadata->>status', 'published');
  }

  if (seller_id) {
    query = query.eq('user_id', seller_id);
  }

  if (search) {
    // Simple text search on title and description
    query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
  }

  // Apply pagination
  const offset = (pageNum - 1) * limitNum;
  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + limitNum - 1);

  const { data: items, error, count } = await query;

  if (error) {
    console.error('Error fetching marketplace items:', error);
    res.status(500).json({
      error: 'Failed to fetch marketplace items',
      code: 'DATABASE_ERROR',
    });
    return;
  }

  // Transform data to marketplace item format
  const transformedItems = (items || []).map((entry) => {
    const metadata = entry.marketplace_metadata || {};
    return {
      id: entry.id,
      title: entry.title,
      description: entry.content,
      price: metadata.price || 0,
      currency: metadata.currency || 'USD',
      item_type: metadata.item_type || 'digital_product',
      category_id: metadata.category_id || null,
      seller_id: entry.user_id,
      status: metadata.status || 'draft',
      inventory_count: metadata.inventory_count || null,
      metadata: metadata.custom_metadata || {},
      created_at: entry.created_at,
      updated_at: entry.updated_at,
    };
  });

  res.status(200).json({
    items: transformedItems,
    total: count || 0,
    page: pageNum,
    limit: limitNum,
    total_pages: Math.ceil((count || 0) / limitNum),
  });
}

// Export with middleware chain
export async function handleListItems(req: VercelRequest, res: VercelResponse): Promise<void> {
  await rateLimit(req, res, async () => {
    await asyncHandler(getMarketplaceItemsHandler)(req, res);
  });
}