// Task: T039 - User logout endpoint
// Description: Sign out user and invalidate session

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseClient } from '../../config/supabase';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/error-handler';
import { rateLimit } from '../../middleware/rate-limit';

async function logoutHandler(req: AuthenticatedRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const supabase = getSupabaseClient();

  // Sign out (invalidate session)
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.warn('Logout error:', error);
    // Continue anyway - session may already be expired
  }

  res.status(204).send('');
}

// Export with middleware chain
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await rateLimit(req, res, async () => {
    await authenticate(req, res, async () => {
      await asyncHandler(logoutHandler)(req, res);
    });
  });
}