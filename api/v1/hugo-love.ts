// @ts-nocheck - TODO: Fix type errors
// Consolidated Hugo Love API Handler
// Handles: POST /api/v1/hugo-love/swipe (T058 - FotoFlash)
//          POST /api/v1/hugo-love/ratings (T059 - RateTheBait)
//          GET /api/v1/hugo-love/matches (T060 - CatchTheMatch)
//          POST /api/v1/hugo-love/block (blocking)
//          DELETE /api/v1/hugo-love/block/:blockedUserId (unblocking)
// Pattern: Catch-all routing to reduce function count

import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, AuthenticatedRequest } from '../../src/middleware/auth';
import {
  asyncHandler,
  validationError,
  notFoundError,
  forbiddenError,
} from '../../src/middleware/error-handler';
import { rateLimit } from '../../src/middleware/rate-limit';
import { getSupabaseClient } from '../../src/config/supabase';

/**
 * T058 - FotoFlash: Record a swipe action (like/dislike/review)
 * POST /api/v1/hugo-love/swipe
 *
 * Request body:
 * {
 *   targetUserId: string,    // User being swiped on
 *   direction: 'like' | 'dislike' | 'review',
 *   timestamp?: string       // ISO 8601 timestamp (optional, defaults to now)
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   swipeId: string,
 *   match?: {
 *     matchId: string,
 *     conversationId: string
 *   }
 * }
 */
async function handleSwipe(req: AuthenticatedRequest, res: VercelResponse): Promise<void> {
  const { userId } = req.authContext;
  const { targetUserId, direction, timestamp: clientTimestamp } = req.body;

  // Validation
  if (!targetUserId) {
    throw validationError('targetUserId is required');
  }

  if (!direction || !['like', 'dislike', 'review'].includes(direction)) {
    throw validationError('direction must be "like", "dislike", or "review"');
  }

  if (userId === targetUserId) {
    throw validationError('Cannot swipe on yourself');
  }

  const supabase = getSupabaseClient();
  const timestamp = clientTimestamp || new Date().toISOString();

  // Insert swipe record
  const { data: swipeData, error: swipeError } = await supabase
    .from('hugo_love_swipes')
    .insert({
      user_id: userId,
      target_user_id: targetUserId,
      direction,
      timestamp,
    })
    .select()
    .single();

  if (swipeError || !swipeData) {
    const errorMessage =
      process.env.NODE_ENV === 'production'
        ? 'Failed to record swipe'
        : `Failed to record swipe: ${swipeError?.message}`;
    throw new Error(errorMessage);
  }

  // Check for mutual like (match creation handled by trigger/function)
  let match = null;
  if (direction === 'like') {
    // Query if targetUserId previously liked userId
    const { data: priorLike } = await supabase
      .from('hugo_love_swipes')
      .select('id')
      .eq('user_id', targetUserId)
      .eq('target_user_id', userId)
      .eq('direction', 'like')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (priorLike) {
      // Mutual like detected - fetch the match record
      const [smaller, larger] = [userId, targetUserId].sort();
      const { data: matchData } = await supabase
        .from('hugo_love_matches')
        .select('id, conversation_id')
        .eq('user_id_1', smaller)
        .eq('user_id_2', larger)
        .single();

      if (matchData) {
        match = {
          matchId: matchData.id,
          conversationId: matchData.conversation_id,
        };
      }
    }
  }

  res.status(201).json({
    success: true,
    swipeId: swipeData.id,
    match,
  });
}

/**
 * T059 - RateTheBait: Submit a rating for a user
 * POST /api/v1/hugo-love/ratings
 *
 * Request body:
 * {
 *   ratedUserId: string,     // User being rated
 *   looks: number,           // 1-5 star rating
 *   personality: number,     // 1-5 star rating
 *   interests: number,       // 1-5 star rating
 *   lifestyle: number,       // 1-5 star rating
 *   comment?: string         // Optional review comment
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   ratingId: string,
 *   averageScore: number,    // Rounded to 1 decimal
 *   totalRatings: number     // Count of ratings received by ratedUserId
 * }
 */
