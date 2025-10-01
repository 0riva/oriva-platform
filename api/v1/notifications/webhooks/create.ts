// Task: T032 - POST /api/v1/apps/:appId/webhooks endpoint
// Description: Create webhook subscription

import { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { rateLimit } from '../../../middleware/rate-limit';
import { authenticate } from '../../../middleware/auth';
import { getSupabaseClient } from '../../../config/supabase';

interface CreateWebhookRequest {
  webhook_url: string;
  subscribed_events: string[];
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await authenticate(req, res, async () => {
    await rateLimit(req, res, async () => {
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
        return;
      }

      const { appId } = req.query;
      if (!appId || typeof appId !== 'string') {
        res.status(400).json({ error: 'App ID is required', code: 'VALIDATION_ERROR' });
        return;
      }

      const { webhook_url, subscribed_events }: CreateWebhookRequest = req.body;

      // Validate webhook_url
      if (!webhook_url) {
        res.status(400).json({ error: 'webhook_url is required', code: 'VALIDATION_ERROR' });
        return;
      }

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

      // Validate subscribed_events
      if (!subscribed_events || !Array.isArray(subscribed_events) || subscribed_events.length === 0) {
        res.status(400).json({ error: 'subscribed_events must be a non-empty array', code: 'INVALID_EVENTS' });
        return;
      }

      // Generate webhook secret (32 bytes = 64 hex characters)
      const webhookSecret = crypto.randomBytes(32).toString('hex');

      try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
          .from('app_webhooks')
          .insert({
            app_id: appId,
            webhook_url,
            webhook_secret: webhookSecret,
            subscribed_events,
            is_active: true,
          })
          .select('id')
          .single();

        if (error) {
          res.status(500).json({ error: `Database error: ${error.message}`, code: 'DATABASE_ERROR' });
          return;
        }

        res.status(201).json({
          webhook_id: data.id,
          webhook_secret: webhookSecret,
        });
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error',
          code: 'INTERNAL_ERROR',
        });
      }
    });
  });
}
