// Task: T033 - GET /api/v1/apps/:appId/webhooks endpoint
// Description: List app webhooks

import { VercelRequest, VercelResponse } from '@vercel/node';
import { asyncHandler, validationError } from '../../../middleware/error-handler';
import { rateLimit } from '../../../middleware/rate-limit';
import { authenticate } from '../../../middleware/auth';
import { getSupabaseClient } from '../../../config/supabase';

async function listWebhooksHandler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
    return;
  }

  // Authenticate
  const user = await authenticate(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required', code: 'AUTH_MISSING' });
    return;
  }

  const { appId } = req.query;
  if (!appId || typeof appId !== 'string') {
    throw validationError('App ID is required');
  }

  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('app_webhooks')
      .select('id, app_id, webhook_url, subscribed_events, is_active, last_delivery_at, consecutive_failures, created_at, updated_at')
      .eq('app_id', appId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    res.status(200).json({
      webhooks: data || [],
    });
  } catch (error) {
    throw error;
  }
}

export default asyncHandler(
  rateLimit({ maxRequests: 50, windowMs: 15 * 60 * 1000 })(listWebhooksHandler)
);
