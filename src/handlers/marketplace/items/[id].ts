// @ts-nocheck - TODO: Fix type errors
// Task: T043 - GET/PUT/DELETE /api/v1/marketplace/items/:id endpoint
// Description: CRUD operations for individual marketplace items

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseClient } from '../../../config/supabase';
import { asyncHandler, validationError } from '../../../middleware/error-handler';
import { rateLimit } from '../../../middleware/rate-limit';
import { authenticate } from '../../../middleware/auth';

interface UpdateItemRequest {
  title?: string;
  description?: string;
  price?: number;
  currency?: string;
  item_type?: 'digital_product' | 'physical_product' | 'service' | 'extension' | 'subscription';
  category_id?: string;
  inventory_count?: number;
  status?: 'draft' | 'published' | 'archived';
  metadata?: Record<string, any>;
}

const VALID_ITEM_TYPES = [
  'digital_product',
  'physical_product',
  'service',
  'extension',
  'subscription',
];
const VALID_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];
const VALID_STATUSES = ['draft', 'published', 'archived'];

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getMarketplaceItemHandler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    throw validationError('Item ID is required');
  }

  if (!UUID_REGEX.test(id)) {
    throw validationError('Invalid item ID format');
  }

  const supabase = getSupabaseClient();

  const { data: entry, error } = await supabase
    .from('entries')
    .select('*')
    .eq('id', id)
    .not('marketplace_metadata', 'is', null)
    .single();

  if (error || !entry) {
    res.status(404).json({
      error: 'Marketplace item not found',
      code: 'ITEM_NOT_FOUND',
    });
    return;
  }

  const metadata = entry.marketplace_metadata || {};

  // Transform to marketplace item format
  const item = {
    id: entry.id,
    title: entry.title,
    description: entry.content,
    price: metadata.price || 0,
    currency: metadata.currency || 'USD',
    item_type: metadata.item_type || 'digital_product',
    category_id: metadata.category_id || null,
    category_ids: metadata.category_ids || [],
    topic_ids: metadata.topic_ids || [],
    seller_id: entry.user_id,
    seller_name: metadata.seller_name || null,
    seller_avatar: metadata.seller_avatar || null,
    profile_id: metadata.profile_id || null,
    status: metadata.status || 'draft',
    inventory_count: metadata.inventory_count || null,
    metadata: metadata.custom_metadata || {},
    created_at: entry.created_at,
    updated_at: entry.updated_at,
  };

  res.status(200).json(item);
}

