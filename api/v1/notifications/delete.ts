// Task: T031 - DELETE /api/v1/notifications/:id endpoint
// Description: Delete notification

import { VercelRequest, VercelResponse } from '@vercel/node';
import { asyncHandler, validationError } from '../../middleware/error-handler';
import { rateLimit } from '../../middleware/rate-limit';
import { authenticate } from '../../middleware/auth';
import { deleteNotification } from '../../services/notificationManager';

async function deleteNotificationHandler(req: VercelRequest, res: VercelResponse): Promise<void> {
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

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    throw validationError('Notification ID is required');
  }

  // App ID should come from authenticated context
  const appId = user.app_id || req.headers['x-app-id'] as string;
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
    throw error;
  }
}

export default asyncHandler(
  rateLimit({ maxRequests: 1000, windowMs: 15 * 60 * 1000 })(deleteNotificationHandler)
);
