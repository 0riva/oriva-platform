/**
 * Marketplace Review Detail API
 * Feature: 010-orivaflow-semantic-commerce
 *
 * GET /api/marketplace/reviews/[id] - Get review details
 * PATCH /api/marketplace/reviews/[id] - Update review (author only)
 * DELETE /api/marketplace/reviews/[id] - Delete review (author only)
 * POST /api/marketplace/reviews/[id]/vote - Vote on review helpfulness
 * POST /api/marketplace/reviews/[id]/respond - Seller response to review
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method, query } = req;
  const { id } = query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Review ID required' });
  }

  // Get user from authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.substring(7);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    switch (method) {
      case 'GET':
        return await handleGet(req, res, user.id, id);
      case 'PATCH':
        return await handlePatch(req, res, user.id, id);
      case 'DELETE':
        return await handleDelete(req, res, user.id, id);
      default:
        res.setHeader('Allow', ['GET', 'PATCH', 'DELETE']);
        return res.status(405).json({ error: `Method ${method} not allowed` });
    }
  } catch (error) {
    console.error('[Review Detail API Error]:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET - Get review details
 */
async function handleGet(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string,
  reviewId: string
) {
  const { data: review, error } = await supabase
    .from('marketplace_reviews')
    .select(`
      *,
      reviewer:auth.users!reviewer_id(id, email),
      transaction:orivapay_transactions(id, status, item:entries!item_id(id, seller_id)),
      item:entries!item_id(id, title, seller_id)
    `)
    .eq('id', reviewId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({ error: 'Review not found' });
    }
    console.error('[Get Review Error]:', error);
    return res.status(500).json({ error: 'Failed to fetch review' });
  }

  // Check if user can view this review
  const isAuthor = review.reviewer_id === userId;
  const isApproved = review.moderation_status === 'approved';

  if (!isAuthor && !isApproved) {
    return res.status(403).json({ error: 'Review is not yet approved' });
  }

  return res.status(200).json({ review });
}

/**
 * PATCH - Update review
 */
async function handlePatch(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string,
  reviewId: string
) {
  const { rating, title, content } = req.body;

  // Get existing review
  const { data: existing, error: fetchError } = await supabase
    .from('marketplace_reviews')
    .select('reviewer_id')
    .eq('id', reviewId)
    .single();

  if (fetchError || !existing) {
    return res.status(404).json({ error: 'Review not found' });
  }

  // Verify user is the author
  if (existing.reviewer_id !== userId) {
    return res.status(403).json({ error: 'You can only update your own reviews' });
  }

  // Build updates
  const updates: any = {};

  if (rating !== undefined) {
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }
    updates.rating = rating;
  }

  if (title !== undefined) {
    if (title.length > 200) {
      return res.status(400).json({ error: 'Title must be 200 characters or less' });
    }
    updates.title = title;
  }

  if (content !== undefined) {
    if (content.length < 10) {
      return res.status(400).json({ error: 'Content must be at least 10 characters' });
    }
    updates.content = content;
  }

  // Reset moderation status if content changed
  if (rating !== undefined || title !== undefined || content !== undefined) {
    updates.moderation_status = 'pending';
  }

  // Update review
  const { data: review, error } = await supabase
    .from('marketplace_reviews')
    .update(updates)
    .eq('id', reviewId)
    .select(`
      *,
      reviewer:auth.users!reviewer_id(id, email),
      transaction:orivapay_transactions(id, status)
    `)
    .single();

  if (error) {
    console.error('[Update Review Error]:', error);
    return res.status(500).json({ error: 'Failed to update review' });
  }

  return res.status(200).json({ review });
}

/**
 * DELETE - Delete review
 */
async function handleDelete(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string,
  reviewId: string
) {
  // Get existing review
  const { data: existing, error: fetchError } = await supabase
    .from('marketplace_reviews')
    .select('reviewer_id')
    .eq('id', reviewId)
    .single();

  if (fetchError || !existing) {
    return res.status(404).json({ error: 'Review not found' });
  }

  // Verify user is the author
  if (existing.reviewer_id !== userId) {
    return res.status(403).json({ error: 'You can only delete your own reviews' });
  }

  // Delete review
  const { error } = await supabase
    .from('marketplace_reviews')
    .delete()
    .eq('id', reviewId);

  if (error) {
    console.error('[Delete Review Error]:', error);
    return res.status(500).json({ error: 'Failed to delete review' });
  }

  return res.status(204).send(null);
}