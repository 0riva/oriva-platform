/**
 * Event Types Definition
 * api/patterns/eventTypes.ts
 *
 * Defines all event types used in the event bus system for cross-app communication.
 * Events flow through the system enabling real-time updates and inter-app notifications.
 */

/**
 * All event types supported by the event bus
 */
export enum EventType {
  // User Events
  USER_CREATED = 'user.created',
  USER_UPDATED = 'user.updated',
  USER_PROFILE_CHANGED = 'user.profile_changed',
  USER_DELETED = 'user.deleted',
  USER_STATUS_CHANGED = 'user.status_changed',

  // Session Events
  SESSION_STARTED = 'session.started',
  SESSION_ENDED = 'session.ended',
  SESSION_REGISTERED = 'session.registered',
  SESSION_CANCELLED = 'session.cancelled',
  SESSION_UPDATED = 'session.updated',

  // Event (Live Mixers) Events
  EVENT_CREATED = 'event.created',
  EVENT_UPDATED = 'event.updated',
  EVENT_DELETED = 'event.deleted',
  EVENT_REGISTRATION = 'event.registration',
  EVENT_CANCELLED = 'event.cancelled',
  EVENT_RSVP_CHANGED = 'event.rsvp_changed',

  // Work Buddy Events
  FOCUS_SESSION_STARTED = 'work_buddy.focus_session_started',
  FOCUS_SESSION_ENDED = 'work_buddy.focus_session_ended',
  APPOINTMENT_SCHEDULED = 'work_buddy.appointment_scheduled',
  APPOINTMENT_CANCELLED = 'work_buddy.appointment_cancelled',

  // Hugo Love Events
  PROFILE_VIEWED = 'hugo_love.profile_viewed',
  MATCH_CREATED = 'hugo_love.match_created',
  MESSAGE_SENT = 'hugo_love.message_sent',
  SWIPE_ACTION = 'hugo_love.swipe_action',

  // App Events
  APP_INSTALLED = 'app.installed',
  APP_UNINSTALLED = 'app.uninstalled',
  APP_UPDATED = 'app.updated',
  APP_ENABLED = 'app.enabled',
  APP_DISABLED = 'app.disabled',

  // Notification Events
  NOTIFICATION_CREATED = 'notification.created',
  NOTIFICATION_READ = 'notification.read',
  NOTIFICATION_DELIVERED = 'notification.delivered',
  NOTIFICATION_FAILED = 'notification.failed',
}

/**
 * Event metadata for tracking and debugging
 */
export interface EventMetadata {
  correlationId: string;
  causationId?: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Source app information
 */
export interface EventSource {
  appId: string;
  appName: string;
  version?: string;
}

/**
 * Core event structure
 */
export interface Event {
  id: string;
  type: EventType;
  source: EventSource;
  userId?: string;
  organizationId?: string;
  timestamp: number;
  data: Record<string, unknown>;
  metadata: EventMetadata;
  correlationId: string;
}

/**
 * Event filter for subscriptions
 */
export interface EventFilter {
  eventType?: EventType | EventType[];
  source?: string | string[];
  userId?: string;
  timeRange?: {
    startTime: number;
    endTime: number;
  };
}

/**
 * Query result for event history
 */
export interface EventQueryResult {
  events: Event[];
  total: number;
  hasMore: boolean;
  cursor?: string;
}

/**
 * Event handler function
 */
export type EventHandler = (event: Event) => Promise<void> | void;

/**
 * Event subscription
 */
export interface EventSubscription {
  id: string;
  eventType: EventType | EventType[];
  userId: string;
  appId: string;
  handler?: EventHandler;
  filters?: EventFilter[];
  createdAt: number;
  updatedAt: number;
  active: boolean;
}

/**
 * Event subscription request
 */
export interface SubscribeRequest {
  eventTypes: EventType[];
  filters?: EventFilter[];
}

/**
 * Event publication request
 */
export interface PublishEventRequest {
  type: EventType;
  data: Record<string, unknown>;
  userId?: string;
  organizationId?: string;
}
