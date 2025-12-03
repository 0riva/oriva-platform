/**
 * Ask Me Anything (AMA) Tenant Routes
 *
 * Main router for the AMA feature. Mounts all AMA sub-routers.
 * These are internal BFF tenant endpoints, NOT public API endpoints.
 *
 * Base path: /api/v1/ask-me-anything
 *
 * Sub-routes:
 * - /sessions - Session CRUD operations
 * - /questions - Question submission and moderation
 * - /votes - Question upvoting/downvoting
 * - /rsvps - Session attendance management
 */

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';

// Import sub-routers
import sessionsRouter from './sessions';
import questionsRouter from './questions';
import votesRouter from './votes';
import rsvpsRouter from './rsvps';

const router = Router();

// Require authentication for all AMA routes
router.use(requireAuth);

// Mount sub-routers
router.use('/sessions', sessionsRouter);
router.use('/questions', questionsRouter);
router.use('/votes', votesRouter);
router.use('/rsvps', rsvpsRouter);

// Health check endpoint for AMA service
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    service: 'ask-me-anything',
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

export default router;
