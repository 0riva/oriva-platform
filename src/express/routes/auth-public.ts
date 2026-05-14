/**
 * Public Auth Routes
 * Mounted at /api/v1/auth
 *
 * Extracted from api/index.ts (Phase 4 sub-router migration).
 * Handlers close over module-level singletons from index.ts, passed in via factory.
 *
 * NOTE: GET /api/v1/auth/profile is also registered inline in api/index.ts
 * (the withAuthContext keyInfo-based version) which is registered earlier and
 * wins Express first-match. The GET /profile handler here is preserved for
 * parity but remains shadowed — behaviour is unchanged from pre-extraction.
 */

import { Router, type RequestHandler } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from 'winston';
import { respondWithError } from '../utils/response';
import { getErrorMessage } from '../utils/query';
import { validateRequestData, ValidationError } from '../../middleware/validation';
import { createUserSupabaseClient } from '../../middleware/auth';
import { authRateLimiter } from '../../middleware/rateLimiter';
import {
  RegisterBodySchema,
  LoginBodySchema,
  TokenRefreshBodySchema,
} from '../../openapi/schemas/auth';

export function createAuthPublicRouter(
  supabase: SupabaseClient,
  supabaseAuth: SupabaseClient,
  logger: Logger,
  validateAuth: RequestHandler[]
): Router {
  const router = Router();

  // POST /api/v1/auth/register - User registration
  // authRateLimiter (5 / 15 min) guards against automated signup abuse.
  router.post('/register', authRateLimiter, async (req, res) => {
    try {
      const { email, password, username, name, preferences } = validateRequestData(
        RegisterBodySchema,
        req.body ?? {}
      );

      // Create Supabase auth user using anon client (public signup)
      const { data: authData, error: authError } = await supabaseAuth.auth.signUp({
        email,
        password,
      });

      if (authError) {
        if (
          authError.message.includes('already registered') ||
          authError.message.includes('already exists')
        ) {
          return respondWithError(res, 409, 'USER_EXISTS', 'Email already registered');
        }
        logger.error('Auth signup failed', {
          error: authError,
          message: authError.message,
          status: authError.status,
        });
        // Do not surface the raw Supabase error to the client — it can
        // contain internal schema / constraint detail. Logged above.
        return respondWithError(res, 500, 'SIGNUP_ERROR', 'Registration failed');
      }

      if (!authData.user) {
        return respondWithError(res, 500, 'USER_CREATION_FAILED', 'User creation failed');
      }

      // Create user profile in profiles table (called 'users')
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .insert({
          account_id: authData.user.id,
          display_name: name || authData.user.email!.split('@')[0],
          username: authData.user.email!.split('@')[0],
        })
        .select()
        .single();

      if (profileError) {
        // Rollback: Delete auth user if profile creation fails
        await supabase.auth.admin.deleteUser(authData.user.id);
        logger.error('Profile creation failed', { error: profileError });
        return respondWithError(
          res,
          500,
          'PROFILE_CREATION_FAILED',
          'Failed to create user profile'
        );
      }

      // Generate session tokens
      const { data: sessionData, error: sessionError } = await supabaseAuth.auth.signInWithPassword(
        {
          email,
          password,
        }
      );

      if (sessionError || !sessionData.session) {
        logger.error('Session creation failed', { error: sessionError });
        return respondWithError(
          res,
          500,
          'SESSION_ERROR',
          'Session creation failed after registration'
        );
      }

      // Return auth response with profile data
      res.status(201).json({
        user: {
          id: profileData.id,
          email: authData.user.email,
          display_name: profileData.display_name,
          username: profileData.username,
          subscription_tier: 'free',
          created_at: profileData.created_at,
        },
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
        expires_in: sessionData.session.expires_in || 3600,
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        respondWithError(res, 400, 'VALIDATION_ERROR', error.message, error.details as unknown[]);
        return;
      }
      logger.error('Registration error', { error });
      respondWithError(res, 500, 'REGISTRATION_ERROR', getErrorMessage(error));
    }
  });

  // POST /api/v1/auth/login - User login
  // authRateLimiter (5 / 15 min) guards against credential brute-force.
  router.post('/login', authRateLimiter, async (req, res) => {
    try {
      const { email, password } = validateRequestData(LoginBodySchema, req.body ?? {});

      // Authenticate with Supabase
      const { data: sessionData, error: authError } = await supabaseAuth.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !sessionData.session) {
        logger.error('Login failed', { error: authError, email });
        return respondWithError(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
      }

      // Get user profile from profiles table
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .eq('account_id', sessionData.user.id)
        .single();

      if (profileError || !profileData) {
        logger.error('User profile not found', {
          error: profileError,
          authUserId: sessionData.user.id,
        });
        return respondWithError(res, 404, 'USER_NOT_FOUND', 'User profile not found');
      }

      // Return auth response with profile data
      res.status(200).json({
        user: {
          id: profileData.id,
          email: sessionData.user.email,
          display_name: profileData.display_name,
          username: profileData.username,
          subscription_tier: 'free',
          created_at: sessionData.user.created_at,
        },
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
        expires_in: sessionData.session.expires_in || 3600,
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        respondWithError(res, 400, 'VALIDATION_ERROR', error.message, error.details as unknown[]);
        return;
      }
      logger.error('Login error', { error });
      respondWithError(res, 500, 'LOGIN_ERROR', getErrorMessage(error));
    }
  });

  // POST /api/v1/auth/logout - User logout
  router.post('/logout', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return respondWithError(res, 401, 'AUTH_MISSING', 'Missing authorization header');
      }

      // Sign out the caller's own session. A service-role signOut would not
      // invalidate the user's token — it must be done on a client scoped to
      // their access token.
      const token = authHeader.substring(7);
      await createUserSupabaseClient(token).auth.signOut();
      res.status(204).end();
    } catch (error) {
      logger.error('Logout error', { error });
      respondWithError(res, 500, 'LOGOUT_ERROR', getErrorMessage(error));
    }
  });

  // POST /api/v1/auth/token/refresh - Refresh access token
  router.post('/token/refresh', async (req, res) => {
    try {
      const { refresh_token } = validateRequestData(TokenRefreshBodySchema, req.body ?? {});

      const { data, error } = await supabase.auth.refreshSession({ refresh_token });

      if (error || !data.session) {
        return respondWithError(
          res,
          401,
          'INVALID_REFRESH_TOKEN',
          'Invalid or expired refresh token'
        );
      }

      res.status(200).json({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in || 3600,
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        respondWithError(res, 400, 'VALIDATION_ERROR', error.message, error.details as unknown[]);
        return;
      }
      logger.error('Token refresh error', { error });
      respondWithError(res, 500, 'REFRESH_ERROR', getErrorMessage(error));
    }
  });

  // GET /api/v1/auth/profile - Get user profile (requires auth)
  router.get('/profile', ...validateAuth, async (req, res) => {
    try {
      const userId = (req as any).authContext.userId;

      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, username, bio, avatar_url, location, website_url')
        .eq('id', userId)
        .single();

      if (error || !data) {
        return respondWithError(res, 404, 'USER_NOT_FOUND', 'User not found');
      }

      res.status(200).json(data);
    } catch (error) {
      logger.error('Get profile error', { error });
      respondWithError(res, 500, 'PROFILE_ERROR', getErrorMessage(error));
    }
  });

  // PATCH /api/v1/auth/profile - Update user profile (requires auth)
  router.patch('/profile', ...validateAuth, async (req, res) => {
    try {
      const userId = (req as any).authContext.userId;
      const { name, bio, avatar_url, location, website_url } = req.body;

      if (!name && !bio && !avatar_url && !location && !website_url) {
        return respondWithError(
          res,
          400,
          'VALIDATION_ERROR',
          'At least one field must be provided'
        );
      }

      const updates: any = {};
      if (name) updates.display_name = name;
      if (bio !== undefined) updates.bio = bio;
      if (avatar_url !== undefined) updates.avatar_url = avatar_url;
      if (location !== undefined) updates.location = location;
      if (website_url !== undefined) updates.website_url = website_url;

      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        logger.error('Update profile error', { error });
        return respondWithError(res, 500, 'UPDATE_FAILED', 'Failed to update profile');
      }

      res.status(200).json(data);
    } catch (error) {
      logger.error('Update profile error', { error });
      respondWithError(res, 500, 'PROFILE_ERROR', getErrorMessage(error));
    }
  });

  // PUT /api/v1/auth/profile - Update user profile (requires auth) - alias for PATCH
  router.put('/profile', ...validateAuth, async (req, res) => {
    try {
      const userId = (req as any).authContext.userId;
      const { name, bio, avatar_url, location, website_url, preferences, data_retention_days } =
        req.body;

      if (
        !name &&
        !bio &&
        !avatar_url &&
        !location &&
        !website_url &&
        !preferences &&
        !data_retention_days
      ) {
        return respondWithError(
          res,
          400,
          'VALIDATION_ERROR',
          'At least one field must be provided'
        );
      }

      // Validate data_retention_days if provided
      if (data_retention_days !== undefined && data_retention_days < 30) {
        return respondWithError(
          res,
          400,
          'VALIDATION_ERROR',
          'data_retention_days must be at least 30'
        );
      }

      const updates: any = {};
      if (name) updates.display_name = name;
      if (bio !== undefined) updates.bio = bio;
      if (avatar_url !== undefined) updates.avatar_url = avatar_url;
      if (location !== undefined) updates.location = location;
      if (website_url !== undefined) updates.website_url = website_url;
      if (preferences !== undefined) updates.preferences = preferences;
      if (data_retention_days !== undefined) updates.data_retention_days = data_retention_days;

      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        logger.error('Update profile error', { error });
        return respondWithError(res, 500, 'UPDATE_FAILED', 'Failed to update profile');
      }

      res.status(200).json(data);
    } catch (error) {
      logger.error('Update profile error', { error });
      respondWithError(res, 500, 'PROFILE_ERROR', getErrorMessage(error));
    }
  });

  // DELETE /api/v1/auth/account - Delete user account (requires auth)
  router.delete('/account', ...validateAuth, async (req, res) => {
    try {
      const userId = (req as any).authContext.userId;

      // Resolve the underlying auth user id before deleting the profile row.
      // authContext.userId is profiles.id, not auth.users.id.
      const { data: profile, error: lookupError } = await supabase
        .from('profiles')
        .select('account_id')
        .eq('id', userId)
        .single();

      if (lookupError || !profile) {
        return respondWithError(res, 404, 'USER_NOT_FOUND', 'User not found');
      }

      const { error } = await supabase.from('profiles').delete().eq('id', userId);

      if (error) {
        logger.error('Delete account error', { error });
        return respondWithError(res, 500, 'DELETE_FAILED', 'Failed to delete account');
      }

      // Remove the Supabase Auth user so the account cannot be re-authenticated
      // and any outstanding JWTs become orphaned.
      const { error: authDeleteError } = await supabase.auth.admin.deleteUser(profile.account_id);

      if (authDeleteError) {
        logger.error('Failed to delete auth user after profile deletion', {
          error: authDeleteError,
          accountId: profile.account_id,
        });
        return respondWithError(res, 500, 'DELETE_FAILED', 'Failed to fully delete account');
      }

      res.status(204).end();
    } catch (error) {
      logger.error('Delete account error', { error });
      respondWithError(res, 500, 'ACCOUNT_ERROR', getErrorMessage(error));
    }
  });

  return router;
}
