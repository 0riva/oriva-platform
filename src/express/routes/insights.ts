/**
 * Insights Routes
 * Task: T040
 *
 * API endpoints for AI-generated insights in hugo_ai schema.
 * Routes: POST /insights, GET /insights/:insightId, GET /insights
 */

import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { requireApiKey, requireAuthentication, requireAppAccess } from '../middleware/auth';
import { schemaRouter } from '../middleware/schemaRouter';
import {
  createInsight,
  getInsight,
  listUserInsights,
  listSessionInsights,
  updateInsightMetadata,
  getUserInsightStats,
  deleteInsight,
  CreateInsightRequest,
  InsightResponse,
} from '../../services/insightsService';

const router = Router();

// Apply schema routing middleware to all routes
router.use(schemaRouter);

/**
 * POST /api/v1/hugo-ai/insights
 * Create a new insight
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

    const input: CreateInsightRequest = req.body;

    // Validate user_id is provided
    if (!input.user_id) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'user_id is required',
      });
      return;
    }

    // Validate user_id format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(input.user_id)) {
      res.status(400).json({
        code: 'INVALID_USER_ID',
        message: 'Invalid user ID format',
      });
      return;
    }

    // Validate user_id matches authenticated user
    if (input.user_id !== userId) {
      res.status(403).json({
        code: 'FORBIDDEN',
        message: 'Cannot create insight for another user',
      });
      return;
    }

    const insight: InsightResponse = await createInsight(req, userId, input);
    res.status(201).json(insight);
  })
);

/**
 * GET /api/v1/hugo-ai/insights
 * List user's insights with filters
 * NOTE: This must come BEFORE /:insightId to avoid path matching issues
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
      insight_type: req.query.insight_type as string | undefined,
      min_confidence: req.query.min_confidence
        ? parseFloat(req.query.min_confidence as string)
        : undefined,
      source_app_id: req.query.source_app_id as string | undefined,
      cross_app_only: req.query.cross_app_only === 'true',
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
    };

    const result = await listUserInsights(req, userId, filters);
    res.status(200).json(result);
  })
);

/**
 * GET /api/v1/hugo-ai/insights/:insightId
 * Get insight by ID
 */
router.get(
  '/:insightId',
  requireApiKey,
  requireAuthentication,
  requireAppAccess,
  asyncHandler(async (req, res) => {
    const { insightId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    const insight: InsightResponse = await getInsight(req, insightId, userId);
    res.status(200).json(insight);
  })
);

/**
 * GET /api/v1/hugo-ai/sessions/:sessionId/insights
 * List insights for a session
 */
router.get(
  '/sessions/:sessionId/insights',
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

    const result = await listSessionInsights(req, sessionId, userId);
    res.status(200).json(result);
  })
);

/**
 * PATCH /api/v1/hugo-ai/insights/:insightId/metadata
 * Update insight metadata
 */
router.patch(
  '/:insightId/metadata',
  requireApiKey,
  requireAuthentication,
  requireAppAccess,
  asyncHandler(async (req, res) => {
    const { insightId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    const { metadata } = req.body;
    const insight: InsightResponse = await updateInsightMetadata(req, insightId, userId, metadata);
    res.status(200).json(insight);
  })
);

/**
 * GET /api/v1/hugo-ai/insights/stats
 * Get insight statistics for user
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

    const stats = await getUserInsightStats(req, userId);
    res.status(200).json(stats);
  })
);

/**
 * DELETE /api/v1/hugo-ai/insights/:insightId
 * Delete insight
 */
router.delete(
  '/:insightId',
  requireApiKey,
  requireAuthentication,
  requireAppAccess,
  asyncHandler(async (req, res) => {
    const { insightId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    await deleteInsight(req, insightId, userId);
    res.status(200).json({ message: 'Insight deleted' });
  })
);

export default router;
