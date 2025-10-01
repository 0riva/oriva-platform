// Task: T034 - PATCH /api/v1/apps/:appId/webhooks/:id endpoint
// Description: Update webhook

import { VercelRequest, VercelResponse } from '@vercel/node';
import { rateLimit } from '../../../middleware/rate-limit';
import { authenticate } from '../../../middleware/auth';
import { getSupabaseClient } from '../../../config/supabase';

interface UpdateWebhookRequest {
  webhook_url?: string;
  subscribed_events?: string[];
  is_active?: boolean;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await authenticate(req, res, async () => {
    await rateLimit(req, res, async () => {
      if (req.method !== 'PATCH') {
        res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
        return;
      }

      const { appId, id } = req.query;
      if (!appId || typeof appId !== 'string') {
        res.status(400).json({ error: 'App ID is required', code: 'VALIDATION_ERROR' });
        return;
      }
      if (!id || typeof id !== 'string') {
        res.status(400).json({ error: 'Webhook ID is required', code: 'VALIDATION_ERROR' });
        return;
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
          .select(
            'id, app_id, webhook_url, subscribed_events, is_active, last_delivery_at, consecutive_failures, created_at, updated_at'
          )
          .single();

        if (error) {
          res.status(500).json({ error: `Database error: ${error.message}`, code: 'DATABASE_ERROR' });
          return;
        }

        res.status(200).json(data);
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error',
          code: 'INTERNAL_ERROR',
        });
      }
    });
  });
}
