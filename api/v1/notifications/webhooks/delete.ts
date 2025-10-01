// Task: T035 - DELETE /api/v1/apps/:appId/webhooks/:id endpoint
// Description: Delete webhook

import { VercelRequest, VercelResponse } from '@vercel/node';
import { rateLimit } from '../../../middleware/rate-limit';
import { authenticate } from '../../../middleware/auth';
import { getSupabaseClient } from '../../../config/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await authenticate(req, res, async () => {
    await rateLimit(req, res, async () => {
      if (req.method !== 'DELETE') {
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

        const { error } = await supabase.from('app_webhooks').delete().eq('id', id);

        if (error) {
          res.status(500).json({ error: `Database error: ${error.message}`, code: 'DATABASE_ERROR' });
          return;
        }

        res.status(204).end();
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error',
          code: 'INTERNAL_ERROR',
        });
      }
    });
  });
}
