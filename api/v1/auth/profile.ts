// Task: T037 - Get/update user profile endpoint
// Description: Retrieve and update authenticated user's profile

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseClient } from '../../config/supabase';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth';
import { asyncHandler, validationError } from '../../middleware/error-handler';
import { rateLimit } from '../../middleware/rate-limit';

interface UpdateProfileRequest {
  preferences?: Record<string, unknown>;
  data_retention_days?: number;
}

async function getProfileHandler(req: AuthenticatedRequest, res: VercelResponse): Promise<void> {
  const { userId } = req.authContext;
  const supabase = getSupabaseClient();

  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id, email, preferences, subscription_tier, data_retention_days, created_at, last_active_at')
    .eq('id', userId)
    .single();

  if (userError || !userData) {
    res.status(404).json({
      error: 'User profile not found',
      code: 'USER_NOT_FOUND',
    });
    return;
  }

  res.status(200).json(userData);
}

async function updateProfileHandler(req: AuthenticatedRequest, res: VercelResponse): Promise<void> {
  const { userId } = req.authContext;
  const { preferences, data_retention_days }: UpdateProfileRequest = req.body;

  // Validation
  if (data_retention_days !== undefined) {
    if (data_retention_days < 30 || data_retention_days > 1825) {
      throw validationError('Data retention days must be between 30 and 1825 (5 years)');
    }
  }

  const supabase = getSupabaseClient();

  // Build update object
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (preferences !== undefined) {
    updates.preferences = preferences;
  }

  if (data_retention_days !== undefined) {
    updates.data_retention_days = data_retention_days;
  }

  const { data: userData, error: userError } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (userError || !userData) {
    throw new Error(`Profile update failed: ${userError?.message}`);
  }

  res.status(200).json(userData);
}

async function profileHandler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method === 'GET') {
    await getProfileHandler(req as AuthenticatedRequest, res);
  } else if (req.method === 'PUT') {
    await updateProfileHandler(req as AuthenticatedRequest, res);
  } else {
    res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
  }
}

// Export with middleware chain
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await rateLimit(req, res, async () => {
    await authenticate(req, res, async () => {
      await asyncHandler(profileHandler)(req, res);
    });
  });
}