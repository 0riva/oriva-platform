/**
 * Marketplace Search API Endpoint
 * 
 * POST /api/v1/marketplace/search
 * 
 * Search marketplace items with text search, filters, sorting, and pagination.
 * Supports semantic search when available, with fallback to text search.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { authenticate } from '../../../middleware/auth';
import { asyncHandler } from '../../../middleware/error-handler';
import { rateLimit } from '../../../middleware/rate-limit';
import { validationError } from '../../../middleware/error-handler';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface SearchFilters {
  item_type?: string;
  category_id?: string;
  min_price?: number;
  max_price?: number;
  seller_id?: string;
  status?: 'draft' | 'active' | 'inactive' | 'sold_out';
}

interface SearchRequest {
  query?: string;
  filters?: SearchFilters;
  sort?: 'price' | 'created_at' | 'updated_at' | 'relevance';
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  semantic?: boolean;
}

/**
 * Transform entry with marketplace_metadata to marketplace item format
 */
function transformToMarketplaceItem(entry: any): any {
  const metadata = entry.marketplace_metadata || {};
  
  return {
    id: entry.id,
    title: entry.title,
    description: entry.content,
    price: metadata.price,
    currency: metadata.currency || 'USD',
    item_type: metadata.item_type,
    category_id: metadata.category_id,
    seller_id: entry.user_id,
    status: metadata.status || 'draft',
    inventory_count: metadata.inventory_count,
    metadata: metadata.custom_metadata || {},
    created_at: entry.created_at,
    updated_at: entry.updated_at,
  };
}

/**
 * Validate search request parameters
 */
function validateSearchRequest(body: SearchRequest): void {
  const { filters, sort, order, page, limit } = body;

  // Validate sort field
  if (sort && !['price', 'created_at', 'updated_at', 'relevance'].includes(sort)) {
    throw validationError('Invalid sort field. Must be one of: price, created_at, updated_at, relevance');
  }

  // Validate order
  if (order && !['asc', 'desc'].includes(order)) {
    throw validationError('Invalid order. Must be either "asc" or "desc"');
  }

  // Validate pagination
  if (page !== undefined && (typeof page !== 'number' || page < 1)) {
    throw validationError('Page must be a positive integer');
  }

  if (limit !== undefined && (typeof limit !== 'number' || limit < 1 || limit > 100)) {
    throw validationError('Limit must be a positive integer not exceeding 100');
  }

  // Validate price range
  if (filters?.min_price !== undefined && filters?.max_price !== undefined) {
    if (filters.min_price > filters.max_price) {
      throw validationError('min_price cannot be greater than max_price');
    }
  }

  if (filters?.min_price !== undefined && (typeof filters.min_price !== 'number' || filters.min_price < 0)) {
    throw validationError('min_price must be a non-negative number');
  }

  if (filters?.max_price !== undefined && (typeof filters.max_price !== 'number' || filters.max_price < 0)) {
    throw validationError('max_price must be a non-negative number');
  }
}

/**
 * Perform text-based search on marketplace items
 */
