// Task: T029 - GET /api/v1/users/:userId/notifications endpoint
// Description: Query user notifications

import { VercelRequest, VercelResponse } from '@vercel/node';
import { rateLimit } from '../../middleware/rate-limit';
import { authenticate } from '../../middleware/auth';
import { queryNotifications, getCachedNotificationCount } from '../../services/notificationManager';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await authenticate(req, res, async () => {
    await rateLimit(req, res, async () => {
      if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
        return;
      }

      const { userId } = req.query;
      if (!userId || typeof userId !== 'string') {
        res.status(400).json({ error: 'User ID is required', code: 'VALIDATION_ERROR' });
        return;
      }

      const {
        status,
        app_id,
        priority,
        limit = '50',
        offset = '0',
      } = req.query;

      const parsedLimit = Math.min(parseInt(limit as string, 10) || 50, 100);
      const parsedOffset = parseInt(offset as string, 10) || 0;

      try {
        const result = await queryNotifications({
          userId,
          status: status as any,
          appId: app_id as string,
          priority: priority as string,
          limit: parsedLimit,
          offset: parsedOffset,
        });

        // Get cached unread count
        const unreadCount = await getCachedNotificationCount(userId);

        res.status(200).json({
          notifications: result.notifications,
          unread_count: unreadCount,
          pagination: {
            total: result.total,
            limit: result.limit,
            offset: result.offset,
            has_more: result.offset + result.limit < result.total,
          },
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
