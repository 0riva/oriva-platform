// Task: T022 - NotificationManager service for notification lifecycle management
// Description: Create, query, update, and delete notifications with state management

import { getSupabaseClient } from '../config/supabase';
import { logger } from '../utils/logger';
import { publishEvent } from './eventPublisher';
import xss from 'xss';

export interface CreateNotificationParams {
  app_id: string;
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

export interface CreateNotificationResult {
  notification_id: string;
  created_at: string;
}

export interface QueryNotificationsParams {
  userId: string;
  status?: 'unread' | 'read' | 'dismissed' | 'clicked';
  appId?: string;
  priority?: string;
  limit?: number;
  offset?: number;
}

export interface UpdateNotificationStateParams {
  notificationId: string;
  userId: string;
  status: 'read' | 'dismissed' | 'clicked';
  metadata?: Record<string, unknown>;
}

// Valid priorities
const VALID_PRIORITIES = ['low', 'normal', 'high', 'critical'];

/**
 * Create a notification
 * - Validates payload
 * - Inserts into platform_notifications and notification_state
 * - Publishes notification.created event
 * - Handles duplicate external_id
 * - XSS sanitization on title and body
 */
export async function createNotification(params: CreateNotificationParams): Promise<CreateNotificationResult> {
  const {
    app_id,
    user_id,
    title,
    body,
    priority,
    category,
    external_id,
    action_url,
    icon_url,
    image_url,
    expires_at,
    metadata = {},
  } = params;

  // Validation
  if (!title || title.trim().length === 0) {
    throw new Error('Title cannot be empty');
  }

  if (title.length > 200) {
    throw new Error('Title cannot exceed 200 characters');
  }

  if (!body || body.trim().length === 0) {
    throw new Error('Body cannot be empty');
  }

  if (body.length > 1000) {
    throw new Error('Body cannot exceed 1000 characters');
  }

  if (!VALID_PRIORITIES.includes(priority)) {
    throw new Error(`Invalid priority: ${priority}. Must be one of: ${VALID_PRIORITIES.join(', ')}`);
  }

  // XSS sanitization
  const sanitizedTitle = xss(title);
  const sanitizedBody = xss(body);

  try {
    const supabase = getSupabaseClient();

    // Check for duplicate external_id
    if (external_id) {
      const { data: existing } = await supabase
        .from('platform_notifications')
        .select('id')
        .eq('app_id', app_id)
        .eq('external_id', external_id)
        .single();

      if (existing) {
        throw new Error(`Duplicate external_id: ${external_id}`);
      }
    }

    // Insert notification
    const { data: notification, error: notificationError } = await supabase
      .from('platform_notifications')
      .insert({
        app_id,
        user_id,
        title: sanitizedTitle,
        body: sanitizedBody,
        priority,
        category: category || null,
        external_id: external_id || null,
        action_url: action_url || null,
        icon_url: icon_url || null,
        image_url: image_url || null,
        expires_at: expires_at || null,
        metadata,
      })
      .select('id, created_at')
      .single();

    if (notificationError) {
      logger.error('Failed to create notification', {
        error: notificationError.message,
        app_id,
        user_id,
      });
      throw new Error(`Database error: ${notificationError.message}`);
    }

    if (!notification) {
      throw new Error('No data returned after notification creation');
    }

    // Create notification_state
    const { error: stateError } = await supabase
      .from('notification_state')
      .insert({
        notification_id: notification.id,
        user_id,
        status: 'unread',
      });

    if (stateError) {
      logger.error('Failed to create notification_state', {
        error: stateError.message,
        notification_id: notification.id,
      });
      throw new Error(`Failed to create notification state: ${stateError.message}`);
    }

    // Publish platform event
    try {
      await publishEvent({
        appId: app_id,
        userId: user_id,
        eventCategory: 'notification',
        eventType: 'created',
        entityType: 'notification',
        entityId: notification.id,
        eventData: {
          title: sanitizedTitle,
          priority,
          category,
        },
      });
    } catch (eventError) {
      logger.warn('Failed to publish notification.created event', {
        error: eventError instanceof Error ? eventError.message : String(eventError),
        notification_id: notification.id,
      });
    }

    // Invalidate count cache
    await invalidateCountCache(user_id);

    logger.info('Notification created', {
      notification_id: notification.id,
      app_id,
      user_id,
      priority,
    });

    return {
      notification_id: notification.id,
      created_at: notification.created_at,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('Duplicate external_id')) {
      throw error; // Re-throw for proper 409 handling
    }
    logger.error('Failed to create notification', {
      error: error instanceof Error ? error.message : String(error),
      app_id,
      user_id,
    });
    throw error;
  }
}

/**
 * Query notifications for a user with filters
 * - Joins platform_notifications and notification_state
 * - Excludes expired notifications
 * - Includes app branding
 * - Sorts by priority and created_at
 */
export async function queryNotifications(params: QueryNotificationsParams) {
  const {
    userId,
    status,
    appId,
    priority,
    limit = 50,
    offset = 0,
  } = params;

  try {
    const supabase = getSupabaseClient();

    // Build query with JOIN
    let query = supabase
      .from('platform_notifications')
      .select(`
        id,
        app_id,
        user_id,
        title,
        body,
        priority,
        category,
        external_id,
        action_url,
        icon_url,
        image_url,
        expires_at,
        metadata,
        created_at,
        notification_state!inner (
          status,
          read_at,
          dismissed_at,
          clicked_at
        ),
        hugo_apps!inner (
          display_name,
          icon_url
        )
      `, { count: 'exact' })
      .eq('user_id', userId)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    // Filter by status if provided
    if (status) {
      query = query.eq('notification_state.status', status);
    }

    // Filter by app_id if provided
    if (appId) {
      query = query.eq('app_id', appId);
    }

    // Filter by priority if provided
    if (priority) {
      query = query.eq('priority', priority);
    }

    // Exclude expired notifications
    query = query.or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`);

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      logger.error('Failed to query notifications', {
        error: error.message,
        userId,
      });
      throw new Error(`Database error: ${error.message}`);
    }

    // Transform data to include app branding
    const notifications = (data || []).map((notif: any) => ({
      notification_id: notif.id,
      app_id: notif.app_id,
      app_name: notif.hugo_apps?.display_name || notif.app_id,
      app_icon_url: notif.hugo_apps?.icon_url || null,
      title: notif.title,
      body: notif.body,
      priority: notif.priority,
      category: notif.category,
      action_url: notif.action_url,
      icon_url: notif.icon_url,
      image_url: notif.image_url,
      expires_at: notif.expires_at,
      metadata: notif.metadata,
      status: notif.notification_state[0]?.status || 'unread',
      read_at: notif.notification_state[0]?.read_at || null,
      dismissed_at: notif.notification_state[0]?.dismissed_at || null,
      clicked_at: notif.notification_state[0]?.clicked_at || null,
      created_at: notif.created_at,
    }));

    return {
      notifications,
      total: count || 0,
      limit,
      offset,
    };
  } catch (error) {
    logger.error('Failed to query notifications', {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });
    throw error;
  }
}

/**
 * Update notification state
 * - Updates notification_state table
 * - Publishes state change event
 * - Handles idempotent operations
 * - Invalidates count cache
 */
export async function updateNotificationState(params: UpdateNotificationStateParams) {
  const { notificationId, userId, status, metadata = {} } = params;

  try {
    const supabase = getSupabaseClient();

    // Get current state for idempotency check
    const { data: currentState, error: fetchError } = await supabase
      .from('notification_state')
      .select('*')
      .eq('notification_id', notificationId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !currentState) {
      throw new Error('Notification not found');
    }

    // Idempotency: If already in target state, return success without update
    if (currentState.status === status) {
      logger.debug('Notification already in target state', {
        notification_id: notificationId,
        status,
      });
      return {
        status: currentState.status,
        updated_at: currentState.updated_at,
      };
    }

    // Build update object
    const updates: any = { status };

    if (status === 'read' && !currentState.read_at) {
      updates.read_at = new Date().toISOString();
    } else if (status === 'dismissed' && !currentState.dismissed_at) {
      updates.dismissed_at = new Date().toISOString();
      if (!currentState.read_at) {
        updates.read_at = new Date().toISOString();
      }
    } else if (status === 'clicked' && !currentState.clicked_at) {
      updates.clicked_at = new Date().toISOString();
      if (!currentState.read_at) {
        updates.read_at = new Date().toISOString();
      }
    }

    // Update state
    const { data: updatedState, error: updateError } = await supabase
      .from('notification_state')
      .update(updates)
      .eq('notification_id', notificationId)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      logger.error('Failed to update notification state', {
        error: updateError.message,
        notification_id: notificationId,
      });
      throw new Error(`Database error: ${updateError.message}`);
    }

    // Get notification details for event
    const { data: notification } = await supabase
      .from('platform_notifications')
      .select('app_id')
      .eq('id', notificationId)
      .single();

    if (notification) {
      // Publish platform event
      try {
        await publishEvent({
          appId: notification.app_id,
          userId,
          eventCategory: 'notification',
          eventType: status, // 'read', 'dismissed', or 'clicked'
          entityType: 'notification',
          entityId: notificationId,
          eventData: metadata,
        });
      } catch (eventError) {
        logger.warn(`Failed to publish notification.${status} event`, {
          error: eventError instanceof Error ? eventError.message : String(eventError),
          notification_id: notificationId,
        });
      }
    }

    // Invalidate count cache
    await invalidateCountCache(userId);

    logger.info('Notification state updated', {
      notification_id: notificationId,
      status,
    });

    return {
      status: updatedState.status,
      updated_at: updatedState.updated_at,
      read_at: updatedState.read_at,
      dismissed_at: updatedState.dismissed_at,
      clicked_at: updatedState.clicked_at,
    };
  } catch (error) {
    logger.error('Failed to update notification state', {
      error: error instanceof Error ? error.message : String(error),
      notification_id: notificationId,
    });
    throw error;
  }
}

/**
 * Delete notification (app owner only)
 * - Checks app authorization
 * - Deletes notification (CASCADE deletes notification_state)
 * - Publishes deletion event
 */
export async function deleteNotification(notificationId: string, appId: string) {
  try {
    const supabase = getSupabaseClient();

    // Check if notification belongs to app
    const { data: notification, error: fetchError } = await supabase
      .from('platform_notifications')
      .select('app_id, user_id')
      .eq('id', notificationId)
      .single();

    if (fetchError || !notification) {
      throw new Error('Notification not found');
    }

    if (notification.app_id !== appId) {
      throw new Error('Not authorized to delete this notification');
    }

    // Delete notification (CASCADE will handle notification_state)
    const { error: deleteError } = await supabase
      .from('platform_notifications')
      .delete()
      .eq('id', notificationId);

    if (deleteError) {
      logger.error('Failed to delete notification', {
        error: deleteError.message,
        notification_id: notificationId,
      });
      throw new Error(`Database error: ${deleteError.message}`);
    }

    // Publish deletion event
    try {
      await publishEvent({
        appId,
        userId: notification.user_id,
        eventCategory: 'notification',
        eventType: 'deleted',
        entityType: 'notification',
        entityId: notificationId,
      });
    } catch (eventError) {
      logger.warn('Failed to publish notification.deleted event', {
        error: eventError instanceof Error ? eventError.message : String(eventError),
        notification_id: notificationId,
      });
    }

    // Invalidate count cache
    await invalidateCountCache(notification.user_id);

    logger.info('Notification deleted', {
      notification_id: notificationId,
      app_id: appId,
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to delete notification', {
      error: error instanceof Error ? error.message : String(error),
      notification_id: notificationId,
    });
    throw error;
  }
}

/**
 * Expire notifications (background task)
 * - Marks expired notifications as dismissed
 * - Publishes expiry events
 */
export async function expireNotifications() {
  try {
    const supabase = getSupabaseClient();

    // Find expired notifications that are not yet dismissed
    const { data: expiredNotifications, error: fetchError } = await supabase
      .from('platform_notifications')
      .select(`
        id,
        app_id,
        user_id,
        notification_state!inner (
          status
        )
      `)
      .lt('expires_at', new Date().toISOString())
      .neq('notification_state.status', 'dismissed');

    if (fetchError) {
      logger.error('Failed to fetch expired notifications', {
        error: fetchError.message,
      });
      return { expired: 0 };
    }

    if (!expiredNotifications || expiredNotifications.length === 0) {
      return { expired: 0 };
    }

    let expiredCount = 0;

    // Update each expired notification
    for (const notif of expiredNotifications) {
      try {
        await updateNotificationState({
          notificationId: notif.id,
          userId: notif.user_id,
          status: 'dismissed',
          metadata: { expired: true },
        });
        expiredCount++;
      } catch (error) {
        logger.warn('Failed to expire notification', {
          error: error instanceof Error ? error.message : String(error),
          notification_id: notif.id,
        });
      }
    }

    logger.info('Expired notifications processed', { count: expiredCount });

    return { expired: expiredCount };
  } catch (error) {
    logger.error('Failed to expire notifications', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { expired: 0 };
  }
}

/**
 * Get cached notification count (placeholder for future Redis integration)
 */
export async function getCachedNotificationCount(userId: string): Promise<number | null> {
  // TODO: Implement Redis caching in future
  return null;
}

/**
 * Invalidate count cache (placeholder for future Redis integration)
 */
export async function invalidateCountCache(userId: string): Promise<void> {
  // TODO: Implement Redis cache invalidation in future
  logger.debug('Count cache invalidation called', { userId });
}
