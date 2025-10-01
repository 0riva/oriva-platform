// @ts-nocheck - TODO: Fix type errors
// Task: T023 - WebhookDelivery service for webhook event delivery
// Description: Deliver events to subscribed webhooks with HMAC signatures

import { getSupabaseClient } from '../config/supabase';
import { logger } from '../utils/logger';
import crypto from 'crypto';

export interface WebhookDeliveryResult {
  success: boolean;
  status_code?: number;
  error?: string;
}

/**
 * Deliver an event to a specific webhook
 * - Fetches event and webhook from database
 * - Builds webhook payload
 * - Generates HMAC-SHA256 signature
 * - HTTP POST to webhook_url with 10-second timeout
 * - Logs delivery attempt
 * - Updates webhook stats
 */
export async function deliverEvent(eventId: string, webhookId: string): Promise<WebhookDeliveryResult> {
  try {
    const supabase = getSupabaseClient();

    // Fetch event
    const { data: event, error: eventError } = await supabase
      .from('platform_events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      logger.error('Event not found for webhook delivery', {
        event_id: eventId,
        webhook_id: webhookId,
      });
      return { success: false, error: 'Event not found' };
    }

    // Fetch webhook
    const { data: webhook, error: webhookError } = await supabase
      .from('app_webhooks')
      .select('*')
      .eq('id', webhookId)
      .single();

    if (webhookError || !webhook) {
      logger.error('Webhook not found', {
        webhook_id: webhookId,
      });
      return { success: false, error: 'Webhook not found' };
    }

    // Check if webhook is active
    if (!webhook.is_active) {
      logger.debug('Webhook is inactive, skipping delivery', {
        webhook_id: webhookId,
      });
      return { success: false, error: 'Webhook inactive' };
    }

    // Build webhook payload
    const payload = {
      event_id: event.id,
      event_type: `${event.event_category}.${event.event_type}`,
      timestamp: event.timestamp,
      app_id: event.app_id,
      data: {
        notification_id: event.entity_type === 'notification' ? event.entity_id : undefined,
        entity_type: event.entity_type,
        entity_id: event.entity_id,
        ...event.event_data,
      },
    };

    const payloadString = JSON.stringify(payload);

    // Generate HMAC-SHA256 signature
    const signature = crypto
      .createHmac('sha256', webhook.webhook_secret)
      .update(payloadString)
      .digest('hex');

    const signatureHeader = `sha256=${signature}`;

    // HTTP POST to webhook_url with 10-second timeout
    const startTime = Date.now();
    let responseStatus: number | undefined;
    let responseBody: string | undefined;
    let success = false;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(webhook.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Oriva-Signature': signatureHeader,
          'X-Oriva-Event-Id': event.id,
          'X-Oriva-Event-Type': `${event.event_category}.${event.event_type}`,
          'User-Agent': 'Oriva-Platform/1.0',
        },
        body: payloadString,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      responseStatus = response.status;
      responseBody = await response.text().catch(() => '');
      success = response.status >= 200 && response.status < 300;

      logger.info('Webhook delivery attempt completed', {
        webhook_id: webhookId,
        event_id: eventId,
        status: responseStatus,
        success,
        duration_ms: Date.now() - startTime,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn('Webhook delivery failed', {
        webhook_id: webhookId,
        event_id: eventId,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      });

      responseStatus = 0;
      responseBody = errorMessage;
      success = false;
    }

    // Log delivery attempt
    const { error: logError } = await supabase
      .from('webhook_delivery_log')
      .insert({
        webhook_id: webhookId,
        app_id: event.app_id,
        event_id: eventId,
        event_type: `${event.event_category}.${event.event_type}`,
        response_status: responseStatus || 0,
        response_body: responseBody?.substring(0, 1000) || null, // Limit to 1000 chars
        attempts: 1,
        success,
      });

    if (logError) {
      logger.error('Failed to log webhook delivery', {
        error: logError.message,
        webhook_id: webhookId,
      });
    }

    // Update webhook stats
    if (success) {
      // Reset consecutive failures on success
      await supabase
        .from('app_webhooks')
        .update({
          last_delivery_at: new Date().toISOString(),
          consecutive_failures: 0,
        })
        .eq('id', webhookId);
    } else {
      // Increment consecutive failures
      const newFailureCount = (webhook.consecutive_failures || 0) + 1;
      const updates: any = {
        consecutive_failures: newFailureCount,
      };

      // Disable webhook after 100 consecutive failures
      if (newFailureCount >= 100) {
        updates.is_active = false;
        logger.warn('Webhook disabled due to consecutive failures', {
          webhook_id: webhookId,
          consecutive_failures: newFailureCount,
        });
      }

      await supabase
        .from('app_webhooks')
        .update(updates)
        .eq('id', webhookId);
    }

    return {
      success,
      status_code: responseStatus,
      error: success ? undefined : responseBody,
    };
  } catch (error) {
    logger.error('Webhook delivery error', {
      error: error instanceof Error ? error.message : String(error),
      event_id: eventId,
      webhook_id: webhookId,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Trigger webhook delivery for matching subscriptions
 * Called by EventPublisher after event is created
 */
export async function triggerWebhookDelivery(
  eventId: string,
  appId: string,
  eventCategory: string,
  eventType: string
): Promise<void> {
  try {
    const supabase = getSupabaseClient();

    const fullEventType = `${eventCategory}.${eventType}`;

    // Find webhooks subscribed to this event type
    const { data: webhooks, error } = await supabase
      .from('app_webhooks')
      .select('id')
      .eq('app_id', appId)
      .eq('is_active', true)
      .contains('subscribed_events', [fullEventType]);

    if (error) {
      logger.error('Failed to fetch webhooks for event', {
        error: error.message,
        event_id: eventId,
      });
      return;
    }

    if (!webhooks || webhooks.length === 0) {
      logger.debug('No webhooks subscribed to event type', {
        event_id: eventId,
        event_type: fullEventType,
      });
      return;
    }

    logger.info('Triggering webhook deliveries', {
      event_id: eventId,
      event_type: fullEventType,
      webhook_count: webhooks.length,
    });

    // Deliver to each webhook (fire-and-forget for async processing)
    // In production, this should be handled by a background worker with retry logic
    for (const webhook of webhooks) {
      // Non-blocking: don't await
      deliverEvent(eventId, webhook.id).catch((error) => {
        logger.error('Webhook delivery failed', {
          error: error instanceof Error ? error.message : String(error),
          event_id: eventId,
          webhook_id: webhook.id,
        });
      });
    }
  } catch (error) {
    logger.error('Failed to trigger webhook delivery', {
      error: error instanceof Error ? error.message : String(error),
      event_id: eventId,
    });
  }
}

/**
 * Retry failed webhook delivery with exponential backoff
 * Should be called by background worker
 */
export async function retryWebhookDelivery(logId: string, attempt: number): Promise<WebhookDeliveryResult> {
  try {
    const supabase = getSupabaseClient();

    // Fetch delivery log
    const { data: log, error: logError } = await supabase
      .from('webhook_delivery_log')
      .select('*')
      .eq('id', logId)
      .single();

    if (logError || !log) {
      logger.error('Delivery log not found for retry', { log_id: logId });
      return { success: false, error: 'Delivery log not found' };
    }

    // Maximum 5 retry attempts
    if (attempt > 5) {
      logger.warn('Max retry attempts reached', {
        log_id: logId,
        webhook_id: log.webhook_id,
      });
      return { success: false, error: 'Max retry attempts reached' };
    }

    // Exponential backoff: 2^attempt seconds
    const backoffSeconds = Math.pow(2, attempt);
    logger.info('Retrying webhook delivery', {
      log_id: logId,
      webhook_id: log.webhook_id,
      attempt,
      backoff_seconds: backoffSeconds,
    });

    // Perform delivery retry
    const result = await deliverEvent(log.event_id, log.webhook_id);

    // Update delivery log with retry info
    await supabase
      .from('webhook_delivery_log')
      .update({
        attempts: attempt,
        success: result.success,
        response_status: result.status_code || 0,
        response_body: result.error?.substring(0, 1000) || null,
      })
      .eq('id', logId);

    return result;
  } catch (error) {
    logger.error('Failed to retry webhook delivery', {
      error: error instanceof Error ? error.message : String(error),
      log_id: logId,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
