/**
 * Hugo Love Messages Routes
 * GET /api/v1/hugo-love/matches/:matchId/messages - Get conversation
 * POST /api/v1/hugo-love/matches/:matchId/messages - Send message
 * PATCH /api/v1/hugo-love/messages/:messageId/read - Mark as read
 * DELETE /api/v1/hugo-love/messages/:messageId - Delete message
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { getSupabase } from '../../middleware/schemaRouter';
import { validateSendMessageRequest, validatePagination } from './validation';
import { ValidationError, isValidUuid } from '../../utils/validation-express';
import { logger } from '../../../utils/logger';

const router = Router();
router.use(requireAuth);

/**
 * GET /api/v1/hugo-love/matches/:matchId/messages
 */
router.get('/:matchId/messages', async (req: Request, res: Response): Promise<void> => {
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
    const { limit, offset } = validatePagination(req.query);

    const supabase = getSupabase(req);

    // Verify user has access to this match
    const { data: match } = await supabase
      .from('hugo_love_matches')
      .select('id')
      .eq('id', matchId)
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .single();

    if (!match) {
      res.status(403).json({ error: 'Unauthorized', code: 'FORBIDDEN' });
      return;
    }

    const { data: messages, error } = await supabase
      .from('hugo_messages')
      .select('*')
      .eq('match_id', matchId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('Messages fetch error', { error });
      res.status(500).json({ error: 'Failed to fetch messages', code: 'SERVER_ERROR' });
      return;
    }

    res.json({
      messages: messages || [],
      hasMore: (messages?.length || 0) === limit,
    });
  } catch (error: any) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message, code: 'INVALID_INPUT', details: error.details });
    } else {
      logger.error('Messages endpoint error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
    }
  }
});

/**
 * POST /api/v1/hugo-love/matches/:matchId/messages
 */
router.post('/:matchId/messages', async (req: Request, res: Response): Promise<void> => {
  try {
    // SECURITY: Validate all IDs to prevent filter injection
    const rawFromUserId = req.profileId || req.user!.id;
    const { matchId } = req.params;

    if (!isValidUuid(rawFromUserId)) {
      res.status(400).json({ error: 'Invalid profile ID format', code: 'INVALID_PROFILE_ID' });
      return;
    }
    if (!isValidUuid(matchId)) {
      res.status(400).json({ error: 'Invalid match ID format', code: 'INVALID_MATCH_ID' });
      return;
    }
    const fromUserId = rawFromUserId;
    const validated = validateSendMessageRequest(req.body);

    const supabase = getSupabase(req);

    // Verify user has access to this match
    const { data: match } = await supabase
      .from('hugo_love_matches')
      .select('user1_id, user2_id')
      .eq('id', matchId)
      .or(`user1_id.eq.${fromUserId},user2_id.eq.${fromUserId}`)
      .single();

    if (!match) {
      res.status(403).json({ error: 'Unauthorized', code: 'FORBIDDEN' });
      return;
    }

    const { data: message, error } = await supabase
      .from('hugo_messages')
      .insert({
        match_id: matchId,
        from_user_id: fromUserId,
        text: validated.text,
        attachments: validated.attachments,
      })
      .select()
      .single();

    if (error) {
      logger.error('Message creation error', { error });
      res.status(500).json({ error: 'Failed to send message', code: 'SERVER_ERROR' });
      return;
    }

    res.status(201).json({
      messageId: message.id,
      timestamp: message.created_at,
      isRead: false,
    });
  } catch (error: any) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message, code: 'INVALID_INPUT', details: error.details });
    } else {
      logger.error('Send message endpoint error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
    }
  }
});

/**
 * PATCH /api/v1/hugo-love/messages/:messageId/read
 */
router.patch('/:messageId/read', async (req: Request, res: Response): Promise<void> => {
  try {
    // SECURITY: Validate all IDs to prevent filter injection
    const rawUserId = req.profileId || req.user!.id;
    const { messageId } = req.params;

    if (!isValidUuid(rawUserId)) {
      res.status(400).json({ error: 'Invalid profile ID format', code: 'INVALID_PROFILE_ID' });
      return;
    }
    if (!isValidUuid(messageId)) {
      res.status(400).json({ error: 'Invalid message ID format', code: 'INVALID_MESSAGE_ID' });
      return;
    }
    const userId = rawUserId;

    const supabase = getSupabase(req);

    // Verify user is recipient
    const { data: message } = await supabase
      .from('hugo_messages')
      .select('from_user_id, match_id')
      .eq('id', messageId)
      .single();

    if (!message) {
      res.status(404).json({ error: 'Message not found', code: 'NOT_FOUND' });
      return;
    }

    if (message.from_user_id === userId) {
      throw new ValidationError('Cannot mark own message as read', {});
    }

    const { data: updated, error } = await supabase
      .from('hugo_messages')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', messageId)
      .select()
      .single();

    if (error) {
      logger.error('Mark read error', { error });
      res.status(500).json({ error: 'Failed to mark message as read', code: 'SERVER_ERROR' });
      return;
    }

    res.json({
      messageId: updated.id,
      isRead: true,
      readAt: updated.read_at,
    });
  } catch (error: any) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message, code: 'INVALID_INPUT', details: error.details });
    } else {
      logger.error('Mark read endpoint error', { error });
      res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
    }
  }
});

/**
 * DELETE /api/v1/hugo-love/messages/:messageId
 */
router.delete('/:messageId', async (req: Request, res: Response): Promise<void> => {
  try {
    // SECURITY: Validate all IDs to prevent filter injection
    const rawUserId = req.profileId || req.user!.id;
    const { messageId } = req.params;

    if (!isValidUuid(rawUserId)) {
      res.status(400).json({ error: 'Invalid profile ID format', code: 'INVALID_PROFILE_ID' });
      return;
    }
    if (!isValidUuid(messageId)) {
      res.status(400).json({ error: 'Invalid message ID format', code: 'INVALID_MESSAGE_ID' });
      return;
    }
    const userId = rawUserId;

    const supabase = getSupabase(req);

    // Verify user owns this message
    const { data: message } = await supabase
      .from('hugo_messages')
      .select('id')
      .eq('id', messageId)
      .eq('from_user_id', userId)
      .single();

    if (!message) {
      res.status(404).json({ error: 'Message not found or not authorized', code: 'NOT_FOUND' });
      return;
    }

    // Soft delete (mark as deleted)
    const { error } = await supabase
      .from('hugo_messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', messageId);

    if (error) {
      logger.error('Delete message error', { error });
      res.status(500).json({ error: 'Failed to delete message', code: 'SERVER_ERROR' });
      return;
    }

    res.status(204).send();
  } catch (error: any) {
    logger.error('Delete message endpoint error', { error });
    res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
  }
});

export default router;
