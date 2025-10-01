// @ts-nocheck - TODO: Fix type errors
/**
 * Marketplace Review Vote API
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
    const { vote_type } = req.body;

    if (!vote_type || !['helpful', 'not_helpful'].includes(vote_type)) {
      return res.status(400).json({
        error: 'vote_type required (helpful or not_helpful)',
      });
    }

    // Check if review exists
    const { data: review, error: reviewError } = await supabase
      .from('marketplace_reviews')
      .select('id')
      .eq('id', id)
      .single();

    if (reviewError || !review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Check if user already voted
    const { data: existingVote } = await supabase
      .from('marketplace_review_votes')
      .select('id, vote_type')
      .eq('review_id', id)
      .eq('user_id', user.id)
      .single();

    if (existingVote) {
      // Update vote if different
      if (existingVote.vote_type !== vote_type) {
        await supabase
          .from('marketplace_review_votes')
          .update({ vote_type })
          .eq('id', existingVote.id);

        // Update review counts
        if (vote_type === 'helpful') {
          await supabase.rpc('increment_review_helpful_count', { review_uuid: id });
          await supabase.rpc('decrement_review_not_helpful_count', { review_uuid: id });
        } else {
          await supabase.rpc('increment_review_not_helpful_count', { review_uuid: id });
          await supabase.rpc('decrement_review_helpful_count', { review_uuid: id });
        }

        return res.status(200).json({ message: 'Vote updated', vote_type });
      } else {
        return res.status(200).json({ message: 'Vote already recorded', vote_type });
      }
    }

    // Create new vote
    const { error: voteError } = await supabase
      .from('marketplace_review_votes')
      .insert({
        review_id: id,
        user_id: user.id,
        vote_type,
      });

    if (voteError) {
      console.error('[Create Vote Error]:', voteError);
      return res.status(500).json({ error: 'Failed to record vote' });
    }

    // Update review counts
    if (vote_type === 'helpful') {
      await supabase.rpc('increment_review_helpful_count', { review_uuid: id });
    } else {
      await supabase.rpc('increment_review_not_helpful_count', { review_uuid: id });
    }

    return res.status(201).json({ message: 'Vote recorded', vote_type });

  } catch (error) {
    console.error('[Review Vote API Error]:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}