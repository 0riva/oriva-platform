// Consolidated Workers Handler
// Handles: POST /api/workers/webhookRetry
//          POST /api/workers/notificationExpiry
//          POST /api/workers/dataArchival
// Pattern: Catch-all routing to reduce function count

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseClient } from '../src/config/supabase';
import { logger } from '../src/utils/logger';
import { retryWebhookDelivery } from '../src/services/webhookDelivery';
import { expireNotifications } from '../src/services/notificationManager';
import { authenticate } from '../src/middleware/auth';
import { rateLimit } from '../src/middleware/rate-limit';

const MAX_RETRIES = 5;
const MAX_RETRIES_PER_RUN = 100;
const MAX_RECORDS_PER_RUN = 10000;
const DEFAULT_RETENTION_DAYS = 90;

async function handleWebhookRetry(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    logger.info('Webhook retry worker started');

    const supabase = getSupabaseClient();

    // Find failed deliveries that need retry
    const { data: failedDeliveries, error: fetchError } = await supabase
      .from('webhook_delivery_log')
      .select('*')
      .eq('success', false)
      .lt('attempts', MAX_RETRIES)
      .order('created_at', { ascending: true })
      .limit(MAX_RETRIES_PER_RUN);

    if (fetchError) {
      logger.error('Failed to fetch delivery logs', { error: fetchError.message });
      const errorMessage = process.env.NODE_ENV === 'production'
        ? 'Failed to fetch delivery logs'
        : `Failed to fetch delivery logs: ${fetchError.message}`;
      res.status(500).json({ error: errorMessage, code: 'FETCH_ERROR' });
      return;
    }

    if (!failedDeliveries || failedDeliveries.length === 0) {
      logger.info('No failed deliveries to retry');
      res.status(200).json({ retried: 0, skipped: 0 });
      return;
    }

    let retriedCount = 0;
    let skippedCount = 0;

    for (const delivery of failedDeliveries) {
      try {
        const attempt = delivery.delivery_attempt + 1;

        // Calculate exponential backoff delay: 2^attempt seconds
        const backoffSeconds = Math.pow(2, delivery.delivery_attempt);
        const deliveryAge = Date.now() - new Date(delivery.delivered_at).getTime();
        const requiredDelay = backoffSeconds * 1000;

        // Check if enough time has elapsed
        if (deliveryAge < requiredDelay) {
          skippedCount++;
          logger.debug('Skipping retry (backoff not elapsed)', {
            log_id: delivery.id,
            attempt,
            backoff_seconds: backoffSeconds,
            age_ms: deliveryAge,
          });
          continue;
        }

        // Retry delivery
        logger.info('Retrying webhook delivery', {
          log_id: delivery.id,
          webhook_id: delivery.webhook_id,
          attempt,
        });

        await retryWebhookDelivery(delivery.id, attempt);
        retriedCount++;

        // Check if webhook should be disabled
        const { data: webhook } = await supabase
          .from('app_webhooks')
          .select('consecutive_failures')
          .eq('id', delivery.webhook_id)
          .single();

        if (webhook && webhook.consecutive_failures >= 100) {
          // Disable webhook
          await supabase.from('app_webhooks').update({ is_active: false }).eq('id', delivery.webhook_id);

          logger.error('Webhook disabled due to consecutive failures', {
            webhook_id: delivery.webhook_id,
            consecutive_failures: webhook.consecutive_failures,
          });
        }
      } catch (error) {
        logger.error('Failed to retry webhook delivery', {
          error: error instanceof Error ? error.message : String(error),
          log_id: delivery.id,
        });
      }
    }

    logger.info('Webhook retry worker completed', {
      retried: retriedCount,
      skipped: skippedCount,
      total: failedDeliveries.length,
    });

    res.status(200).json({
      retried: retriedCount,
      skipped: skippedCount,
      total: failedDeliveries.length,
    });
  } catch (error) {
    logger.error('Webhook retry worker failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    const errorMessage = process.env.NODE_ENV === 'production'
      ? 'Webhook retry worker failed'
      : (error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({
      error: errorMessage,
      code: 'WORKER_ERROR',
    });
  }
}

async function handleNotificationExpiry(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    logger.info('Notification expiry worker started');

    const result = await expireNotifications();

    logger.info('Notification expiry worker completed', {
      expired_count: result.expired,
    });

    res.status(200).json({
      expired: result.expired,
      message: `Expired ${result.expired} notifications`,
    });
  } catch (error) {
    logger.error('Notification expiry worker failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    const errorMessage = process.env.NODE_ENV === 'production'
      ? 'Notification expiry worker failed'
      : (error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({
      error: errorMessage,
      code: 'WORKER_ERROR',
    });
  }
}

async function handleDataArchival(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    logger.info('Data archival worker started');

    const retentionDays = parseInt(process.env.RETENTION_DAYS || String(DEFAULT_RETENTION_DAYS), 10);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffTimestamp = cutoffDate.toISOString();

    const supabase = getSupabaseClient();

    let archivedEvents = 0;
    let archivedNotifications = 0;

    // Archive old events
    try {
      const { data: oldEvents, error: eventsError } = await supabase
        .from('platform_events')
        .select('id')
        .lt('created_at', cutoffTimestamp)
        .limit(MAX_RECORDS_PER_RUN);

      if (eventsError) {
        logger.error('Failed to fetch old events', { error: eventsError.message });
      } else if (oldEvents && oldEvents.length > 0) {
        const eventIds = oldEvents.map((e) => e.id);

        const { error: deleteError } = await supabase.from('platform_events').delete().in('id', eventIds);

        if (deleteError) {
          logger.error('Failed to archive events', { error: deleteError.message });
        } else {
          archivedEvents = oldEvents.length;
          logger.info('Archived old events', { count: archivedEvents });
        }
      }
    } catch (error) {
      logger.error('Event archival failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Archive old notifications
    try {
      const { data: oldNotifications, error: notificationsError } = await supabase
        .from('platform_notifications')
        .select('id')
        .lt('created_at', cutoffTimestamp)
        .limit(MAX_RECORDS_PER_RUN);

      if (notificationsError) {
        logger.error('Failed to fetch old notifications', { error: notificationsError.message });
      } else if (oldNotifications && oldNotifications.length > 0) {
        const notificationIds = oldNotifications.map((n) => n.id);

        const { error: deleteError } = await supabase.from('platform_notifications').delete().in('id', notificationIds);

        if (deleteError) {
          logger.error('Failed to archive notifications', { error: deleteError.message });
        } else {
          archivedNotifications = oldNotifications.length;
          logger.info('Archived old notifications', { count: archivedNotifications });
        }
      }
    } catch (error) {
      logger.error('Notification archival failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    logger.info('Data archival worker completed', {
      retention_days: retentionDays,
      cutoff_date: cutoffTimestamp,
      archived_events: archivedEvents,
      archived_notifications: archivedNotifications,
    });

    res.status(200).json({
      retention_days: retentionDays,
      archived_events: archivedEvents,
      archived_notifications: archivedNotifications,
      message: `Archived ${archivedEvents} events and ${archivedNotifications} notifications`,
    });
  } catch (error) {
    logger.error('Data archival worker failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    const errorMessage = process.env.NODE_ENV === 'production'
      ? 'Data archival worker failed'
      : (error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({
      error: errorMessage,
      code: 'WORKER_ERROR',
    });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // Add authentication and rate limiting to protect worker endpoints
  await authenticate(req, res, async () => {
    await rateLimit(req, res, async () => {
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
        return;
      }

      // Extract worker name from URL with more precise matching
      const { url } = req;

      // Use regex patterns for more precise route matching
      if (url?.match(/\/webhookRetry$/)) {
        return handleWebhookRetry(req, res);
      }

      if (url?.match(/\/notificationExpiry$/)) {
        return handleNotificationExpiry(req, res);
      }

      if (url?.match(/\/dataArchival$/)) {
        return handleDataArchival(req, res);
      }

      res.status(404).json({ error: 'Worker not found', code: 'NOT_FOUND' });
    });
  });
}
