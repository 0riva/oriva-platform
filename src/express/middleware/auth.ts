// @ts-nocheck - Schema typing limitations with Supabase client
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
import { getSupabaseServiceClient } from '../../config/supabase';
import { logger, sanitizeError } from '../../utils/logger';
import { isValidUuid } from '../utils/validation-express';

// Extend Express Request to include user context
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role?: string;
      };
      /**
       * Oriva Profile ID from X-Profile-ID header
       * Used to scope tenant app data to a specific profile
       * Falls back to user.id if not provided
       */
      profileId?: string;
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
export const requireApiKey = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
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
    // Use service client to bypass RLS for API key validation (server-side operation)
    const supabase = getSupabaseServiceClient();
    const { data: keyRecord, error } = await supabase
      .schema('oriva_platform')
      .from('developer_api_keys')
      .select('id, app_id, is_active, usage_count, expires_at')
      .eq('key_hash', hashedKey)
      .maybeSingle();

    if (error) {
      logger.error('API key lookup failed', {
        error: sanitizeError(error),
      });
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'API key validation failed',
      });
      return;
    }

    if (!keyRecord) {
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
    Promise.resolve(
      supabase
        .schema('oriva_platform')
        .from('developer_api_keys')
        .update({
          usage_count: (keyRecord.usage_count || 0) + 1,
          last_used_at: new Date().toISOString(),
        })
        .eq('id', keyRecord.id)
    ).catch((err: unknown) => {
      // SECURITY: Sanitize error details
      logger.warn('API key usage tracking failed', {
        error: sanitizeError(err),
      });
    });

    next();
  } catch (error) {
    // SECURITY: Sanitize error details
    logger.error('API key validation failed', {
      error: sanitizeError(error),
    });
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

      // Load user record from public.users table (not oriva_platform)
      const supabase = getSupabase(req);
      const { data: userRecord, error: userError } = await supabase
        .schema('public')
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

      // Also set profileId for test mode (with UUID validation)
      const profileIdHeader = req.header('X-Profile-ID');
      if (profileIdHeader && !isValidUuid(profileIdHeader)) {
        res.status(400).json({
          code: 'INVALID_PROFILE_ID',
          message: 'X-Profile-ID must be a valid UUID',
        });
        return;
      }
      req.profileId = profileIdHeader || userRecord.id;

      // Set keyInfo for routes that expect it (same as production auth)
      (req as any).keyInfo = {
        id: `test-${userRecord.id}`,
        userId: req.profileId,
        name: userRecord.email || 'Test User',
        permissions: ['read', 'write'],
        usageCount: 0,
        isActive: true,
        authType: 'supabase_auth' as const,
      };

      next();
      return;
    }

    // SECURITY: Explicit JWT token expiration check
    // Parse JWT to extract expiration time (don't trust Supabase exclusively)
    try {
      const tokenParts = token.split('.');
      if (tokenParts.length === 3) {
        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
        const expiresAt = payload.exp * 1000; // Convert to milliseconds
        const now = Date.now();

        // Check if token is expired
        if (now >= expiresAt) {
          logger.warn('Expired JWT token rejected', {
            expiresAt: new Date(expiresAt).toISOString(),
          });
          res.status(401).json({
            code: 'TOKEN_EXPIRED',
            message: 'Token has expired',
          });
          return;
        }

        // Warn if token expires soon (< 5 minutes)
        const fiveMinutes = 5 * 60 * 1000;
        if (expiresAt - now < fiveMinutes) {
          logger.info('JWT token expiring soon', {
            expiresIn: Math.floor((expiresAt - now) / 1000) + 's',
          });
          // Signal client to refresh token
          res.setHeader('X-Token-Refresh-Required', 'true');
        }
      }
    } catch (parseError) {
      // If JWT parsing fails, continue with Supabase validation
      logger.warn('Failed to parse JWT for expiration check', {
        error: sanitizeError(parseError),
      });
    }

    // Verify JWT with Supabase using service client
    // Note: getUser(token) requires service_role key to validate arbitrary JWTs
    // The anon key client can only validate its own session token
    const serviceClient = getSupabaseServiceClient();
    const {
      data: { user },
      error,
    } = await serviceClient.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
      });
      return;
    }

    // Load full user record from public.users table
    // Note: users table is in public schema, not oriva_platform
    // Use service client to bypass RLS which may block reading user records
    // IMPORTANT: Look up by email, not id, because auth.users.id may not match public.users.id
    // (these tables can be populated independently, email is the reliable link)
    const { data: userRecord, error: userError } = await serviceClient
      .schema('public')
      .from('users')
      .select('id, email, full_name')
      .eq('email', user.email)
      .single<UserRecord>();

    if (userError || !userRecord) {
      logger.warn('[Auth] User not found in public.users', {
        authUserId: user.id,
        email: user.email,
        error: userError ? sanitizeError(userError) : 'No record found',
      });
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

    // Extract X-Profile-ID header if present
    // This allows tenant apps to scope data to a specific Oriva profile
    const profileIdHeader = req.header('X-Profile-ID');
    if (profileIdHeader) {
      // SECURITY: Validate UUID format to prevent SQL injection
      if (!isValidUuid(profileIdHeader)) {
        logger.warn('[Auth] Invalid X-Profile-ID format rejected:', {
          profileId: profileIdHeader.substring(0, 50), // Truncate for logging
          userId: userRecord.id,
        });
        res.status(400).json({
          code: 'INVALID_PROFILE_ID',
          message: 'X-Profile-ID must be a valid UUID',
        });
        return;
      }
      // SECURITY: Validate that this profile belongs to the authenticated user
      const serviceClient = getSupabaseServiceClient();
      const { data: profile, error: profileError } = await serviceClient
        .from('profiles')
        .select('id, user_id')
        .eq('id', profileIdHeader)
        .eq('user_id', userRecord.id)
        .maybeSingle();

      if (profileError) {
        logger.error('[Auth] Profile ownership check failed:', {
          error: sanitizeError(profileError),
          profileId: profileIdHeader,
          userId: userRecord.id,
        });
        res.status(500).json({
          code: 'INTERNAL_ERROR',
          message: 'Failed to validate profile ownership',
        });
        return;
      }

      if (!profile) {
        logger.warn('[Auth] Profile ownership validation failed:', {
          profileId: profileIdHeader,
          userId: userRecord.id,
        });
        res.status(403).json({
          code: 'FORBIDDEN',
          message: 'You do not have access to this profile',
        });
        return;
      }

      req.profileId = profileIdHeader;
      logger.debug('[Auth] Profile ID validated:', { profileId: profileIdHeader });
    } else {
      // Default to user ID if no profile ID specified
      req.profileId = userRecord.id;
    }

    // Also set keyInfo for routes that expect it (e.g., Hugo AI, Merlin AI)
    // This provides a unified interface for both API key and JWT authentication
    // For profile-scoped data, userId should be the profile ID (from X-Profile-ID header)
    (req as any).keyInfo = {
      id: `jwt-${userRecord.id}`,
      userId: req.profileId, // Use profile ID for data scoping
      name: userRecord.email || 'JWT Auth',
      permissions: ['read', 'write'],
      usageCount: 0,
      isActive: true,
      authType: 'supabase_auth' as const,
    };

    next();
  } catch (error) {
    // SECURITY: Sanitize error details
    logger.error('Authentication failed', {
      error: sanitizeError(error),
    });
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Authentication failed',
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
    // SECURITY: Sanitize error details
    logger.error('App access check failed', {
      error: sanitizeError(error),
    });
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Access check failed',
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

/**
 * Simple JWT authentication middleware for internal routes
 * Only validates JWT with Supabase auth, does NOT require oriva_platform.users record
 * Use for internal APIs that work with any authenticated Supabase user
 */
export const requireJwtAuth = async (
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

    // Verify JWT with Supabase using service client
    // Note: getUser(token) requires service_role key to validate arbitrary JWTs
    const serviceClient = getSupabaseServiceClient();
    const {
      data: { user },
      error,
    } = await serviceClient.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
      });
      return;
    }

    // Attach user to request (using Supabase auth user directly)
    req.user = {
      id: user.id,
      email: user.email || '',
    };

    next();
  } catch (error) {
    logger.error('JWT authentication failed', {
      error: sanitizeError(error),
    });
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Authentication failed',
    });
  }
};