async function handleRating(req: AuthenticatedRequest, res: VercelResponse): Promise<void> {
  const { userId } = req.authContext;
  const { ratedUserId, looks, personality, interests, lifestyle, comment } = req.body;

  // Validation
  if (!ratedUserId) {
    throw validationError('ratedUserId is required');
  }

  if (userId === ratedUserId) {
    throw validationError('Cannot rate yourself');
  }

  // Validate all 4 factors are 1-5
  const ratings = { looks, personality, interests, lifestyle };
  for (const [field, value] of Object.entries(ratings)) {
    if (typeof value !== 'number' || value < 1 || value > 5 || !Number.isInteger(value)) {
      throw validationError(`${field} must be an integer between 1 and 5`);
    }
  }

  if (comment && typeof comment !== 'string') {
    throw validationError('comment must be a string');
  }

  if (comment && comment.length > 500) {
    throw validationError('comment must not exceed 500 characters');
  }

  const supabase = getSupabaseClient();
  const trimmedComment = comment ? comment.trim() : null;
  const averageScore = parseFloat(((looks + personality + interests + lifestyle) / 4).toFixed(1));

  // Insert rating record
  const { data: ratingData, error: ratingError } = await supabase
    .from('hugo_love_ratings')
    .insert({
      rater_id: userId,
      rated_user_id: ratedUserId,
      looks,
      personality,
      interests,
      lifestyle,
      average_score: averageScore,
      comment: trimmedComment,
    })
    .select()
    .single();

  if (ratingError || !ratingData) {
    const errorMessage =
      process.env.NODE_ENV === 'production'
        ? 'Failed to submit rating'
        : `Failed to submit rating: ${ratingError?.message}`;
    throw new Error(errorMessage);
  }

  // Get updated stats for rated user
  const { data: statsData } = await supabase
    .from('hugo_love_ratings')
    .select('id')
    .eq('rated_user_id', ratedUserId);

  const totalRatings = statsData?.length || 0;

  res.status(201).json({
    success: true,
    ratingId: ratingData.id,
    averageScore,
    totalRatings,
  });
}

/**
 * T060 - CatchTheMatch: Retrieve matches for current user
 * GET /api/v1/hugo-love/matches?limit=50&offset=0
 *
 * Query params:
 * - limit: number (default: 50, max: 200)
 * - offset: number (default: 0, for pagination)
 *
 * Response:
 * {
 *   success: boolean,
 *   matches: Array<{
 *     matchId: string,
 *     userId1: string,
 *     userId2: string,
 *     conversationId: string,
 *     status: 'active' | 'expired' | 'blocked',
 *     createdAt: string,
 *     matchedProfile?: {
 *       userId: string,
 *       name: string,
 *       avatar?: string
 *     }
 *   }>,
 *   count: number,
 *   total: number
 * }
 */
