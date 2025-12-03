/**
 * Ask Me Anything RSVPs Router
 * Handles RSVP management for AMA sessions
 */

import { Router, Request, Response } from 'express';
import { getSupabase } from '../../middleware/schemaRouter';
import { sendSuccess, sendError, sendNotFound } from '../../utils/response';
import { validateUuid } from '../../utils/validation-express';
import { validateRSVPRequest, validatePagination } from './validation';

const router = Router();

// Schema name for AMA tables
const AMA_SCHEMA = 'ask_me_anything';

/**
 * GET /rsvps
 * Get RSVPs for a session (for hosts to see attendee list)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase(req);
    const { sessionId, status } = req.query;

    if (!sessionId || typeof sessionId !== 'string') {
      return sendError(res, 'sessionId query parameter is required', 400);
    }

    validateUuid(sessionId, 'sessionId');

    const { limit, offset } = validatePagination(req.query);

    let query = supabase
      .schema(AMA_SCHEMA)
      .from('rsvps')
      .select('*', { count: 'exact' })
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by status if provided
    if (status && typeof status === 'string') {
      query = query.eq('rsvp_status', status);
    }

    const { data: rsvps, error, count } = await query;

    if (error) {
      console.error('Error fetching RSVPs:', error);
      return sendError(res, 'Failed to fetch RSVPs', 500);
    }

    return sendSuccess(res, {
      rsvps: rsvps || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Error in GET /rsvps:', error);
    return sendError(res, error instanceof Error ? error.message : 'Internal server error', 500);
  }
});

/**
 * GET /rsvps/me
 * Get the current user's RSVP for a session
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase(req);
    const userId = req.user?.id;
    const { sessionId } = req.query;

    if (!userId) {
      return sendError(res, 'User ID required', 401);
    }

    if (!sessionId || typeof sessionId !== 'string') {
      return sendError(res, 'sessionId query parameter is required', 400);
    }

    validateUuid(sessionId, 'sessionId');

    const { data: rsvp, error } = await supabase
      .schema(AMA_SCHEMA)
      .from('rsvps')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching user RSVP:', error);
      return sendError(res, 'Failed to fetch RSVP', 500);
    }

    return sendSuccess(res, {
      rsvp: rsvp || null,
      hasRsvp: !!rsvp,
    });
  } catch (error) {
    console.error('Error in GET /rsvps/me:', error);
    return sendError(res, error instanceof Error ? error.message : 'Internal server error', 500);
  }
});

/**
 * POST /rsvps
 * Create or update an RSVP for an AMA session
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase(req);
    const userId = req.user?.id;

    if (!userId) {
      return sendError(res, 'User ID required', 401);
    }

    const validated = validateRSVPRequest(req.body);

    // Verify the session exists
    const { data: session, error: sessionError } = await supabase
      .schema(AMA_SCHEMA)
      .from('ama_sessions')
      .select('id, status')
      .eq('id', validated.sessionId)
      .single();

    if (sessionError || !session) {
      return sendNotFound(res, 'AMA session not found');
    }

    if (session.status === 'ended' || session.status === 'deleted') {
      return sendError(res, 'This AMA session is no longer accepting RSVPs', 400);
    }

    // Check for existing RSVP
    const { data: existingRsvp, error: checkError } = await supabase
      .schema(AMA_SCHEMA)
      .from('rsvps')
      .select('id')
      .eq('session_id', validated.sessionId)
      .eq('user_id', userId)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing RSVP:', checkError);
      return sendError(res, 'Failed to check existing RSVP', 500);
    }

    let rsvp;

    if (existingRsvp) {
      // Update existing RSVP
      const { data: updatedRsvp, error: updateError } = await supabase
        .schema(AMA_SCHEMA)
        .from('rsvps')
        .update({
          rsvp_status: validated.rsvpStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingRsvp.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating RSVP:', updateError);
        return sendError(res, 'Failed to update RSVP', 500);
      }

      rsvp = updatedRsvp;
    } else {
      // Create new RSVP
      const { data: newRsvp, error: insertError } = await supabase
        .schema(AMA_SCHEMA)
        .from('rsvps')
        .insert({
          session_id: validated.sessionId,
          user_id: userId,
          rsvp_status: validated.rsvpStatus,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating RSVP:', insertError);
        return sendError(res, 'Failed to create RSVP', 500);
      }

      rsvp = newRsvp;
    }

    return sendSuccess(res, { rsvp }, existingRsvp ? 200 : 201);
  } catch (error) {
    console.error('Error in POST /rsvps:', error);
    return sendError(res, error instanceof Error ? error.message : 'Internal server error', 500);
  }
});

/**
 * DELETE /rsvps/:sessionId
 * Remove an RSVP from a session
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

    // Get the existing RSVP
    const { data: existingRsvp, error: fetchError } = await supabase
      .schema(AMA_SCHEMA)
      .from('rsvps')
      .select('id')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching RSVP:', fetchError);
      return sendError(res, 'Failed to fetch RSVP', 500);
    }

    if (!existingRsvp) {
      return sendNotFound(res, 'RSVP not found');
    }

    // Delete the RSVP
    const { error: deleteError } = await supabase
      .schema(AMA_SCHEMA)
      .from('rsvps')
      .delete()
      .eq('id', existingRsvp.id);

    if (deleteError) {
      console.error('Error deleting RSVP:', deleteError);
      return sendError(res, 'Failed to delete RSVP', 500);
    }

    return sendSuccess(res, { success: true, message: 'RSVP removed successfully' });
  } catch (error) {
    console.error('Error in DELETE /rsvps/:sessionId:', error);
    return sendError(res, error instanceof Error ? error.message : 'Internal server error', 500);
  }
});

/**
 * GET /rsvps/count/:sessionId
 * Get RSVP counts for a session
 */
router.get('/count/:sessionId', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase(req);
    const { sessionId } = req.params;

    validateUuid(sessionId, 'sessionId');

    // Get counts for each status
    const { data: rsvps, error } = await supabase
      .schema(AMA_SCHEMA)
      .from('rsvps')
      .select('rsvp_status')
      .eq('session_id', sessionId);

    if (error) {
      console.error('Error fetching RSVP counts:', error);
      return sendError(res, 'Failed to fetch RSVP counts', 500);
    }

    const counts = {
      going: 0,
      maybe: 0,
      not_going: 0,
      total: rsvps?.length || 0,
    };

    rsvps?.forEach((rsvp) => {
      if (rsvp.rsvp_status in counts) {
        counts[rsvp.rsvp_status as keyof typeof counts]++;
      }
    });

    return sendSuccess(res, { counts });
  } catch (error) {
    console.error('Error in GET /rsvps/count/:sessionId:', error);
    return sendError(res, error instanceof Error ? error.message : 'Internal server error', 500);
  }
});

export default router;
