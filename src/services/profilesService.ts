/**
 * Profiles Service
 * Task: T030
 *
 * Business logic for app-specific user profiles.
 * Handles profile creation, updates, and retrieval in app schemas.
 */

import { Request } from 'express';
import {
  createQueryBuilder,
  executeQuery,
  executeQueryOptional,
  DatabaseError,
} from '../utils/database-express';
import { validateRequired, validateUuid } from '../utils/validation-express';

/**
 * Create profile request
 */
export interface CreateProfileRequest {
  user_id?: string;
  profile_data: Record<string, unknown>;
}

/**
 * Update profile request
 */
export interface UpdateProfileRequest {
  profile_data?: Record<string, unknown>;
}

/**
 * Profile response
 */
export interface ProfileResponse {
  id: string;
  user_id: string;
  profile_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * Create a new profile for user in app
 */
export const createProfile = async (
  req: Request,
  userId: string,
  input: CreateProfileRequest
): Promise<ProfileResponse> => {
  validateUuid(userId, 'user_id');
  validateRequired(input.profile_data, 'profile_data');

  const db = createQueryBuilder(req);
  const appUuid = req.appContext?.appUuid;

  if (!appUuid) {
    throw new DatabaseError('App context not initialized', 'CONFIGURATION_ERROR', undefined);
  }

  // Verify user exists
  const userExists = await executeQueryOptional(
    () => db.from('users').select('id').eq('id', userId).maybeSingle(),
    'check user exists'
  );

  if (!userExists) {
    throw new DatabaseError('User not found', 'USER_NOT_FOUND', undefined);
  }

  // Check if profile already exists
  const existingProfile = await executeQueryOptional<ProfileResponse>(
    () => db.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
    'check existing profile'
  );

  if (existingProfile) {
    throw new DatabaseError('Profile already exists for this user', 'PROFILE_EXISTS', undefined);
  }

  // Create profile in app-specific schema
  const profile = await executeQuery<ProfileResponse>(
    () =>
      db
        .from('profiles')
        .insert({
          user_id: userId,
          profile_data: input.profile_data,
        })
        .select()
        .single(),
    'create profile'
  );

  return profile;
};

/**
 * Get profile by user ID
 */
export const getProfile = async (req: Request, userId: string): Promise<ProfileResponse> => {
  validateUuid(userId, 'user_id');

  const db = createQueryBuilder(req);

  const profile = await executeQuery<ProfileResponse>(
    () => db.from('profiles').select('*').eq('user_id', userId).single(),
    'get profile'
  );

  return profile;
};

/**
 * Update profile
 */
export const updateProfile = async (
  req: Request,
  userId: string,
  updates: UpdateProfileRequest
): Promise<ProfileResponse> => {
  validateUuid(userId, 'user_id');

  const db = createQueryBuilder(req);

  // Verify profile exists
  const existingProfile = await executeQuery<ProfileResponse>(
    () => db.from('profiles').select('*').eq('user_id', userId).single(),
    'verify profile exists'
  );

  // Build update object
  const updateData: Partial<UpdateProfileRequest> = {};

  if (updates.profile_data !== undefined) {
    // Merge with existing profile_data
    updateData.profile_data = {
      ...existingProfile.profile_data,
      ...updates.profile_data,
    };
  }

  // Update profile
  const updatedProfile = await executeQuery<ProfileResponse>(
    () => db.from('profiles').update(updateData).eq('user_id', userId).select().single(),
    'update profile'
  );

  return updatedProfile;
};

/**
 * Delete profile (soft delete by removing data)
 */
export const deleteProfile = async (req: Request, userId: string): Promise<void> => {
  validateUuid(userId, 'user_id');

  const db = createQueryBuilder(req);

  await executeQuery(() => db.from('profiles').delete().eq('user_id', userId), 'delete profile');
};

/**
 * Check if user has profile in app
 */
export const hasProfile = async (req: Request, userId: string): Promise<boolean> => {
  validateUuid(userId, 'user_id');

  const db = createQueryBuilder(req);

  const profile = await executeQueryOptional(
    () => db.from('profiles').select('id').eq('user_id', userId).maybeSingle(),
    'check profile exists'
  );

  return profile !== null;
};

/**
 * List all profiles in app (admin only)
 */
export const listProfiles = async (
  req: Request,
  filters?: {
    limit?: number;
    offset?: number;
  }
): Promise<{ profiles: ProfileResponse[] }> => {
  const db = createQueryBuilder(req);

  // Build query
  let query = db.from('profiles').select('*').order('created_at', { ascending: false });

  // Apply pagination
  if (filters?.limit !== undefined && filters?.offset !== undefined) {
    query = query.range(filters.offset, filters.offset + filters.limit - 1);
  }

  const profiles = await executeQuery<ProfileResponse[]>(() => query, 'list profiles');

  return { profiles };
};

/**
 * Get profile statistics for app
 */
export const getProfileStats = async (
  req: Request
): Promise<{
  total_profiles: number;
}> => {
  const db = createQueryBuilder(req);

  const profiles = await executeQuery<ProfileResponse[]>(
    () => db.from('profiles').select('*'),
    'get profiles for stats'
  );

  const stats = {
    total_profiles: profiles.length,
  };

  return stats;
};

/**
 * Update profile field
 */
export const updateProfileField = async (
  req: Request,
  userId: string,
  fieldPath: string,
  value: unknown
): Promise<ProfileResponse> => {
  validateUuid(userId, 'user_id');
  validateRequired(fieldPath, 'field_path');

  const db = createQueryBuilder(req);

  // Get existing profile
  const existingProfile = await executeQuery<ProfileResponse>(
    () => db.from('profiles').select('*').eq('user_id', userId).single(),
    'get profile'
  );

  // Update specific field in profile_data
  const updatedProfileData = { ...existingProfile.profile_data };
  const fieldParts = fieldPath.split('.');

  // Navigate to nested field
  let current: Record<string, unknown> = updatedProfileData;
  for (let i = 0; i < fieldParts.length - 1; i++) {
    const part = fieldParts[i];
    if (!(part in current)) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  // Set value
  current[fieldParts[fieldParts.length - 1]] = value;

  // Update profile
  const updatedProfile = await executeQuery<ProfileResponse>(
    () =>
      db
        .from('profiles')
        .update({ profile_data: updatedProfileData })
        .eq('user_id', userId)
        .select()
        .single(),
    'update profile field'
  );

  return updatedProfile;
};

/**
 * Update preference field (stored within profile_data)
 */
export const updatePreferenceField = async (
  req: Request,
  userId: string,
  key: string,
  value: unknown
): Promise<ProfileResponse> => {
  validateUuid(userId, 'user_id');
  validateRequired(key, 'preference_key');

  const db = createQueryBuilder(req);

  // Get existing profile
  const existingProfile = await executeQuery<ProfileResponse>(
    () => db.from('profiles').select('*').eq('user_id', userId).single(),
    'get profile'
  );

  // Update preference within profile_data
  const updatedProfileData = {
    ...existingProfile.profile_data,
    preferences: {
      ...((existingProfile.profile_data.preferences as Record<string, unknown>) || {}),
      [key]: value,
    },
  };

  // Update profile
  const updatedProfile = await executeQuery<ProfileResponse>(
    () =>
      db
        .from('profiles')
        .update({ profile_data: updatedProfileData })
        .eq('user_id', userId)
        .select()
        .single(),
    'update preference field'
  );

  return updatedProfile;
};
