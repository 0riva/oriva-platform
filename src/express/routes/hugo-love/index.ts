/**
 * Hugo Love Main Router
 * Consolidates all Hugo Love API endpoints
 *
 * @deprecated These routes are DEPRECATED as of 2025-12-21.
 * First-party tenant apps (o-orig) should migrate to Next.js API routes:
 *   - o-orig: /api/tenant/love-puzl/* (love-puzl is the new brand)
 *   - Services: Use apiFetch from packages/shared/config/apiConfig.ts
 *
 * These routes will be removed in a future release.
 * Third-party developers should use the public API at /api/v1/*
 *
 * Migration Guide:
 *   OLD: api.oriva.io/api/v1/tenant/hugo-love/profiles
 *   NEW: o-orig app calls /api/tenant/love-puzl/profiles (relative URL)
 *
 * The apiConfig.ts in o-orig handles routing:
 *   - Browser: Uses relative /api/tenant/love-puzl/* URLs
 *   - SSR: Routes to https://o-originals.vercel.app/api/tenant/love-puzl/*
 */

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../../middleware/auth';
import { logger } from '../../../utils/logger';
import swipeRouter from './swipe';
import ratingsRouter from './ratings';
import matchesRouter from './matches';
import profilesRouter from './profiles';
import messagesRouter from './messages';
import aiChatRouter from './ai-chat';
import journalRouter from './journal';
import subscriptionsRouter from './subscriptions';
import moderationRouter from './moderation';

const router = Router();

/**
 * Deprecation warning middleware
 * Logs a warning for every request to these deprecated routes
 */
const deprecationWarning = (req: Request, res: Response, next: NextFunction) => {
  logger.warn({
    message: '[DEPRECATED] Hugo Love tenant routes are deprecated',
    deprecatedPath: req.originalUrl,
    migrateTo: req.originalUrl
      .replace('/hugo-love/', '/love-puzl/')
      .replace('api.oriva.io', 'o-orig Next.js API'),
    deprecationDate: '2025-12-21',
    userAgent: req.get('user-agent'),
    ip: req.ip,
  });

  // Add deprecation header to response
  res.set('X-Deprecated-API', 'true');
  res.set('X-Deprecated-Date', '2025-12-21');
  res.set('X-Migrate-To', 'o-orig/api/tenant/love-puzl/*');

  next();
};

// Apply deprecation warning to all routes
router.use(deprecationWarning);

// All Hugo Love routes require authentication
router.use(requireAuth);

// Mount routers
router.use('/swipe', swipeRouter);
router.use('/swipes', swipeRouter); // For GET /swipes and /swipes/today
router.use('/ratings', ratingsRouter);
router.use('/matches', matchesRouter);
router.use('/profiles', profilesRouter);
router.use('/matches', messagesRouter); // For /matches/:matchId/messages
router.use('/messages', messagesRouter); // For /messages/:messageId operations
router.use('/ai-chat', aiChatRouter);
router.use('/journal', journalRouter);
router.use('/subscriptions', subscriptionsRouter);
router.use('/reports', moderationRouter);

export default router;
