/**
 * Work Buddy Routes
 * Task: T088
 *
 * API endpoints for Work Buddy app.
 * Routes: GET/POST /api/v1/work-buddy/sessions, availability, calendar, notifications
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { requireApiKey, requireAuthentication, requireAppAccess } from '../middleware/auth';
import { schemaRouter, getSupabase, getAppContext } from '../middleware/schemaRouter';

const router = Router();

// Apply schema routing middleware to all routes
router.use(schemaRouter);

/**
 * GET /api/v1/work-buddy/sessions
 * List user's work sessions
 */
router.get(
  '/sessions',
  requireApiKey,
  requireAuthentication,
  requireAppAccess,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    const supabase = getSupabase(req);
    const { data: sessions, error } = await supabase
      .from('work_sessions')
      .select('*')
      .or(`host_user_id.eq.${userId},participants.cs.[{"user_id":"${userId}"}]`)
      .order('scheduled_start', { ascending: false });

    if (error) {
      res.status(400).json({ code: 'DATABASE_ERROR', message: error.message });
      return;
    }

    res.status(200).json({ data: sessions });
  })
);

/**
 * POST /api/v1/work-buddy/sessions
 * Create a new work session
 */
router.post(
  '/sessions',
  requireApiKey,
  requireAuthentication,
  requireAppAccess,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    const { title, description, work_type, scheduled_start, duration_minutes, max_participants } =
      req.body;

    // Validate required fields
    if (!title || !scheduled_start) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'title and scheduled_start are required',
      });
      return;
    }

    const supabase = getSupabase(req);
    const { data: session, error } = await supabase
      .from('work_sessions')
      .insert({
        host_user_id: userId,
        title,
        description,
        work_type: work_type || 'anything',
        scheduled_start,
        duration_minutes: duration_minutes || 30,
        max_participants: max_participants || 3,
        status: 'scheduled',
      })
      .select()
      .single();

    if (error) {
      res.status(400).json({ code: 'DATABASE_ERROR', message: error.message });
      return;
    }

    res.status(201).json({ data: session });
  })
);

/**
 * GET /api/v1/work-buddy/sessions/:id
 * Get session by ID
 */
router.get(
  '/sessions/:id',
  requireApiKey,
  requireAuthentication,
  requireAppAccess,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    const supabase = getSupabase(req);
    const { data: session, error } = await supabase
      .from('work_sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !session) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Session not found' });
      return;
    }

    // Check user access
    const isHost = session.host_user_id === userId;
    const isParticipant = session.participants?.some(
      (p: { user_id: string }) => p.user_id === userId
    );

    if (!isHost && !isParticipant) {
      res
        .status(403)
        .json({ code: 'FORBIDDEN', message: 'User does not have access to this session' });
      return;
    }

    res.status(200).json({ data: session });
  })
);

/**
 * PATCH /api/v1/work-buddy/sessions/:id
 * Update a session
 */
router.patch(
  '/sessions/:id',
  requireApiKey,
  requireAuthentication,
  requireAppAccess,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    const supabase = getSupabase(req);

    // Check host access
    const { data: session, error: fetchError } = await supabase
      .from('work_sessions')
      .select('host_user_id')
      .eq('id', id)
      .single();

    if (fetchError || !session) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Session not found' });
      return;
    }

    if (session.host_user_id !== userId) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Only session host can update' });
      return;
    }

    // Update session
    const { data: updated, error } = await supabase
      .from('work_sessions')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      res.status(400).json({ code: 'DATABASE_ERROR', message: error.message });
      return;
    }

    res.status(200).json({ data: updated });
  })
);

/**
 * DELETE /api/v1/work-buddy/sessions/:id
 * Delete a session
 */
router.delete(
  '/sessions/:id',
  requireApiKey,
  requireAuthentication,
  requireAppAccess,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    const supabase = getSupabase(req);

    // Check host access
    const { data: session, error: fetchError } = await supabase
      .from('work_sessions')
      .select('host_user_id')
      .eq('id', id)
      .single();

    if (fetchError || !session) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Session not found' });
      return;
    }

    if (session.host_user_id !== userId) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Only session host can delete' });
      return;
    }

    // Delete session
    const { error } = await supabase.from('work_sessions').delete().eq('id', id);

    if (error) {
      res.status(400).json({ code: 'DATABASE_ERROR', message: error.message });
      return;
    }

    res.status(204).send();
  })
);

/**
 * POST /api/v1/work-buddy/sessions/:id/join
 * Join a session
 */
router.post(
  '/sessions/:id/join',
  requireApiKey,
  requireAuthentication,
  requireAppAccess,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    const supabase = getSupabase(req);

    // Get current session
    const { data: session, error: fetchError } = await supabase
      .from('work_sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !session) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Session not found' });
      return;
    }

    // Check if already participant
    const isParticipant = session.participants?.some(
      (p: { user_id: string }) => p.user_id === userId
    );

    if (isParticipant) {
      res
        .status(400)
        .json({ code: 'ALREADY_PARTICIPANT', message: 'User is already in this session' });
      return;
    }

    // Add user to participants
    const updatedParticipants = [
      ...session.participants,
      { user_id: userId, joined_at: new Date().toISOString() },
    ];

    const { data: updated, error } = await supabase
      .from('work_sessions')
      .update({ participants: updatedParticipants })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      res.status(400).json({ code: 'DATABASE_ERROR', message: error.message });
      return;
    }

    res.status(200).json({ data: updated });
  })
);

/**
 * POST /api/v1/work-buddy/sessions/:id/leave
 * Leave a session
 */
router.post(
  '/sessions/:id/leave',
  requireApiKey,
  requireAuthentication,
  requireAppAccess,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    const supabase = getSupabase(req);

    // Get current session
    const { data: session, error: fetchError } = await supabase
      .from('work_sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !session) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Session not found' });
      return;
    }

    // Remove user from participants
    const updatedParticipants = session.participants.filter(
      (p: { user_id: string }) => p.user_id !== userId
    );

    const { data: updated, error } = await supabase
      .from('work_sessions')
      .update({ participants: updatedParticipants })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      res.status(400).json({ code: 'DATABASE_ERROR', message: error.message });
      return;
    }

    res.status(200).json({ data: updated });
  })
);

/**
 * GET /api/v1/work-buddy/availability
 * Get user availability
 */
router.get(
  '/availability',
  requireApiKey,
  requireAuthentication,
  requireAppAccess,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    // Placeholder implementation
    res.status(200).json({
      data: {
        user_id: userId,
        status: 'available',
        message: 'Ready for collaboration',
      },
    });
  })
);

/**
 * GET /api/v1/work-buddy/notifications
 * Get notifications
 */
router.get(
  '/notifications',
  requireApiKey,
  requireAuthentication,
  requireAppAccess,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    // Placeholder implementation
    res.status(200).json({
      data: [],
    });
  })
);

/**
 * GET /api/v1/work-buddy/calendar
 * Get calendar data
 */
router.get(
  '/calendar',
  requireApiKey,
  requireAuthentication,
  requireAppAccess,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    // Placeholder implementation
    res.status(200).json({
      data: {
        events: [],
      },
    });
  })
);

/**
 * GET /api/v1/work-buddy/calendar/connections
 * Get calendar connections
 */
router.get(
  '/calendar/connections',
  requireApiKey,
  requireAuthentication,
  requireAppAccess,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    // Placeholder implementation
    res.status(200).json({
      data: [],
    });
  })
);

export default router;
