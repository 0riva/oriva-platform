// Task: T034 - PATCH /api/v1/apps/:appId/webhooks/:id endpoint
// Description: Update webhook

import { VercelRequest, VercelResponse } from '@vercel/node';
import { asyncHandler, validationError } from '../../../middleware/error-handler';
import { rateLimit } from '../../../middleware/rate-limit';
import { authenticate } from '../../../middleware/auth';
import { getSupabaseClient } from '../../../config/supabase';

interface UpdateWebhookRequest {
  webhook_url?: string;
  subscribed_events?: string[];
  is_active?: boolean;
}

async function updateWebhookHandler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'PATCH') {
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

  const { webhook_url, subscribed_events, is_active }: UpdateWebhookRequest = req.body;

  // Validate webhook_url if provided
  if (webhook_url) {
    try {
      const url = new URL(webhook_url);
      if (url.protocol !== 'https:') {
        res.status(400).json({ error: 'webhook_url must use HTTPS', code: 'INVALID_URL' });
        return;
      }
    } catch (error) {
      res.status(400).json({ error: 'Invalid webhook_url format', code: 'INVALID_URL' });
      return;
    }
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
      res.status(403).json({ error: 'Not authorized to modify this webhook', code: 'FORBIDDEN' });
      return;
    }

    // Build update object
    const updates: any = {};
    if (webhook_url !== undefined) updates.webhook_url = webhook_url;
    if (subscribed_events !== undefined) updates.subscribed_events = subscribed_events;
    if (is_active !== undefined) updates.is_active = is_active;

    const { data, error } = await supabase
      .from('app_webhooks')
      .update(updates)
      .eq('id', id)
      .select('id, app_id, webhook_url, subscribed_events, is_active, last_delivery_at, consecutive_failures, created_at, updated_at')
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    res.status(200).json(data);
  } catch (error) {
    throw error;
  }
}

export default asyncHandler(
  rateLimit({ maxRequests: 50, windowMs: 15 * 60 * 1000 })(updateWebhookHandler)
);