async function performTextSearch(
  query: string,
  filters: SearchFilters,
  sort: string,
  order: string,
  page: number,
  limit: number
): Promise<{ items: any[]; total: number }> {
  // Start with base query - only items with marketplace_metadata and active status
  let supabaseQuery = supabase
    .from('entries')
    .select('*', { count: 'exact' })
    .eq('entry_type', 'marketplace_item')
    .not('marketplace_metadata', 'is', null);

  // Filter by status (default to active only)
  const status = filters.status || 'active';
  supabaseQuery = supabaseQuery.eq('marketplace_metadata->>status', status);

  // Apply text search if query provided
  if (query && query.trim()) {
    // Search in title and content (description)
    // Using ilike for case-insensitive pattern matching
    supabaseQuery = supabaseQuery.or(
      `title.ilike.%${query}%,content.ilike.%${query}%`
    );
  }

  // Apply filters
  if (filters.item_type) {
    supabaseQuery = supabaseQuery.eq('marketplace_metadata->>item_type', filters.item_type);
  }

  if (filters.category_id) {
    supabaseQuery = supabaseQuery.eq('marketplace_metadata->>category_id', filters.category_id);
  }

  if (filters.seller_id) {
    supabaseQuery = supabaseQuery.eq('user_id', filters.seller_id);
  }

  // Price range filtering requires casting JSONB to numeric
  if (filters.min_price !== undefined) {
    supabaseQuery = supabaseQuery.gte('marketplace_metadata->>price', filters.min_price.toString());
  }

  if (filters.max_price !== undefined) {
    supabaseQuery = supabaseQuery.lte('marketplace_metadata->>price', filters.max_price.toString());
  }

  // Apply sorting
  let orderColumn = 'created_at';
  let orderDirection: 'asc' | 'desc' = order === 'asc' ? 'asc' : 'desc';

  if (sort === 'price') {
    // For price sorting, we need to cast the JSONB field to numeric
    // This is a limitation - we'll fetch and sort in memory for price
    orderColumn = 'marketplace_metadata->>price';
  } else if (sort === 'created_at') {
    orderColumn = 'created_at';
  } else if (sort === 'updated_at') {
    orderColumn = 'updated_at';
  } else if (sort === 'relevance' && query) {
    // For relevance, prioritize exact matches in title
    // This is basic relevance - could be enhanced with vector search
    orderColumn = 'title';
    orderDirection = 'asc';
  }

  supabaseQuery = supabaseQuery.order(orderColumn, { ascending: orderDirection === 'asc' });

  // Apply pagination
  const offset = (page - 1) * limit;
  supabaseQuery = supabaseQuery.range(offset, offset + limit - 1);

  // Execute query
  const { data: entries, error, count } = await supabaseQuery;

  if (error) {
    console.error('Search query error:', error);
    throw new Error('Failed to search marketplace items');
  }

  // Handle price sorting in memory if needed
  let sortedEntries = entries || [];
  if (sort === 'price' && sortedEntries.length > 0) {
    sortedEntries.sort((a, b) => {
      const priceA = parseFloat(a.marketplace_metadata?.price || '0');
      const priceB = parseFloat(b.marketplace_metadata?.price || '0');
      return orderDirection === 'asc' ? priceA - priceB : priceB - priceA;
    });
  }

  // Transform entries to marketplace items
  const items = sortedEntries.map(transformToMarketplaceItem);

  return {
    items,
    total: count || 0,
  };
}

/**
 * Perform semantic search using vector embeddings (if available)
 * Falls back to text search if semantic search is not available
 */
async function performSemanticSearch(
  query: string,
  filters: SearchFilters,
  sort: string,
  order: string,
  page: number,
  limit: number
): Promise<{ items: any[]; total: number }> {
  // Check if pgvector extension and embeddings are available
  // For now, we'll fallback to text search
  // This would be enhanced with actual vector similarity search
  
  try {
    // TODO: Implement vector similarity search when embeddings are available
    // Example: SELECT * FROM entries 
    //          WHERE marketplace_metadata IS NOT NULL
    //          ORDER BY embedding <-> query_embedding
    //          LIMIT ?
    
    // For now, fallback to text search
    console.log('Semantic search requested but not yet implemented, falling back to text search');
    return await performTextSearch(query, filters, sort, order, page, limit);
  } catch (error) {
    console.error('Semantic search error, falling back to text search:', error);
    return await performTextSearch(query, filters, sort, order, page, limit);
  }
}

/**
 * Main search handler
 */
async function searchMarketplaceHandler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
    return;
  }

  // Authenticate user
  const user = await authenticate(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    return;
  }

  // Parse and validate request body
  const {
    query = '',
    filters = {},
    sort = 'relevance',
    order = 'desc',
    page = 1,
    limit = 20,
    semantic = false,
  }: SearchRequest = req.body;

  // Validate request
  try {
    validateSearchRequest({ query, filters, sort, order, page, limit, semantic });
  } catch (error: any) {
    res.status(400).json({
      error: error.message,
      code: error.code || 'VALIDATION_ERROR',
    });
    return;
  }

  // Perform search
  try {
    const searchResults = semantic && query
      ? await performSemanticSearch(query, filters, sort, order, page, limit)
      : await performTextSearch(query, filters, sort, order, page, limit);

    res.status(200).json({
      items: searchResults.items,
      total: searchResults.total,
      page,
      limit,
      has_more: searchResults.total > page * limit,
    });
  } catch (error: any) {
    console.error('Search error:', error);
    res.status(500).json({
      error: 'Internal server error during search',
      code: 'INTERNAL_ERROR',
    });
  }
}

// Export with middleware chain
export const handleSearch = asyncHandler(searchMarketplaceHandler);