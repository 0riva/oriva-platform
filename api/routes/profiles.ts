/**
 * Profiles Routes
 * Task: T043
 *
 * API endpoints for app-specific user profiles.
 * Routes: POST /profiles, GET /profiles/:userId, PATCH /profiles/:userId
 */

import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { requireApiKey, requireAuthentication, requireAppAccess } from '../middleware/auth';
import { schemaRouter } from '../middleware/schemaRouter';
import {
  createProfile,
  getProfile,
  updateProfile,
  deleteProfile,
  hasProfile,
  listProfiles,
  getProfileStats,
  updateProfileField,
  updatePreferenceField,
  CreateProfileRequest,
  UpdateProfileRequest,
  ProfileResponse,
} from '../services/profilesService';

const router = Router();

// Apply schema routing middleware to all routes
router.use(schemaRouter);

/**
 * POST /api/v1/apps/profiles
 * Create a new profile
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

    const input: CreateProfileRequest = req.body;
    const profile: ProfileResponse = await createProfile(req, userId, input);
    res.status(201).json(profile);
  })
);

/**
 * GET /api/v1/apps/profiles/:userId
 * Get profile by user ID
 */
router.get(
  '/:userId',
  requireApiKey,
  requireAuthentication,
  requireAppAccess,
  asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const profile: ProfileResponse = await getProfile(req, userId);
    res.status(200).json(profile);
  })
);

/**
 * PATCH /api/v1/apps/profiles/:userId
 * Update profile
 */
router.patch(
  '/:userId',
  requireApiKey,
  requireAuthentication,
  requireAppAccess,
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const updates: UpdateProfileRequest = req.body;

    const profile: ProfileResponse = await updateProfile(req, userId, updates);
    res.status(200).json(profile);
  })
);

/**
 * DELETE /api/v1/apps/profiles/:userId
 * Delete profile
 */
router.delete(
  '/:userId',
  requireApiKey,
  requireAuthentication,
  requireAppAccess,
  asyncHandler(async (req, res) => {
    const { userId } = req.params;

    await deleteProfile(req, userId);
    res.status(200).json({ message: 'Profile deleted' });
  })
);

/**
 * GET /api/v1/apps/profiles/:userId/exists
 * Check if user has profile
 */
router.get(
  '/:userId/exists',
  requireApiKey,
  requireAuthentication,
  requireAppAccess,
  asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const exists = await hasProfile(req, userId);
    res.status(200).json({ exists });
  })
);

/**
 * GET /api/v1/apps/profiles
 * List all profiles (admin only)
 */
router.get(
  '/',
  requireApiKey,
  requireAppAccess,
  asyncHandler(async (req, res) => {
    const filters = {
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
    };

    const result = await listProfiles(req, filters);
    res.status(200).json(result);
  })
);

/**
 * GET /api/v1/apps/profiles/stats
 * Get profile statistics
 */
router.get(
  '/stats',
  requireApiKey,
  requireAppAccess,
  asyncHandler(async (req, res) => {
    const stats = await getProfileStats(req);
    res.status(200).json(stats);
  })
);

/**
 * PATCH /api/v1/apps/profiles/:userId/fields/:fieldPath
 * Update specific profile field
 */
router.patch(
  '/:userId/fields/:fieldPath',
  requireApiKey,
  requireAuthentication,
  requireAppAccess,
  asyncHandler(async (req, res) => {
    const { userId, fieldPath } = req.params;
    const { value } = req.body;

    const profile: ProfileResponse = await updateProfileField(req, userId, fieldPath, value);
    res.status(200).json(profile);
  })
);

/**
 * PATCH /api/v1/apps/profiles/:userId/preferences/:key
 * Update specific preference
 */
router.patch(
  '/:userId/preferences/:key',
  requireApiKey,
  requireAuthentication,
  requireAppAccess,
  asyncHandler(async (req, res) => {
    const { userId, key } = req.params;
    const { value } = req.body;

    const profile: ProfileResponse = await updatePreferenceField(req, userId, key, value);
    res.status(200).json(profile);
  })
);

export default router;
