// Task: T040 - Account deletion endpoint
// Description: Delete user account and all associated data (CASCADE)

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseClient, getSupabaseServiceClient } from '../../config/supabase';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth';
import { asyncHandler, validationError } from '../../middleware/error-handler';
import { rateLimit } from '../../middleware/rate-limit';

interface DeleteAccountRequest {
  password: string;
}

async function deleteAccountHandler(req: AuthenticatedRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'DELETE') {
    res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const { userId, email } = req.authContext;
  const { password }: DeleteAccountRequest = req.body;

  // Validation - require password confirmation
  if (!password) {
    throw validationError('Password confirmation required');
  }

  const supabase = getSupabaseClient();

  // Verify password before deletion
  const { error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    res.status(401).json({
      error: 'Invalid password',
      code: 'INVALID_CREDENTIALS',
    });
    return;
  }

  // Get Oriva user ID before deletion
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('oriva_user_id')
    .eq('id', userId)
    .single();

  if (userError || !userData) {
    res.status(404).json({
      error: 'User profile not found',
      code: 'USER_NOT_FOUND',
    });
    return;
  }

  const orivaUserId = userData.oriva_user_id;

  // Delete platform user record (CASCADE will delete conversations, messages, progress, memories)
  const { error: deleteError } = await supabase
    .from('users')
    .delete()
    .eq('id', userId);

  if (deleteError) {
    throw new Error(`User deletion failed: ${deleteError.message}`);
  }

  // Delete Oriva 101 auth user (requires service role)
  const serviceClient = getSupabaseServiceClient();
  const { error: authDeleteError } = await serviceClient.auth.admin.deleteUser(orivaUserId);

  if (authDeleteError) {
    console.error('Auth user deletion failed:', authDeleteError);
    // Continue anyway - platform data is already deleted
  }

  res.status(204).send('');
}

// Export with middleware chain
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await rateLimit(req, res, async () => {
    await authenticate(req, res, async () => {
      await asyncHandler(deleteAccountHandler)(req, res);
    });
  });
}