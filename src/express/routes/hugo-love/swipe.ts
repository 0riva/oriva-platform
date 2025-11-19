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
import { ValidationError } from '../../utils/validation-express';

const router = Router();

// All routes require authentication
router.use(requireAuth);

/**
 * POST /api/v1/hugo-love/swipe
 * Submit a swipe decision
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const validated = validateSwipeRequest(req.body);

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
      console.error('Swipe creation error:', swipeError);
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
    console.error('Swipe endpoint error:', error);
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
    const userId = req.user!.id;
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
      console.error('Swipe history error:', error);
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
    console.error('Swipe history endpoint error:', error);
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
 * GET /api/v1/hugo-love/swipes/today
 * Get today's swipes
 */
router.get('/today', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const today = new Date().toISOString().split('T')[0];

    const supabase = getSupabase(req);

    const { data: swipes, error } = await supabase
      .from('hugo_love_swipes')
      .select('*')
      .eq('swiper_id', userId)
      .gte('timestamp', `${today}T00:00:00`)
      .lt('timestamp', `${today}T23:59:59`);

    if (error) {
      console.error('Today swipes error:', error);
      res.status(500).json({
        error: "Failed to fetch today's swipes",
        code: 'SERVER_ERROR',
      });
      return;
    }

    res.json({ swipes: swipes || [] });
  } catch (error: any) {
    console.error('Today swipes endpoint error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR',
    });
  }
});

export default router;
