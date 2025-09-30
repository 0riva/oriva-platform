// Task: T013 - JWT authentication middleware
// Description: Verify Oriva SSO JWT tokens and extract user context

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseClient } from '../config/supabase';

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
  next: () => void | Promise<void>,
): Promise<void> {
  try {
    // Extract JWT from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Missing or invalid Authorization header',
        code: 'AUTH_MISSING',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // Verify JWT with Supabase
    const supabase = getSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({
        error: 'Invalid or expired token',
        code: 'AUTH_INVALID',
      });
      return;
    }

    // Fetch user profile from users table
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('id, email, subscription_tier')
      .eq('oriva_user_id', user.id)
      .single();

    if (profileError || !userProfile) {
      res.status(404).json({
        error: 'User profile not found',
        code: 'USER_NOT_FOUND',
      });
      return;
    }

    // Attach auth context to request
    (req as AuthenticatedRequest).authContext = {
      userId: userProfile.id,
      email: userProfile.email,
      subscription_tier: userProfile.subscription_tier,
    };

    // Update last_active_at timestamp (fire and forget)
    supabase
      .from('users')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', userProfile.id)
      .then(() => {})
      .catch((err) => console.warn('Failed to update last_active_at:', err));

    // Continue to handler
    await next();
  } catch (error) {
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
  next: () => void | Promise<void>,
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
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (!error && user) {
      const { data: userProfile } = await supabase
        .from('users')
        .select('id, email, subscription_tier')
        .eq('oriva_user_id', user.id)
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