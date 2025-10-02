/**
 * User Apps Service
 * Task: T027
 *
 * Business logic for user-app access management.
 * Handles user_app_access records and permissions.
 */

import { Request } from 'express';
import {
  createQueryBuilder,
  executeQuery,
  executeQueryOptional,
  DatabaseError,
} from '../utils/database';
import {
  validateRequired,
  validateUuid,
  validateEnum,
  USER_ROLES,
  USER_APP_STATUSES,
  UserRole,
  UserAppStatus,
} from '../utils/validation';
import { AppResponse } from './platformAppsService';

/**
 * User-app access record with app details
 */
export interface UserAppAccess {
  app: AppResponse;
  role: UserRole;
  status: UserAppStatus;
  joined_at: string;
  last_active_at?: string;
  settings?: Record<string, unknown>;
}

/**
 * List user apps response
 */
export interface ListUserAppsResponse {
  apps: UserAppAccess[];
}

/**
 * Get all apps accessible by a user
 */
export const getUserApps = async (
  req: Request,
  userId: string,
  filters?: {
    status?: string;
  }
): Promise<ListUserAppsResponse> => {
  validateUuid(userId, 'user_id');

  const db = createQueryBuilder(req);

  // Query user_app_access with joined app data
  let query = db
    .from('user_app_access')
    .select(
      `
      role,
      status,
      joined_at,
      last_active_at,
      settings,
      app:app_id (
        id,
        app_id,
        name,
        description,
        schema_name,
        status,
        settings,
        created_at,
        updated_at
      )
    `
    )
    .eq('user_id', userId)
    .order('joined_at', { ascending: false });

  // Apply status filter if provided
  if (filters?.status) {
    const status = validateEnum(filters.status as UserAppStatus, USER_APP_STATUSES, 'status');
    query = query.eq('status', status);
  } else {
    // Default to active only
    query = query.eq('status', 'active');
  }

  const result = await executeQuery<any>(
    () => query,
    'get user apps'
  ) as UserAppAccess[];

  // Check if user exists (empty result could mean no access or user doesn't exist)
  if (result.length === 0) {
    // Verify user exists
    const userExists = await executeQueryOptional(
      () => db.from('users').select('id').eq('id', userId).maybeSingle(),
      'check user exists'
    );

    if (!userExists) {
      throw new DatabaseError('User not found', 'USER_NOT_FOUND', undefined);
    }
  }

  return { apps: result };
};

/**
 * Grant user access to an app
 */
export const grantAppAccess = async (
  req: Request,
  userId: string,
  appId: string,
  role: UserRole = 'user'
): Promise<void> => {
  validateUuid(userId, 'user_id');
  validateUuid(appId, 'app_id');
  validateEnum(role, USER_ROLES, 'role');

  const db = createQueryBuilder(req);

  // Verify user exists
  const userExists = await executeQueryOptional(
    () => db.from('users').select('id').eq('id', userId).maybeSingle(),
    'check user exists'
  );

  if (!userExists) {
    throw new DatabaseError('User not found', 'USER_NOT_FOUND', undefined);
  }

  // Verify app exists
  const appExists = await executeQueryOptional(
    () => db.from('apps').select('id').eq('id', appId).maybeSingle(),
    'check app exists'
  );

  if (!appExists) {
    throw new DatabaseError('App not found', 'APP_NOT_FOUND', undefined);
  }

  // Create or update user_app_access
  await executeQuery(
    () =>
      db
        .from('user_app_access')
        .upsert(
          {
            user_id: userId,
            app_id: appId,
            role,
            status: 'active',
            joined_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id,app_id',
          }
        )
        .select()
        .single(),
    'grant app access'
  );
};

/**
 * Revoke user access to an app (soft delete)
 */
export const revokeAppAccess = async (
  req: Request,
  userId: string,
  appId: string
): Promise<void> => {
  validateUuid(userId, 'user_id');
  validateUuid(appId, 'app_id');

  const db = createQueryBuilder(req);

  await executeQuery(
    () =>
      db
        .from('user_app_access')
        .update({ status: 'deleted' })
        .eq('user_id', userId)
        .eq('app_id', appId)
        .select()
        .single(),
    'revoke app access'
  );
};

/**
 * Update user role for an app
 */
export const updateUserRole = async (
  req: Request,
  userId: string,
  appId: string,
  role: UserRole
): Promise<void> => {
  validateUuid(userId, 'user_id');
  validateUuid(appId, 'app_id');
  validateEnum(role, USER_ROLES, 'role');

  const db = createQueryBuilder(req);

  await executeQuery(
    () =>
      db
        .from('user_app_access')
        .update({ role })
        .eq('user_id', userId)
        .eq('app_id', appId)
        .select()
        .single(),
    'update user role'
  );
};

/**
 * Check if user has access to an app
 */
export const hasAppAccess = async (
  req: Request,
  userId: string,
  appId: string
): Promise<boolean> => {
  validateUuid(userId, 'user_id');
  validateUuid(appId, 'app_id');

  const db = createQueryBuilder(req);

  const access = await executeQueryOptional(
    () =>
      db
        .from('user_app_access')
        .select('status')
        .eq('user_id', userId)
        .eq('app_id', appId)
        .maybeSingle(),
    'check app access'
  );

  return access !== null && access.status === 'active';
};

/**
 * Get user's role for an app
 */
export const getUserAppRole = async (
  req: Request,
  userId: string,
  appId: string
): Promise<UserRole | null> => {
  validateUuid(userId, 'user_id');
  validateUuid(appId, 'app_id');

  const db = createQueryBuilder(req);

  const access = await executeQueryOptional<{ role: UserRole; status: UserAppStatus }>(
    () =>
      db
        .from('user_app_access')
        .select('role, status')
        .eq('user_id', userId)
        .eq('app_id', appId)
        .maybeSingle(),
    'get user app role'
  );

  if (!access || access.status !== 'active') {
    return null;
  }

  return access.role;
};

/**
 * Update last active timestamp for user-app access
 */
export const updateLastActive = async (
  req: Request,
  userId: string,
  appId: string
): Promise<void> => {
  validateUuid(userId, 'user_id');
  validateUuid(appId, 'app_id');

  const db = createQueryBuilder(req);

  await executeQueryOptional(
    () =>
      db
        .from('user_app_access')
        .update({ last_active_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('app_id', appId),
    'update last active'
  );
};
