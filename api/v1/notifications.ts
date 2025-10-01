// Consolidated Notifications API Handler
// Handles: POST /api/v1/apps/:appId/notifications
//          GET /api/v1/users/:userId/notifications
//          PATCH /api/v1/notifications/:id
//          DELETE /api/v1/notifications/:id
// Pattern: Catch-all routing to reduce function count

import { VercelRequest, VercelResponse } from '@vercel/node';
import { rateLimit } from '../../src/middleware/rate-limit';
import { authenticate, AuthenticatedRequest } from '../../src/middleware/auth';
import {
  createNotification,
  queryNotifications,
  getCachedNotificationCount,
  updateNotificationState,
  deleteNotification,
} from '../../src/services/notificationManager';

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

interface UpdateNotificationRequest {
  status: 'read' | 'dismissed' | 'clicked';
  metadata?: Record<string, unknown>;
}

async function handleCreate(req: VercelRequest, res: VercelResponse, appId: string): Promise<void> {
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
    const errorMessage = process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : (error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({
      error: errorMessage,
      code: 'INTERNAL_ERROR',
    });
  }
}

async function handleQuery(req: VercelRequest, res: VercelResponse, userId: string): Promise<void> {
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
    const errorMessage = process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : (error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({
      error: errorMessage,
      code: 'INTERNAL_ERROR',
    });
  }
}

async function handleUpdate(req: VercelRequest, res: VercelResponse, id: string, userId: string): Promise<void> {
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
    const errorMessage = process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : (error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({
      error: errorMessage,
      code: 'INTERNAL_ERROR',
    });
  }
}

async function handleDelete(req: VercelRequest, res: VercelResponse, id: string, appId: string): Promise<void> {
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
    const errorMessage = process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : (error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({
      error: errorMessage,
      code: 'INTERNAL_ERROR',
    });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await authenticate(req, res, async () => {
    await rateLimit(req, res, async () => {
      const { method } = req;

      // POST /api/v1/apps/:appId/notifications (create)
      if (method === 'POST') {
        const { appId } = req.query;
        if (!appId || typeof appId !== 'string') {
          res.status(400).json({ error: 'App ID is required', code: 'VALIDATION_ERROR' });
          return;
        }
        return handleCreate(req, res, appId);
      }

      // GET /api/v1/users/:userId/notifications (query)
      if (method === 'GET') {
        const { userId } = req.query;
        if (!userId || typeof userId !== 'string') {
          res.status(400).json({ error: 'User ID is required', code: 'VALIDATION_ERROR' });
          return;
        }
        return handleQuery(req, res, userId);
      }

      // PATCH /api/v1/notifications/:id (update)
      if (method === 'PATCH') {
        const { id } = req.query;
        if (!id || typeof id !== 'string') {
          res.status(400).json({ error: 'Notification ID is required', code: 'VALIDATION_ERROR' });
          return;
        }
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.authContext.userId;
        return handleUpdate(req, res, id, userId);
      }

      // DELETE /api/v1/notifications/:id (delete)
      if (method === 'DELETE') {
        const { id } = req.query;
        if (!id || typeof id !== 'string') {
          res.status(400).json({ error: 'Notification ID is required', code: 'VALIDATION_ERROR' });
          return;
        }
        const appId = req.headers['x-app-id'] as string;
        if (!appId) {
          res.status(400).json({ error: 'App ID is required', code: 'APP_ID_REQUIRED' });
          return;
        }
        return handleDelete(req, res, id, appId);
      }

      res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
    });
  });
}
