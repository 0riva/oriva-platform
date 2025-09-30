// Task: T038 - Token refresh endpoint
// Description: Refresh access token using refresh token

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseClient } from '../../../config/supabase';
import { asyncHandler, validationError } from '../../../middleware/error-handler';
import { rateLimit } from '../../../middleware/rate-limit';

interface RefreshRequest {
  refresh_token: string;
}

async function refreshHandler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const { refresh_token }: RefreshRequest = req.body;

  // Validation
  if (!refresh_token) {
    throw validationError('Refresh token is required');
  }

  const supabase = getSupabaseClient();

  // Refresh session with Supabase Auth
  const { data: sessionData, error: sessionError } = await supabase.auth.refreshSession({
    refresh_token,
  });

  if (sessionError || !sessionData.session) {
    res.status(401).json({
      error: 'Invalid or expired refresh token',
      code: 'INVALID_REFRESH_TOKEN',
    });
    return;
  }

  // Return new tokens
  res.status(200).json({
    access_token: sessionData.session.access_token,
    refresh_token: sessionData.session.refresh_token,
    expires_in: sessionData.session.expires_in || 3600,
  });
}

// Export with middleware chain
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await rateLimit(req, res, async () => {
    await asyncHandler(refreshHandler)(req, res);
  });
}