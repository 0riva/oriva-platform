// Task: T028 - POST /api/v1/apps/:appId/notifications endpoint
// Description: Create notification

import { VercelRequest, VercelResponse } from '@vercel/node';
import { asyncHandler, validationError } from '../../middleware/error-handler';
import { rateLimit } from '../../middleware/rate-limit';
import { authenticate } from '../../middleware/auth';
import { createNotification } from '../../services/notificationManager';

interface CreateNotificationRequest {
  user_id: string;
  title: string;
  body: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  category?: string;
  external_id?: string;
  action_url?: string;
  icon_url?: string;
  image_url?: string;
  expires_at?: string;
  metadata?: Record<string, unknown>;
}

async function createNotificationHandler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
    return;
  }

  // Authenticate
  const user = await authenticate(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required', code: 'AUTH_MISSING' });
    return;
  }

  const { appId } = req.query;
  if (!appId || typeof appId !== 'string') {
    throw validationError('App ID is required');
  }

  const requestData: CreateNotificationRequest = req.body;

  // Validate required fields
  if (!requestData.user_id || !requestData.title || !requestData.body || !requestData.priority) {
    throw validationError('Missing required fields: user_id, title, body, priority');
  }

  try {
    const result = await createNotification({
      app_id: appId,
      ...requestData,
    });

    res.status(201).json({
      notification_id: result.notification_id,
      created_at: result.created_at,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Duplicate external_id')) {
        res.status(409).json({ error: error.message, code: 'DUPLICATE_EXTERNAL_ID' });
        return;
      }
      if (error.message.includes('cannot exceed') || error.message.includes('cannot be empty')) {
        res.status(400).json({ error: error.message, code: 'VALIDATION_ERROR' });
        return;
      }
    }
    throw error;
  }
}

export default asyncHandler(
  rateLimit({ maxRequests: 500, windowMs: 15 * 60 * 1000 })(createNotificationHandler)
);
