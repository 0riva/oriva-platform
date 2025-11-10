/**
 * Hugo Love Profiles Routes
 * GET /api/v1/hugo-love/profiles/me - Get current user's profile
 * PATCH /api/v1/hugo-love/profiles/me - Update current user's profile
 * GET /api/v1/hugo-love/profiles/:userId - Get public profile
 * POST /api/v1/hugo-love/profiles/blocks - Block a user
 * GET /api/v1/hugo-love/profiles/blocks - Get blocked users
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { getSupabase } from '../../middleware/schemaRouter';
import { validateUpdateProfileRequest, validateBlockUserRequest } from './validation';
import { ValidationError } from '../../utils/validation';

const router = Router();
router.use(requireAuth);

/**
 * GET /api/v1/hugo-love/profiles/me
 */
router.get('/me', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const supabase = getSupabase(req);

    const { data: profile, error } = await supabase
      .from('hugo_love_profiles')
      .select('*')
      .eq('account_id', userId)
      .single();

    if (error) {
      console.error('Profile fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch profile', code: 'SERVER_ERROR' });
      return;
    }

    res.json(profile);
  } catch (error: any) {
    console.error('Profile endpoint error:', error);
    res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
  }
});

/**
 * PATCH /api/v1/hugo-love/profiles/me
 */
router.patch('/me', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const updates = validateUpdateProfileRequest(req.body);

    if (Object.keys(updates).length === 0) {
      throw new ValidationError('No valid fields to update', {});
    }

    const supabase = getSupabase(req);

    const { data: updated, error } = await supabase
      .from('hugo_love_profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('account_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Profile update error:', error);
      res.status(500).json({ error: 'Failed to update profile', code: 'SERVER_ERROR' });
      return;
    }

    res.json({
      userId: updated.account_id,
      updatedFields: Object.keys(updates),
      updatedAt: updated.updated_at,
    });
  } catch (error: any) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message, code: 'INVALID_INPUT', details: error.details });
    } else {
      console.error('Profile update endpoint error:', error);
      res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
    }
  }
});

/**
 * GET /api/v1/hugo-love/profiles/:userId
 */
router.get('/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const supabase = getSupabase(req);

    const { data: profile, error } = await supabase
      .from('hugo_love_profiles')
      .select('account_id, name, age, bio, photos, interests, location')
      .eq('account_id', userId)
      .single();

    if (error || !profile) {
      res.status(404).json({ error: 'Profile not found', code: 'NOT_FOUND' });
      return;
    }

    // Return public view (limited fields)
    res.json({
      userId: profile.account_id,
      name: profile.name,
      age: profile.age,
      bio: profile.bio,
      photos: profile.photos,
      interests: profile.interests,
      location: profile.location
        ? {
            city: profile.location.city,
            state: profile.location.state,
          }
        : undefined,
    });
  } catch (error: any) {
    console.error('Public profile endpoint error:', error);
    res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
  }
});

/**
 * POST /api/v1/hugo-love/profiles/blocks
 */
router.post('/blocks', async (req: Request, res: Response): Promise<void> => {
  try {
    const blockerId = req.user!.id;
    const validated = validateBlockUserRequest(req.body);

    if (blockerId === validated.blockedUserId) {
      throw new ValidationError('Cannot block yourself', { field: 'blockedUserId' });
    }

    const supabase = getSupabase(req);

    const { data: block, error } = await supabase
      .from('hugo_love_blocks')
      .insert({
        blocker_id: blockerId,
        blocked_id: validated.blockedUserId,
      })
      .select()
      .single();

    if (error) {
      console.error('Block creation error:', error);
      res.status(500).json({ error: 'Failed to block user', code: 'SERVER_ERROR' });
      return;
    }

    res.status(201).json({
      blockId: block.id,
      blockedUserId: validated.blockedUserId,
      blockedAt: block.created_at,
    });
  } catch (error: any) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message, code: 'INVALID_INPUT', details: error.details });
    } else {
      console.error('Block endpoint error:', error);
      res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
    }
  }
});

/**
 * GET /api/v1/hugo-love/profiles/blocks
 */
router.get('/blocks', async (req: Request, res: Response): Promise<void> => {
  try {
    const blockerId = req.user!.id;
    const supabase = getSupabase(req);

    const { data: blocks, error } = await supabase
      .from('hugo_love_blocks')
      .select('*')
      .eq('blocker_id', blockerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Blocks fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch blocks', code: 'SERVER_ERROR' });
      return;
    }

    res.json({ blocks: blocks || [] });
  } catch (error: any) {
    console.error('Blocks endpoint error:', error);
    res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
  }
});

export default router;
