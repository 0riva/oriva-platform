/**
 * Event Bus Routes
 * api/routes/events.ts
 * Task: T108 (Phase 3.8)
 *
 * API endpoints for event bus and notification management.
 * Routes: POST/GET /api/v1/events, subscriptions, notifications, preferences
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { requireApiKey, requireAuthentication } from '../middleware/auth';
import { schemaRouter, getSupabase, getAppContext } from '../middleware/schemaRouter';
import { eventBusService } from '../../services/eventBusService';
import { notificationRouterService } from '../../services/notificationRouterService';
import { realtimeDeliveryService } from '../../services/realtimeDeliveryService';
import type { PublishEventRequest, SubscribeRequest } from '../../patterns/eventTypes';
import type { SendNotificationRequest } from '../../patterns/notificationTypes';

const router = Router();

// Apply schema routing middleware to all routes
router.use(schemaRouter);

/**
 * POST /api/v1/events
 * Publish an event to the event bus
 */
router.post(
  '/',
  requireApiKey,
  requireAuthentication,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    const appId = (req as any).appId;
    const publishRequest: PublishEventRequest = req.body;

    // Validate required fields
    if (!publishRequest.type) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'event type is required',
      });
      return;
    }

    try {
      const event = await eventBusService.publish(
        req,
        {
          appId: appId || 'unknown',
          appName: (req as any).appName || 'unknown',
          version: '1.0.0',
        },
        userId,
        publishRequest
      );

      // Route event to notifications
      const notifications = await notificationRouterService.routeEvent(req, event);

      // Attempt to send notifications in background
      if (notifications.length > 0) {
        for (const notification of notifications) {
          notificationRouterService.sendNotification(req, notification).catch((error) => {
            console.error('Error sending notification:', error);
          });

          // Try real-time delivery
          await realtimeDeliveryService.broadcastMessage(notification.userId, notification, req);
        }
      }

      res.status(201).json({ data: event, notifications });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to publish event';
      res.status(400).json({ code: 'EVENT_PUBLISH_FAILED', message });
    }
  })
);

/**
 * GET /api/v1/events
 * Get event history
 */
router.get(
  '/',
  requireApiKey,
  requireAuthentication,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    const appId = (req as any).appId || '';
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;

    try {
      const result = await eventBusService.getEventHistory(
        req,
        userId,
        appId,
        undefined,
        limit,
        offset
      );

      res.status(200).json({
        data: result.events,
        total: result.total,
        hasMore: result.hasMore,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch event history';
      res.status(400).json({ code: 'EVENT_HISTORY_FETCH_FAILED', message });
    }
  })
);

/**
 * POST /api/v1/event-subscriptions
 * Subscribe to events
 */
router.post(
  '/subscriptions',
  requireApiKey,
  requireAuthentication,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    const appId = (req as any).appId;
    const subscribeRequest: SubscribeRequest = req.body;

    // Validate required fields
    if (!subscribeRequest.eventTypes) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'eventTypes is required',
      });
      return;
    }

    try {
      const subscription = await eventBusService.subscribe(
        req,
        userId,
        appId || 'unknown',
        subscribeRequest
      );

      res.status(201).json({ data: subscription });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create subscription';
      res.status(400).json({ code: 'SUBSCRIPTION_FAILED', message });
    }
  })
);

/**
 * GET /api/v1/event-subscriptions
 * Get user's event subscriptions
 */
router.get(
  '/subscriptions',
  requireApiKey,
  requireAuthentication,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    const appId = (req as any).appId;

    try {
      const subscriptions = await eventBusService.getUserSubscriptions(req, userId, appId);

      res.status(200).json({ data: subscriptions });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch subscriptions';
      res.status(400).json({ code: 'SUBSCRIPTIONS_FETCH_FAILED', message });
    }
  })
);

/**
 * DELETE /api/v1/event-subscriptions/:id
 * Unsubscribe from events
 */
router.delete(
  '/subscriptions/:id',
  requireApiKey,
  requireAuthentication,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    try {
      await eventBusService.unsubscribe(req, id, userId);
      res.status(204).send();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to unsubscribe';
      res.status(400).json({ code: 'UNSUBSCRIBE_FAILED', message });
    }
  })
);

/**
 * GET /api/v1/notifications
 * Get user notifications
 */
router.get(
  '/notifications',
  requireApiKey,
  requireAuthentication,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    const appIds = (req as any).appIds || [];
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const since = req.query.since ? Number(req.query.since) : undefined;

    try {
      const notifications = await realtimeDeliveryService.pollMessages(
        req,
        userId,
        appIds,
        limit,
        since
      );

      res.status(200).json({ data: notifications });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch notifications';
      res.status(400).json({ code: 'NOTIFICATIONS_FETCH_FAILED', message });
    }
  })
);

/**
 * PATCH /api/v1/notifications/:id
 * Mark notification as read
 */
router.patch(
  '/notifications/:id',
  requireApiKey,
  requireAuthentication,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const { id } = req.params;
    const { status } = req.body;

    if (!userId) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    if (!status) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'status is required',
      });
      return;
    }

    try {
      const supabase = getSupabase(req);
      const { data: notification, error } = await supabase
        .from('event_bus_notifications')
        .update({
          status,
          read_at: status === 'read' ? new Date().toISOString() : null,
        })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error || !notification) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Notification not found' });
        return;
      }

      res.status(200).json({ data: notification });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update notification';
      res.status(400).json({ code: 'NOTIFICATION_UPDATE_FAILED', message });
    }
  })
);

/**
 * GET /api/v1/notification-preferences
 * Get user notification preferences
 */
router.get(
  '/preferences',
  requireApiKey,
  requireAuthentication,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    try {
      const preferences = await notificationRouterService.getUserPreferences(req, userId);

      res.status(200).json({ data: preferences });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch preferences';
      res.status(400).json({ code: 'PREFERENCES_FETCH_FAILED', message });
    }
  })
);

/**
 * PUT /api/v1/notification-preferences
 * Update user notification preferences
 */
router.put(
  '/preferences',
  requireApiKey,
  requireAuthentication,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    try {
      const updated = await notificationRouterService.updatePreferences(req, userId, req.body);

      res.status(200).json({ data: updated });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update preferences';
      res.status(400).json({ code: 'PREFERENCES_UPDATE_FAILED', message });
    }
  })
);

/**
 * GET /api/v1/notifications/connection-status
 * Get real-time connection status
 */
router.get(
  '/connection-status',
  requireApiKey,
  requireAuthentication,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    try {
      const status = await realtimeDeliveryService.getConnectionStatus(userId);

      res.status(200).json({ data: status });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch connection status';
      res.status(400).json({ code: 'CONNECTION_STATUS_FAILED', message });
    }
  })
);

export default router;
