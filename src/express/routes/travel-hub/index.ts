/**
 * Travel Hub Concierge Main Router
 * Consolidates all Travel Hub Concierge API endpoints
 *
 * @deprecated These routes are DEPRECATED as of 2025-12-21.
 * First-party tenant apps (o-orig) should migrate to Next.js API routes:
 *   - o-orig: /api/tenant/travel-hub/*
 *   - Services: Use apiFetch from packages/shared/config/apiConfig.ts
 *
 * These routes will be removed in a future release.
 * Third-party developers should use the public API at /api/v1/*
 *
 * Migration Guide:
 *   OLD: api.oriva.io/api/v1/tenant/travel-hub/concierges
 *   NEW: o-orig app calls /api/tenant/travel-hub/concierges (relative URL)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { requireJwtAuth } from '../../middleware/auth';
import { logger } from '../../../utils/logger';
import conciergesRouter from './concierges';
import clientsRouter from './clients';
import itinerariesRouter from './itineraries';
import chatRouter from './chat';
import adminRouter from './admin';
import transcriptsRouter from './transcripts';

const router = Router();

/**
 * Deprecation warning middleware
 * Logs a warning for every request to these deprecated routes
 */
const deprecationWarning = (req: Request, res: Response, next: NextFunction) => {
  logger.warn({
    message: '[DEPRECATED] Travel Hub tenant routes are deprecated',
    deprecatedPath: req.originalUrl,
    migrateTo: 'o-orig Next.js API /api/tenant/travel-hub/*',
    deprecationDate: '2025-12-21',
    userAgent: req.get('user-agent'),
    ip: req.ip,
  });

  // Add deprecation header to response
  res.set('X-Deprecated-API', 'true');
  res.set('X-Deprecated-Date', '2025-12-21');
  res.set('X-Migrate-To', 'o-orig/api/tenant/travel-hub/*');

  next();
};

// Apply deprecation warning to all routes
router.use(deprecationWarning);

// All Travel Hub Concierge routes require JWT authentication
// Using requireJwtAuth which validates JWT without requiring public.users table
// Travel Hub uses travel_hub.system_users and travel_hub.concierges for user management
router.use(requireJwtAuth);

// Mount routers
router.use('/concierges', conciergesRouter);
router.use('/clients', clientsRouter);
router.use('/itineraries', itinerariesRouter);
router.use('/chat', chatRouter);
router.use('/admin', adminRouter);
router.use('/transcripts', transcriptsRouter);

export default router;