async function handleGetMatches(req: AuthenticatedRequest, res: VercelResponse): Promise<void> {
  const { userId } = req.authContext;
  const { limit = '50', offset = '0' } = req.query;

  const parsedLimit = Math.min(Math.max(parseInt(String(limit), 10) || 50, 1), 200);
  const parsedOffset = Math.max(parseInt(String(offset), 10) || 0, 0);

  const supabase = getSupabaseClient();

  // Get matches where user is either userId1 or userId2
  // Using RLS: users can see their own matches only
  const {
    data: matchesData,
    error: matchesError,
    count: totalCount,
  } = await supabase
    .from('hugo_love_matches')
    .select(
      `
      id,
      user_id_1,
      user_id_2,
      conversation_id,
      status,
      created_at
    `,
      { count: 'exact' }
    )
    .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`)
    .order('created_at', { ascending: false })
    .range(parsedOffset, parsedOffset + parsedLimit - 1);

  if (matchesError) {
    const errorMessage =
      process.env.NODE_ENV === 'production'
        ? 'Failed to fetch matches'
        : `Failed to fetch matches: ${matchesError.message}`;
    throw new Error(errorMessage);
  }

  // Fetch matched profiles for context (without exposing sensitive data)
  const matches = await Promise.all(
    (matchesData || []).map(async (match) => {
      const otherUserId = match.user_id_1 === userId ? match.user_id_2 : match.user_id_1;

      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .eq('account_id', otherUserId)
        .single();

      return {
        matchId: match.id,
        userId1: match.user_id_1,
        userId2: match.user_id_2,
        conversationId: match.conversation_id,
        status: match.status,
        createdAt: match.created_at,
        matchedProfile: profileData
          ? {
              userId: otherUserId,
              name: profileData.name || 'User',
              avatar: profileData.avatar_url,
            }
          : undefined,
      };
    })
  );

  res.status(200).json({
    success: true,
    matches,
    count: matches.length,
    total: totalCount || 0,
  });
}

/**
 * T060 - CatchTheMatch: Get specific match details
 * GET /api/v1/hugo-love/matches/:matchId
 *
 * Response: Single match object (same as in list)
 */
async function handleGetMatch(req: AuthenticatedRequest, res: VercelResponse): Promise<void> {
  const { userId } = req.authContext;
  const { matchId } = req.query;

  if (!matchId) {
    throw validationError('matchId is required');
  }

  const supabase = getSupabaseClient();

  const { data: matchData, error: matchError } = await supabase
    .from('hugo_love_matches')
    .select(
      `
      id,
      user_id_1,
      user_id_2,
      conversation_id,
      status,
      created_at
    `
    )
    .eq('id', matchId)
    .single();

  if (matchError || !matchData) {
    throw notFoundError('Match not found');
  }

  // Verify user is part of this match
  if (matchData.user_id_1 !== userId && matchData.user_id_2 !== userId) {
    throw forbiddenError('You do not have access to this match');
  }

  // Fetch matched profile
  const otherUserId = matchData.user_id_1 === userId ? matchData.user_id_2 : matchData.user_id_1;
  const { data: profileData } = await supabase
    .from('profiles')
    .select('id, name, avatar_url')
    .eq('account_id', otherUserId)
    .single();

  res.status(200).json({
    matchId: matchData.id,
    userId1: matchData.user_id_1,
    userId2: matchData.user_id_2,
    conversationId: matchData.conversation_id,
    status: matchData.status,
    createdAt: matchData.created_at,
    matchedProfile: profileData
      ? {
          userId: otherUserId,
          name: profileData.name || 'User',
          avatar: profileData.avatar_url,
        }
      : undefined,
  });
}

/**
 * T060 - CatchTheMatch: Block a user
 * POST /api/v1/hugo-love/block
 *
 * Request body:
 * {
 *   blockedUserId: string
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   message: string
 * }
 */
async function handleBlockUser(req: AuthenticatedRequest, res: VercelResponse): Promise<void> {
  const { userId } = req.authContext;
  const { blockedUserId } = req.body;

  if (!blockedUserId) {
    throw validationError('blockedUserId is required');
  }

  if (userId === blockedUserId) {
    throw validationError('Cannot block yourself');
  }

  const supabase = getSupabaseClient();

  // Check if already blocked
  const { data: existingBlock } = await supabase
    .from('hugo_love_blocks')
    .select('id')
    .eq('blocker_id', userId)
    .eq('blocked_id', blockedUserId)
    .single();

  if (existingBlock) {
    res.status(200).json({
      success: true,
      message: 'User already blocked',
    });
    return;
  }

  // Create block record
  const { error: blockError } = await supabase.from('hugo_love_blocks').insert({
    blocker_id: userId,
    blocked_id: blockedUserId,
  });

  if (blockError) {
    const errorMessage =
      process.env.NODE_ENV === 'production'
        ? 'Failed to block user'
        : `Failed to block user: ${blockError.message}`;
    throw new Error(errorMessage);
  }

  res.status(200).json({
    success: true,
    message: 'User blocked successfully',
  });
}

/**
 * T060 - CatchTheMatch: Unblock a user
 * DELETE /api/v1/hugo-love/block/:blockedUserId
 *
 * Response:
 * {
 *   success: boolean,
 *   message: string
 * }
 */
async function handleUnblockUser(req: AuthenticatedRequest, res: VercelResponse): Promise<void> {
  const { userId } = req.authContext;
  const { blockedUserId } = req.query;

  if (!blockedUserId) {
    throw validationError('blockedUserId is required');
  }

  const supabase = getSupabaseClient();

  const { error: deleteError } = await supabase
    .from('hugo_love_blocks')
    .delete()
    .eq('blocker_id', userId)
    .eq('blocked_id', blockedUserId);

  if (deleteError) {
    const errorMessage =
      process.env.NODE_ENV === 'production'
        ? 'Failed to unblock user'
        : `Failed to unblock user: ${deleteError.message}`;
    throw new Error(errorMessage);
  }

  res.status(200).json({
    success: true,
    message: 'User unblocked successfully',
  });
}

/**
 * Main router handler
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await asyncHandler(async () => {
    await authenticate(req, res, async () => {
      await rateLimit(req, res, async () => {
        const authReq = req as AuthenticatedRequest;
        const { url, method } = req;

        if (!url) {
          res.status(400).json({ error: 'Invalid request', code: 'INVALID_REQUEST' });
          return;
        }

        // GET /api/v1/hugo-love/matches/:matchId (check first for specificity)
        const matchIdMatch = url.match(/\/matches\/([^/?]+)$/);
        if (matchIdMatch && method === 'GET') {
          const matchId = matchIdMatch[1];
          const queryUrl = new URL(req.url || '', 'http://localhost');
          queryUrl.searchParams.set('matchId', matchId);
          authReq.query = { matchId };
          return handleGetMatch(authReq, res);
        }

        // GET /api/v1/hugo-love/matches (list all)
        if (url.match(/\/matches$/) && method === 'GET') {
          return handleGetMatches(authReq, res);
        }

        // POST /api/v1/hugo-love/swipe
        if (url.match(/\/swipe$/) && method === 'POST') {
          return handleSwipe(authReq, res);
        }

        // POST /api/v1/hugo-love/ratings
        if (url.match(/\/ratings$/) && method === 'POST') {
          return handleRating(authReq, res);
        }

        // POST /api/v1/hugo-love/block
        if (url.match(/\/block$/) && method === 'POST') {
          return handleBlockUser(authReq, res);
        }

        // DELETE /api/v1/hugo-love/block/:blockedUserId
        const blockMatch = url.match(/\/block\/([^/?]+)$/);
        if (blockMatch && method === 'DELETE') {
          const blockedUserId = blockMatch[1];
          authReq.query = { blockedUserId };
          return handleUnblockUser(authReq, res);
        }

        res.status(404).json({ error: 'Endpoint not found', code: 'NOT_FOUND' });
      });
    });
  })(req, res);
}
