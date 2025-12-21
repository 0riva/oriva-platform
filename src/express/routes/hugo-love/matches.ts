/**
 * Hugo Love Matches Routes
 * GET /api/v1/hugo-love/matches - Get user's matches
 * GET /api/v1/hugo-love/matches/:matchId - Get match details
 * PATCH /api/v1/hugo-love/matches/:matchId - Update match status
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { getSupabase } from '../../middleware/schemaRouter';
import { validateUpdateMatchRequest, validatePagination } from './validation';
import { ValidationError, isValidUuid } from '../../utils/validation-express';

const router = Router();
router.use(requireAuth);

/**
 * GET /api/v1/hugo-love/matches
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
    const status = (req.query.status as string) || 'active';
    const { limit, offset } = validatePagination(req.query);

    const supabase = getSupabase(req);

    const {
      data: matches,
      count,
      error,
    } = await supabase
      .from('hugo_love_matches')
      .select('*', { count: 'exact' })
      .eq('status', status)
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Matches fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch matches', code: 'SERVER_ERROR' });
      return;
    }

    res.json({
      matches: matches || [],
      totalCount: count || 0,
      hasMore: offset + limit < (count || 0),
    });
  } catch (error: any) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message, code: 'INVALID_INPUT', details: error.details });
    } else {
      console.error('Matches endpoint error:', error);
      res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
    }
  }
});

/**
 * GET /api/v1/hugo-love/matches/:matchId
 */
router.get('/:matchId', async (req: Request, res: Response): Promise<void> => {
  try {
    // SECURITY: Validate all IDs to prevent filter injection
    const rawUserId = req.profileId || req.user!.id;
    const { matchId } = req.params;

    if (!isValidUuid(rawUserId)) {
      res.status(400).json({ error: 'Invalid profile ID format', code: 'INVALID_PROFILE_ID' });
      return;
    }
    if (!isValidUuid(matchId)) {
      res.status(400).json({ error: 'Invalid match ID format', code: 'INVALID_MATCH_ID' });
      return;
    }
    const userId = rawUserId;

    const supabase = getSupabase(req);

    const { data: match, error: matchError } = await supabase
      .from('hugo_love_matches')
      .select('*')
      .eq('id', matchId)
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .single();

    if (matchError || !match) {
      res.status(404).json({ error: 'Match not found', code: 'NOT_FOUND' });
      return;
    }

    // Get other user's profile
    const otherUserId = match.user1_id === userId ? match.user2_id : match.user1_id;
    const { data: otherProfile } = await supabase
      .from('hugo_love_profiles')
      .select('*')
      .eq('account_id', otherUserId)
      .single();

    // Get last message
    const { data: lastMessage } = await supabase
      .from('hugo_messages')
      .select('*')
      .eq('match_id', matchId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    res.json({
      match,
      otherProfile: otherProfile || undefined,
      lastMessage: lastMessage || undefined,
    });
  } catch (error: any) {
    console.error('Match details endpoint error:', error);
    res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
  }
});

/**
 * PATCH /api/v1/hugo-love/matches/:matchId
 */
router.patch('/:matchId', async (req: Request, res: Response): Promise<void> => {
  try {
    // SECURITY: Validate all IDs to prevent filter injection
    const rawUserId = req.profileId || req.user!.id;
    const { matchId } = req.params;

    if (!isValidUuid(rawUserId)) {
      res.status(400).json({ error: 'Invalid profile ID format', code: 'INVALID_PROFILE_ID' });
      return;
    }
    if (!isValidUuid(matchId)) {
      res.status(400).json({ error: 'Invalid match ID format', code: 'INVALID_MATCH_ID' });
      return;
    }
    const userId = rawUserId;
    const validated = validateUpdateMatchRequest(req.body);

    const supabase = getSupabase(req);

    // Verify user owns this match
    const { data: match, error: matchError } = await supabase
      .from('hugo_love_matches')
      .select('id')
      .eq('id', matchId)
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .single();

    if (matchError || !match) {
      res.status(403).json({ error: 'Unauthorized', code: 'FORBIDDEN' });
      return;
    }

    // Update status
    const { data: updated, error } = await supabase
      .from('hugo_love_matches')
      .update({ status: validated.status })
      .eq('id', matchId)
      .select()
      .single();

    if (error) {
      console.error('Match update error:', error);
      res.status(500).json({ error: 'Failed to update match', code: 'SERVER_ERROR' });
      return;
    }

    res.json(updated);
  } catch (error: any) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message, code: 'INVALID_INPUT', details: error.details });
    } else {
      console.error('Match update endpoint error:', error);
      res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
    }
  }
});

export default router;
