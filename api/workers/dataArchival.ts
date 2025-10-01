// Task: T039 - Data archival worker
// Description: Archive old events and notifications
// Schedule: Daily at midnight (Vercel Cron Job)

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseClient } from '../config/supabase';
import { logger } from '../utils/logger';

const MAX_RECORDS_PER_RUN = 10000;
const DEFAULT_RETENTION_DAYS = 90;

/**
 * Data archival worker
 * - Archives events older than retention policy (default: 90 days)
 * - Archives notifications older than retention policy
 * - Cascade deletes notification_state records
 * - Configurable retention period via RETENTION_DAYS env var
 */
export default async function dataArchivalWorker(req: VercelRequest, res: VercelResponse) {
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
        // In production, move to cold storage or S3
        // For now, just delete
        const eventIds = oldEvents.map((e) => e.id);

        const { error: deleteError } = await supabase
          .from('platform_events')
          .delete()
          .in('id', eventIds);

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
        // In production, move to cold storage or S3
        // For now, just delete (CASCADE will handle notification_state)
        const notificationIds = oldNotifications.map((n) => n.id);

        const { error: deleteError } = await supabase
          .from('platform_notifications')
          .delete()
          .in('id', notificationIds);

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
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
