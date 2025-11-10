/**
 * Event Bus Service
 * api/services/eventBusService.ts
 * Task: T108 (Phase 3.8)
 *
 * Core event bus for cross-app communication. Handles publishing, subscribing,
 * and dispatching events across the Oriva platform with multi-tenant isolation.
 */

import { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  createQueryBuilder,
  executeQuery,
  executeQueryOptional,
  DatabaseError,
} from '../utils/database-express';
import { validateRequired, ValidationError } from '../utils/validation-express';
import {
  Event,
  EventType,
  EventSource,
  EventMetadata,
  EventSubscription,
  EventFilter,
  EventHandler,
  EventQueryResult,
  SubscribeRequest,
  PublishEventRequest,
} from '../patterns/eventTypes';

/**
 * In-memory event subscription registry
 * Maps event types -> handlers for immediate dispatch
 */
interface SubscriptionEntry {
  subscription: EventSubscription;
  handler?: EventHandler;
}

class EventBusService {
  private subscriptions: Map<string, SubscriptionEntry[]> = new Map();
  private globalHandlers: Set<EventHandler> = new Set();
  private eventRetentionDays = 30;

  /**
   * Publish an event to the event bus
   */
  publish = async (
    req: Request,
    source: EventSource,
    userId: string | undefined,
    publishRequest: PublishEventRequest
  ): Promise<Event> => {
    const eventId = uuidv4();
    const correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();
    const timestamp = Date.now();

    const metadata: EventMetadata = {
      correlationId,
      version: '1.0.0',
      environment: (process.env.NODE_ENV as any) || 'development',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    };

    const event: Event = {
      id: eventId,
      type: publishRequest.type,
      source,
      userId: publishRequest.userId || userId,
      organizationId: publishRequest.organizationId,
      timestamp,
      data: publishRequest.data,
      metadata,
      correlationId,
    };

    // Persist event to database
    const db = createQueryBuilder(req);
    await executeQuery<Event>(
      () =>
        db
          .from('event_bus_events')
          .insert({
            id: event.id,
            event_type: event.type,
            source_app_id: event.source.appId,
            source_app_name: event.source.appName,
            source_version: event.source.version,
            user_id: event.userId,
            organization_id: event.organizationId,
            timestamp: event.timestamp,
            data: event.data,
            metadata: event.metadata,
            correlation_id: event.correlationId,
            created_at: new Date(timestamp).toISOString(),
          })
          .select('*')
          .single(),
      'publish event'
    );

    // Dispatch event to subscribers (in-memory)
    await this.dispatchEvent(event);

    return event;
  };

  /**
   * Subscribe to events
   */
  subscribe = async (
    req: Request,
    userId: string,
    appId: string,
    subscribeRequest: SubscribeRequest,
    handler?: EventHandler
  ): Promise<EventSubscription> => {
    const subscriptionId = uuidv4();
    const now = Date.now();

    const subscription: EventSubscription = {
      id: subscriptionId,
      eventType: subscribeRequest.eventTypes,
      userId,
      appId,
      handler,
      filters: subscribeRequest.filters,
      createdAt: now,
      updatedAt: now,
      active: true,
    };

    // Persist subscription to database
    const db = createQueryBuilder(req);
    await executeQuery<EventSubscription>(
      () =>
        db
          .from('event_bus_subscriptions')
          .insert({
            id: subscription.id,
            event_types: subscription.eventType,
            user_id: subscription.userId,
            app_id: subscription.appId,
            filters: subscription.filters,
            active: subscription.active,
            created_at: new Date(now).toISOString(),
            updated_at: new Date(now).toISOString(),
          })
          .select('*')
          .single(),
      'create subscription'
    );

    // Register in-memory handler if provided
    if (handler) {
      const eventTypes = Array.isArray(subscribeRequest.eventTypes)
        ? subscribeRequest.eventTypes
        : [subscribeRequest.eventTypes];

      for (const eventType of eventTypes) {
        if (!this.subscriptions.has(eventType)) {
          this.subscriptions.set(eventType, []);
        }
        this.subscriptions.get(eventType)!.push({
          subscription,
          handler,
        });
      }
    }

    return subscription;
  };

  /**
   * Unsubscribe from events
   */
  unsubscribe = async (req: Request, subscriptionId: string, userId: string): Promise<void> => {
    const db = createQueryBuilder(req);

    // Get subscription
    const subscription = await executeQueryOptional<EventSubscription>(
      () =>
        db
          .from('event_bus_subscriptions')
          .select('*')
          .eq('id', subscriptionId)
          .eq('user_id', userId)
          .maybeSingle(),
      'get subscription'
    );

    if (!subscription) {
      throw new ValidationError('Subscription not found', 'SUBSCRIPTION_NOT_FOUND');
    }

    // Delete from database
    await executeQuery<void>(
      () =>
        db.from('event_bus_subscriptions').delete().eq('id', subscriptionId).eq('user_id', userId),
      'delete subscription'
    );

    // Remove from in-memory registry
    this.removeSubscriptionFromRegistry(subscription);
  };

