/**
 * Platform Apps Service
 * Task: T026
 *
 * Business logic for app registration and management in oriva_platform schema.
 * Handles app creation, listing, and schema provisioning.
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
  validateSchemaName,
  validateEnum,
  validatePagination,
  APP_STATUSES,
  AppStatus,
  ValidationError,
} from '../utils/validation';

/**
 * App registration request
 */
export interface CreateAppRequest {
  app_id: string;
  name: string;
  description?: string;
  schema_name: string;
  settings?: {
    quotas?: {
      max_users?: number;
      max_storage_gb?: number;
      max_api_calls?: number;
    };
    features?: string[];
    personality_id?: string;
  };
}

/**
 * App response
 */
export interface AppResponse {
  id: string;
  app_id: string;
  name: string;
  description?: string;
  schema_name: string;
  status: AppStatus;
  settings?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * List apps response
 */
export interface ListAppsResponse {
  apps: AppResponse[];
}

/**
 * Register a new app in the platform
 */
export const registerApp = async (
  req: Request,
  input: CreateAppRequest
): Promise<AppResponse> => {
  // Validate required fields
  const appId = validateRequired(input.app_id, 'app_id');
  const name = validateRequired(input.name, 'name');
  const schemaName = validateRequired(input.schema_name, 'schema_name');

  // Validate schema name format
  validateSchemaName(schemaName);

  // Build query
  const db = createQueryBuilder(req);

  // Check if app_id already exists
  const existingApp = await executeQueryOptional<AppResponse>(
    () => db.from('apps').select('id, app_id').eq('app_id', appId).maybeSingle(),
    'check existing app'
  );

  if (existingApp) {
    throw new DatabaseError(
      `App with app_id '${appId}' already exists`,
      'APP_ID_EXISTS',
      undefined
    );
  }

  // Create app record
  const app = await executeQuery<AppResponse>(
    () =>
      db
        .from('apps')
        .insert({
          app_id: appId,
          name,
          description: input.description,
          schema_name: schemaName,
          status: 'active',
          settings: input.settings || {},
        })
        .select()
        .single(),
    'create app'
  );

  // Create app-specific schema
  try {
    await db.rpc('create_app_schema', {
      schema_name: schemaName,
    });
  } catch (error) {
    // If schema creation fails, we should roll back the app record
    // But since Supabase doesn't support transactions, we'll just log the error
    console.error('Failed to create app schema:', error);
    throw new DatabaseError(
      'Failed to create app schema. App record created but schema provisioning failed.',
      'SCHEMA_CREATION_FAILED',
      undefined
    );
  }

  return app;
};

/**
 * List all apps in the platform
 */
export const listApps = async (
  req: Request,
  filters?: {
    status?: string;
    limit?: number;
    offset?: number;
  }
): Promise<ListAppsResponse> => {
  const db = createQueryBuilder(req);

  // Build query with filters
  let query = db.from('apps').select('*').order('created_at', { ascending: false });

  // Apply status filter if provided
  if (filters?.status) {
    const status = validateEnum(filters.status as AppStatus, APP_STATUSES, 'status');
    query = query.eq('status', status);
  }

  // Apply pagination
  if (filters?.limit !== undefined || filters?.offset !== undefined) {
    const { limit, offset } = validatePagination({
      limit: filters.limit?.toString(),
      offset: filters.offset?.toString(),
    });
    query = query.range(offset, offset + limit - 1);
  }

  const apps = await executeQuery<AppResponse[]>(
    () => query,
    'list apps'
  );

  return { apps };
};

/**
 * Get app by app_id
 */
export const getAppByAppId = async (req: Request, appId: string): Promise<AppResponse> => {
  const db = createQueryBuilder(req);

  const app = await executeQuery<AppResponse>(
    () => db.from('apps').select('*').eq('app_id', appId).single(),
    'get app'
  );

  return app;
};

/**
 * Get app by UUID
 */
export const getAppById = async (req: Request, id: string): Promise<AppResponse> => {
  const db = createQueryBuilder(req);

  const app = await executeQuery<AppResponse>(
    () => db.from('apps').select('*').eq('id', id).single(),
    'get app by id'
  );

  return app;
};

/**
 * Update app status
 */
export const updateAppStatus = async (
  req: Request,
  appId: string,
  status: AppStatus
): Promise<AppResponse> => {
  validateEnum(status, APP_STATUSES, 'status');

  const db = createQueryBuilder(req);

  const app = await executeQuery<AppResponse>(
    () => db.from('apps').update({ status }).eq('app_id', appId).select().single(),
    'update app status'
  );

  return app;
};

/**
 * Delete app (soft delete by setting status to inactive)
 */
export const deleteApp = async (req: Request, appId: string): Promise<void> => {
  await updateAppStatus(req, appId, 'inactive');
};

/**
 * Validate app exists and is active
 */
export const validateAppAccess = async (req: Request, appId: string): Promise<AppResponse> => {
  const app = await getAppByAppId(req, appId);

  if (app.status !== 'active') {
    throw new ValidationError(`App is currently ${app.status}`, {
      appId,
      status: app.status,
    });
  }

  return app;
};
