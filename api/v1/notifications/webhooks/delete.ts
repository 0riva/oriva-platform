// Task: T035 - DELETE /api/v1/apps/:appId/webhooks/:id endpoint
// Description: Delete webhook

import { VercelRequest, VercelResponse } from '@vercel/node';
import { asyncHandler, validationError } from '../../../middleware/error-handler';
import { rateLimit } from '../../../middleware/rate-limit';
import { authenticate } from '../../../middleware/auth';
import { getSupabaseClient } from '../../../config/supabase';

async function deleteWebhookHandler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'DELETE') {
    res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
    return;
  }

  // Authenticate
  const user = await authenticate(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required', code: 'AUTH_MISSING' });
    return;
  }

  const { appId, id } = req.query;
  if (!appId || typeof appId !== 'string') {
    throw validationError('App ID is required');
  }
  if (!id || typeof id !== 'string') {
    throw validationError('Webhook ID is required');
  }

  try {
    const supabase = getSupabaseClient();

    // Verify webhook belongs to app
    const { data: existing, error: fetchError } = await supabase
      .from('app_webhooks')
      .select('app_id')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      res.status(404).json({ error: 'Webhook not found', code: 'NOT_FOUND' });
      return;
    }

    if (existing.app_id !== appId) {
      res.status(403).json({ error: 'Not authorized to delete this webhook', code: 'FORBIDDEN' });
      return;
    }

    const { error } = await supabase
      .from('app_webhooks')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    res.status(204).end();
  } catch (error) {
    throw error;
  }
}

export default asyncHandler(
  rateLimit({ maxRequests: 50, windowMs: 15 * 60 * 1000 })(deleteWebhookHandler)
);
