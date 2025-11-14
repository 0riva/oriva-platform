/**
 * Schema Routing Middleware
 * Task: T021
 *
 * Routes requests to appropriate PostgreSQL schemas based on X-App-ID header.
 * Implements multi-tenant architecture with schema-level isolation.
 *
 * SECURITY UPDATE:
 * - Uses anon key for user-facing requests to enforce Row-Level Security (RLS)
 * - Service role key reserved for admin-only operations (never exposed to users)
 * - For admin operations, use getSupabaseServiceClient() from src/config/supabase.ts
 */

import { Request, Response, NextFunction } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger, sanitizeError, sanitizeObject } from '../../utils/logger';

// Extend Express Request to include app context
declare global {
  namespace Express {
    interface Request {
      appContext?: {
        appId: string;
        appUuid: string;
        schemaName: string;
        supabase: SupabaseClient;
      };
    }
  }
}

interface AppRecord {
  id: string;
  app_id: string;
  name: string;
  schema_name: string;
  status: string;
}

/**
 * Schema routing middleware
 * Extracts X-App-ID header and sets up schema-aware database context
 *
 * SECURITY: Uses anon key to enforce RLS policies on all user requests
 */
export const schemaRouter = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract X-App-ID header
    const appId = req.header('X-App-ID');

    if (!appId) {
      res.status(400).json({
        code: 'MISSING_APP_ID',
        message: 'X-App-ID header is required for schema routing',
      });
      return;
    }

    // SECURITY: Use anon key for user-facing requests to enforce RLS
    // Service role key should NEVER be used for user-initiated requests
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      res.status(500).json({
        code: 'CONFIGURATION_ERROR',
        message: 'Database configuration missing',
      });
      return;
    }

    // Use anon key to enforce Row-Level Security policies
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Look up app in oriva_platform.apps
    const { data: app, error: appError } = await supabase
      .schema('oriva_platform')
      .from('apps')
      .select('id, app_id, name, schema_name, status')
      .eq('app_id', appId)
      .single<AppRecord>();

    if (appError || !app) {
      res.status(404).json({
        code: 'APP_NOT_FOUND',
        message: `App not found: ${appId}`,
        details: appError,
      });
      return;
    }

    // Check app status
    if (app.status !== 'active') {
      res.status(503).json({
        code: 'APP_UNAVAILABLE',
        message: `App is currently ${app.status}`,
      });
      return;
    }

    // Set schema search path for this request
    const { error: pathError } = await supabase
      .schema('oriva_platform')
      .rpc('set_request_schema_path', {
        p_app_id: appId,
      });

    if (pathError) {
      // SECURITY: Sanitize error details to prevent exposure
      logger.error('Schema path setup failed', {
        appId,
        error: sanitizeError(pathError),
      });
      res.status(500).json({
        code: 'SCHEMA_ROUTING_ERROR',
        message: 'Failed to route request to app schema',
      });
      return;
    }

    // Attach app context to request
    req.appContext = {
      appId: app.app_id,
      appUuid: app.id,
      schemaName: app.schema_name,
      supabase,
    };

    // Continue to next middleware
    next();
  } catch (error) {
    // SECURITY: Sanitize error details to prevent sensitive data exposure
    logger.error('Schema routing failed', {
      appId: req.header('X-App-ID'),
      error: sanitizeError(error),
    });
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Schema routing failed',
    });
  }
};

/**
 * Optional schema routing middleware (for endpoints that don't require X-App-ID)
 * Used for platform-level endpoints like /platform/apps
 *
 * SECURITY: Uses anon key to enforce RLS policies
 */
export const optionalSchemaRouter = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const appId = req.header('X-App-ID');

  // If no X-App-ID provided, just set up platform-level Supabase client
  if (!appId) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      res.status(500).json({
        code: 'CONFIGURATION_ERROR',
        message: 'Database configuration missing',
      });
      return;
    }

    // SECURITY: Use anon key for user requests to enforce RLS
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    req.appContext = {
      appId: 'platform',
      appUuid: '',
      schemaName: 'oriva_platform',
      supabase,
    };

    next();
    return;
  }

  // If X-App-ID provided, use full schema routing
  await schemaRouter(req, res, next);
};

/**
 * Get schema-aware Supabase client from request
 */
export const getSupabase = (req: Request): SupabaseClient => {
  if (!req.appContext?.supabase) {
    throw new Error('Supabase client not initialized. Schema routing middleware required.');
  }
  return req.appContext.supabase;
};

/**
 * Get app context from request
 */
export const getAppContext = (req: Request): NonNullable<Request['appContext']> => {
  if (!req.appContext) {
    throw new Error('App context not initialized. Schema routing middleware required.');
  }
  return req.appContext;
};

/**
 * Build fully qualified table name for current schema
 */
export const getTableName = (req: Request, tableName: string): string => {
  const { schemaName } = getAppContext(req);
  return `${schemaName}.${tableName}`;
};
