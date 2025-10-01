// Task: T030 - PATCH /api/v1/notifications/:id endpoint
// Description: Update notification state

import { VercelRequest, VercelResponse } from '@vercel/node';
import { asyncHandler, validationError } from '../../middleware/error-handler';
import { rateLimit } from '../../middleware/rate-limit';
import { authenticate } from '../../middleware/auth';
import { updateNotificationState } from '../../services/notificationManager';

interface UpdateNotificationRequest {
  status: 'read' | 'dismissed' | 'clicked';
  metadata?: Record<string, unknown>;
}

async function updateNotificationHandler(req: VercelRequest, res: VercelResponse): Promise<void> {
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

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    throw validationError('Notification ID is required');
  }

  const { status, metadata }: UpdateNotificationRequest = req.body;

  if (!status) {
    throw validationError('Status is required');
  }

  if (!['read', 'dismissed', 'clicked'].includes(status)) {
    res.status(400).json({ error: 'Invalid status. Must be: read, dismissed, or clicked', code: 'INVALID_STATUS' });
    return;
  }

  try {
    const result = await updateNotificationState({
      notificationId: id,
      userId: user.id,
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
    throw error;
  }
}

export default asyncHandler(
  rateLimit({ maxRequests: 1000, windowMs: 15 * 60 * 1000 })(updateNotificationHandler)
);
