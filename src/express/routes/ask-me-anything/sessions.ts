/**
 * Ask Me Anything Sessions Router
 * Handles CRUD operations for AMA sessions
 */

import { Router, Request, Response } from 'express';
import { getSupabase } from '../../middleware/schemaRouter';
import { sendSuccess, sendError, sendNotFound } from '../../utils/response';
import { validateUuid } from '../../utils/validation-express';
import {
  validateCreateSessionRequest,
  validateUpdateSessionRequest,
  validatePagination,
  validateSessionFilter,
} from './validation';

const router = Router();

// Schema name for AMA tables
const AMA_SCHEMA = 'ask_me_anything';

/**
 * GET /sessions
 * Get all AMA sessions with optional filtering
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase(req);
    const { limit, offset } = validatePagination(req.query);
    const filter = validateSessionFilter(req.query);

    let query = supabase
      .schema(AMA_SCHEMA)
      .from('ama_sessions')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (filter.status) {
      query = query.eq('status', filter.status);
    }
    if (filter.visibility) {
      query = query.eq('visibility', filter.visibility);
    }

    const { data: sessions, error, count } = await query;

    if (error) {
      console.error('Error fetching sessions:', error);
      return sendError(res, 'Failed to fetch sessions', 500);
    }

    return sendSuccess(res, {
      sessions: sessions || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Error in GET /sessions:', error);
    return sendError(res, error instanceof Error ? error.message : 'Internal server error', 500);
  }
});

/**
 * GET /sessions/:sessionId
 * Get a specific AMA session by ID
 */
router.get('/:sessionId', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase(req);
    const { sessionId } = req.params;

    validateUuid(sessionId, 'sessionId');

    const { data: session, error } = await supabase
      .schema(AMA_SCHEMA)
      .from('ama_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return sendNotFound(res, 'Session not found');
      }
      console.error('Error fetching session:', error);
      return sendError(res, 'Failed to fetch session', 500);
    }

    return sendSuccess(res, { session });
  } catch (error) {
    console.error('Error in GET /sessions/:sessionId:', error);
    return sendError(res, error instanceof Error ? error.message : 'Internal server error', 500);
  }
});

/**
 * POST /sessions
 * Create a new AMA session
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase(req);
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, 'User ID required', 401);
    }

    const validated = validateCreateSessionRequest(req.body);

    // Build the session data
    const sessionData: Record<string, unknown> = {
      title: validated.title,
      account_id: userId,
      status: 'draft',
      visibility: validated.visibility || 'public',
    };

    // Optional fields
    if (validated.description) sessionData.description = validated.description;
    if (validated.scheduledAt) sessionData.scheduled_at = validated.scheduledAt;
    if (validated.durationMinutes) sessionData.duration_minutes = validated.durationMinutes;
    if (validated.templateId) sessionData.template_id = validated.templateId;
    if (validated.groupId) sessionData.group_id = validated.groupId;
    if (validated.category) sessionData.category = validated.category;
    if (validated.eventImage) sessionData.event_image = validated.eventImage;

    // Guest fields
    if (validated.guestName) sessionData.guest_name = validated.guestName;
    if (validated.guestEmail) sessionData.guest_email = validated.guestEmail;
    if (validated.guestProfileId) sessionData.guest_profile_id = validated.guestProfileId;
    if (validated.guestBio) sessionData.guest_bio = validated.guestBio;
    if (validated.guestAvatar) sessionData.guest_avatar = validated.guestAvatar;

    // Host fields
    if (validated.hostName) sessionData.host_name = validated.hostName;
    if (validated.hostEmail) sessionData.host_email = validated.hostEmail;
    if (validated.hostProfileId) sessionData.host_profile_id = validated.hostProfileId;
    if (validated.hostBio) sessionData.host_bio = validated.hostBio;
    if (validated.hostAvatar) sessionData.host_avatar = validated.hostAvatar;

    const { data: session, error } = await supabase
      .schema(AMA_SCHEMA)
      .from('ama_sessions')
      .insert(sessionData)
      .select()
      .single();

    if (error) {
      console.error('Error creating session:', error);
      return sendError(res, 'Failed to create session', 500);
    }

    return sendSuccess(res, { session }, 201);
  } catch (error) {
    console.error('Error in POST /sessions:', error);
    return sendError(res, error instanceof Error ? error.message : 'Internal server error', 500);
  }
});

/**
 * PATCH /sessions/:sessionId
 * Update an existing AMA session
 */
router.patch('/:sessionId', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase(req);
    const { sessionId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, 'User ID required', 401);
    }

    validateUuid(sessionId, 'sessionId');

    // Verify ownership
    const { data: existingSession, error: fetchError } = await supabase
      .schema(AMA_SCHEMA)
      .from('ama_sessions')
      .select('account_id')
      .eq('id', sessionId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return sendNotFound(res, 'Session not found');
      }
      console.error('Error fetching session for update:', fetchError);
      return sendError(res, 'Failed to verify session ownership', 500);
    }

    if (existingSession.account_id !== userId) {
      return sendError(res, 'Not authorized to update this session', 403);
    }

    const updates = validateUpdateSessionRequest(req.body);

    // Convert to snake_case for database
    const dbUpdates: Record<string, unknown> = {};
    if (updates.title) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.scheduledAt !== undefined) dbUpdates.scheduled_at = updates.scheduledAt;
    if (updates.durationMinutes) dbUpdates.duration_minutes = updates.durationMinutes;
    if (updates.settings) dbUpdates.settings = updates.settings;

    dbUpdates.updated_at = new Date().toISOString();

    const { data: session, error } = await supabase
      .schema(AMA_SCHEMA)
      .from('ama_sessions')
      .update(dbUpdates)
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      console.error('Error updating session:', error);
      return sendError(res, 'Failed to update session', 500);
    }

    return sendSuccess(res, { session });
  } catch (error) {
    console.error('Error in PATCH /sessions/:sessionId:', error);
    return sendError(res, error instanceof Error ? error.message : 'Internal server error', 500);
  }
});

/**
 * DELETE /sessions/:sessionId
 * Delete an AMA session (soft delete by setting status to 'deleted')
 */
router.delete('/:sessionId', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase(req);
    const { sessionId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, 'User ID required', 401);
    }

    validateUuid(sessionId, 'sessionId');

    // Verify ownership
    const { data: existingSession, error: fetchError } = await supabase
      .schema(AMA_SCHEMA)
      .from('ama_sessions')
      .select('account_id')
      .eq('id', sessionId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return sendNotFound(res, 'Session not found');
      }
      console.error('Error fetching session for delete:', fetchError);
      return sendError(res, 'Failed to verify session ownership', 500);
    }

    if (existingSession.account_id !== userId) {
      return sendError(res, 'Not authorized to delete this session', 403);
    }

    // Soft delete by updating status
    const { error } = await supabase
      .schema(AMA_SCHEMA)
      .from('ama_sessions')
      .update({
        status: 'deleted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) {
      console.error('Error deleting session:', error);
      return sendError(res, 'Failed to delete session', 500);
    }

    return sendSuccess(res, { message: 'Session deleted successfully' });
  } catch (error) {
    console.error('Error in DELETE /sessions/:sessionId:', error);
    return sendError(res, error instanceof Error ? error.message : 'Internal server error', 500);
  }
});

export default router;
