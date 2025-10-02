/**
 * Ice Breakers Routes
 * Task: T044
 *
 * API endpoints for Hugo Love ice breaker suggestions.
 * Routes: POST /ice-breakers, GET /ice-breakers/:id, GET /ice-breakers
 */

import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { requireApiKey, requireAuthentication, requireAppAccess } from '../middleware/auth';
import { schemaRouter } from '../middleware/schemaRouter';
import {
  createIceBreaker,
  getIceBreaker,
  listUserIceBreakers,
  getSuggestedIceBreakers,
  recordIceBreakerUsage,
  deleteIceBreaker,
  getUserIceBreakerStats,
  updateIceBreaker,
  CreateIceBreakerRequest,
  IceBreakerResponse,
} from '../services/iceBreakersService';

const router = Router();

// Apply schema routing middleware to all routes
router.use(schemaRouter);

/**
 * POST /api/v1/apps/ice-breakers
 * Create a new ice breaker
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

    const input: CreateIceBreakerRequest = req.body;
    const iceBreaker: IceBreakerResponse = await createIceBreaker(req, userId, input);
    res.status(201).json(iceBreaker);
  })
);

/**
 * GET /api/v1/apps/ice-breakers/:id
 * Get ice breaker by ID
 */
router.get(
  '/:id',
  requireApiKey,
  requireAuthentication,
  requireAppAccess,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    const iceBreaker: IceBreakerResponse = await getIceBreaker(req, id, userId);
    res.status(200).json(iceBreaker);
  })
);

/**
 * GET /api/v1/apps/ice-breakers
 * List user's ice breakers with filters
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
      category: req.query.category as string | undefined,
      style: req.query.style as string | undefined,
      context_tag: req.query.context_tag as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
    };

    const result = await listUserIceBreakers(req, userId, filters);
    res.status(200).json(result);
  })
);

/**
 * GET /api/v1/apps/ice-breakers/suggested
 * Get suggested ice breakers for user
 */
router.get(
  '/suggested',
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
      category: req.query.category as string | undefined,
      style: req.query.style as string | undefined,
      context_tags: req.query.context_tags
        ? (req.query.context_tags as string).split(',')
        : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    };

    const result = await getSuggestedIceBreakers(req, userId, filters);
    res.status(200).json(result);
  })
);

/**
 * POST /api/v1/apps/ice-breakers/:id/use
 * Record ice breaker usage
 */
router.post(
  '/:id/use',
  requireApiKey,
  requireAuthentication,
  requireAppAccess,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    const iceBreaker: IceBreakerResponse = await recordIceBreakerUsage(req, id, userId);
    res.status(200).json(iceBreaker);
  })
);

/**
 * PATCH /api/v1/apps/ice-breakers/:id
 * Update ice breaker
 */
router.patch(
  '/:id',
  requireApiKey,
  requireAuthentication,
  requireAppAccess,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    const updates = req.body;
    const iceBreaker: IceBreakerResponse = await updateIceBreaker(req, id, userId, updates);
    res.status(200).json(iceBreaker);
  })
);

/**
 * DELETE /api/v1/apps/ice-breakers/:id
 * Delete ice breaker
 */
router.delete(
  '/:id',
  requireApiKey,
  requireAuthentication,
  requireAppAccess,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    await deleteIceBreaker(req, id, userId);
    res.status(200).json({ message: 'Ice breaker deleted' });
  })
);

/**
 * GET /api/v1/apps/ice-breakers/stats
 * Get ice breaker statistics
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

    const stats = await getUserIceBreakerStats(req, userId);
    res.status(200).json(stats);
  })
);

export default router;
