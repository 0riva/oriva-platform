// @ts-nocheck - TODO: Fix type errors
// Task: T013 - JWT authentication middleware
// Description: Verify Oriva SSO JWT tokens and extract user context

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseClient } from '../config/supabase';
import { trackAPIResponseTime, trackAuthEvent } from '../lib/metrics';
import { authRateLimiter } from './rateLimiter';

// JWT verification with Supabase Auth
export interface AuthContext {
  userId: string;
  email: string;
  subscription_tier: 'free' | 'premium' | 'enterprise';
}

/**
 * Authentication middleware for Vercel Edge Functions
 * Verifies JWT token from Authorization header and attaches user context
 */
export async function authenticate(
  req: VercelRequest,
  res: VercelResponse,
  next: () => void | Promise<void>
): Promise<void> {
  const startTime = Date.now();

  try {
    // Extract JWT from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      trackAuthEvent('login', false);
      res.status(401).json({
        error: 'Missing or invalid Authorization header',
        code: 'AUTH_MISSING',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // Verify JWT with Supabase
    const supabase = getSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      trackAuthEvent('login', false);
      res.status(401).json({
        error: 'Invalid or expired token',
        code: 'AUTH_INVALID',
      });
      return;
    }

    // Check for X-Profile-ID header (Love Puzl and other apps send this for profile scoping)
    const profileIdHeader = req.headers['x-profile-id'] as string | undefined;
    let userProfile: { id: string; account_id: string } | null = null;

    if (profileIdHeader) {
      // Client explicitly provided profile ID - verify it exists and belongs to this user
      const { data: providedProfile, error: profileLookupError } = await supabase
        .from('profiles')
        .select('id, account_id')
        .eq('id', profileIdHeader)
        .single();

      if (providedProfile) {
        // Verify this profile belongs to the authenticated user (same account_id)
        if (providedProfile.account_id === user.id) {
          userProfile = providedProfile;
          console.log('[Auth] Using X-Profile-ID header:', {
            profileId: profileIdHeader,
            userId: user.id,
          });
        } else {
          console.warn('[Auth] X-Profile-ID does not belong to authenticated user:', {
            profileId: profileIdHeader,
            profileAccountId: providedProfile.account_id,
            authUserId: user.id,
          });
          // Fall through to normal lookup
        }
      } else {
        console.warn('[Auth] X-Profile-ID not found:', {
          profileId: profileIdHeader,
          error: profileLookupError,
        });
        // Fall through to normal lookup
      }
    }

    // If no profile from header, fetch user profile from profiles table
    if (!userProfile) {
      // Note: Only select columns that exist in production schema
      const { data: foundProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, account_id')
        .eq('account_id', user.id)
        .single();

      if (foundProfile) {
        userProfile = foundProfile;
      } else if (profileError?.code === 'PGRST116') {
        // PGRST116 = "No rows returned" - auto-create profile for new users via magic link
        const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
        const anonSuffix = Math.floor(Math.random() * 100000000)
          .toString()
          .padStart(8, '0');

        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            account_id: user.id,
            display_name: displayName,
            username: `anon_${anonSuffix}`,
            profileurl: `anon_${anonSuffix}`,
            is_default: true,
            is_active: true,
            is_anonymous: true,
          })
          .select('id, account_id')
          .single();

        if (createError || !newProfile) {
          console.error('[Auth] Failed to auto-create profile:', createError);
          res.status(500).json({
            error: 'Failed to create user profile',
            code: 'PROFILE_CREATE_FAILED',
          });
          return;
        }

        userProfile = newProfile;
        console.log('[Auth] Auto-created profile for new user:', {
          userId: user.id,
          profileId: newProfile.id,
        });
      }
    }

    // Final check - must have a profile
    if (!userProfile) {
      console.error('[Auth] No profile found and could not create one:', { userId: user.id });
      res.status(500).json({
        error: 'User profile not found',
        code: 'PROFILE_NOT_FOUND',
      });
      return;
    }

    // Attach auth context to request (for Vercel Edge Functions)
    // Note: email comes from Supabase auth user, subscription_tier defaults to 'free'
    (req as AuthenticatedRequest).authContext = {
      userId: userProfile.id,
      email: user.email || '',
      subscription_tier: 'free',
    };

    // Also set keyInfo for Express routes (Merlin AI, etc.)
    // This ensures compatibility with routes that use createAuthMiddleware
    (req as any).keyInfo = {
      id: `jwt-${user.id}`,
      userId: userProfile.id,
      name: user.email || 'JWT Auth',
      permissions: ['read', 'write'],
      usageCount: 0,
      isActive: true,
      authType: 'supabase_auth' as const,
    };

    // Update last_active_at timestamp (fire and forget)
    supabase
      .from('profiles')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', userProfile.id)
      .then(() => {})
      .catch((err) => console.warn('Failed to update last_active_at:', err));

    // Track successful authentication
    trackAuthEvent('login', true);
    trackAPIResponseTime('auth.middleware', Date.now() - startTime);

    // Continue to handler
    await next();
  } catch (error) {
    trackAuthEvent('login', false);
    trackAPIResponseTime('auth.middleware', Date.now() - startTime);
    console.error('Authentication error:', error);
    res.status(500).json({
      error: 'Internal authentication error',
      code: 'AUTH_ERROR',
    });
  }
}

