// Task: T030 - PATCH /api/v1/notifications/:id endpoint
// Description: Update notification state

import { VercelRequest, VercelResponse } from '@vercel/node';
import { rateLimit } from '../../middleware/rate-limit';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth';
import { updateNotificationState } from '../../services/notificationManager';

interface UpdateNotificationRequest {
  status: 'read' | 'dismissed' | 'clicked';
  metadata?: Record<string, unknown>;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await authenticate(req, res, async () => {
    await rateLimit(req, res, async () => {
      if (req.method !== 'PATCH') {
        res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
        return;
      }

      const { id } = req.query;
      if (!id || typeof id !== 'string') {
        res.status(400).json({ error: 'Notification ID is required', code: 'VALIDATION_ERROR' });
        return;
      }

      const { status, metadata }: UpdateNotificationRequest = req.body;

      if (!status) {
        res.status(400).json({ error: 'Status is required', code: 'VALIDATION_ERROR' });
        return;
      }

      if (!['read', 'dismissed', 'clicked'].includes(status)) {
        res.status(400).json({
          error: 'Invalid status. Must be: read, dismissed, or clicked',
          code: 'INVALID_STATUS',
        });
        return;
      }

      const authReq = req as AuthenticatedRequest;
      const userId = authReq.authContext.userId;

      try {
        const result = await updateNotificationState({
          notificationId: id,
          userId,
          status,
          metadata,
        });

        res.status(200).json(result);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            res.status(404).json({ error: error.message, code: 'NOT_FOUND' });
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
