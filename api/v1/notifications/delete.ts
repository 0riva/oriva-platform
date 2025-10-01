// Task: T031 - DELETE /api/v1/notifications/:id endpoint
// Description: Delete notification

import { VercelRequest, VercelResponse } from '@vercel/node';
import { rateLimit } from '../../middleware/rate-limit';
import { authenticate } from '../../middleware/auth';
import { deleteNotification } from '../../services/notificationManager';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await authenticate(req, res, async () => {
    await rateLimit(req, res, async () => {
      if (req.method !== 'DELETE') {
        res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
        return;
      }

      const { id } = req.query;
      if (!id || typeof id !== 'string') {
        res.status(400).json({ error: 'Notification ID is required', code: 'VALIDATION_ERROR' });
        return;
      }

      // App ID should come from authenticated context or header
      const appId = req.headers['x-app-id'] as string;
      if (!appId) {
        res.status(400).json({ error: 'App ID is required', code: 'APP_ID_REQUIRED' });
        return;
      }

      try {
        await deleteNotification(id, appId);
        res.status(204).end();
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            res.status(404).json({ error: error.message, code: 'NOT_FOUND' });
            return;
          }
          if (error.message.includes('Not authorized')) {
            res.status(403).json({ error: error.message, code: 'FORBIDDEN' });
            return;
          }
        }
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error',
          code: 'INTERNAL_ERROR',
        });
      }
    });
  });
}
