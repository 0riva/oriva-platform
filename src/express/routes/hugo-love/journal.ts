/**
 * Hugo Love Journal Routes
 * POST /api/v1/hugo-love/journal - Create journal entry
 * GET /api/v1/hugo-love/journal - Get journal entries
 * PATCH /api/v1/hugo-love/journal/:entryId - Update entry
 * DELETE /api/v1/hugo-love/journal/:entryId - Delete entry
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { getSupabase } from '../../middleware/schemaRouter';
import { validateCreateJournalRequest, validateUpdateJournalRequest } from './validation';
import { ValidationError } from '../../utils/validation-express';
import { logger } from '../../../utils/logger';

const router = Router();
router.use(requireAuth);

/**
 * POST /api/v1/hugo-love/journal
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    // Use Oriva profile ID from X-Profile-ID header - journal entries are per profile
    const userId = req.profileId || req.user!.id;
    const validated = validateCreateJournalRequest(req.body);

    const supabase = getSupabase(req);

    const { data: entry, error } = await supabase
      .from('hugo_journal')
      .insert({
        user_id: userId,
        text: validated.text,
        date: validated.date,
        tags: validated.tags,
      })
      .select()
      .single();

    if (error) {
      logger.error('Journal creation error', { error });
      res.status(500).json({ error: 'Failed to create journal entry', code: 'SERVER_ERROR' });
      return;
    }

    res.status(201).json({
      entryId: entry.id,
      createdAt: entry.created_at,
    });
  } catch (error: any) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message, code: 'INVALID_INPUT', details: error.details });
    } else {
      logger.error('Journal creation endpoint error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
    }
  }
});

/**
 * GET /api/v1/hugo-love/journal
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    // Use Oriva profile ID from X-Profile-ID header - journal entries are per profile
    const userId = req.profileId || req.user!.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const tags = req.query.tags as string;

    const supabase = getSupabase(req);

    let query = supabase
      .from('hugo_journal')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(limit);

    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }
    if (tags) {
      const tagArray = tags.split(',');
      query = query.contains('tags', tagArray);
    }

    const { data: entries, count, error } = await query;

    if (error) {
      logger.error('Journal fetch error', { error });
      res.status(500).json({ error: 'Failed to fetch journal entries', code: 'SERVER_ERROR' });
      return;
    }

    res.json({
      entries: entries || [],
      totalCount: count || 0,
    });
  } catch (error: any) {
    logger.error('Journal fetch endpoint error', { error });
    res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
  }
});

/**
 * PATCH /api/v1/hugo-love/journal/:entryId
 */
router.patch('/:entryId', async (req: Request, res: Response): Promise<void> => {
  try {
    // Use Oriva profile ID from X-Profile-ID header - journal entries are per profile
    const userId = req.profileId || req.user!.id;
    const { entryId } = req.params;
    const updates = validateUpdateJournalRequest(req.body);

    if (Object.keys(updates).length === 0) {
      throw new ValidationError('No valid fields to update', {});
    }

    const supabase = getSupabase(req);

    // Verify ownership
    const { data: entry } = await supabase
      .from('hugo_journal')
      .select('id')
      .eq('id', entryId)
      .eq('user_id', userId)
      .single();

    if (!entry) {
      res.status(404).json({ error: 'Entry not found or unauthorized', code: 'NOT_FOUND' });
      return;
    }

    const { data: updated, error } = await supabase
      .from('hugo_journal')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', entryId)
      .select()
      .single();

    if (error) {
      logger.error('Journal update error', { error });
      res.status(500).json({ error: 'Failed to update journal entry', code: 'SERVER_ERROR' });
      return;
    }

    res.json({
      entryId: updated.id,
      updatedAt: updated.updated_at,
    });
  } catch (error: any) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message, code: 'INVALID_INPUT', details: error.details });
    } else {
      logger.error('Journal update endpoint error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
    }
  }
});

/**
 * DELETE /api/v1/hugo-love/journal/:entryId
 */
router.delete('/:entryId', async (req: Request, res: Response): Promise<void> => {
  try {
    // Use Oriva profile ID from X-Profile-ID header - journal entries are per profile
    const userId = req.profileId || req.user!.id;
    const { entryId } = req.params;

    const supabase = getSupabase(req);

    // Verify ownership and delete
    const { error } = await supabase
      .from('hugo_journal')
      .delete()
      .eq('id', entryId)
      .eq('user_id', userId);

    if (error) {
      logger.error('Journal delete error', { error });
      res.status(500).json({ error: 'Failed to delete journal entry', code: 'SERVER_ERROR' });
      return;
    }

    res.status(204).send();
  } catch (error: any) {
    logger.error('Journal delete endpoint error', { error });
    res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
  }
});

export default router;
