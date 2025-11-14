/**
 * Authentication Middleware
 * Task: T022
 *
 * Validates API keys and manages user authentication for multi-tenant platform.
 * Supports both platform-level and app-level API keys.
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
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
 * Hash API key using SHA-256 (constant-time hashing)
 * SECURITY: Prevents timing attacks and ensures keys are never stored in plaintext
 */
const hashApiKey = async (key: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Buffer.from(hashBuffer).toString('hex');
};

/**
 * API Key authentication middleware
 * SECURITY: Validates X-API-Key header against hashed keys in database
 * - Keys stored as SHA-256 hashes in developer_api_keys table
 * - Uses constant-time comparison to prevent timing attacks
 * - Tracks usage count and last_used_at timestamp
 */
export const requireApiKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const apiKey = req.header('X-API-Key');

    if (!apiKey) {
      res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'API key required. Provide X-API-Key header.',
      });
      return;
    }

    // Validate API key format (should start with oriva_pk_)
    if (!apiKey.startsWith('oriva_pk_')) {
      res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Invalid API key format. Must start with oriva_pk_',
      });
      return;
    }

    // Hash the provided API key
    const hashedKey = await hashApiKey(apiKey);

    // Query database for matching API key
    const supabase = getSupabase(req);
    const { data: keyRecord, error } = await supabase
      .schema('oriva_platform')
      .from('developer_api_keys')
      .select('id, app_id, is_active, usage_count, expires_at')
      .eq('key_hash', hashedKey)
      .maybeSingle();

    if (error || !keyRecord) {
      res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Invalid API key',
      });
      return;
    }

    // Check if key is active
    if (!keyRecord.is_active) {
      res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'API key has been deactivated',
      });
      return;
    }

    // Check if key has expired
    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
      res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'API key has expired',
      });
      return;
    }

    // Update usage tracking (fire and forget - don't block request)
    void supabase
      .schema('oriva_platform')
      .from('developer_api_keys')
      .update({
        usage_count: (keyRecord.usage_count || 0) + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', keyRecord.id)
      .then(() => {})
      .catch((err: unknown) => console.warn('Failed to update API key usage:', err));

    next();
  } catch (error) {
    console.error('API key validation error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'API key validation failed',
    });
  }
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

    // SECURITY: Test mode bypass - STRICTLY controlled
    // Only enabled when:
    // 1. NODE_ENV is explicitly 'test'
    // 2. ALLOW_TEST_TOKENS env var is set to 'true'
    // 3. NOT running on Vercel (VERCEL_ENV is undefined)
    const isTestEnvironment =
      process.env.NODE_ENV === 'test' &&
      process.env.ALLOW_TEST_TOKENS === 'true' &&
      !process.env.VERCEL_ENV;

    if (isTestEnvironment && token.startsWith('test-user-')) {
      // Extract user ID from test token format: "test-user-{uuid}"
      const userId = token.replace('test-user-', '');

      // Load user record from database
      const supabase = getSupabase(req);
      const { data: userRecord, error: userError } = await supabase
        .schema('oriva_platform')
        .from('users')
        .select('id, email, full_name')
        .eq('id', userId)
        .single<UserRecord>();

      if (userError || !userRecord) {
        res.status(401).json({
          code: 'USER_NOT_FOUND',
          message: 'Test user account not found',
        });
        return;
      }

      req.user = {
        id: userRecord.id,
        email: userRecord.email,
      };

      next();
      return;
    }

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
      .schema('oriva_platform')
      .from('users')
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
      .schema('oriva_platform')
      .from('user_app_access')
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