  /**
   * Get event history
   */
  getEventHistory = async (
    req: Request,
    userId: string,
    appId: string,
    filter?: EventFilter,
    limit: number = 100,
    offset: number = 0
  ): Promise<EventQueryResult> => {
    const db = createQueryBuilder(req);

    let query = db.from('event_bus_events').select('*', { count: 'exact' });

    // Filter by user and app source
    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (filter?.eventType) {
      const eventTypes = Array.isArray(filter.eventType) ? filter.eventType : [filter.eventType];
      query = query.in('event_type', eventTypes);
    }

    if (filter?.source) {
      const sources = Array.isArray(filter.source) ? filter.source : [filter.source];
      query = query.in('source_app_id', sources);
    }

    if (filter?.timeRange) {
      query = query
        .gte('timestamp', filter.timeRange.startTime)
        .lte('timestamp', filter.timeRange.endTime);
    }

    // Apply pagination
    query = query.order('timestamp', { ascending: false }).range(offset, offset + limit - 1);

    const { data: events, count, error } = await query;

    if (error) {
      throw new DatabaseError('Failed to fetch event history', 'EVENT_HISTORY_FETCH_FAILED', error);
    }

    return {
      events: (events || []) as Event[],
      total: count || 0,
      hasMore: (count || 0) > offset + limit,
    };
  };

  /**
   * Get user subscriptions
   */
  getUserSubscriptions = async (
    req: Request,
    userId: string,
    appId?: string
  ): Promise<EventSubscription[]> => {
    const db = createQueryBuilder(req);

    let query = db
      .from('event_bus_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true);

    if (appId) {
      query = query.eq('app_id', appId);
    }

    const { data: subscriptions, error } = await query;

    if (error) {
      throw new DatabaseError('Failed to fetch subscriptions', 'SUBSCRIPTIONS_FETCH_FAILED', error);
    }

    return (subscriptions || []) as EventSubscription[];
  };

  /**
   * Clean up old events (runs periodically)
   */
  cleanupOldEvents = async (req: Request): Promise<number> => {
    const db = createQueryBuilder(req);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.eventRetentionDays);

    const { data: deleted, error } = await db
      .from('event_bus_events')
      .delete()
      .lt('timestamp', cutoffDate.getTime());

    if (error) {
      throw new DatabaseError('Failed to cleanup old events', 'EVENT_CLEANUP_FAILED', error);
    }

    return 0; // Supabase doesn't return row count
  };

  /**
   * Internal: Dispatch event to subscribed handlers
   */
  private dispatchEvent = async (event: Event): Promise<void> => {
    const handlers: EventHandler[] = [];

    // Get type-specific handlers
    const typeHandlers = this.subscriptions.get(event.type);
    if (typeHandlers) {
      for (const entry of typeHandlers) {
        if (entry.handler && this.matchesFilters(event, entry.subscription)) {
          handlers.push(entry.handler);
        }
      }
    }

    // Add global handlers
    handlers.push(...this.globalHandlers);

    // Execute handlers (fire and forget, but log errors)
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        console.error(`Error in event handler for ${event.type}:`, error);
      }
    }
  };

  /**
   * Internal: Check if event matches subscription filters
   */
  private matchesFilters = (event: Event, subscription: EventSubscription): boolean => {
    const filters = subscription.filters;

    if (!filters) {
      return true;
    }

    // Check user ID filter
    if (filters.userId && event.userId !== filters.userId) {
      return false;
    }

    // Check source filter
    if (filters.source) {
      const sources = Array.isArray(filters.source) ? filters.source : [filters.source];
      if (!sources.includes(event.source.appId)) {
        return false;
      }
    }

    // Check time range filter
    if (filters.timeRange) {
      if (
        event.timestamp < filters.timeRange.startTime ||
        event.timestamp > filters.timeRange.endTime
      ) {
        return false;
      }
    }

    return true;
  };

  /**
   * Internal: Remove subscription from in-memory registry
   */
  private removeSubscriptionFromRegistry = (subscription: EventSubscription): void => {
    const eventTypes = Array.isArray(subscription.eventType)
      ? subscription.eventType
      : [subscription.eventType];

    for (const eventType of eventTypes) {
      const handlers = this.subscriptions.get(eventType);
      if (handlers) {
        const index = handlers.findIndex((h) => h.subscription.id === subscription.id);
        if (index > -1) {
          handlers.splice(index, 1);
        }
        if (handlers.length === 0) {
          this.subscriptions.delete(eventType);
        }
      }
    }
  };

  /**
   * Register a global event handler (for all events)
   */
  registerGlobalHandler = (handler: EventHandler): void => {
    this.globalHandlers.add(handler);
  };

  /**
   * Unregister a global event handler
   */
  unregisterGlobalHandler = (handler: EventHandler): void => {
    this.globalHandlers.delete(handler);
  };
}

// Singleton instance
export const eventBusService = new EventBusService();

export default eventBusService;
