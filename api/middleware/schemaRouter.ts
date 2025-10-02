/**
 * Schema Routing Middleware
 * Task: T021
 *
 * Routes requests to appropriate PostgreSQL schemas based on X-App-ID header.
 * Implements multi-tenant architecture with schema-level isolation.
 */

import { Request, Response, NextFunction } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

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

    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      res.status(500).json({
        code: 'CONFIGURATION_ERROR',
        message: 'Database configuration missing',
      });
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Look up app in oriva_platform.apps
    const { data: app, error: appError } = await supabase
      .from('oriva_platform.apps')
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
    const { error: pathError } = await supabase.rpc('set_request_schema_path', {
      p_app_id: appId,
    });

    if (pathError) {
      console.error('Failed to set schema path:', pathError);
      res.status(500).json({
        code: 'SCHEMA_ROUTING_ERROR',
        message: 'Failed to route request to app schema',
        details: pathError,
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
    console.error('Schema routing error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Schema routing failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Optional schema routing middleware (for endpoints that don't require X-App-ID)
 * Used for platform-level endpoints like /platform/apps
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
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      res.status(500).json({
        code: 'CONFIGURATION_ERROR',
        message: 'Database configuration missing',
      });
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
export const getAppContext = (
  req: Request
): NonNullable<Request['appContext']> => {
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
