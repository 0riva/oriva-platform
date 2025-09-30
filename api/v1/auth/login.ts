// Task: T036 - User login endpoint
// Description: Authenticate user and return JWT tokens

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseClient } from '../../config/supabase';
import { asyncHandler, validationError } from '../../middleware/error-handler';
import { rateLimit } from '../../middleware/rate-limit';

interface LoginRequest {
  email: string;
  password: string;
}

async function loginHandler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const { email, password }: LoginRequest = req.body;

  // Validation
  if (!email || !password) {
    throw validationError('Email and password are required');
  }

  const supabase = getSupabaseClient();

  // Authenticate with Supabase Auth
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

  // Fetch platform user record
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id, email, subscription_tier, created_at')
    .eq('oriva_user_id', authData.user.id)
    .single();

  if (userError || !userData) {
    res.status(404).json({
      error: 'User profile not found',
      code: 'USER_NOT_FOUND',
    });
    return;
  }

  // Update last_active_at
  await supabase
    .from('users')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', userData.id);

  // Return auth response
  res.status(200).json({
    user: {
      id: userData.id,
      email: userData.email,
      subscription_tier: userData.subscription_tier,
      created_at: userData.created_at,
    },
    access_token: authData.session.access_token,
    refresh_token: authData.session.refresh_token,
    expires_in: authData.session.expires_in || 3600,
  });
}

// Export with middleware chain
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await rateLimit(req, res, async () => {
    await asyncHandler(loginHandler)(req, res);
  });
}