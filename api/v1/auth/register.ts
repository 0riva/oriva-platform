// Task: T035 - Native account registration endpoint
// Description: Create new user account with Oriva 101 integration

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseClient } from '../../config/supabase';
import { asyncHandler, validationError } from '../../middleware/error-handler';
import { rateLimit } from '../../middleware/rate-limit';

interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
  preferences?: Record<string, unknown>;
}

async function registerHandler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const { email, password, name, preferences }: RegisterRequest = req.body;

  // Validation
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

  // Create Oriva 101 user (Supabase Auth)
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: name || email.split('@')[0],
      },
    },
  });

  if (authError) {
    if (authError.message.includes('already registered')) {
      res.status(409).json({
        error: 'Email already registered',
        code: 'USER_EXISTS',
      });
      return;
    }
    throw new Error(`Auth signup failed: ${authError.message}`);
  }

  if (!authData.user) {
    throw new Error('User creation failed');
  }

  // Create platform user record
  const { data: userData, error: userError } = await supabase
    .from('users')
    .insert({
      oriva_user_id: authData.user.id,
      email: email,
      preferences: preferences || {},
      subscription_tier: 'free',
      data_retention_days: 365,
    })
    .select()
    .single();

  if (userError) {
    // Rollback: Delete auth user if platform user creation fails
    await supabase.auth.admin.deleteUser(authData.user.id);
    throw new Error(`User record creation failed: ${userError.message}`);
  }

  // Generate tokens
  const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (sessionError || !sessionData.session) {
    throw new Error('Session creation failed after registration');
  }

  // Return auth response
  res.status(201).json({
    user: {
      id: userData.id,
      email: userData.email,
      subscription_tier: userData.subscription_tier,
      created_at: userData.created_at,
    },
    access_token: sessionData.session.access_token,
    refresh_token: sessionData.session.refresh_token,
    expires_in: sessionData.session.expires_in || 3600,
  });
}

// Validation helpers
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isStrongPassword(password: string): boolean {
  if (password.length < 8) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  return true;
}

// Export with middleware chain
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await rateLimit(req, res, async () => {
    await asyncHandler(registerHandler)(req, res);
  });
}