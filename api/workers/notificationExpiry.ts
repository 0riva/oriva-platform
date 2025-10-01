// Task: T038 - Notification expiry worker
// Description: Expire notifications past their expiry date
// Schedule: Every 5 minutes (Vercel Cron Job)

import { VercelRequest, VercelResponse } from '@vercel/node';
import { logger } from '../utils/logger';
import { expireNotifications } from '../services/notificationManager';

/**
 * Notification expiry worker
 * - Queries platform_notifications WHERE expires_at < NOW()
 * - Updates notification_state to status=dismissed
 * - Publishes notification.expired events
 * - Broadcasts expiry to WebSocket connections
 * - Limit: 1000 notifications per run
 */
export default async function notificationExpiryWorker(req: VercelRequest, res: VercelResponse) {
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
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
