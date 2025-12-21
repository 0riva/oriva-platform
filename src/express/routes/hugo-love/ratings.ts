/**
 * Hugo Love Ratings Routes
 * POST /api/v1/hugo-love/ratings - Submit a rating
 * GET /api/v1/hugo-love/ratings/:userId - Get ratings received
 * GET /api/v1/hugo-love/ratings/given - Get ratings given
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { getSupabase } from '../../middleware/schemaRouter';
import { validateRatingRequest } from './validation';
import { ValidationError } from '../../utils/validation-express';
import { logger } from '../../../utils/logger';

const router = Router();
router.use(requireAuth);

/**
 * POST /api/v1/hugo-love/ratings
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    // Use Oriva profile ID from X-Profile-ID header - ratings are tied to the selected profile
    const raterId = req.profileId || req.user!.id;
    const validated = validateRatingRequest(req.body);

    if (raterId === validated.targetUserId) {
      throw new ValidationError('Cannot rate yourself', { field: 'targetUserId' });
    }

    const supabase = getSupabase(req);

    const { data: rating, error } = await supabase
      .from('hugo_love_ratings')
      .insert({
        rater_id: raterId,
        target_id: validated.targetUserId,
        score: validated.score,
        comment: validated.comment,
      })
      .select()
      .single();

    if (error) {
      logger.error('Rating creation error', { error });
      res.status(500).json({ error: 'Failed to create rating', code: 'SERVER_ERROR' });
      return;
    }

    // Calculate average for target user
    const { data: ratings } = await supabase
      .from('hugo_love_ratings')
      .select('score')
      .eq('target_id', validated.targetUserId);

    const avgScore = ratings?.length
      ? ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length
      : 0;

    res.status(201).json({
      ratingId: rating.id,
      averageScore: avgScore,
      totalRatings: ratings?.length || 0,
    });
  } catch (error: any) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message, code: 'INVALID_INPUT', details: error.details });
    } else {
      logger.error('Rating endpoint error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
    }
  }
});

/**
 * GET /api/v1/hugo-love/ratings/:userId
 */
router.get('/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const supabase = getSupabase(req);

    const { data: ratings, error } = await supabase
      .from('hugo_love_ratings')
      .select('*')
      .eq('target_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Ratings fetch error', { error });
      res.status(500).json({ error: 'Failed to fetch ratings', code: 'SERVER_ERROR' });
      return;
    }

    const avgScore = ratings?.length
      ? ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length
      : 0;

    res.json({
      ratings: ratings || [],
      averageScore: avgScore,
      totalRatings: ratings?.length || 0,
    });
  } catch (error: any) {
    logger.error('Ratings fetch endpoint error', { error });
    res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
  }
});

/**
 * GET /api/v1/hugo-love/ratings/given
 */
router.get('/given', async (req: Request, res: Response): Promise<void> => {
  try {
    // Use Oriva profile ID from X-Profile-ID header - ratings are tied to the selected profile
    const raterId = req.profileId || req.user!.id;
    const supabase = getSupabase(req);

    const { data: ratings, error } = await supabase
      .from('hugo_love_ratings')
      .select('*')
      .eq('rater_id', raterId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Given ratings fetch error', { error });
      res.status(500).json({ error: 'Failed to fetch given ratings', code: 'SERVER_ERROR' });
      return;
    }

    res.json({ ratings: ratings || [] });
  } catch (error: any) {
    logger.error('Given ratings endpoint error', { error });
    res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
  }
});

export default router;
