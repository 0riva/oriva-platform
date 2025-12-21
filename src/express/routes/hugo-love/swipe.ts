/**
 * Hugo Love Swipe Routes
 * POST /api/v1/hugo-love/swipe - Submit a swipe
 * GET /api/v1/hugo-love/swipes - Get swipe history
 * GET /api/v1/hugo-love/swipes/today - Get today's swipes
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { getSupabase } from '../../middleware/schemaRouter';
import { validateSwipeRequest, validatePagination } from './validation';
import { ValidationError, isValidUuid } from '../../utils/validation-express';
import { logger } from '../../../utils/logger';

const router = Router();

// All routes require authentication
router.use(requireAuth);

/**
 * POST /api/v1/hugo-love/swipe
 * Submit a swipe decision
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    // SECURITY: Validate all IDs to prevent filter injection
    const rawUserId = req.profileId || req.user!.id;
    const validated = validateSwipeRequest(req.body);

    if (!isValidUuid(rawUserId)) {
      res.status(400).json({ error: 'Invalid profile ID format', code: 'INVALID_PROFILE_ID' });
      return;
    }
    if (!isValidUuid(validated.targetUserId)) {
      res.status(400).json({ error: 'Invalid target user ID format', code: 'INVALID_TARGET_ID' });
      return;
    }
    const userId = rawUserId;

    if (userId === validated.targetUserId) {
      throw new ValidationError('Cannot swipe on yourself', { field: 'targetUserId' });
    }

    const supabase = getSupabase(req);

    // Create swipe record
    const { data: swipe, error: swipeError } = await supabase
      .from('hugo_love_swipes')
      .insert({
        swiper_id: userId,
        target_id: validated.targetUserId,
        decision: validated.decision,
        timestamp: new Date().toISOString(),
      })
      .select()
      .single();

    if (swipeError) {
      logger.error('Swipe creation error', { error: swipeError });
      res.status(500).json({
        error: 'Failed to create swipe',
        code: 'SERVER_ERROR',
      });
      return;
    }

    // Check for mutual match
    let mutualMatch = false;
    let matchId: string | undefined;

    if (validated.decision === 'like') {
      // Check if target user already liked this user
      const { data: reciprocalLike } = await supabase
        .from('hugo_love_swipes')
        .select('id')
        .eq('swiper_id', validated.targetUserId)
        .eq('target_id', userId)
        .eq('decision', 'like')
        .single();

      if (reciprocalLike) {
        mutualMatch = true;

        // Check if match already exists
        const { data: existingMatch } = await supabase
          .from('hugo_love_matches')
          .select('id')
          .or(
            `and(user1_id.eq.${userId},user2_id.eq.${validated.targetUserId}),and(user1_id.eq.${validated.targetUserId},user2_id.eq.${userId})`
          )
          .eq('status', 'active')
          .single();

        matchId = existingMatch?.id;
      }
    }

    res.status(200).json({
      swipeId: swipe.id,
      mutualMatch,
      matchId,
    });
  } catch (error: any) {
    logger.error('Swipe endpoint error', { error });
    if (error instanceof ValidationError) {
      res.status(400).json({
        error: error.message,
        code: 'INVALID_INPUT',
        details: error.details,
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        code: 'SERVER_ERROR',
      });
    }
  }
});

/**
 * GET /api/v1/hugo-love/swipes
 * Get user's swipe history
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    // SECURITY: Validate profileId to prevent filter injection
    const rawUserId = req.profileId || req.user!.id;
    if (!isValidUuid(rawUserId)) {
      res.status(400).json({ error: 'Invalid profile ID format', code: 'INVALID_PROFILE_ID' });
      return;
    }
    const userId = rawUserId;
    const { limit, offset } = validatePagination(req.query);

    const supabase = getSupabase(req);

    const {
      data: swipes,
      error,
      count,
    } = await supabase
      .from('hugo_love_swipes')
      .select('*', { count: 'exact' })
      .eq('swiper_id', userId)
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('Swipe history error', { error });
      res.status(500).json({
        error: 'Failed to fetch swipes',
        code: 'SERVER_ERROR',
      });
      return;
    }

    res.json({
      swipes: swipes || [],
      totalCount: count || 0,
      hasMore: offset + limit < (count || 0),
    });
  } catch (error: any) {
    logger.error('Swipe history endpoint error', { error });
    if (error instanceof ValidationError) {
      res.status(400).json({
        error: error.message,
        code: 'INVALID_INPUT',
        details: error.details,
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        code: 'SERVER_ERROR',
      });
    }
  }
});

/**
 * GET /api/v1/tenant/hugo-love/swipes/stats/daily
 * Get daily swipe statistics for the user
 * Returns remaining likes/dislikes and today's activity
 */
