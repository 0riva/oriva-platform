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
} from '../../services/profilesService';

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
        message: 'Cannot create profile for another user',
      });
      return;
    }

    const profile: ProfileResponse = await createProfile(req, userId, input);
    res.status(201).json(profile);
  })
);

/**
 * GET /api/v1/apps/profiles/available
 * Get all active Oriva profiles for the authenticated user
 * Returns profiles from public.profiles table (platform-level identities)
 */
router.get(
  '/available',
  requireApiKey,
  requireAuthentication,
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    // Import supabase client
    const { getSupabaseClient } = await import('../../config/supabase');
    const supabase = getSupabaseClient();

    // Call the database function to get active profiles for this user
    const { data: profiles, error } = await supabase.rpc('get_user_active_profiles', {
      user_id: userId,
    });

    if (error) {
      console.error('Error fetching user profiles:', error);
      res.status(500).json({
        code: 'DATABASE_ERROR',
        message: 'Failed to fetch profiles',
        details: error.message,
      });
      return;
    }

    // Map database columns to API format expected by useOrivaProfiles
    const normalizedProfiles = (profiles || []).map(
      (profile: {
        profile_id: string;
        display_name: string;
        avatar_url: string | null;
        is_default: boolean;
      }) => ({
        id: profile.profile_id,
        profileId: profile.profile_id,
        name: profile.display_name,
        profileName: profile.display_name,
        avatar: profile.avatar_url,
        avatarUrl: profile.avatar_url,
        isDefault: profile.is_default,
        isActive: true, // All returned profiles are active (filter is in the DB function)
      })
    );

    res.status(200).json(normalizedProfiles);
  })
);

/**
 * GET /api/v1/apps/profiles/me
 * Get current authenticated user's profile
 */
router.get(
  '/me',
  requireApiKey,
  requireAuthentication,
  requireAppAccess,
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    const profile: ProfileResponse = await getProfile(req, userId);
    res.status(200).json(profile);
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
 * List all profiles (requires authentication and app access)
 */
router.get(
  '/',
  requireApiKey,
  requireAuthentication,
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
