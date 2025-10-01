// Task: T021 - EventPublisher service for platform event publishing
// Description: Validate, persist, and broadcast platform events

import { getSupabaseClient } from '../config/supabase';
import { logger } from '../utils/logger';

export interface PublishEventParams {
  appId: string;
  userId: string;
  eventCategory: 'notification' | 'user' | 'session' | 'transaction';
  eventType: string;
  entityType: string;
  entityId: string;
  eventData?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface PublishEventResult {
  event_id: string;
  timestamp: string;
}

// Valid event categories
const VALID_EVENT_CATEGORIES = ['notification', 'user', 'session', 'transaction'];

// Event type format regex: lowercase letters and underscores only
const EVENT_TYPE_REGEX = /^[a-z_]+$/;

/**
 * Publish a platform event
 * - Validates event payload
 * - Inserts into platform_events table
 * - Logs event
 * - Broadcasts to WebSocket connections (if available)
 * - Triggers webhook delivery (if available)
 */
export async function publishEvent(params: PublishEventParams): Promise<PublishEventResult> {
  const {
    appId,
    userId,
    eventCategory,
    eventType,
    entityType,
    entityId,
    eventData = {},
    ipAddress,
    userAgent
  } = params;

  // Validation
  if (!VALID_EVENT_CATEGORIES.includes(eventCategory)) {
    throw new Error(`Invalid event_category: ${eventCategory}. Must be one of: ${VALID_EVENT_CATEGORIES.join(', ')}`);
  }

  if (!EVENT_TYPE_REGEX.test(eventType)) {
    throw new Error(`Invalid event_type format: ${eventType}. Must contain only lowercase letters and underscores.`);
  }

  if (!entityId || entityId.trim().length === 0) {
    throw new Error('entity_id cannot be empty');
  }

  if (!entityType || entityType.trim().length === 0) {
    throw new Error('entity_type cannot be empty');
  }

  try {
    const supabase = getSupabaseClient();

    // Insert event into database
    const { data, error } = await supabase
      .from('platform_events')
      .insert({
        app_id: appId,
        user_id: userId,
        event_category: eventCategory,
        event_type: eventType,
        entity_type: entityType,
        entity_id: entityId,
        event_data: eventData,
        ip_address: ipAddress || null,
        user_agent: userAgent || null,
        timestamp: new Date().toISOString(),
      })
      .select('id, timestamp')
      .single();

    if (error) {
      logger.error('Failed to publish event', {
        error: error.message,
        appId,
        userId,
        eventCategory,
        eventType,
        entityType,
        entityId,
      });
      throw new Error(`Database error: ${error.message}`);
    }

    if (!data) {
      throw new Error('No data returned after event insertion');
    }

    // Log successful event publication
    logger.info('Event published', {
      event_id: data.id,
      app_id: appId,
      user_id: userId,
      event_category: eventCategory,
      event_type: eventType,
      entity_type: entityType,
      entity_id: entityId,
    });

    // Broadcast to WebSocket connections (if broadcaster is available)
    try {
      const { broadcastEvent } = await import('./websocketBroadcaster');
      await broadcastEvent({
        event_id: data.id,
        app_id: appId,
        user_id: userId,
        event_category: eventCategory,
        event_type: eventType,
        entity_type: entityType,
        entity_id: entityId,
        event_data: eventData,
        timestamp: data.timestamp,
      }, userId);
    } catch (error) {
      // Non-critical: WebSocket broadcasting is optional
      logger.debug('WebSocket broadcast skipped', { error });
    }

    // Trigger webhook delivery (if delivery service is available)
    try {
      const { triggerWebhookDelivery } = await import('./webhookDelivery');
      await triggerWebhookDelivery(data.id, appId, eventCategory, eventType);
    } catch (error) {
      // Non-critical: Webhook delivery is async and handled by background worker
      logger.debug('Webhook delivery trigger skipped', { error });
    }

    return {
      event_id: data.id,
      timestamp: data.timestamp,
    };
  } catch (error) {
    logger.error('Failed to publish event', {
      error: error instanceof Error ? error.message : String(error),
      appId,
      userId,
      eventCategory,
      eventType,
    });
    throw error;
  }
}

/**
 * Query events with filters
 */
export interface QueryEventsParams {
  appId: string;
  userId?: string;
  eventCategory?: string;
  eventType?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export async function queryEvents(params: QueryEventsParams) {
  const {
    appId,
    userId,
    eventCategory,
    eventType,
    startDate,
    endDate,
    limit = 50,
    offset = 0,
  } = params;

  try {
    const supabase = getSupabaseClient();

    let query = supabase
      .from('platform_events')
      .select('*', { count: 'exact' })
      .eq('app_id', appId)
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (eventCategory) {
      query = query.eq('event_category', eventCategory);
    }

    if (eventType) {
      query = query.eq('event_type', eventType);
    }

    if (startDate) {
      query = query.gte('timestamp', startDate);
    }

    if (endDate) {
      query = query.lte('timestamp', endDate);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      logger.error('Failed to query events', {
        error: error.message,
        appId,
        userId,
      });
      throw new Error(`Database error: ${error.message}`);
    }

    return {
      events: data || [],
      total: count || 0,
      limit,
      offset,
    };
  } catch (error) {
    logger.error('Failed to query events', {
      error: error instanceof Error ? error.message : String(error),
      appId,
      userId,
    });
    throw error;
  }
}
