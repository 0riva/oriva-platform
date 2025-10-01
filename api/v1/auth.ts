// Consolidated Auth API Handler
// Handles: POST /api/v1/auth/register
//          POST /api/v1/auth/login
//          POST /api/v1/auth/logout
//          GET /api/v1/auth/profile
//          PATCH /api/v1/auth/profile
//          GET /api/v1/auth/account
//          DELETE /api/v1/auth/account
//          POST /api/v1/auth/token/refresh
// Pattern: Catch-all routing to reduce function count

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseClient } from '../src/config/supabase';
import { asyncHandler, validationError } from '../src/middleware/error-handler';
import { rateLimit } from '../src/middleware/rate-limit';
import { authenticate, AuthenticatedRequest } from '../src/middleware/auth';

interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
  preferences?: Record<string, unknown>;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface UpdateProfileRequest {
  name?: string;
  preferences?: Record<string, unknown>;
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isStrongPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password)
  );
}

async function handleRegister(req: VercelRequest, res: VercelResponse): Promise<void> {
  const { email, password, name, preferences }: RegisterRequest = req.body;

  if (!email || !password) {
    throw validationError('Email and password are required');
  }

  if (!isValidEmail(email)) {
    throw validationError('Invalid email format');
  }

  if (!isStrongPassword(password)) {
    throw validationError('Password must be at least 8 characters with uppercase, lowercase, and numbers');
  }

  const supabase = getSupabaseClient();

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError || !authData.user) {
    res.status(400).json({
      error: authError?.message || 'Failed to create account',
      code: 'REGISTRATION_FAILED',
    });
    return;
  }

  const { data: userData, error: userError } = await supabase
    .from('users')
    .insert({
      oriva_user_id: authData.user.id,
      email: authData.user.email!,
      subscription_tier: 'free',
      user_preferences: preferences || {},
    })
    .select()
    .single();

  if (userError) {
    res.status(500).json({
      error: 'Failed to create user profile',
      code: 'PROFILE_CREATION_FAILED',
    });
    return;
  }

  res.status(201).json({
    user: {
      id: userData.id,
      email: userData.email,
      subscription_tier: userData.subscription_tier,
    },
    message: 'Account created successfully',
  });
}

async function handleLogin(req: VercelRequest, res: VercelResponse): Promise<void> {
  const { email, password }: LoginRequest = req.body;

  if (!email || !password) {
    throw validationError('Email and password are required');
  }

  const supabase = getSupabaseClient();

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData.user || !authData.session) {
    res.status(401).json({
      error: 'Invalid email or password',
      code: 'INVALID_CREDENTIALS',
    });
    return;
  }

  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id, email, subscription_tier, user_preferences')
    .eq('oriva_user_id', authData.user.id)
    .single();

  if (userError || !userData) {
    res.status(404).json({
      error: 'User profile not found',
      code: 'USER_NOT_FOUND',
    });
    return;
  }

  res.status(200).json({
    access_token: authData.session.access_token,
    refresh_token: authData.session.refresh_token,
    expires_at: authData.session.expires_at,
    user: {
      id: userData.id,
      email: userData.email,
      subscription_tier: userData.subscription_tier,
    },
  });
}

async function handleLogout(req: VercelRequest, res: VercelResponse): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: 'Missing authorization header', code: 'AUTH_MISSING' });
    return;
  }

  const token = authHeader.replace('Bearer ', '');
  const supabase = getSupabaseClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    res.status(500).json({ error: 'Failed to logout', code: 'LOGOUT_FAILED' });
    return;
  }

  res.status(200).json({ message: 'Logged out successfully' });
}

async function handleGetProfile(req: VercelRequest, res: VercelResponse): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.authContext.userId;

  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('users')
    .select('id, email, subscription_tier, user_preferences')
    .eq('id', userId)
    .single();

  if (error || !data) {
    res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
    return;
  }

  res.status(200).json(data);
}

async function handleUpdateProfile(req: VercelRequest, res: VercelResponse): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.authContext.userId;
  const { name, preferences }: UpdateProfileRequest = req.body;

  if (!name && !preferences) {
    throw validationError('At least one field must be provided');
  }

  const supabase = getSupabaseClient();
  const updates: any = {};

  if (preferences) updates.user_preferences = preferences;

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: 'Failed to update profile', code: 'UPDATE_FAILED' });
    return;
  }

  res.status(200).json(data);
}

async function handleGetAccount(req: VercelRequest, res: VercelResponse): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.authContext.userId;

  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('users')
    .select('id, email, subscription_tier, created_at, updated_at')
    .eq('id', userId)
    .single();

  if (error || !data) {
    res.status(404).json({ error: 'Account not found', code: 'ACCOUNT_NOT_FOUND' });
    return;
  }

  res.status(200).json(data);
}

async function handleDeleteAccount(req: VercelRequest, res: VercelResponse): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.authContext.userId;

  const supabase = getSupabaseClient();

  const { error } = await supabase.from('users').delete().eq('id', userId);

  if (error) {
    res.status(500).json({ error: 'Failed to delete account', code: 'DELETE_FAILED' });
    return;
  }

  res.status(204).end();
}

async function handleTokenRefresh(req: VercelRequest, res: VercelResponse): Promise<void> {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    throw validationError('Refresh token is required');
  }

  const supabase = getSupabaseClient();

  const { data, error } = await supabase.auth.refreshSession({ refresh_token });

  if (error || !data.session) {
    res.status(401).json({
      error: 'Invalid or expired refresh token',
      code: 'INVALID_REFRESH_TOKEN',
    });
    return;
  }

  res.status(200).json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
  });
}

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

      if (url?.includes('/token/refresh') && method === 'POST') {
        return handleTokenRefresh(req, res);
      }

      // Protected endpoints (auth required)
      await authenticate(req, res, async () => {
        if (url?.includes('/logout') && method === 'POST') {
          return handleLogout(req, res);
        }

        if (url?.includes('/profile') && method === 'GET') {
          return handleGetProfile(req, res);
        }

        if (url?.includes('/profile') && method === 'PATCH') {
          return handleUpdateProfile(req, res);
        }

        if (url?.includes('/account') && method === 'GET') {
          return handleGetAccount(req, res);
        }

        if (url?.includes('/account') && method === 'DELETE') {
          return handleDeleteAccount(req, res);
        }

        res.status(404).json({ error: 'Endpoint not found', code: 'NOT_FOUND' });
      });
    });
  })(req, res);
}