router.get('/stats/daily', async (req: Request, res: Response): Promise<void> => {
  try {
    // SECURITY: Validate profileId to prevent filter injection
    const rawUserId = req.profileId || req.user!.id;
    if (!isValidUuid(rawUserId)) {
      res.status(400).json({ error: 'Invalid profile ID format', code: 'INVALID_PROFILE_ID' });
      return;
    }
    const userId = rawUserId;
    const today = new Date().toISOString().split('T')[0];

    const supabase = getSupabase(req);

    // Get today's swipes for counts
    const { data: todaySwipes, error: swipesError } = await supabase
      .from('hugo_love_swipes')
      .select('decision')
      .eq('swiper_id', userId)
      .gte('timestamp', `${today}T00:00:00`)
      .lt('timestamp', `${today}T23:59:59`);

    if (swipesError) {
      logger.error('Daily stats swipes error', { error: swipesError });
      res.status(500).json({
        error: 'Failed to fetch daily stats',
        code: 'SERVER_ERROR',
      });
      return;
    }

    // Get today's matches
    const { data: todayMatches, error: matchesError } = await supabase
      .from('hugo_love_matches')
      .select('id')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .gte('created_at', `${today}T00:00:00`)
      .lt('created_at', `${today}T23:59:59`);

    if (matchesError) {
      logger.error('Daily stats matches error', { error: matchesError });
      // Continue with swipe stats even if matches fail
    }

    // Calculate stats
    const swipes = todaySwipes || [];
    const likesToday = swipes.filter((s) => s.decision === 'like').length;
    const dislikesToday = swipes.filter(
      (s) => s.decision === 'dislike' || s.decision === 'pass'
    ).length;

    // Default limits (could be made configurable per subscription tier)
    const DAILY_LIKE_LIMIT = 50;
    const DAILY_DISLIKE_LIMIT = 100;

    res.json({
      data: {
        likesRemaining: Math.max(0, DAILY_LIKE_LIMIT - likesToday),
        dislikesRemaining: Math.max(0, DAILY_DISLIKE_LIMIT - dislikesToday),
        totalSwipesToday: swipes.length,
        matchesToday: todayMatches?.length || 0,
      },
    });
  } catch (error: any) {
    logger.error('Daily stats endpoint error', { error });
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR',
    });
  }
});

/**
 * GET /api/v1/hugo-love/swipes/today
 * Get today's swipes
 */
router.get('/today', async (req: Request, res: Response): Promise<void> => {
  try {
    // SECURITY: Validate profileId to prevent filter injection
    const rawUserId = req.profileId || req.user!.id;
    if (!isValidUuid(rawUserId)) {
      res.status(400).json({ error: 'Invalid profile ID format', code: 'INVALID_PROFILE_ID' });
      return;
    }
    const userId = rawUserId;
    const today = new Date().toISOString().split('T')[0];

    const supabase = getSupabase(req);

    const { data: swipes, error } = await supabase
      .from('hugo_love_swipes')
      .select('*')
      .eq('swiper_id', userId)
      .gte('timestamp', `${today}T00:00:00`)
      .lt('timestamp', `${today}T23:59:59`);

    if (error) {
      logger.error('Today swipes error', { error });
      res.status(500).json({
        error: "Failed to fetch today's swipes",
        code: 'SERVER_ERROR',
      });
      return;
    }

    res.json({ swipes: swipes || [] });
  } catch (error: any) {
    logger.error('Today swipes endpoint error', { error });
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR',
    });
  }
});

export default router;
