/**
 * EXAMPLE: Refactored Auth Endpoint Using Zod Validation
 *
 * This demonstrates how to:
 * 1. Define validation schemas using Zod
 * 2. Integrate with existing error-handler middleware
 * 3. Use type inference to eliminate manual interfaces
 * 4. Structure handlers for clarity and reusability
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { getSupabaseClient } from '../../src/config/supabase';
import { asyncHandler, validationError } from '../../src/middleware/error-handler';
import { rateLimit } from '../../src/middleware/rate-limit';
import { authenticate, AuthenticatedRequest } from '../../src/middleware/auth';
import { validateRequestData } from '../../src/middleware/validation';
import {
  EmailSchema,
  PasswordSchema,
  LoginPasswordSchema,
  NameSchema,
  UserLoginSchema,
  UserCreateSchema,
  UserUpdateProfileSchema,
  PasswordResetRequestSchema,
  PasswordResetCompleteSchema,
  TokenRefreshSchema,
  RefreshTokenSchema,
} from '../schemas/common';

// ═══════════════════════════════════════════════════════════════════════════
// Request Schemas (for this endpoint)
// ═══════════════════════════════════════════════════════════════════════════

const RegisterRequestSchema = UserCreateSchema;
const LoginRequestSchema = UserLoginSchema;

const UpdateProfileRequestSchema = UserUpdateProfileSchema;

const ForgotPasswordRequestSchema = PasswordResetRequestSchema;
const ResetPasswordRequestSchema = PasswordResetCompleteSchema;

const RefreshTokenRequestSchema = TokenRefreshSchema;

// ═══════════════════════════════════════════════════════════════════════════
// Inferred Types (No manual interfaces needed)
// ═══════════════════════════════════════════════════════════════════════════

type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
type LoginRequest = z.infer<typeof LoginRequestSchema>;
type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;
type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequestSchema>;
type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;
type RefreshTokenRequest = z.infer<typeof RefreshTokenRequestSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// Handler: Register
// ═══════════════════════════════════════════════════════════════════════════

async function handleRegister(req: VercelRequest, res: VercelResponse): Promise<void> {
  // Validate request body using Zod schema
  const registerData = validateRequestData(RegisterRequestSchema, req.body);

  const supabase = getSupabaseClient();

  // Check if email already exists
  // @ts-expect-error — Supabase type inference exceeds depth limit in example file
  const { data: existingUser } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', registerData.email)
    .single();

  if (existingUser) {
    throw validationError('Email address is already registered');
  }

  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: registerData.email,
    password: registerData.password,
  });

  if (authError || !authData.user) {
    res.status(400).json({
      error: authError?.message || 'Failed to create account',
      code: 'REGISTRATION_FAILED',
    });
    return;
  }

  // Create user profile
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .insert({
      account_id: authData.user.id,
      display_name: registerData.displayName,
      username: registerData.displayName.toLowerCase().replace(/\s+/g, '-'),
      email: registerData.email,
    })
    .select('id, display_name, username, email')
    .single();

  if (profileError) {
    res.status(500).json({
      error: 'Failed to create user profile',
      code: 'PROFILE_CREATION_FAILED',
    });
    return;
  }

  res.status(201).json({
    message: 'Account created successfully',
    user: profileData,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Handler: Login
// ═══════════════════════════════════════════════════════════════════════════

async function handleLogin(req: VercelRequest, res: VercelResponse): Promise<void> {
  // Validate request body using Zod schema
  const loginData = validateRequestData(LoginRequestSchema, req.body);

  const supabase = getSupabaseClient();

  // Authenticate with Supabase
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: loginData.email,
    password: loginData.password,
  });

  if (authError || !authData.user || !authData.session) {
    res.status(401).json({
      error: 'Invalid email or password',
      code: 'INVALID_CREDENTIALS',
    });
    return;
  }

  // Get user profile
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('id, display_name, username, avatar_url, email')
    .eq('account_id', authData.user.id)
    .single();

  if (profileError || !profileData) {
    res.status(404).json({
      error: 'User profile not found',
      code: 'USER_NOT_FOUND',
    });
    return;
  }

  // Return authentication response
  res.status(200).json({
    user: profileData,
    tokens: {
      accessToken: authData.session.access_token,
      refreshToken: authData.session.refresh_token,
      expiresAt: authData.session.expires_at,
      tokenType: 'Bearer',
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Handler: Get Profile
// ═══════════════════════════════════════════════════════════════════════════

async function handleGetProfile(req: VercelRequest, res: VercelResponse): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.authContext.userId;

  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, username, bio, avatar_url, location, website_url, email, created_at')
    .eq('id', userId)
    .single();

  if (error || !data) {
    res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
    return;
  }

  res.status(200).json(data);
}

// ═══════════════════════════════════════════════════════════════════════════
// Handler: Update Profile
// ═══════════════════════════════════════════════════════════════════════════

async function handleUpdateProfile(req: VercelRequest, res: VercelResponse): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.authContext.userId;

  // Validate request body using Zod schema
  const updateData = validateRequestData(UpdateProfileRequestSchema, req.body);

  // Check that at least one field is being updated
  if (Object.keys(updateData).length === 0) {
    throw validationError('At least one field must be provided for update');
  }

  const supabase = getSupabaseClient();

  // Build update object (only include provided fields)
  const updates: Record<string, any> = {};
  if (updateData.displayName !== undefined) {
    updates.display_name = updateData.displayName;
  }
  if (updateData.username !== undefined) {
    updates.username = updateData.username;
  }
  if (updateData.bio !== undefined) {
    updates.bio = updateData.bio;
  }
  if (updateData.avatarUrl !== undefined) {
    updates.avatar_url = updateData.avatarUrl;
  }
  if (updateData.websiteUrl !== undefined) {
    updates.website_url = updateData.websiteUrl;
  }
  if (updateData.location !== undefined) {
    updates.location = updateData.location;
  }

  // Update profile
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    res.status(500).json({
      error: 'Failed to update profile',
      code: 'UPDATE_FAILED',
    });
    return;
  }

  res.status(200).json(data);
}

// ═══════════════════════════════════════════════════════════════════════════
// Handler: Forgot Password
// ═══════════════════════════════════════════════════════════════════════════

async function handleForgotPassword(req: VercelRequest, res: VercelResponse): Promise<void> {
  // Validate request body
  const forgotData = validateRequestData(ForgotPasswordRequestSchema, req.body);

  const supabase = getSupabaseClient();

  // Send password reset email
  const { error } = await supabase.auth.resetPasswordForEmail(forgotData.email, {
    redirectTo: `${process.env.SITE_URL || 'http://127.0.0.1:3000'}/reset-password`,
  });

  // Always return success to avoid user enumeration
  // (whether the email exists or not, we give same response)
  res.status(200).json({
    message: 'If an account exists with that email, you will receive a password reset link',
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Handler: Reset Password
// ═══════════════════════════════════════════════════════════════════════════

async function handleResetPassword(req: VercelRequest, res: VercelResponse): Promise<void> {
  // Validate request body
  const resetData = validateRequestData(ResetPasswordRequestSchema, req.body);

  // Create Supabase client with reset token as auth
  const { createClient } = await import('@supabase/supabase-js');
  const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54331';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

  const supabaseWithToken = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${resetData.token}`,
      },
    },
  });

  // Update password with reset token
  const { error } = await supabaseWithToken.auth.updateUser({
    password: resetData.password,
  });

  if (error) {
    res.status(400).json({
      error: 'Invalid or expired reset token',
      code: 'INVALID_RESET_TOKEN',
    });
    return;
  }

  res.status(200).json({
    message: 'Password reset successfully',
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Handler: Refresh Token
// ═══════════════════════════════════════════════════════════════════════════

async function handleRefreshToken(req: VercelRequest, res: VercelResponse): Promise<void> {
  // Validate request body
  const refreshData = validateRequestData(RefreshTokenRequestSchema, req.body);

  const supabase = getSupabaseClient();

  // Refresh session with Supabase
  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: refreshData.refreshToken,
  });

  if (error || !data.session || !data.user) {
    res.status(401).json({
      error: 'Invalid or expired refresh token',
      code: 'INVALID_REFRESH_TOKEN',
    });
    return;
  }

  // Return new tokens
  res.status(200).json({
    tokens: {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at,
      tokenType: 'Bearer',
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Handler (Route Dispatcher)
// ═══════════════════════════════════════════════════════════════════════════

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await asyncHandler(async () => {
    await rateLimit(req, res, async () => {
      const { url, method } = req;

      // Public endpoints (no auth required)
      if (url?.includes('/register') && method === 'POST') {
        return handleRegister(req, res);
      }

      if (url?.includes('/login') && method === 'POST') {
        return handleLogin(req, res);
      }

      if (url?.includes('/forgot-password') && method === 'POST') {
        return handleForgotPassword(req, res);
      }

      if (url?.includes('/reset-password') && method === 'POST') {
        return handleResetPassword(req, res);
      }

      if (url?.includes('/token/refresh') && method === 'POST') {
        return handleRefreshToken(req, res);
      }

      // Protected endpoints (auth required)
      await authenticate(req, res, async () => {
        if (url?.includes('/profile') && method === 'GET') {
          return handleGetProfile(req, res);
        }

        if (url?.includes('/profile') && method === 'PATCH') {
          return handleUpdateProfile(req, res);
        }

        res.status(404).json({ error: 'Endpoint not found', code: 'NOT_FOUND' });
      });
    });
  })(req, res);
}
