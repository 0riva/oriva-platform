// Consolidated Integrations API Handler
// Handles: Events, Notifications, and Webhooks
//
// Routes:
// - POST   /api/v1/apps/:appId/events
// - GET    /api/v1/apps/:appId/events
// - POST   /api/v1/apps/:appId/notifications
// - GET    /api/v1/users/:userId/notifications
// - PATCH  /api/v1/notifications/:id
// - DELETE /api/v1/notifications/:id
// - POST   /api/v1/apps/:appId/webhooks
// - GET    /api/v1/apps/:appId/webhooks
// - PATCH  /api/v1/apps/:appId/webhooks/:id
// - DELETE /api/v1/apps/:appId/webhooks/:id
//
// Pattern: Catch-all routing to reduce function count

import { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { rateLimit } from '../../src/middleware/rate-limit';
import { authenticate, AuthenticatedRequest } from '../../src/middleware/auth';
import { publishEvent, queryEvents } from '../../src/services/eventPublisher';
import {
  createNotification,
  queryNotifications,
  getCachedNotificationCount,
  updateNotificationState,
  deleteNotification,
} from '../../src/services/notificationManager';
import { getSupabaseClient } from '../../src/config/supabase';

// ============================================================================
// Types
// ============================================================================

interface PublishEventRequest {
  user_id: string;
  event_category: 'notification' | 'user' | 'session' | 'transaction';
  event_type: string;
  entity_type: string;
  entity_id: string;
  event_data?: Record<string, unknown>;
}

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

interface CreateWebhookRequest {
  webhook_url: string;
  subscribed_events: string[];
}

interface UpdateWebhookRequest {
  webhook_url?: string;
  subscribed_events?: string[];
  is_active?: boolean;
}

// ============================================================================
// Events Handlers
// ============================================================================

async function handlePublishEvent(req: VercelRequest, res: VercelResponse, appId: string): Promise<void> {
  const {
    user_id,
    event_category,
    event_type,
    entity_type,
    entity_id,
    event_data = {},
  }: PublishEventRequest = req.body;

  // Validate required fields
  if (!user_id || !event_category || !event_type || !entity_type || !entity_id) {
    res.status(400).json({
      error: 'Missing required fields: user_id, event_category, event_type, entity_type, entity_id',
      code: 'VALIDATION_ERROR',
    });
    return;
  }

  try {
    const result = await publishEvent({
      appId,
      userId: user_id,
      eventCategory: event_category,
      eventType: event_type,
      entityType: entity_type,
      entityId: entity_id,
      eventData: event_data,
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'] as string,
    });

    res.status(200).json({
      event_id: result.event_id,
      timestamp: result.timestamp,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Invalid event_category')) {
        res.status(400).json({ error: error.message, code: 'INVALID_EVENT_CATEGORY' });
        return;
      }
      if (error.message.includes('Invalid event_type format')) {
        res.status(400).json({ error: error.message, code: 'INVALID_EVENT_TYPE' });
        return;
      }
    }
    const errorMessage = process.env.NODE_ENV === 'production'
      ? 'Failed to publish event'
      : (error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({
      error: errorMessage,
      code: 'INTERNAL_ERROR',
    });
  }
}

async function handleQueryEvents(req: VercelRequest, res: VercelResponse, appId: string): Promise<void> {
  const {
    user_id,
    event_category,
    event_type,
    start_date,
    end_date,
    limit = '100',
    offset = '0',
  } = req.query;

  const parsedLimit = Math.min(parseInt(limit as string, 10) || 100, 100);
  const parsedOffset = parseInt(offset as string, 10) || 0;

  try {
    const result = await queryEvents({
      appId,
      userId: user_id as string,
      eventCategory: event_category as string,
      eventType: event_type as string,
      startDate: start_date as string,
      endDate: end_date as string,
      limit: parsedLimit,
      offset: parsedOffset,
    });

    res.status(200).json({
      events: result.events,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        has_more: result.offset + result.limit < result.total,
      },
    });
  } catch (error) {
    const errorMessage = process.env.NODE_ENV === 'production'
      ? 'Query failed'
      : (error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({
      error: errorMessage,
      code: 'INTERNAL_ERROR',
    });
  }
}

// ============================================================================
// Notifications Handlers
// ============================================================================

async function handleCreateNotification(req: VercelRequest, res: VercelResponse, appId: string): Promise<void> {
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

async function handleQueryNotifications(req: VercelRequest, res: VercelResponse, userId: string): Promise<void> {
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

async function handleUpdateNotification(req: VercelRequest, res: VercelResponse, id: string, userId: string): Promise<void> {
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

async function handleDeleteNotification(req: VercelRequest, res: VercelResponse, id: string, appId: string): Promise<void> {
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

// ============================================================================
// Webhooks Handlers
// ============================================================================

async function handleCreateWebhook(req: VercelRequest, res: VercelResponse, appId: string): Promise<void> {
  const { webhook_url, subscribed_events }: CreateWebhookRequest = req.body;

  // Validate webhook_url
  if (!webhook_url) {
    res.status(400).json({ error: 'webhook_url is required', code: 'VALIDATION_ERROR' });
    return;
  }

  try {
    const url = new URL(webhook_url);
    if (url.protocol !== 'https:') {
      res.status(400).json({ error: 'webhook_url must use HTTPS', code: 'INVALID_URL' });
      return;
    }
  } catch (error) {
    res.status(400).json({ error: 'Invalid webhook_url format', code: 'INVALID_URL' });
    return;
  }

  // Validate subscribed_events
  if (!subscribed_events || !Array.isArray(subscribed_events) || subscribed_events.length === 0) {
    res.status(400).json({ error: 'subscribed_events must be a non-empty array', code: 'INVALID_EVENTS' });
    return;
  }

  // Generate webhook secret
  const webhookSecret = crypto.randomBytes(32).toString('hex');

  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('app_webhooks')
      .insert({
        app_id: appId,
        webhook_url,
        webhook_secret: webhookSecret,
        subscribed_events,
        is_active: true,
      })
      .select('id')
      .single();

    if (error) {
      res.status(500).json({ error: `Database error: ${error.message}`, code: 'DATABASE_ERROR' });
      return;
    }

    res.status(201).json({
      webhook_id: data.id,
      webhook_secret: webhookSecret,
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

async function handleListWebhooks(req: VercelRequest, res: VercelResponse, appId: string): Promise<void> {
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
    const errorMessage = process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : (error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({
      error: errorMessage,
      code: 'INTERNAL_ERROR',
    });
  }
}

async function handleUpdateWebhook(req: VercelRequest, res: VercelResponse, appId: string, id: string): Promise<void> {
  const { webhook_url, subscribed_events, is_active }: UpdateWebhookRequest = req.body;

  if (!webhook_url && !subscribed_events && is_active === undefined) {
    res.status(400).json({
      error: 'At least one field must be provided: webhook_url, subscribed_events, or is_active',
      code: 'VALIDATION_ERROR',
    });
    return;
  }

  const updates: any = {};
  if (webhook_url) {
    try {
      const url = new URL(webhook_url);
      if (url.protocol !== 'https:') {
        res.status(400).json({ error: 'webhook_url must use HTTPS', code: 'INVALID_URL' });
        return;
      }
      updates.webhook_url = webhook_url;
    } catch (error) {
      res.status(400).json({ error: 'Invalid webhook_url format', code: 'INVALID_URL' });
      return;
    }
  }

  if (subscribed_events) {
    if (!Array.isArray(subscribed_events) || subscribed_events.length === 0) {
      res.status(400).json({ error: 'subscribed_events must be a non-empty array', code: 'INVALID_EVENTS' });
      return;
    }
    updates.subscribed_events = subscribed_events;
  }

  if (is_active !== undefined) {
    updates.is_active = is_active;
  }

  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('app_webhooks')
      .update(updates)
      .eq('id', id)
      .eq('app_id', appId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ error: 'Webhook not found or not authorized', code: 'NOT_FOUND' });
        return;
      }
      res.status(500).json({ error: `Database error: ${error.message}`, code: 'DATABASE_ERROR' });
      return;
    }

    res.status(200).json(data);
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

async function handleDeleteWebhook(req: VercelRequest, res: VercelResponse, appId: string, id: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();

    const { error } = await supabase.from('app_webhooks').delete().eq('id', id).eq('app_id', appId);

    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ error: 'Webhook not found or not authorized', code: 'NOT_FOUND' });
        return;
      }
      res.status(500).json({ error: `Database error: ${error.message}`, code: 'DATABASE_ERROR' });
      return;
    }

    res.status(204).end();
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

// ============================================================================
// Main Handler
// ============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await authenticate(req, res, async () => {
    await rateLimit(req, res, async () => {
      const { method, url } = req;
      const { appId, userId, id } = req.query;

      // ========================================
      // EVENTS Routes
      // ========================================
      if (url?.includes('/events')) {
        if (!appId || typeof appId !== 'string') {
          res.status(400).json({ error: 'App ID is required', code: 'VALIDATION_ERROR' });
          return;
        }

        // POST /api/v1/apps/:appId/events
        if (method === 'POST') {
          return handlePublishEvent(req, res, appId);
        }

        // GET /api/v1/apps/:appId/events
        if (method === 'GET') {
          return handleQueryEvents(req, res, appId);
        }

        res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
        return;
      }

      // ========================================
      // NOTIFICATIONS Routes
      // ========================================
      if (url?.includes('/notifications')) {
        // POST /api/v1/apps/:appId/notifications (create)
        if (method === 'POST') {
          if (!appId || typeof appId !== 'string') {
            res.status(400).json({ error: 'App ID is required', code: 'VALIDATION_ERROR' });
            return;
          }
          return handleCreateNotification(req, res, appId);
        }

        // GET /api/v1/users/:userId/notifications (query)
        if (method === 'GET' && !id) {
          if (!userId || typeof userId !== 'string') {
            res.status(400).json({ error: 'User ID is required', code: 'VALIDATION_ERROR' });
            return;
          }
          return handleQueryNotifications(req, res, userId);
        }

        // PATCH /api/v1/notifications/:id (update)
        if (method === 'PATCH' && id) {
          if (typeof id !== 'string') {
            res.status(400).json({ error: 'Notification ID is required', code: 'VALIDATION_ERROR' });
            return;
          }
          const authReq = req as AuthenticatedRequest;
          const authUserId = authReq.authContext.userId;
          return handleUpdateNotification(req, res, id, authUserId);
        }

        // DELETE /api/v1/notifications/:id (delete)
        if (method === 'DELETE' && id) {
          if (typeof id !== 'string') {
            res.status(400).json({ error: 'Notification ID is required', code: 'VALIDATION_ERROR' });
            return;
          }
          const headerAppId = req.headers['x-app-id'] as string;
          if (!headerAppId) {
            res.status(400).json({ error: 'App ID is required', code: 'APP_ID_REQUIRED' });
            return;
          }
          return handleDeleteNotification(req, res, id, headerAppId);
        }

        res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
        return;
      }

      // ========================================
      // WEBHOOKS Routes
      // ========================================
      if (url?.includes('/webhooks')) {
        if (!appId || typeof appId !== 'string') {
          res.status(400).json({ error: 'App ID is required', code: 'VALIDATION_ERROR' });
          return;
        }

        // POST /api/v1/apps/:appId/webhooks (create)
        if (method === 'POST') {
          return handleCreateWebhook(req, res, appId);
        }

        // GET /api/v1/apps/:appId/webhooks (list)
        if (method === 'GET' && !id) {
          return handleListWebhooks(req, res, appId);
        }

        // PATCH /api/v1/apps/:appId/webhooks/:id (update)
        if (method === 'PATCH' && id && typeof id === 'string') {
          return handleUpdateWebhook(req, res, appId, id);
        }

        // DELETE /api/v1/apps/:appId/webhooks/:id (delete)
        if (method === 'DELETE' && id && typeof id === 'string') {
          return handleDeleteWebhook(req, res, appId, id);
        }

        res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
        return;
      }

      // Unknown route
      res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
    });
  });
}
