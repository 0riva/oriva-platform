/**
 * Chat Routes
 * GET /api/v1/travel-hub/chat/conversations - List conversations
 * GET /api/v1/travel-hub/chat/conversations/:id - Get conversation with messages
 * POST /api/v1/travel-hub/chat/conversations - Create conversation
 * PATCH /api/v1/travel-hub/chat/conversations/:id/status - Update conversation status
 * GET /api/v1/travel-hub/chat/conversations/:id/messages - Get messages
 * POST /api/v1/travel-hub/chat/conversations/:id/messages - Send message
 * POST /api/v1/travel-hub/chat/conversations/:id/read - Mark as read
 * GET /api/v1/travel-hub/chat/unread - Get unread counts
 */

import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { getSupabase } from '../../middleware/schemaRouter';
import { logger } from '../../../utils/logger';

const router = Router();

const SCHEMA = 'travel_hub';

// Validation middleware helper
const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ ok: false, errors: errors.array() });
  }
  next();
};

/**
 * GET /api/v1/travel-hub/chat/conversations
 * List conversations for a user (as client or concierge)
 */
router.get(
  '/conversations',
  [
    query('role').isIn(['client', 'concierge']),
    query('user_id').isUUID(),
    query('status').optional().isIn(['open', 'resolved', 'archived']),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const { role, user_id, status, limit = 20, offset = 0 } = req.query;

      const filterField = role === 'client' ? 'client_id' : 'concierge_id';

      let query = supabase
        .schema(SCHEMA)
        .from('concierge_conversations')
        .select('*', { count: 'exact' })
        .eq(filterField, user_id)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error, count } = await query;

      if (error) {
        logger.error('[ChatRoute] Error fetching conversations', { error });
        return res.status(500).json({ ok: false, error: error.message });
      }

      res.json({
        ok: true,
        data,
        pagination: {
          total: count || 0,
          limit: Number(limit),
          offset: Number(offset),
        },
      });
    } catch (error: any) {
      logger.error('[ChatRoute] Unexpected error', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/v1/travel-hub/chat/conversations/:id
 * Get conversation by ID
 */
router.get(
  '/conversations/:id',
  [param('id').isUUID()],
  validate,
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const { id } = req.params;

      const { data, error } = await supabase
        .schema(SCHEMA)
        .from('concierge_conversations')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ ok: false, error: 'Conversation not found' });
        }
        logger.error('[ChatRoute] Error fetching conversation', { error, id });
        return res.status(500).json({ ok: false, error: error.message });
      }

      res.json({ ok: true, data });
    } catch (error: any) {
      logger.error('[ChatRoute] Unexpected error in getById', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

/**
 * POST /api/v1/travel-hub/chat/conversations
 * Create new conversation
 */
router.post(
  '/conversations',
  [
    body('client_id').isUUID(),
    body('concierge_id').isUUID(),
    body('itinerary_id').optional().isUUID(),
    body('subject').optional().isString().isLength({ max: 200 }),
    body('initial_message').optional().isString().isLength({ max: 5000 }),
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const { client_id, concierge_id, itinerary_id, subject, initial_message } = req.body;

      const conversationData = {
        client_id,
        concierge_id,
        itinerary_id,
        subject,
        status: 'open',
        unread_count_client: 0,
        unread_count_concierge: initial_message ? 1 : 0,
        metadata: {},
      };

      const { data: conversation, error: convError } = await supabase
        .schema(SCHEMA)
        .from('concierge_conversations')
        .insert([conversationData])
        .select()
        .single();

      if (convError) {
        logger.error('[ChatRoute] Error creating conversation', { error: convError });
        return res.status(500).json({ ok: false, error: convError.message });
      }

      // Send initial message if provided
      if (initial_message) {
        const messageData = {
          conversation_id: conversation.id,
          sender_type: 'client',
          sender_id: client_id,
          content: initial_message,
          message_type: 'text',
          attachments: [],
          metadata: {},
        };

        const { error: msgError } = await supabase
          .schema(SCHEMA)
          .from('concierge_messages')
          .insert([messageData]);

        if (msgError) {
          logger.error('[ChatRoute] Error sending initial message', { error: msgError });
        }

        // Update last_message_at
        await supabase
          .schema(SCHEMA)
          .from('concierge_conversations')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', conversation.id);
      }

      logger.info('[ChatRoute] Conversation created', { conversationId: conversation.id });
      res.status(201).json({ ok: true, data: conversation });
    } catch (error: any) {
      logger.error('[ChatRoute] Unexpected error in create', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

/**
 * PATCH /api/v1/travel-hub/chat/conversations/:id/status
 * Update conversation status
 */
router.patch(
  '/conversations/:id/status',
  [param('id').isUUID(), body('status').isIn(['open', 'resolved', 'archived'])],
  validate,
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const { id } = req.params;
      const { status } = req.body;

      const { data, error } = await supabase
        .schema(SCHEMA)
        .from('concierge_conversations')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ ok: false, error: 'Conversation not found' });
        }
        logger.error('[ChatRoute] Error updating status', { error, id });
        return res.status(500).json({ ok: false, error: error.message });
      }

      logger.info('[ChatRoute] Status updated', { conversationId: id, status });
      res.json({ ok: true, data });
    } catch (error: any) {
      logger.error('[ChatRoute] Unexpected error in status', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/v1/travel-hub/chat/conversations/:id/messages
 * Get messages for a conversation
 */
router.get(
  '/conversations/:id/messages',
  [
    param('id').isUUID(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('before').optional().isISO8601(),
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const { id } = req.params;
      const { limit = 50, before } = req.query;

      let query = supabase
        .schema(SCHEMA)
        .from('concierge_messages')
        .select('*')
        .eq('conversation_id', id)
        .order('created_at', { ascending: false })
        .limit(Number(limit));

      if (before) {
        query = query.lt('created_at', before);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('[ChatRoute] Error fetching messages', { error, conversationId: id });
        return res.status(500).json({ ok: false, error: error.message });
      }

      // Return in chronological order
      res.json({ ok: true, data: (data || []).reverse() });
    } catch (error: any) {
      logger.error('[ChatRoute] Unexpected error in getMessages', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

/**
 * POST /api/v1/travel-hub/chat/conversations/:id/messages
 * Send a message
 */
router.post(
  '/conversations/:id/messages',
  [
    param('id').isUUID(),
    body('sender_type').isIn(['client', 'concierge', 'system', 'ai']),
    body('sender_id').isUUID(),
    body('content').isString().notEmpty().isLength({ max: 10000 }),
    body('message_type')
      .optional()
      .isIn(['text', 'image', 'file', 'itinerary_share', 'booking_share']),
    body('attachments').optional().isArray(),
    body('reference_type').optional().isString(),
    body('reference_id').optional().isUUID(),
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const { id } = req.params;
      const {
        sender_type,
        sender_id,
        content,
        message_type,
        attachments,
        reference_type,
        reference_id,
      } = req.body;

      const messageData = {
        conversation_id: id,
        sender_type,
        sender_id,
        content,
        message_type: message_type || 'text',
        attachments: attachments || [],
        reference_type,
        reference_id,
        metadata: {},
      };

      const { data, error } = await supabase
        .schema(SCHEMA)
        .from('concierge_messages')
        .insert([messageData])
        .select()
        .single();

      if (error) {
        logger.error('[ChatRoute] Error sending message', { error, conversationId: id });
        return res.status(500).json({ ok: false, error: error.message });
      }

      // Update conversation
      const unreadField =
        sender_type === 'client' ? 'unread_count_concierge' : 'unread_count_client';

      // Get current count and increment
      const { data: conv } = await supabase
        .schema(SCHEMA)
        .from('concierge_conversations')
        .select(unreadField)
        .eq('id', id)
        .single();

      await supabase
        .schema(SCHEMA)
        .from('concierge_conversations')
        .update({
          last_message_at: new Date().toISOString(),
          [unreadField]: ((conv as any)?.[unreadField] || 0) + 1,
        })
        .eq('id', id);

      logger.info('[ChatRoute] Message sent', { messageId: data.id, conversationId: id });
      res.status(201).json({ ok: true, data });
    } catch (error: any) {
      logger.error('[ChatRoute] Unexpected error in sendMessage', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

/**
 * POST /api/v1/travel-hub/chat/conversations/:id/read
 * Mark messages as read
 */
router.post(
  '/conversations/:id/read',
  [param('id').isUUID(), body('reader_type').isIn(['client', 'concierge'])],
  validate,
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const { id } = req.params;
      const { reader_type } = req.body;

      // Mark messages as read
      await supabase
        .schema(SCHEMA)
        .from('concierge_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', id)
        .neq('sender_type', reader_type)
        .is('read_at', null);

      // Reset unread count
      const unreadField =
        reader_type === 'client' ? 'unread_count_client' : 'unread_count_concierge';

      await supabase
        .schema(SCHEMA)
        .from('concierge_conversations')
        .update({ [unreadField]: 0 })
        .eq('id', id);

      logger.info('[ChatRoute] Messages marked as read', { conversationId: id, reader_type });
      res.json({ ok: true });
    } catch (error: any) {
      logger.error('[ChatRoute] Unexpected error in markAsRead', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/v1/travel-hub/chat/unread
 * Get unread message counts
 */
router.get(
  '/unread',
  [query('role').isIn(['client', 'concierge']), query('user_id').isUUID()],
  validate,
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const { role, user_id } = req.query;

      const filterField = role === 'client' ? 'client_id' : 'concierge_id';
      const countField = role === 'client' ? 'unread_count_client' : 'unread_count_concierge';

      const { data, error } = await supabase
        .schema(SCHEMA)
        .from('concierge_conversations')
        .select(`id, ${countField}`)
        .eq(filterField, user_id)
        .gt(countField, 0);

      if (error) {
        logger.error('[ChatRoute] Error fetching unread counts', { error });
        return res.status(500).json({ ok: false, error: error.message });
      }

      const byConversation: Record<string, number> = {};
      let total = 0;

      (data || []).forEach((conv: any) => {
        byConversation[conv.id] = conv[countField];
        total += conv[countField];
      });

      res.json({ ok: true, data: { total, byConversation } });
    } catch (error: any) {
      logger.error('[ChatRoute] Unexpected error in getUnread', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

export default router;