async function updateMarketplaceItemHandler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    throw validationError('Item ID is required');
  }

  if (!UUID_REGEX.test(id)) {
    throw validationError('Invalid item ID format');
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
    currency,
    item_type,
    category_id,
    inventory_count,
    status,
    metadata,
  }: UpdateItemRequest = req.body;

  // Validate at least one field is being updated
  if (
    !title &&
    !description &&
    price === undefined &&
    !currency &&
    !item_type &&
    !category_id &&
    inventory_count === undefined &&
    !status &&
    !metadata
  ) {
    throw validationError('At least one field must be provided for update');
  }

  const supabase = getSupabaseClient();

  // Fetch existing item
  const { data: existingEntry, error: fetchError } = await supabase
    .from('entries')
    .select('*')
    .eq('id', id)
    .not('marketplace_metadata', 'is', null)
    .single();

  if (fetchError || !existingEntry) {
    res.status(404).json({
      error: 'Marketplace item not found',
      code: 'ITEM_NOT_FOUND',
    });
    return;
  }

  // Check ownership
  if (existingEntry.user_id !== user.id) {
    res.status(403).json({
      error: 'You do not have permission to update this item',
      code: 'FORBIDDEN',
    });
    return;
  }

  // Validate updates
  if (title && (title.length < 3 || title.length > 200)) {
    throw validationError('Title must be between 3 and 200 characters');
  }

  if (description && (description.length < 10 || description.length > 5000)) {
    throw validationError('Description must be between 10 and 5000 characters');
  }

  if (price !== undefined && (typeof price !== 'number' || price < 0 || price > 1000000)) {
    throw validationError('Price must be a positive number not exceeding 1,000,000');
  }

  if (currency && !VALID_CURRENCIES.includes(currency)) {
    throw validationError(`Currency must be one of: ${VALID_CURRENCIES.join(', ')}`);
  }

  if (item_type && !VALID_ITEM_TYPES.includes(item_type)) {
    throw validationError(`Item type must be one of: ${VALID_ITEM_TYPES.join(', ')}`);
  }

  if (status && !VALID_STATUSES.includes(status)) {
    throw validationError(`Status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  if (
    inventory_count !== undefined &&
    (typeof inventory_count !== 'number' || inventory_count < 0)
  ) {
    throw validationError('Inventory count must be a non-negative number');
  }

  // Build updated marketplace_metadata
  const existingMetadata = existingEntry.marketplace_metadata || {};
  const updatedMetadata = {
    ...existingMetadata,
    ...(price !== undefined && { price }),
    ...(currency && { currency }),
    ...(item_type && { item_type }),
    ...(category_id !== undefined && { category_id }),
    ...(inventory_count !== undefined && { inventory_count }),
    ...(status && { status }),
    ...(metadata && { custom_metadata: { ...existingMetadata.custom_metadata, ...metadata } }),
  };

  // Update entry
  const updateData: any = {
    marketplace_metadata: updatedMetadata,
    updated_at: new Date().toISOString(),
  };

  if (title) updateData.title = title;
  if (description) updateData.content = description;

  const { data: updatedEntry, error: updateError } = await supabase
    .from('entries')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    console.error('Error updating marketplace item:', updateError);
    res.status(500).json({
      error: 'Failed to update marketplace item',
      code: 'DATABASE_ERROR',
    });
    return;
  }

  // Transform to marketplace item format
  const item = {
    id: updatedEntry.id,
    title: updatedEntry.title,
    description: updatedEntry.content,
    price: updatedMetadata.price,
    currency: updatedMetadata.currency,
    item_type: updatedMetadata.item_type,
    category_id: updatedMetadata.category_id,
    seller_id: updatedEntry.user_id,
    status: updatedMetadata.status,
    inventory_count: updatedMetadata.inventory_count,
    metadata: updatedMetadata.custom_metadata || {},
    created_at: updatedEntry.created_at,
    updated_at: updatedEntry.updated_at,
  };

  res.status(200).json(item);
}

async function deleteMarketplaceItemHandler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    throw validationError('Item ID is required');
  }

  if (!UUID_REGEX.test(id)) {
    throw validationError('Invalid item ID format');
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

  const supabase = getSupabaseClient();

  // Fetch existing item to check ownership
  const { data: existingEntry, error: fetchError } = await supabase
    .from('entries')
    .select('user_id')
    .eq('id', id)
    .not('marketplace_metadata', 'is', null)
    .single();

  if (fetchError || !existingEntry) {
    res.status(404).json({
      error: 'Marketplace item not found',
      code: 'ITEM_NOT_FOUND',
    });
    return;
  }

  // Check ownership
  if (existingEntry.user_id !== user.id) {
    res.status(403).json({
      error: 'You do not have permission to delete this item',
      code: 'FORBIDDEN',
    });
    return;
  }

  // Delete item
  const { error: deleteError } = await supabase.from('entries').delete().eq('id', id);

  if (deleteError) {
    console.error('Error deleting marketplace item:', deleteError);
    res.status(500).json({
      error: 'Failed to delete marketplace item',
      code: 'DATABASE_ERROR',
    });
    return;
  }

  res.status(204).send('');
}

async function marketplaceItemByIdHandler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const method = req.method;

  switch (method) {
    case 'GET':
      await getMarketplaceItemHandler(req, res);
      break;
    case 'PUT':
      await updateMarketplaceItemHandler(req, res);
      break;
    case 'DELETE':
      await deleteMarketplaceItemHandler(req, res);
      break;
    default:
      res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
  }
}

// Export with middleware chain
export async function handleItemById(req: VercelRequest, res: VercelResponse): Promise<void> {
  await rateLimit(req, res, async () => {
    await asyncHandler(marketplaceItemByIdHandler)(req, res);
  });
}
