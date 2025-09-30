/**
 * Review Vote API
 * Feature: 010-orivaflow-semantic-commerce
 *
 * POST /api/marketplace/reviews/[id]/vote - Vote on review helpfulness
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
    return await handleVote(req, res, user.id, id);
  } catch (error) {
    console.error('[Review Vote API Error]:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleVote(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string,
  reviewId: string
) {
  const { vote_type } = req.body;

  // Validate vote type
  if (!vote_type || !['helpful', 'not_helpful'].includes(vote_type)) {
    return res.status(400).json({ error: 'vote_type must be "helpful" or "not_helpful"' });
  }

  // Check if review exists
  const { data: review, error: reviewError } = await supabase
    .from('marketplace_reviews')
    .select('id, helpful_count, not_helpful_count')
    .eq('id', reviewId)
    .single();

  if (reviewError || !review) {
    return res.status(404).json({ error: 'Review not found' });
  }

  // Check if user has already voted
  const { data: existingVote } = await supabase
    .from('marketplace_review_votes')
    .select('id, vote_type')
    .eq('review_id', reviewId)
    .eq('user_id', userId)
    .single();

  if (existingVote) {
    // User is changing their vote
    if (existingVote.vote_type === vote_type) {
      return res.status(400).json({ error: 'You have already voted this way' });
    }

    // Update vote
    const { error: updateError } = await supabase
      .from('marketplace_review_votes')
      .update({ vote_type })
      .eq('id', existingVote.id);

    if (updateError) {
      console.error('[Update Vote Error]:', updateError);
      return res.status(500).json({ error: 'Failed to update vote' });
    }

    // Update review counts
    const updates: any = {};
    if (existingVote.vote_type === 'helpful') {
      updates.helpful_count = Math.max(0, review.helpful_count - 1);
      updates.not_helpful_count = review.not_helpful_count + 1;
    } else {
      updates.helpful_count = review.helpful_count + 1;
      updates.not_helpful_count = Math.max(0, review.not_helpful_count - 1);
    }

    await supabase
      .from('marketplace_reviews')
      .update(updates)
      .eq('id', reviewId);

    return res.status(200).json({
      message: 'Vote updated',
      vote_type,
    });
  }

  // Create new vote
  const { error: voteError } = await supabase
    .from('marketplace_review_votes')
    .insert({
      review_id: reviewId,
      user_id: userId,
      vote_type,
    });

  if (voteError) {
    console.error('[Create Vote Error]:', voteError);
    return res.status(500).json({ error: 'Failed to create vote' });
  }

  // Update review counts
  const updates: any = {};
  if (vote_type === 'helpful') {
    updates.helpful_count = review.helpful_count + 1;
  } else {
    updates.not_helpful_count = review.not_helpful_count + 1;
  }

  await supabase
    .from('marketplace_reviews')
    .update(updates)
    .eq('id', reviewId);

  return res.status(201).json({
    message: 'Vote recorded',
    vote_type,
  });
}