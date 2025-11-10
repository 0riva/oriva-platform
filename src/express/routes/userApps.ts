/**
 * User Apps Routes
 * Task: T037
 *
 * API endpoints for user-app access management.
 * Routes: GET /users/:userId/apps, POST /users/:userId/apps/:appId, DELETE /users/:userId/apps/:appId
 */

import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { requireApiKey, requireAuthentication } from '../middleware/auth';
import { optionalSchemaRouter } from '../middleware/schemaRouter';
import {
  getUserApps,
  grantAppAccess,
  revokeAppAccess,
  updateUserRole,
  getUserAppRole,
  updateLastActive,
  ListUserAppsResponse,
} from '../../services/userAppsService';

const router = Router();

// Platform routes need schema router for database access (even without X-App-ID)
router.use(optionalSchemaRouter);

/**
 * GET /api/v1/platform/users/:userId/apps
 * Get all apps accessible by a user
 */
router.get(
  '/:userId/apps',
  requireApiKey,
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const filters = {
      status: req.query.status as string | undefined,
    };

    const result: ListUserAppsResponse = await getUserApps(req, userId, filters);
    res.status(200).json(result);
  })
);

/**
 * POST /api/v1/platform/users/:userId/apps/:appId
 * Grant user access to an app
 */
router.post(
  '/:userId/apps/:appId',
  requireApiKey,
  asyncHandler(async (req, res) => {
    const { userId, appId } = req.params;
    const { role } = req.body;

    await grantAppAccess(req, userId, appId, role);
    res.status(201).json({ message: 'App access granted' });
  })
);

/**
 * DELETE /api/v1/platform/users/:userId/apps/:appId
 * Revoke user access to an app
 */
router.delete(
  '/:userId/apps/:appId',
  requireApiKey,
  asyncHandler(async (req, res) => {
    const { userId, appId } = req.params;

    await revokeAppAccess(req, userId, appId);
    res.status(200).json({ message: 'App access revoked' });
  })
);

/**
 * PATCH /api/v1/platform/users/:userId/apps/:appId/role
 * Update user's role for an app
 */
router.patch(
  '/:userId/apps/:appId/role',
  requireApiKey,
  asyncHandler(async (req, res) => {
    const { userId, appId } = req.params;
    const { role } = req.body;

    await updateUserRole(req, userId, appId, role);
    res.status(200).json({ message: 'User role updated' });
  })
);

/**
 * GET /api/v1/platform/users/:userId/apps/:appId/role
 * Get user's role for an app
 */
router.get(
  '/:userId/apps/:appId/role',
  requireApiKey,
  requireAuthentication,
  asyncHandler(async (req, res) => {
    const { userId, appId } = req.params;

    const role = await getUserAppRole(req, userId, appId);
    res.status(200).json({ role });
  })
);

/**
 * POST /api/v1/platform/users/:userId/apps/:appId/active
 * Update last active timestamp
 */
router.post(
  '/:userId/apps/:appId/active',
  requireApiKey,
  requireAuthentication,
  asyncHandler(async (req, res) => {
    const { userId, appId } = req.params;

    await updateLastActive(req, userId, appId);
    res.status(200).json({ message: 'Last active updated' });
  })
);

export default router;
