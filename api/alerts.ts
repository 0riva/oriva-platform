// Task: T077 - Alerts endpoint for monitoring dashboard
// Description: View recent alerts and alert summary

import { VercelRequest, VercelResponse } from '@vercel/node';
import { checkAlerts, getRecentAlerts, getAlertSummary, getAlertHealthStatus } from '../src/lib/alerts';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    // Only allow GET requests
    if (req.method !== 'GET') {
      res.status(405).json({
        error: 'Method not allowed',
        code: 'METHOD_NOT_ALLOWED',
      });
      return;
    }

    // Parse query parameters
    const action = (req.query.action as string) || 'status';
    const windowMs = parseInt((req.query.window_ms as string) || '3600000', 10); // Default 1 hour

    switch (action) {
      case 'status': {
        // Get current alert health status
        const status = getAlertHealthStatus();
        const summary = getAlertSummary(15 * 60 * 1000);

        res.status(200).json({
          status: status.healthy ? 'healthy' : 'unhealthy',
          timestamp: new Date().toISOString(),
          alerts: {
            critical: status.criticalAlerts,
            errors: status.errorAlerts,
            warnings: status.warningAlerts,
          },
          summary,
          last_check: new Date(status.lastCheckTime).toISOString(),
        });
        break;
      }

      case 'recent': {
        // Get recent alerts
        const alerts = getRecentAlerts(windowMs);

        res.status(200).json({
          timestamp: new Date().toISOString(),
          window_ms: windowMs,
          alerts,
          total: alerts.length,
        });
        break;
      }

      case 'check': {
        // Trigger immediate alert check
        const triggered = checkAlerts(5 * 60 * 1000);

        res.status(200).json({
          timestamp: new Date().toISOString(),
          triggered_alerts: triggered,
          total: triggered.length,
        });
        break;
      }

      case 'summary': {
        // Get alert summary by severity
        const summary = getAlertSummary(windowMs);

        res.status(200).json({
          timestamp: new Date().toISOString(),
          window_ms: windowMs,
          summary,
          total: Object.values(summary).reduce((a, b) => a + b, 0),
        });
        break;
      }

      default:
        res.status(400).json({
          error: 'Invalid action',
          code: 'INVALID_ACTION',
          valid_actions: ['status', 'recent', 'check', 'summary'],
        });
    }
  } catch (error) {
    console.error('Alert endpoint error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      message: (error as Error).message,
    });
  }
}