/**
 * Notification Router Service
 * api/services/notificationRouterService.ts
 * Task: T108 (Phase 3.8)
 *
 * Routes events to notifications and manages delivery through multiple channels.
 * Handles user preferences, delivery tracking, and retry logic.
 */

import { Request } from 'express';
import { randomUUID } from 'crypto';
import {
  createQueryBuilder,
  executeQuery,
  executeQueryOptional,
  DatabaseError,
} from '../utils/database-express';
import { validateRequired, ValidationError } from '../utils/validation-express';
import { Event, EventType } from '../patterns/eventTypes';
import {
  Notification,
  NotificationType,
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
  NotificationMappingRule,
  NotificationPreferences,
  SendNotificationRequest,
  SendBatchNotificationsRequest,
  DeliveryResult,
  DeliveryAttempt,
} from '../patterns/notificationTypes';

/**
 * Default notification mapping rules
 * These define how events are converted to notifications
 */
const DEFAULT_MAPPING_RULES: NotificationMappingRule[] = [
  {
    id: randomUUID(),
    eventType: EventType.SESSION_STARTED,
    notificationType: NotificationType.SESSION_REMINDER,
    priority: NotificationPriority.NORMAL,
    channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
    template: {
      title: 'Session Started',
      body: 'Your session has started. Join now!',
    },
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: randomUUID(),
    eventType: EventType.EVENT_REGISTRATION,
    notificationType: NotificationType.EVENT_REGISTRATION_CONFIRMED,
    priority: NotificationPriority.NORMAL,
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    template: {
      title: 'Registration Confirmed',
      body: 'You are registered for the event!',
    },
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: randomUUID(),
    eventType: EventType.USER_PROFILE_CHANGED,
    notificationType: NotificationType.USER_PROFILE_UPDATED,
    priority: NotificationPriority.LOW,
    channels: [NotificationChannel.IN_APP],
    template: {
      title: 'Profile Updated',
      body: 'Your profile has been updated.',
    },
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

/**
 * Default user notification preferences
 */
const DEFAULT_PREFERENCES: Omit<
  NotificationPreferences,
  'userId' | 'createdAt' | 'updatedAt'
> = {
  channels: {
    in_app: { enabled: true },
    email: { enabled: false },
    push: { enabled: true },
    webhook: { enabled: false },
    sms: { enabled: false },
  },
  notificationTypes: {},
  unsubscribedTypes: [],
};

class NotificationRouterService {
  /**
   * Route an event to one or more notifications
   */
  routeEvent = async (req: Request, event: Event): Promise<Notification[]> => {
    const db = createQueryBuilder(req);

    if (!event.userId) {
      return []; // No user to notify
    }

    // Get applicable mapping rules
    const mappingRules = await this.getMappingRules(req, event.type);

    if (mappingRules.length === 0) {
      return []; // No mapping rules for this event
    }

    // Get user preferences
    const preferences = await this.getUserPreferences(req, event.userId);

    const notifications: Notification[] = [];

    // Create notification for each applicable mapping rule
    for (const rule of mappingRules) {
      // Check if user unsubscribed from this notification type
      if (preferences.unsubscribedTypes.includes(rule.notificationType)) {
        continue;
      }

      // Determine delivery channels based on preferences
      let channels = rule.channels;
      const notificationTypeConfig = preferences.notificationTypes[rule.notificationType];

      if (notificationTypeConfig) {
        if (!notificationTypeConfig.enabled) {
          continue; // User disabled this notification type
        }
        if (notificationTypeConfig.channels) {
          channels = notificationTypeConfig.channels;
        }
      }

      // Filter channels based on user's channel preferences
      const enabledChannels = channels.filter((channel) => {
        const channelConfig = preferences.channels[channel];
        return channelConfig?.enabled !== false;
      });

      if (enabledChannels.length === 0) {
        continue; // No enabled channels
      }

      const notification: Notification = {
        id: randomUUID(),
        userId: event.userId,
        type: rule.notificationType,
        title: rule.template.title,
        body: rule.template.body,
        data: {
          ...rule.template.data,
          ...event.data,
        },
        channels: enabledChannels,
        priority: notificationTypeConfig?.priority || rule.priority,
        status: NotificationStatus.PENDING,
        createdAt: Date.now(),
        source: {
          appId: event.source.appId,
          eventType: event.type,
        },
      };

      // Persist notification
      const persistedNotification = await executeQuery<Notification>(
        () =>
          db
            .from('event_bus_notifications')
            .insert({
              id: notification.id,
              user_id: notification.userId,
              notification_type: notification.type,
              title: notification.title,
              body: notification.body,
              data: notification.data,
              channels: notification.channels,
              priority: notification.priority,
              status: notification.status,
              source_app_id: notification.source.appId,
              source_event_type: notification.source.eventType,
              created_at: new Date(notification.createdAt).toISOString(),
            })
            .select('*')
            .single(),
        'persist notification'
      );

      notifications.push(persistedNotification);
    }

    return notifications;
  };

  /**
   * Send a notification through configured channels
   */
  sendNotification = async (
    req: Request,
    notification: Notification
  ): Promise<DeliveryResult[]> => {
    const db = createQueryBuilder(req);
    const results: DeliveryResult[] = [];
    const timestamp = Date.now();

    // Send through each channel
    for (const channel of notification.channels) {
      try {
        const externalId = await this.deliverThroughChannel(req, notification, channel);

        const result: DeliveryResult = {
          notificationId: notification.id,
          channel,
          success: true,
          timestamp,
          externalId,
        };

        results.push(result);

        // Update delivery status
        await this.recordDeliveryAttempt(
          req,
          notification.id,
          channel,
          NotificationStatus.SENT,
          null,
          externalId
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        const result: DeliveryResult = {
          notificationId: notification.id,
          channel,
          success: false,
          timestamp,
          error: errorMessage,
        };

        results.push(result);

        // Record failed delivery
        await this.recordDeliveryAttempt(
          req,
          notification.id,
          channel,
          NotificationStatus.FAILED,
          errorMessage
        );
      }
    }

    // Update notification status
    const allSuccess = results.every((r) => r.success);
    const newStatus = allSuccess ? NotificationStatus.SENT : NotificationStatus.FAILED;

    await executeQuery<Notification>(
      () =>
        db
          .from('event_bus_notifications')
          .update({
            status: newStatus,
            sent_at: new Date(timestamp).toISOString(),
          })
          .eq('id', notification.id),
      'update notification status'
    );

    return results;
  };

  /**
   * Retry failed notifications
   */
  retryFailed = async (
    req: Request,
    maxRetries: number = 5,
    maxAge: number = 86400000 // 24 hours
  ): Promise<number> => {
    const db = createQueryBuilder(req);

    // Get failed notifications that are still within retry window
    const cutoffTime = Date.now() - maxAge;

    const { data: failedDeliveries, error } = await db
      .from('event_bus_delivery')
      .select('notification_id, channel')
      .eq('status', NotificationStatus.FAILED)
      .lt('created_at', new Date(cutoffTime).toISOString())
      .lt('retry_count', maxRetries);

    if (error) {
      throw new DatabaseError('Failed to fetch retry candidates', 'RETRY_FETCH_FAILED', error);
    }

    let retryCount = 0;

    for (const delivery of failedDeliveries || []) {
      try {
        const notification = await executeQueryOptional<Notification>(
          () =>
            db
              .from('event_bus_notifications')
              .select('*')
              .eq('id', delivery.notification_id)
              .maybeSingle(),
          'get notification for retry'
        );

        if (!notification) {
          continue;
        }

        // Attempt to redeliver
        try {
          const externalId = await this.deliverThroughChannel(
            req,
            notification,
            delivery.channel as NotificationChannel
          );

          // Update delivery attempt
          await this.recordDeliveryAttempt(
            req,
            notification.id,
            delivery.channel,
            NotificationStatus.SENT,
            null,
            externalId
          );

          retryCount++;
        } catch (deliveryError) {
          const errorMessage =
            deliveryError instanceof Error ? deliveryError.message : String(deliveryError);

          // Update retry count
          const deliveryData = await executeQueryOptional<any>(
            () =>
              db
                .from('event_bus_delivery')
                .select('retry_count')
                .eq('notification_id', notification.id)
                .eq('channel', delivery.channel)
                .maybeSingle(),
            'get retry count'
          );

          const nextRetryCount = (deliveryData?.retry_count || 0) + 1;
          const backoffMs = Math.min(1000 * Math.pow(2, nextRetryCount - 1), 60000);

          await executeQuery<void>(
            () =>
              db
                .from('event_bus_delivery')
                .update({
                  retry_count: nextRetryCount,
                  status:
                    nextRetryCount >= maxRetries
                      ? NotificationStatus.FAILED
                      : NotificationStatus.PENDING,
                  next_retry_at: new Date(Date.now() + backoffMs).toISOString(),
                  error: errorMessage,
                })
                .eq('notification_id', notification.id)
                .eq('channel', delivery.channel),
            'update retry attempt'
          );
        }
      } catch (error) {
        console.error('Error retrying notification:', error);
      }
    }

    return retryCount;
  };

  /**
   * Get user notification preferences
   */
  getUserPreferences = async (req: Request, userId: string): Promise<NotificationPreferences> => {
    const db = createQueryBuilder(req);

    const preferences = await executeQueryOptional<NotificationPreferences>(
      () => db.from('event_bus_preferences').select('*').eq('user_id', userId).maybeSingle(),
      'get user preferences'
    );

    if (!preferences) {
      // Return default preferences if not found
      return {
        userId,
        ...DEFAULT_PREFERENCES,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }

    return preferences;
  };

  /**
   * Update user notification preferences
   */
  updatePreferences = async (
    req: Request,
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> => {
    const db = createQueryBuilder(req);

    const updated = await executeQuery<NotificationPreferences>(
      () =>
        db
          .from('event_bus_preferences')
          .upsert({
            user_id: userId,
            ...preferences,
            updated_at: new Date().toISOString(),
          })
          .select('*')
          .single(),
      'update preferences'
    );

    return updated;
  };

  /**
   * Get notification delivery status
   */
  getDeliveryStatus = async (req: Request, notificationId: string): Promise<DeliveryAttempt[]> => {
    const db = createQueryBuilder(req);

    const { data: attempts, error } = await db
      .from('event_bus_delivery')
      .select('*')
      .eq('notification_id', notificationId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new DatabaseError(
        'Failed to fetch delivery status',
        'DELIVERY_STATUS_FETCH_FAILED',
        error
      );
    }

    return (attempts || []) as DeliveryAttempt[];
  };

  /**
   * Internal: Deliver notification through a specific channel
   */
  private deliverThroughChannel = async (
    req: Request,
    notification: Notification,
    channel: NotificationChannel
  ): Promise<string> => {
    switch (channel) {
      case NotificationChannel.IN_APP:
        return this.deliverInApp(notification);
      case NotificationChannel.EMAIL:
        return this.deliverEmail(notification);
      case NotificationChannel.PUSH:
        return this.deliverPush(notification);
      case NotificationChannel.WEBHOOK:
        return this.deliverWebhook(notification);
      default:
        throw new ValidationError(
          `Unsupported delivery channel: ${channel}`,
          'UNSUPPORTED_CHANNEL'
        );
    }
  };

  /**
   * Internal: In-app delivery (just persistence)
   */
  private deliverInApp = async (notification: Notification): Promise<string> => {
    // In-app notifications are already persisted, just return ID
    return notification.id;
  };

  /**
   * Internal: Email delivery (stub for future)
   */
  private deliverEmail = async (notification: Notification): Promise<string> => {
    // TODO: Integrate with email service (SendGrid, Resend, etc.)
    console.log(`[EMAIL] Sending notification ${notification.id} to ${notification.userId}`);
    return `email-${notification.id}`;
  };

  /**
   * Internal: Push notification delivery (stub for future)
   */
  private deliverPush = async (notification: Notification): Promise<string> => {
    // TODO: Integrate with push service (FCM, APNs, etc.)
    console.log(`[PUSH] Sending notification ${notification.id} to ${notification.userId}`);
    return `push-${notification.id}`;
  };

  /**
   * Internal: Webhook delivery (stub for future)
   */
  private deliverWebhook = async (notification: Notification): Promise<string> => {
    // TODO: Integrate with user-configured webhooks
    console.log(`[WEBHOOK] Sending notification ${notification.id} to ${notification.userId}`);
    return `webhook-${notification.id}`;
  };

  /**
   * Internal: Get mapping rules for an event type
   */
  private getMappingRules = async (
    req: Request,
    eventType: EventType
  ): Promise<NotificationMappingRule[]> => {
    // For now, return default rules
    // TODO: Load from database when rules are persisted
    return DEFAULT_MAPPING_RULES.filter((rule) => rule.eventType === eventType && rule.enabled);
  };

  /**
   * Internal: Record a delivery attempt
   */
  private recordDeliveryAttempt = async (
    req: Request,
    notificationId: string,
    channel: NotificationChannel,
    status: NotificationStatus,
    error?: string | null,
    externalId?: string
  ): Promise<void> => {
    const db = createQueryBuilder(req);

    await executeQuery<void>(
      () =>
        db.from('event_bus_delivery').insert({
          id: randomUUID(),
          notification_id: notificationId,
          channel,
          status,
          error: error || null,
          retry_count: 0,
          external_id: externalId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      'record delivery attempt'
    );
  };
}

// Singleton instance
export const notificationRouterService = new NotificationRouterService();

export default notificationRouterService;