/**
 * Optional authentication - allows unauthenticated requests but extracts context if available
 * Useful for public endpoints that customize behavior for authenticated users
 */
export async function optionalAuthenticate(
  req: VercelRequest,
  res: VercelResponse,
  next: () => void | Promise<void>
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No auth provided - continue without context
      await next();
      return;
    }

    const token = authHeader.substring(7);
    const supabase = getSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (!error && user) {
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('id, email, subscription_tier')
        .eq('account_id', user.id)
        .single();

      if (userProfile) {
        (req as AuthenticatedRequest).authContext = {
          userId: userProfile.id,
          email: userProfile.email,
          subscription_tier: userProfile.subscription_tier,
        };
      }
    }

    await next();
  } catch (error) {
    console.error('Optional authentication error:', error);
    // Continue without auth context on error
    await next();
  }
}

/**
 * Extended request type with auth context
 */
export interface AuthenticatedRequest extends VercelRequest {
  authContext: AuthContext;
}

/**
 * Type guard to check if request is authenticated
 */
export function isAuthenticated(req: VercelRequest): req is AuthenticatedRequest {
  return 'authContext' in req && typeof (req as AuthenticatedRequest).authContext === 'object';
}

/**
 * Helper to extract auth context or throw error
 */
export function requireAuthContext(req: VercelRequest): AuthContext {
  if (!isAuthenticated(req)) {
    throw new Error('Authentication required but not provided');
  }
  return req.authContext;
}

/**
 * Express-compatible authentication middleware
 * Wraps the Vercel authenticate function for use with Express routers
 */
import type { Request, Response, NextFunction } from 'express';

export interface ExpressAuthenticatedRequest extends Request {
  authContext: AuthContext;
}

export function createAuthMiddleware() {
  // Return an array of middleware: [rate limiter, auth handler]
  return [
    authRateLimiter,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const vercelReq = req as unknown as VercelRequest;
      const vercelRes = res as unknown as VercelResponse;

      await authenticate(vercelReq, vercelRes, next);
    },
  ];
}

export function createOptionalAuthMiddleware() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const vercelReq = req as unknown as VercelRequest;
    const vercelRes = res as unknown as VercelResponse;

    await optionalAuthenticate(vercelReq, vercelRes, next);
  };
}

/**
 * Create a user-scoped Supabase client using anon key
 * This ensures RLS policies are enforced
 */
export function createUserSupabaseClient(accessToken: string) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase configuration');
  }

  const { createClient } = require('@supabase/supabase-js');

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}
