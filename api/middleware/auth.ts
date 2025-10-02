/**
 * Authentication Middleware
 * Task: T022
 *
 * Validates API keys and manages user authentication for multi-tenant platform.
 * Supports both platform-level and app-level API keys.
 */

import { Request, Response, NextFunction } from 'express';
import { getSupabase } from './schemaRouter';

// Extend Express Request to include user context
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role?: string;
      };
    }
  }
}

interface UserRecord {
  id: string;
  email: string;
  full_name: string | null;
}

/**
 * API Key authentication middleware
 * Validates X-API-Key header against environment configuration
 */
export const requireApiKey = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const apiKey = req.header('X-API-Key');

  if (!apiKey) {
    res.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'API key required. Provide X-API-Key header.',
    });
    return;
  }

  // Validate against configured API keys
  const validApiKeys = [
    process.env.API_KEY_PLATFORM,
    process.env.API_KEY_HUGO_LOVE,
    process.env.API_KEY_HUGO_CAREER,
  ].filter(Boolean);

  if (!validApiKeys.includes(apiKey)) {
    res.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'Invalid API key',
    });
    return;
  }

  next();
};

/**
 * User authentication middleware
 * Validates user JWT token and loads user context
 */
export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Authorization header required with Bearer token',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify JWT with Supabase
    const supabase = getSupabase(req);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
        details: error,
      });
      return;
    }

    // Load full user record from oriva_platform.users
    const { data: userRecord, error: userError } = await supabase
      .from('oriva_platform.users')
      .select('id, email, full_name')
      .eq('id', user.id)
      .single<UserRecord>();

    if (userError || !userRecord) {
      res.status(401).json({
        code: 'USER_NOT_FOUND',
        message: 'User account not found',
      });
      return;
    }

    // Attach user to request
    req.user = {
      id: userRecord.id,
      email: userRecord.email,
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Authentication failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Require user access to current app
 * Checks oriva_platform.user_app_access for active access
 */
export const requireAppAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'User authentication required',
      });
      return;
    }

    if (!req.appContext) {
      res.status(500).json({
        code: 'CONFIGURATION_ERROR',
        message: 'App context not initialized',
      });
      return;
    }

    const supabase = getSupabase(req);
    const userId = req.user.id;
    const appUuid = req.appContext.appUuid;

    // Check user_app_access
    const { data: access, error } = await supabase
      .from('oriva_platform.user_app_access')
      .select('role, status')
      .eq('user_id', userId)
      .eq('app_id', appUuid)
      .single();

    if (error || !access) {
      res.status(403).json({
        code: 'FORBIDDEN',
        message: 'You do not have access to this app',
      });
      return;
    }

    if (access.status !== 'active') {
      res.status(403).json({
        code: 'FORBIDDEN',
        message: `Your access to this app is ${access.status}`,
      });
      return;
    }

    // Attach role to user context
    if (req.user) {
      req.user.role = access.role;
    }

    next();
  } catch (error) {
    console.error('App access check error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Access check failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Require admin role for current app
 */
export const requireAppAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // First check app access
  await requireAppAccess(req, res, () => {
    // Then check role
    if (!req.user?.role || !['admin', 'owner'].includes(req.user.role)) {
      res.status(403).json({
        code: 'FORBIDDEN',
        message: 'Admin or owner role required',
      });
      return;
    }

    next();
  });
};

/**
 * Optional authentication (doesn't fail if not authenticated)
 * Useful for endpoints that can work with or without auth
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No auth provided, continue without user context
    next();
    return;
  }

  // Auth provided, validate it
  await requireAuth(req, res, next);
};

// Alias for backward compatibility
export const requireAuthentication = requireAuth;
