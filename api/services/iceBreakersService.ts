/**
 * Ice Breakers Service
 * Task: T031
 *
 * Business logic for Hugo Love ice breaker suggestions.
 * App-specific feature in hugo_love schema.
 */

import { Request } from 'express';
import {
  createQueryBuilder,
  executeQuery,
  executeQueryOptional,
  DatabaseError,
} from '../utils/database';
import {
  validateRequired,
  validateUuid,
  validateEnum,
  ICE_BREAKER_CATEGORIES,
  ICE_BREAKER_STYLES,
  IceBreakerCategory,
  IceBreakerStyle,
} from '../utils/validation';

/**
 * Create ice breaker request
 */
export interface CreateIceBreakerRequest {
  text: string;
  category: string;
  style: string;
  context_tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Ice breaker response
 */
export interface IceBreakerResponse {
  id: string;
  user_id: string;
  text: string;
  category: IceBreakerCategory;
  style: IceBreakerStyle;
  context_tags: string[];
  usage_count: number;
  last_used_at?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

/**
 * Create a new ice breaker suggestion
 */
export const createIceBreaker = async (
  req: Request,
  userId: string,
  input: CreateIceBreakerRequest
): Promise<IceBreakerResponse> => {
  validateUuid(userId, 'user_id');
  validateRequired(input.text, 'text');

  const category = validateEnum(
    input.category as IceBreakerCategory,
    ICE_BREAKER_CATEGORIES,
    'category'
  );
  const style = validateEnum(input.style as IceBreakerStyle, ICE_BREAKER_STYLES, 'style');

  const db = createQueryBuilder(req);

  // Verify user exists
  const userExists = await executeQueryOptional(
    () => db.from('users').select('id').eq('id', userId).maybeSingle(),
    'check user exists'
  );

  if (!userExists) {
    throw new DatabaseError('User not found', 'USER_NOT_FOUND', undefined);
  }

  // Create ice breaker in hugo_love schema
  const iceBreaker = await executeQuery<IceBreakerResponse>(
    () =>
      db
        .from('ice_breakers')
        .insert({
          user_id: userId,
          text: input.text,
          category,
          style,
          context_tags: input.context_tags || [],
          usage_count: 0,
          metadata: input.metadata || {},
        })
        .select()
        .single(),
    'create ice breaker'
  );

  return iceBreaker;
};

/**
 * Get ice breaker by ID
 */
export const getIceBreaker = async (
  req: Request,
  iceBreakerId: string,
  userId: string
): Promise<IceBreakerResponse> => {
  validateUuid(iceBreakerId, 'ice_breaker_id');
  validateUuid(userId, 'user_id');

  const db = createQueryBuilder(req);

  const iceBreaker = await executeQuery<IceBreakerResponse>(
    () =>
      db
        .from('ice_breakers')
        .select('*')
        .eq('id', iceBreakerId)
        .eq('user_id', userId)
        .single(),
    'get ice breaker'
  );

  return iceBreaker;
};

/**
 * List user's ice breakers
 */
export const listUserIceBreakers = async (
  req: Request,
  userId: string,
  filters?: {
    category?: string;
    style?: string;
    context_tag?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ ice_breakers: IceBreakerResponse[] }> => {
  validateUuid(userId, 'user_id');

  const db = createQueryBuilder(req);

  // Build query
  let query = db
    .from('ice_breakers')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  // Apply category filter
  if (filters?.category) {
    const category = validateEnum(
      filters.category as IceBreakerCategory,
      ICE_BREAKER_CATEGORIES,
      'category'
    );
    query = query.eq('category', category);
  }

  // Apply style filter
  if (filters?.style) {
    const style = validateEnum(
      filters.style as IceBreakerStyle,
      ICE_BREAKER_STYLES,
      'style'
    );
    query = query.eq('style', style);
  }

  // Apply context_tag filter (using PostgreSQL contains operator)
  if (filters?.context_tag) {
    query = query.contains('context_tags', [filters.context_tag]);
  }

  // Apply pagination
  if (filters?.limit !== undefined && filters?.offset !== undefined) {
    query = query.range(filters.offset, filters.offset + filters.limit - 1);
  }

  const iceBreakers = await executeQuery<IceBreakerResponse[]>(
    () => query,
    'list ice breakers'
  );

  return { ice_breakers: iceBreakers };
};

/**
 * Get suggested ice breakers for user
 */
export const getSuggestedIceBreakers = async (
  req: Request,
  userId: string,
  filters?: {
    category?: string;
    style?: string;
    context_tags?: string[];
    limit?: number;
  }
): Promise<{ ice_breakers: IceBreakerResponse[] }> => {
  validateUuid(userId, 'user_id');

  const db = createQueryBuilder(req);

  // Build query - prioritize unused or least used
  let query = db
    .from('ice_breakers')
    .select('*')
    .eq('user_id', userId)
    .order('usage_count', { ascending: true })
    .order('created_at', { ascending: false });

  // Apply category filter
  if (filters?.category) {
    const category = validateEnum(
      filters.category as IceBreakerCategory,
      ICE_BREAKER_CATEGORIES,
      'category'
    );
    query = query.eq('category', category);
  }

  // Apply style filter
  if (filters?.style) {
    const style = validateEnum(
      filters.style as IceBreakerStyle,
      ICE_BREAKER_STYLES,
      'style'
    );
    query = query.eq('style', style);
  }

  // Apply context_tags filter (using PostgreSQL overlaps operator)
  if (filters?.context_tags && filters.context_tags.length > 0) {
    query = query.overlaps('context_tags', filters.context_tags);
  }

  // Apply limit
  if (filters?.limit !== undefined) {
    query = query.limit(filters.limit);
  }

  const iceBreakers = await executeQuery<IceBreakerResponse[]>(
    () => query,
    'get suggested ice breakers'
  );

  return { ice_breakers: iceBreakers };
};

/**
 * Record ice breaker usage
 */
export const recordIceBreakerUsage = async (
  req: Request,
  iceBreakerId: string,
  userId: string
): Promise<IceBreakerResponse> => {
  validateUuid(iceBreakerId, 'ice_breaker_id');
  validateUuid(userId, 'user_id');

  const db = createQueryBuilder(req);

  // Get current ice breaker
  const iceBreaker = await getIceBreaker(req, iceBreakerId, userId);

  // Increment usage count
  const updatedIceBreaker = await executeQuery<IceBreakerResponse>(
    () =>
      db
        .from('ice_breakers')
        .update({
          usage_count: iceBreaker.usage_count + 1,
          last_used_at: new Date().toISOString(),
        })
        .eq('id', iceBreakerId)
        .select()
        .single(),
    'record ice breaker usage'
  );

  return updatedIceBreaker;
};

/**
 * Delete ice breaker
 */
export const deleteIceBreaker = async (
  req: Request,
  iceBreakerId: string,
  userId: string
): Promise<void> => {
  validateUuid(iceBreakerId, 'ice_breaker_id');
  validateUuid(userId, 'user_id');

  const db = createQueryBuilder(req);

  await executeQuery(
    () =>
      db
        .from('ice_breakers')
        .delete()
        .eq('id', iceBreakerId)
        .eq('user_id', userId),
    'delete ice breaker'
  );
};

/**
 * Get ice breaker statistics for user
 */
export const getUserIceBreakerStats = async (
  req: Request,
  userId: string
): Promise<{
  total_ice_breakers: number;
  total_usage_count: number;
  most_used_category: IceBreakerCategory | null;
  most_used_style: IceBreakerStyle | null;
  ice_breakers_by_category: Record<IceBreakerCategory, number>;
  ice_breakers_by_style: Record<IceBreakerStyle, number>;
}> => {
  validateUuid(userId, 'user_id');

  const db = createQueryBuilder(req);

  const iceBreakers = await executeQuery<IceBreakerResponse[]>(
    () => db.from('ice_breakers').select('*').eq('user_id', userId),
    'get user ice breakers for stats'
  );

  // Calculate statistics
  const stats = {
    total_ice_breakers: iceBreakers.length,
    total_usage_count: iceBreakers.reduce((sum, ib) => sum + ib.usage_count, 0),
    most_used_category: null as IceBreakerCategory | null,
    most_used_style: null as IceBreakerStyle | null,
    ice_breakers_by_category: {} as Record<IceBreakerCategory, number>,
    ice_breakers_by_style: {} as Record<IceBreakerStyle, number>,
  };

  // Count by category
  iceBreakers.forEach((iceBreaker) => {
    stats.ice_breakers_by_category[iceBreaker.category] =
      (stats.ice_breakers_by_category[iceBreaker.category] || 0) + 1;
  });

  // Count by style
  iceBreakers.forEach((iceBreaker) => {
    stats.ice_breakers_by_style[iceBreaker.style] =
      (stats.ice_breakers_by_style[iceBreaker.style] || 0) + 1;
  });

  // Find most used category
  let maxCategoryCount = 0;
  for (const [category, count] of Object.entries(stats.ice_breakers_by_category)) {
    if (count > maxCategoryCount) {
      maxCategoryCount = count;
      stats.most_used_category = category as IceBreakerCategory;
    }
  }

  // Find most used style
  let maxStyleCount = 0;
  for (const [style, count] of Object.entries(stats.ice_breakers_by_style)) {
    if (count > maxStyleCount) {
      maxStyleCount = count;
      stats.most_used_style = style as IceBreakerStyle;
    }
  }

  return stats;
};

/**
 * Update ice breaker
 */
export const updateIceBreaker = async (
  req: Request,
  iceBreakerId: string,
  userId: string,
  updates: {
    text?: string;
    category?: string;
    style?: string;
    context_tags?: string[];
    metadata?: Record<string, unknown>;
  }
): Promise<IceBreakerResponse> => {
  validateUuid(iceBreakerId, 'ice_breaker_id');
  validateUuid(userId, 'user_id');

  const db = createQueryBuilder(req);

  // Verify ice breaker exists and belongs to user
  await executeQuery<{ id: string }>(
    () =>
      db
        .from('ice_breakers')
        .select('id')
        .eq('id', iceBreakerId)
        .eq('user_id', userId)
        .single(),
    'verify ice breaker ownership'
  );

  // Build update object
  const updateData: Record<string, unknown> = {};

  if (updates.text !== undefined) {
    validateRequired(updates.text, 'text');
    updateData.text = updates.text;
  }

  if (updates.category !== undefined) {
    updateData.category = validateEnum(
      updates.category as IceBreakerCategory,
      ICE_BREAKER_CATEGORIES,
      'category'
    );
  }

  if (updates.style !== undefined) {
    updateData.style = validateEnum(
      updates.style as IceBreakerStyle,
      ICE_BREAKER_STYLES,
      'style'
    );
  }

  if (updates.context_tags !== undefined) {
    updateData.context_tags = updates.context_tags;
  }

  if (updates.metadata !== undefined) {
    updateData.metadata = updates.metadata;
  }

  // Update ice breaker
  const updatedIceBreaker = await executeQuery<IceBreakerResponse>(
    () =>
      db
        .from('ice_breakers')
        .update(updateData)
        .eq('id', iceBreakerId)
        .select()
        .single(),
    'update ice breaker'
  );

  return updatedIceBreaker;
};
