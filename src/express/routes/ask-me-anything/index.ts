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
 *
 * @deprecated These routes are DEPRECATED as of 2025-12-21.
 * First-party tenant apps (o-orig) should migrate to Next.js API routes:
 *   - o-orig: /api/tenant/ask-me-anything/*
 *   - Services: Use apiFetch from packages/shared/config/apiConfig.ts
 *
 * These routes will be removed in a future release.
 * Third-party developers should use the public API at /api/v1/*
 */

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../../middleware/auth';
import { logger } from '../../../utils/logger';

// Import sub-routers
import sessionsRouter from './sessions';
import questionsRouter from './questions';
import votesRouter from './votes';
import rsvpsRouter from './rsvps';

const router = Router();

/**
 * Deprecation warning middleware
 * Logs a warning for every request to these deprecated routes
 */
const deprecationWarning = (req: Request, res: Response, next: NextFunction) => {
  logger.warn({
    message: '[DEPRECATED] Ask Me Anything tenant routes are deprecated',
    deprecatedPath: req.originalUrl,
    migrateTo: 'o-orig Next.js API /api/tenant/ask-me-anything/*',
    deprecationDate: '2025-12-21',
    userAgent: req.get('user-agent'),
    ip: req.ip,
  });

  // Add deprecation header to response
  res.set('X-Deprecated-API', 'true');
  res.set('X-Deprecated-Date', '2025-12-21');
  res.set('X-Migrate-To', 'o-orig/api/tenant/ask-me-anything/*');

  next();
};

// Apply deprecation warning to all routes
router.use(deprecationWarning);

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
