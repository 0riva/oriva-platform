// Task: T033 - GET /api/v1/apps/:appId/webhooks endpoint
// Description: List app webhooks

import { VercelRequest, VercelResponse } from '@vercel/node';
import { rateLimit } from '../../../middleware/rate-limit';
import { authenticate } from '../../../middleware/auth';
import { getSupabaseClient } from '../../../config/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await authenticate(req, res, async () => {
    await rateLimit(req, res, async () => {
      if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
        return;
      }

      const { appId } = req.query;
      if (!appId || typeof appId !== 'string') {
        res.status(400).json({ error: 'App ID is required', code: 'VALIDATION_ERROR' });
        return;
      }

      try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
          .from('app_webhooks')
          .select(
            'id, app_id, webhook_url, subscribed_events, is_active, last_delivery_at, consecutive_failures, created_at, updated_at'
          )
          .eq('app_id', appId)
          .order('created_at', { ascending: false });

        if (error) {
          res.status(500).json({ error: `Database error: ${error.message}`, code: 'DATABASE_ERROR' });
          return;
        }

        res.status(200).json({
          webhooks: data || [],
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
