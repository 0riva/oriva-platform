/**
 * Review Response API
 * Feature: 010-orivaflow-semantic-commerce
 *
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
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const { query } = req;
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
    return await handleRespond(req, res, user.id, id);
  } catch (error) {
    console.error('[Review Response API Error]:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleRespond(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string,
  reviewId: string
) {
  const { seller_response } = req.body;

  if (!seller_response || seller_response.length < 10) {
    return res.status(400).json({
      error: 'seller_response required and must be at least 10 characters',
    });
  }

  // Get review with item details
  const { data: review, error: reviewError } = await supabase
    .from('marketplace_reviews')
    .select(`
      id,
      item_id,
      seller_response,
      item:entries!item_id(id, user_id)
    `)
    .eq('id', reviewId)
    .single();

  if (reviewError || !review) {
    return res.status(404).json({ error: 'Review not found' });
  }

  // Verify user is the seller
  if (review.item.user_id !== userId) {
    return res.status(403).json({ error: 'Only the seller can respond to this review' });
  }

  // Check if already responded
  if (review.seller_response) {
    return res.status(400).json({ error: 'You have already responded to this review' });
  }

  // Update review with seller response
  const { data: updatedReview, error: updateError } = await supabase
    .from('marketplace_reviews')
    .update({
      seller_response,
      seller_responded_at: new Date().toISOString(),
    })
    .eq('id', reviewId)
    .select(`
      *,
      reviewer:auth.users!reviewer_id(id, email),
      item:entries!item_id(id, title)
    `)
    .single();

  if (updateError) {
    console.error('[Update Review Error]:', updateError);
    return res.status(500).json({ error: 'Failed to add response' });
  }

  return res.status(200).json({ review: updatedReview });
}