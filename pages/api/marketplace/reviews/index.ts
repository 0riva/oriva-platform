/**
 * Marketplace Reviews API
 * Feature: 010-orivaflow-semantic-commerce
 *
 * GET /api/marketplace/reviews - List reviews for an item
 * POST /api/marketplace/reviews - Create a review (verified buyers only)
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
  const { method } = req;

  // Get user from authorization header (optional for GET)
  const authHeader = req.headers.authorization;
  let userId: string | null = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (!authError && user) {
      userId = user.id;
    }
  }

  try {
    switch (method) {
      case 'GET':
        return await handleGet(req, res, userId);
      case 'POST':
        if (!userId) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        return await handlePost(req, res, userId);
      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({ error: `Method ${method} not allowed` });
    }
  } catch (error) {
    console.error('[Reviews API Error]:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET - List reviews for an item
 */
async function handleGet(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string | null
) {
  const {
    item_id,
    rating,
    sort = 'recent', // 'recent', 'helpful', 'rating_high', 'rating_low'
    limit = '20',
    offset = '0',
  } = req.query;

  if (!item_id || typeof item_id !== 'string') {
    return res.status(400).json({ error: 'item_id required' });
  }

  const limitNum = parseInt(limit as string, 10);
  const offsetNum = parseInt(offset as string, 10);

  let query = supabase
    .from('marketplace_reviews')
    .select(`
      *,
      reviewer:auth.users!reviewer_id(id, email),
      transaction:orivapay_transactions(id, status)
    `)
    .eq('item_id', item_id)
    .range(offsetNum, offsetNum + limitNum - 1);

  // Only show approved reviews to non-authors
  if (userId) {
    query = query.or(`moderation_status.eq.approved,reviewer_id.eq.${userId}`);
  } else {
    query = query.eq('moderation_status', 'approved');
  }

  // Filter by rating
  if (rating) {
    query = query.eq('rating', parseInt(rating as string, 10));
  }

  // Apply sorting
  switch (sort) {
    case 'helpful':
      query = query.order('helpful_count', { ascending: false });
      break;
    case 'rating_high':
      query = query.order('rating', { ascending: false });
      break;
    case 'rating_low':
      query = query.order('rating', { ascending: true });
      break;
    case 'recent':
    default:
      query = query.order('created_at', { ascending: false });
      break;
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('[Get Reviews Error]:', error);
    return res.status(500).json({ error: 'Failed to fetch reviews' });
  }

  // Get review statistics
  const { data: stats } = await supabase
    .from('marketplace_reviews')
    .select('rating')
    .eq('item_id', item_id)
    .eq('moderation_status', 'approved');

  const reviewStats = calculateReviewStats(stats || []);

  return res.status(200).json({
    reviews: data,
    stats: reviewStats,
    pagination: {
      limit: limitNum,
      offset: offsetNum,
      total: count,
    },
  });
}

/**
 * POST - Create a review
 */
async function handlePost(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string
) {
  const {
    item_id,
    transaction_id,
    rating,
    title,
    content,
  } = req.body;

  // Validate required fields
  if (!item_id || !rating || !title || !content) {
    return res.status(400).json({
      error: 'Missing required fields: item_id, rating, title, content',
    });
  }

  // Validate rating
  if (rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  }

  // Validate title and content length
  if (title.length > 200) {
    return res.status(400).json({ error: 'Title must be 200 characters or less' });
  }

  if (content.length < 10) {
    return res.status(400).json({ error: 'Content must be at least 10 characters' });
  }

  // Check if user has purchased this item
  const { data: purchase } = await supabase
    .from('orivapay_transactions')
    .select('id')
    .eq('item_id', item_id)
    .eq('buyer_id', userId)
    .eq('status', 'succeeded')
    .single();

  const verified_purchase = !!purchase;
  const transactionId = transaction_id || purchase?.id || null;

  // Check if user has already reviewed this item
  const { data: existing } = await supabase
    .from('marketplace_reviews')
    .select('id')
    .eq('item_id', item_id)
    .eq('reviewer_id', userId)
    .single();

  if (existing) {
    return res.status(400).json({ error: 'You have already reviewed this item' });
  }

  // Create review
  const { data: review, error } = await supabase
    .from('marketplace_reviews')
    .insert({
      item_id,
      reviewer_id: userId,
      transaction_id: transactionId,
      rating,
      title,
      content,
      verified_purchase,
      moderation_status: 'pending', // Reviews require moderation
      helpful_count: 0,
      not_helpful_count: 0,
    })
    .select(`
      *,
      reviewer:auth.users!reviewer_id(id, email),
      transaction:orivapay_transactions(id, status)
    `)
    .single();

  if (error) {
    console.error('[Create Review Error]:', error);
    return res.status(500).json({ error: 'Failed to create review' });
  }

  return res.status(201).json({ review });
}

/**
 * Calculate review statistics
 */
function calculateReviewStats(reviews: any[]) {
  if (reviews.length === 0) {
    return {
      average_rating: 0,
      total_reviews: 0,
      rating_distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    };
  }

  const total = reviews.length;
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  const average = sum / total;

  const distribution = reviews.reduce(
    (acc, r) => {
      acc[r.rating] = (acc[r.rating] || 0) + 1;
      return acc;
    },
    { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  );

  return {
    average_rating: Math.round(average * 10) / 10,
    total_reviews: total,
    rating_distribution: distribution,
  };
}