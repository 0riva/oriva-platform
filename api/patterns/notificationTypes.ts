/**
 * Notification Types Definition
 * api/patterns/notificationTypes.ts
 *
 * Defines all notification types and structures used by the notification router
 * for delivering messages through multiple channels.
 */

import { EventType } from './eventTypes';

/**
 * Notification delivery channels
 */
export enum NotificationChannel {
  IN_APP = 'in_app',
  EMAIL = 'email',
  PUSH = 'push',
  WEBHOOK = 'webhook',
  SMS = 'sms', // Future
}

/**
 * Notification priority levels
 */
export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

/**
 * Notification delivery status
 */
export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
  EXPIRED = 'expired',
}

/**
 * Core notification structure
 */
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channels: NotificationChannel[];
  priority: NotificationPriority;
  status: NotificationStatus;
  createdAt: number;
  sentAt?: number;
  deliveredAt?: number;
  readAt?: number;
  expiresAt?: number;
  source: {
    appId: string;
    eventType: EventType;
  };
}

/**
 * Notification types by category
 */
export enum NotificationType {
  // User notifications
  USER_WELCOME = 'user.welcome',
  USER_PROFILE_UPDATED = 'user.profile_updated',
  USER_ACCOUNT_ACTIVITY = 'user.account_activity',

  // Session notifications
  SESSION_REMINDER = 'session.reminder',
  SESSION_REGISTRATION_CONFIRMED = 'session.registration_confirmed',
  SESSION_CANCELLED = 'session.cancelled',
  SESSION_STARTING_SOON = 'session.starting_soon',
  SESSION_FEEDBACK_REQUEST = 'session.feedback_request',

  // Event notifications (Live Mixers)
  EVENT_CREATED = 'event.created',
  EVENT_UPDATED = 'event.updated',
  EVENT_CANCELLED = 'event.cancelled',
  EVENT_REGISTRATION_CONFIRMED = 'event.registration_confirmed',
  EVENT_ATTENDEE_UPDATE = 'event.attendee_update',
  EVENT_REMINDER = 'event.reminder',

  // Work Buddy notifications
  FOCUS_SESSION_REMINDER = 'work_buddy.focus_session_reminder',
  FOCUS_SESSION_COMPLETED = 'work_buddy.focus_session_completed',
  APPOINTMENT_REMINDER = 'work_buddy.appointment_reminder',
  APPOINTMENT_CANCELLED = 'work_buddy.appointment_cancelled',
  TEAM_MEMBER_STATUS = 'work_buddy.team_member_status',

  // Hugo Love notifications
  NEW_MATCH = 'hugo_love.new_match',
  PROFILE_VIEW = 'hugo_love.profile_view',
  NEW_MESSAGE = 'hugo_love.new_message',
  MATCH_ACTIVITY = 'hugo_love.match_activity',

  // System notifications
  SYSTEM_ALERT = 'system.alert',
  SYSTEM_MAINTENANCE = 'system.maintenance',
  SYSTEM_UPDATE = 'system.update',

  // Generic notifications
  GENERIC = 'generic',
}

/**
 * Delivery attempt tracking
 */
export interface DeliveryAttempt {
  channelId: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  timestamp: number;
  error?: string;
  retryCount: number;
  nextRetryAt?: number;
}

/**
 * Notification with delivery history
 */
export interface NotificationWithDelivery extends Notification {
  deliveryAttempts: DeliveryAttempt[];
}

/**
 * Notification preferences per user
 */
export interface NotificationPreferences {
  userId: string;
  channels: {
    [key in NotificationChannel]?: {
      enabled: boolean;
      doNotDisturb?: {
        enabled: boolean;
        startTime: string; // HH:mm format
        endTime: string; // HH:mm format
        timezone: string;
      };
    };
  };
  notificationTypes: {
    [key in NotificationType]?: {
      enabled: boolean;
      channels?: NotificationChannel[];
      priority?: NotificationPriority;
    };
  };
  unsubscribedTypes: NotificationType[];
  createdAt: number;
  updatedAt: number;
}

/**
 * Notification mapping rule (Event -> Notification)
 */
export interface NotificationMappingRule {
  id: string;
  eventType: EventType;
  notificationType: NotificationType;
  priority: NotificationPriority;
  channels: NotificationChannel[];
  template: {
    title: string;
    body: string;
    data?: Record<string, string>;
  };
  conditions?: {
    [key: string]: unknown;
  };
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * Notification delivery result
 */
export interface DeliveryResult {
  notificationId: string;
  channel: NotificationChannel;
  success: boolean;
  timestamp: number;
  error?: string;
  externalId?: string; // Provider-specific ID (e.g., AWS SNS message ID)
}

/**
 * Bulk delivery results
 */
export interface BulkDeliveryResults {
  notificationId: string;
  totalAttempts: number;
  successCount: number;
  failureCount: number;
  results: DeliveryResult[];
}

/**
 * Notification query filter
 */
export interface NotificationFilter {
  userId?: string;
  type?: NotificationType | NotificationType[];
  status?: NotificationStatus | NotificationStatus[];
  channel?: NotificationChannel | NotificationChannel[];
  appId?: string;
  fromDate?: number;
  toDate?: number;
  unread?: boolean;
}

/**
 * Notification query result
 */
export interface NotificationQueryResult {
  notifications: Notification[];
  total: number;
  hasMore: boolean;
  cursor?: string;
}

/**
 * Notification request to create/send
 */
export interface SendNotificationRequest {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channels?: NotificationChannel[];
  priority?: NotificationPriority;
  expiresIn?: number; // milliseconds
}

/**
 * Batch notification request
 */
export interface SendBatchNotificationsRequest {
  userIds: string[];
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channels?: NotificationChannel[];
  priority?: NotificationPriority;
}

/**
 * Notification delivery options
 */
export interface DeliveryOptions {
  retryPolicy?: {
    maxRetries: number;
    backoffMultiplier: number;
    initialDelayMs: number;
  };
  timeout?: number;
  metadata?: Record<string, unknown>;
}
