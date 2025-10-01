/**
 * Marketplace Reviews API
 * Feature: 010-orivaflow-semantic-commerce
 *
 * GET /api/marketplace/reviews - List reviews for an item
 * POST /api/marketplace/reviews - Create a new review
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
        return await handleGet(req, res, user.id);
      case 'POST':
        return await handlePost(req, res, user.id);
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
  userId: string
) {
  const {
    item_id,
    rating,
    verified_only = 'false',
    sort = 'newest', // 'newest', 'oldest', 'helpful', 'rating_high', 'rating_low'
    limit = '20',
    offset = '0',
  } = req.query;

  if (!item_id) {
    return res.status(400).json({ error: 'item_id required' });
  }

  const limitNum = parseInt(limit as string, 10);
  const offsetNum = parseInt(offset as string, 10);

  let query = supabase
    .from('marketplace_reviews')
    .select(`
      *,
      reviewer:auth.users!reviewer_id(id, email),
      profiles!reviewer_id(username, display_name, avatar_url)
    `)
    .eq('item_id', item_id)
    .eq('moderation_status', 'approved')
    .range(offsetNum, offsetNum + limitNum - 1);

  // Filter by rating
  if (rating) {
    query = query.eq('rating', parseInt(rating as string, 10));
  }

  // Filter verified purchases
  if (verified_only === 'true') {
    query = query.eq('verified_purchase', true);
  }

  // Sort
  switch (sort) {
    case 'newest':
      query = query.order('created_at', { ascending: false });
      break;
    case 'oldest':
      query = query.order('created_at', { ascending: true });
      break;
    case 'helpful':
      query = query.order('helpful_count', { ascending: false });
      break;
    case 'rating_high':
      query = query.order('rating', { ascending: false });
      break;
    case 'rating_low':
      query = query.order('rating', { ascending: true });
      break;
    default:
      query = query.order('created_at', { ascending: false });
  }

  const { data: reviews, error, count } = await query;

  if (error) {
    console.error('[Get Reviews Error]:', error);
    return res.status(500).json({ error: 'Failed to fetch reviews' });
  }

  // Calculate summary statistics
  const { data: allReviews } = await supabase
    .from('marketplace_reviews')
    .select('rating')
    .eq('item_id', item_id)
    .eq('moderation_status', 'approved');

  const summary = calculateSummary(allReviews || []);

  return res.status(200).json({
    reviews,
    summary,
    pagination: {
      limit: limitNum,
      offset: offsetNum,
      total: count,
    },
  });
}

/**
 * POST - Create a new review
 */
async function handlePost(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string
) {
  const {
    item_id,
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

  // Validate content length
  if (content.length < 10) {
    return res.status(400).json({ error: 'Review content must be at least 10 characters' });
  }

  if (title.length > 200) {
    return res.status(400).json({ error: 'Title must be 200 characters or less' });
  }

  // Check if user has purchased the item
  const { data: purchase } = await supabase
    .from('orivapay_transactions')
    .select('id')
    .eq('buyer_id', userId)
    .eq('item_id', item_id)
    .eq('status', 'succeeded')
    .single();

  const verifiedPurchase = !!purchase;

  // Check if user already reviewed this item
  const { data: existingReview } = await supabase
    .from('marketplace_reviews')
    .select('id')
    .eq('item_id', item_id)
    .eq('reviewer_id', userId)
    .single();

  if (existingReview) {
    return res.status(409).json({ error: 'You have already reviewed this item' });
  }

  // Create review
  const { data: review, error } = await supabase
    .from('marketplace_reviews')
    .insert({
      item_id,
      reviewer_id: userId,
      transaction_id: purchase?.id,
      rating,
      title,
      content,
      verified_purchase: verifiedPurchase,
      moderation_status: 'pending', // Will be moderated
    })
    .select(`
      *,
      reviewer:auth.users!reviewer_id(id, email),
      profiles!reviewer_id(username, display_name, avatar_url)
    `)
    .single();

  if (error) {
    console.error('[Create Review Error]:', error);
    return res.status(500).json({ error: 'Failed to create review' });
  }

  return res.status(201).json({ review });
}

function calculateSummary(reviews: any[]) {
  if (reviews.length === 0) {
    return {
      average_rating: 0,
      total_reviews: 0,
      rating_distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    };
  }

  const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
  const averageRating = totalRating / reviews.length;

  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  reviews.forEach(r => {
    distribution[r.rating] = (distribution[r.rating] || 0) + 1;
  });

  return {
    average_rating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
    total_reviews: reviews.length,
    rating_distribution: distribution,
  };
}