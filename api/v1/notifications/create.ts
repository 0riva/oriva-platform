// Task: T028 - POST /api/v1/apps/:appId/notifications endpoint
// Description: Create notification

import { VercelRequest, VercelResponse } from '@vercel/node';
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

      const requestData: CreateNotificationRequest = req.body;

      // Validate required fields
      if (!requestData.user_id || !requestData.title || !requestData.body || !requestData.priority) {
        res.status(400).json({
          error: 'Missing required fields: user_id, title, body, priority',
          code: 'VALIDATION_ERROR',
        });
        return;
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
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error',
          code: 'INTERNAL_ERROR',
        });
      }
    });
  });
}
