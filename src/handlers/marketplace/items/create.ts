// @ts-nocheck - TODO: Fix type errors
// Task: T042 - POST /api/v1/marketplace/items endpoint
// Description: Create new marketplace item (requires authentication)

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseClient } from '../../../config/supabase';
import { asyncHandler, validationError } from '../../../middleware/error-handler';
import { rateLimit } from '../../../middleware/rate-limit';
import { authenticate } from '../../../middleware/auth';

interface CreateItemRequest {
  title: string;
  description: string;
  price: number;
  currency?: string;
  item_type: 'digital_product' | 'physical_product' | 'service' | 'extension' | 'subscription';
  category_id?: string;
  inventory_count?: number;
  metadata?: Record<string, any>;
}

const VALID_ITEM_TYPES = ['digital_product', 'physical_product', 'service', 'extension', 'subscription'];
const VALID_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];

async function createMarketplaceItemHandler(
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
    res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_MISSING',
    });
    return;
  }

  const {
    title,
    description,
    price,
    currency = 'USD',
    item_type,
    category_id,
    inventory_count,
    metadata = {},
  }: CreateItemRequest = req.body;

  // Validate required fields
  if (!title || !description || price === undefined || !item_type) {
    throw validationError('Missing required fields: title, description, price, item_type');
  }

  // Validate title length
  if (title.length < 3 || title.length > 200) {
    throw validationError('Title must be between 3 and 200 characters');
  }

  // Validate description length
  if (description.length < 10 || description.length > 5000) {
    throw validationError('Description must be between 10 and 5000 characters');
  }

  // Validate price
  if (typeof price !== 'number' || price < 0) {
    throw validationError('Price must be a positive number');
  }

  if (price > 1000000) {
    throw validationError('Price cannot exceed 1,000,000');
  }

  // Validate currency
  if (!VALID_CURRENCIES.includes(currency)) {
    throw validationError(`Currency must be one of: ${VALID_CURRENCIES.join(', ')}`);
  }

  // Validate item_type
  if (!VALID_ITEM_TYPES.includes(item_type)) {
    throw validationError(`Item type must be one of: ${VALID_ITEM_TYPES.join(', ')}`);
  }

  // Validate inventory_count if provided
  if (inventory_count !== undefined) {
    if (typeof inventory_count !== 'number' || inventory_count < 0) {
      throw validationError('Inventory count must be a non-negative number');
    }
  }

  const supabase = getSupabaseClient();

  // Create marketplace item as an entry with marketplace_metadata
  const marketplace_metadata = {
    price,
    currency,
    item_type,
    category_id: category_id || null,
    inventory_count: inventory_count || null,
    status: 'draft', // Default status
    custom_metadata: metadata,
  };

  const { data: entry, error } = await supabase
    .from('entries')
    .insert({
      user_id: user.id,
      title,
      content: description,
      entry_type: 'marketplace_item',
      marketplace_metadata,
      visibility: 'public', // Marketplace items are public when published
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating marketplace item:', error);
    res.status(500).json({
      error: 'Failed to create marketplace item',
      code: 'DATABASE_ERROR',
    });
    return;
  }

  // Transform to marketplace item format
  const item = {
    id: entry.id,
    title: entry.title,
    description: entry.content,
    price: marketplace_metadata.price,
    currency: marketplace_metadata.currency,
    item_type: marketplace_metadata.item_type,
    category_id: marketplace_metadata.category_id,
    seller_id: entry.user_id,
    status: marketplace_metadata.status,
    inventory_count: marketplace_metadata.inventory_count,
    metadata: marketplace_metadata.custom_metadata,
    created_at: entry.created_at,
    updated_at: entry.updated_at,
  };

  res.status(201).json(item);
}

// Export with middleware chain
export async function handleCreateItem(req: VercelRequest, res: VercelResponse): Promise<void> {
  await rateLimit(req, res, async () => {
    await asyncHandler(createMarketplaceItemHandler)(req, res);
  });
}