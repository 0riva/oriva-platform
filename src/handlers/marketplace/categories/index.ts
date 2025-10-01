// @ts-nocheck - TODO: Fix type errors
/**
 * Marketplace Categories API Endpoint
 * 
 * GET /api/v1/marketplace/categories
 * 
 * Retrieve marketplace categories with item counts, hierarchy, and filtering options.
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

interface QueryParams {
  top_level?: string;
  parent_id?: string;
  search?: string;
  min_items?: string;
  exclude_empty?: string;
  include_inactive?: string;
}

interface CategoryData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  icon: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Generate slug from category name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Standard marketplace categories
 * These are predefined categories that always exist
 */
const STANDARD_CATEGORIES: Omit<CategoryData, 'created_at' | 'updated_at'>[] = [
  {
    id: 'ui-components',
    name: 'UI Components',
    slug: 'ui-components',
    description: 'Reusable UI components and design systems',
    parent_id: null,
    icon: '🎨',
    display_order: 1,
    is_active: true,
  },
  {
    id: 'templates',
    name: 'Templates',
    slug: 'templates',
    description: 'Ready-to-use application templates and starter kits',
    parent_id: null,
    icon: '📄',
    display_order: 2,
    is_active: true,
  },
  {
    id: 'extensions',
    name: 'Extensions',
    slug: 'extensions',
    description: 'Platform extensions and plugins',
    parent_id: null,
    icon: '🔌',
    display_order: 3,
    is_active: true,
  },
  {
    id: 'development-services',
    name: 'Development Services',
    slug: 'development-services',
    description: 'Professional development and consulting services',
    parent_id: null,
    icon: '💼',
    display_order: 4,
    is_active: true,
  },
  {
    id: 'design-assets',
    name: 'Design Assets',
    slug: 'design-assets',
    description: 'Icons, illustrations, and design resources',
    parent_id: null,
    icon: '🎭',
    display_order: 5,
    is_active: true,
  },
  {
    id: 'integrations',
    name: 'Integrations',
    slug: 'integrations',
    description: 'Third-party service integrations',
    parent_id: null,
    icon: '🔗',
    display_order: 6,
    is_active: true,
  },
  {
    id: 'themes',
    name: 'Themes',
    slug: 'themes',
    description: 'Visual themes and styling packages',
    parent_id: null,
    icon: '🌈',
    display_order: 7,
    is_active: true,
  },
  {
    id: 'utilities',
    name: 'Utilities',
    slug: 'utilities',
    description: 'Helper libraries and utility tools',
    parent_id: null,
    icon: '🔧',
    display_order: 8,
    is_active: true,
  },
];

/**
 * Get item count for a specific category
 */
async function getCategoryItemCount(
  categoryId: string,
  includeInactive: boolean
): Promise<number> {
  let query = supabase
    .from('entries')
    .select('id', { count: 'exact', head: true })
    .eq('entry_type', 'marketplace_item')
    .eq('marketplace_metadata->>category_id', categoryId);

  // Filter by status unless including inactive
  if (!includeInactive) {
    query = query.eq('marketplace_metadata->>status', 'active');
  }

  const { count, error } = await query;

  if (error) {
    console.error(`Error counting items for category ${categoryId}:`, error);
    return 0;
  }

  return count || 0;
}

/**
 * Validate query parameters
 */
function validateQueryParams(params: QueryParams): void {
  const { parent_id, min_items } = params;

  // Validate parent_id format (UUID)
  if (parent_id && !parent_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    // Allow standard category IDs (slugs) as well
    if (!parent_id.match(/^[a-z0-9-]+$/)) {
      throw validationError('Invalid parent_id format. Must be a valid UUID or category slug');
    }
  }

  // Validate min_items
  if (min_items !== undefined) {
    const minItemsNum = parseInt(min_items, 10);
    if (isNaN(minItemsNum) || minItemsNum < 0) {
      throw validationError('min_items must be a non-negative integer');
    }
  }
}

/**
 * Filter categories based on query parameters
 */
function filterCategories(
  categories: any[],
  params: QueryParams
): any[] {
  let filtered = categories;

  // Filter by top-level only
  if (params.top_level === 'true') {
    filtered = filtered.filter(cat => cat.parent_id === null);
  }

  // Filter by parent_id
  if (params.parent_id) {
    filtered = filtered.filter(cat => cat.parent_id === params.parent_id);
  }

  // Filter by search query
  if (params.search) {
    const searchLower = params.search.toLowerCase();
    filtered = filtered.filter(cat => 
      cat.name.toLowerCase().includes(searchLower) ||
      cat.description?.toLowerCase().includes(searchLower)
    );
  }

  // Filter by minimum items
  if (params.min_items !== undefined) {
    const minItemsNum = parseInt(params.min_items, 10);
    filtered = filtered.filter(cat => cat.item_count >= minItemsNum);
  }

  // Exclude empty categories
  if (params.exclude_empty === 'true') {
    filtered = filtered.filter(cat => cat.item_count > 0);
  }

  return filtered;
}

/**
 * Main categories handler
 */
async function getCategoriesHandler(
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

  // Parse and validate query parameters
  const params: QueryParams = req.query;

  try {
    validateQueryParams(params);
  } catch (error: any) {
    res.status(400).json({
      error: error.message,
      code: error.code || 'VALIDATION_ERROR',
    });
    return;
  }

  try {
    const includeInactive = params.include_inactive === 'true';

    // Start with standard categories
    const now = new Date().toISOString();
    let categories: any[] = STANDARD_CATEGORIES.map(cat => ({
      ...cat,
      created_at: now,
      updated_at: now,
    }));

    // Check if we have custom categories in the database
    // For now, we'll use the standard categories only
    // In a production system, this would query a marketplace_categories table
    
    // Get item counts for each category
    const categoriesWithCounts = await Promise.all(
      categories.map(async (category) => {
        const itemCount = await getCategoryItemCount(category.id, includeInactive);
        return {
          ...category,
          item_count: itemCount,
        };
      })
    );

    // Apply filters
    const filteredCategories = filterCategories(categoriesWithCounts, params);

    // Sort by display_order
    filteredCategories.sort((a, b) => a.display_order - b.display_order);

    // Set cache headers (categories change infrequently)
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600'); // 5 min client, 10 min CDN

    res.status(200).json({
      categories: filteredCategories,
      total: filteredCategories.length,
    });
  } catch (error: any) {
    console.error('Categories error:', error);
    res.status(500).json({
      error: 'Internal server error retrieving categories',
      code: 'INTERNAL_ERROR',
    });
  }
}

// Export with middleware chain
export const handleCategories = asyncHandler(getCategoriesHandler);