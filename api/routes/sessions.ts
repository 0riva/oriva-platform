/**
 * Sessions Routes
 * Task: T039
 *
 * API endpoints for AI coaching sessions in hugo_ai schema.
 * Routes: POST /sessions, PATCH /sessions/:sessionId, GET /sessions/:sessionId, GET /sessions
 */

import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { requireApiKey, requireAuthentication, requireAppAccess } from '../middleware/auth';
import { schemaRouter } from '../middleware/schemaRouter';
import {
  createSession,
  updateSession,
  getSession,
  listUserSessions,
  deleteSession,
  incrementMessageCount,
  getUserSessionStats,
  CreateSessionRequest,
  UpdateSessionRequest,
  SessionResponse,
} from '../services/sessionsService';

const router = Router();

// Apply schema routing middleware to all routes
router.use(schemaRouter);

/**
 * POST /api/v1/hugo-ai/sessions
 * Create a new coaching session
 */
router.post(
  '/',
  requireApiKey,
  requireAuthentication,
  requireAppAccess,
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    const input: CreateSessionRequest = req.body;
    const session: SessionResponse = await createSession(req, userId, input);
    res.status(201).json(session);
  })
);

/**
 * PATCH /api/v1/hugo-ai/sessions/:sessionId
 * Update an existing session
 */
router.patch(
  '/:sessionId',
  requireApiKey,
  requireAuthentication,
  requireAppAccess,
  asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    const updates: UpdateSessionRequest = req.body;
    const session: SessionResponse = await updateSession(req, sessionId, userId, updates);
    res.status(200).json(session);
  })
);

/**
 * GET /api/v1/hugo-ai/sessions/:sessionId
 * Get session by ID
 */
router.get(
  '/:sessionId',
  requireApiKey,
  requireAuthentication,
  requireAppAccess,
  asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    const session: SessionResponse = await getSession(req, sessionId, userId);
    res.status(200).json(session);
  })
);

/**
 * GET /api/v1/hugo-ai/sessions
 * List user's sessions with filters
 */
router.get(
  '/',
  requireApiKey,
  requireAuthentication,
  requireAppAccess,
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    const filters = {
      session_type: req.query.session_type as string | undefined,
      app_id: req.query.app_id as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
    };

    const result = await listUserSessions(req, userId, filters);
    res.status(200).json(result);
  })
);

/**
 * DELETE /api/v1/hugo-ai/sessions/:sessionId
 * Delete session
 */
router.delete(
  '/:sessionId',
  requireApiKey,
  requireAuthentication,
  requireAppAccess,
  asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    await deleteSession(req, sessionId, userId);
    res.status(200).json({ message: 'Session deleted' });
  })
);

/**
 * POST /api/v1/hugo-ai/sessions/:sessionId/messages/increment
 * Increment message count for session
 */
router.post(
  '/:sessionId/messages/increment',
  requireApiKey,
  requireAuthentication,
  requireAppAccess,
  asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    await incrementMessageCount(req, sessionId, userId);
    res.status(200).json({ message: 'Message count incremented' });
  })
);

/**
 * GET /api/v1/hugo-ai/sessions/stats
 * Get session statistics for user
 */
router.get(
  '/stats',
  requireApiKey,
  requireAuthentication,
  requireAppAccess,
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    const stats = await getUserSessionStats(req, userId);
    res.status(200).json(stats);
  })
);

export default router;
