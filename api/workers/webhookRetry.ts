// Task: T037 - Webhook retry worker
// Description: Retry failed webhook deliveries with exponential backoff
// Schedule: Every 60 seconds (Vercel Cron Job)

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseClient } from '../config/supabase';
import { logger } from '../utils/logger';
import { retryWebhookDelivery } from '../services/webhookDelivery';

const MAX_RETRIES = 5;
const MAX_RETRIES_PER_RUN = 100;

/**
 * Webhook retry worker
 * - Queries webhook_delivery_log for failed deliveries
 * - Checks exponential backoff timing (1s, 2s, 4s, 8s, 16s)
 * - Retries up to 5 times per webhook
 * - Disables webhooks after 100 consecutive failures
 */
export default async function webhookRetryWorker(req: VercelRequest, res: VercelResponse) {
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
      res.status(500).json({ error: 'Failed to fetch delivery logs' });
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
        const attempt = delivery.attempts + 1;

        // Calculate exponential backoff delay: 2^attempt seconds
        const backoffSeconds = Math.pow(2, delivery.attempts);
        const deliveryAge = Date.now() - new Date(delivery.created_at).getTime();
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
          await supabase
            .from('app_webhooks')
            .update({ is_active: false })
            .eq('id', delivery.webhook_id);

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
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
