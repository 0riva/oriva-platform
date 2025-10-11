/**
 * Platform Apps Routes
 * Task: T036
 *
 * API endpoints for app registration and management.
 * Routes: POST /apps, GET /apps, GET /apps/:appId
 */

import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { requireApiKey } from '../middleware/auth';
import { optionalSchemaRouter } from '../middleware/schemaRouter';
import {
  registerApp,
  listApps,
  getAppByAppId,
  updateAppStatus,
  CreateAppRequest,
  AppResponse,
  ListAppsResponse,
} from '../services/platformAppsService';

const router = Router();

// Platform routes need schema router for database access (even without X-App-ID)
router.use(optionalSchemaRouter);

/**
 * POST /api/v1/platform/apps
 * Register a new app in the platform
 */
router.post(
  '/',
  requireApiKey,
  asyncHandler(async (req, res) => {
    const input: CreateAppRequest = req.body;
    const app: AppResponse = await registerApp(req, input);
    res.status(201).json(app);
  })
);

/**
 * GET /api/v1/platform/apps
 * List all apps with optional filters
 */
router.get(
  '/',
  requireApiKey,
  asyncHandler(async (req, res) => {
    const filters = {
      status: req.query.status as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
    };

    const result: ListAppsResponse = await listApps(req, filters);
    res.status(200).json(result);
  })
);

/**
 * GET /api/v1/platform/apps/:appId
 * Get app by app_id
 */
router.get(
  '/:appId',
  requireApiKey,
  asyncHandler(async (req, res) => {
    const { appId } = req.params;
    const app: AppResponse = await getAppByAppId(req, appId);
    res.status(200).json(app);
  })
);

/**
 * PATCH /api/v1/platform/apps/:appId/status
 * Update app status
 */
router.patch(
  '/:appId/status',
  requireApiKey,
  asyncHandler(async (req, res) => {
    const { appId } = req.params;
    const { status } = req.body;
    const app: AppResponse = await updateAppStatus(req, appId, status);
    res.status(200).json(app);
  })
);

export default router;
