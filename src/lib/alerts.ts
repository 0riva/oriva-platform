// Task: T077 - Alerting rules configuration
// Description: Performance monitoring and automated alerting

import { getAllMetrics, getMetricsSummary } from './metrics';
import { captureMessage } from './sentry';
import type { AggregatedMetrics } from './metrics';

// Alert severity levels
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

// Alert notification interface
export interface Alert {
  severity: AlertSeverity;
  metric: string;
  message: string;
  currentValue: number;
  threshold: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

// Alert thresholds configuration
export const ALERT_THRESHOLDS = {
  // Response time thresholds (milliseconds)
  responseTime: {
    warning: 1000,  // p95 > 1s
    critical: 3000, // p95 > 3s
  },

  // Error rate thresholds (percentage)
  errorRate: {
    warning: 1,     // > 1%
    critical: 5,    // > 5%
  },

  // Knowledge search latency (milliseconds)
  knowledgeSearchLatency: {
    warning: 500,   // > 500ms
    critical: 1000, // > 1s
  },

  // Database query time (milliseconds)
  databaseQueryTime: {
    warning: 300,   // > 300ms
    critical: 500,  // > 500ms
  },

  // Rate limit violations (percentage)
  rateLimitViolations: {
    warning: 2,     // > 2%
    critical: 5,    // > 5%
  },

  // Token usage (per request average)
  tokenUsage: {
    warning: 2000,  // > 2k tokens/request
    critical: 4000, // > 4k tokens/request
  },
} as const;

/**
 * Alert manager for monitoring and notifications
 */
class AlertManager {
  private recentAlerts: Alert[] = [];
  private readonly maxAlerts = 100;
  private readonly alertCooldown = 5 * 60 * 1000; // 5 minutes
  private lastAlertTime = new Map<string, number>();

  /**
   * Check if an alert should be suppressed due to cooldown
   */
  private shouldSuppress(metric: string): boolean {
    const lastAlert = this.lastAlertTime.get(metric);
    if (!lastAlert) {
      return false;
    }

    const timeSinceLastAlert = Date.now() - lastAlert;
    return timeSinceLastAlert < this.alertCooldown;
  }

  /**
   * Record an alert
   */
  private recordAlert(alert: Alert): void {
    this.recentAlerts.push(alert);
    this.lastAlertTime.set(alert.metric, alert.timestamp);

    // Keep only recent alerts
    if (this.recentAlerts.length > this.maxAlerts) {
      this.recentAlerts.shift();
    }

    // Send to monitoring systems
    this.notifyAlert(alert);
  }

  /**
   * Send alert notification
   */
  private notifyAlert(alert: Alert): void {
    // Log to console
    const logLevel = alert.severity === 'critical' || alert.severity === 'error' ? 'error' : 'warn';
    console[logLevel](`[ALERT ${alert.severity.toUpperCase()}] ${alert.message}`, {
      metric: alert.metric,
      currentValue: alert.currentValue,
      threshold: alert.threshold,
      metadata: alert.metadata,
    });

    // Send to Sentry for critical/error alerts
    if (alert.severity === 'critical' || alert.severity === 'error') {
      captureMessage(alert.message, alert.severity === 'critical' ? 'error' : 'warning', {
        metadata: {
          metric: alert.metric,
          currentValue: alert.currentValue,
          threshold: alert.threshold,
          ...alert.metadata,
        },
      });
    }
  }

  /**
   * Check response time metrics
   */
  checkResponseTime(metric: string, stats: AggregatedMetrics): void {
    const p95 = stats.p95;

    if (p95 > ALERT_THRESHOLDS.responseTime.critical) {
      if (!this.shouldSuppress(`${metric}.response_time.critical`)) {
        this.recordAlert({
          severity: 'critical',
          metric: `${metric}.response_time`,
          message: `Critical: ${metric} p95 response time is ${p95.toFixed(0)}ms (threshold: ${ALERT_THRESHOLDS.responseTime.critical}ms)`,
          currentValue: p95,
          threshold: ALERT_THRESHOLDS.responseTime.critical,
          timestamp: Date.now(),
          metadata: {
            avg: stats.avg,
            p99: stats.p99,
            count: stats.count,
          },
        });
      }
    } else if (p95 > ALERT_THRESHOLDS.responseTime.warning) {
      if (!this.shouldSuppress(`${metric}.response_time.warning`)) {
        this.recordAlert({
          severity: 'warning',
          metric: `${metric}.response_time`,
          message: `Warning: ${metric} p95 response time is ${p95.toFixed(0)}ms (threshold: ${ALERT_THRESHOLDS.responseTime.warning}ms)`,
          currentValue: p95,
          threshold: ALERT_THRESHOLDS.responseTime.warning,
          timestamp: Date.now(),
          metadata: {
            avg: stats.avg,
            p99: stats.p99,
            count: stats.count,
          },
        });
      }
    }
  }

  /**
   * Check knowledge search latency
   */
  checkKnowledgeSearchLatency(stats: AggregatedMetrics): void {
    const avg = stats.avg;

    if (avg > ALERT_THRESHOLDS.knowledgeSearchLatency.critical) {
      if (!this.shouldSuppress('knowledge.search_latency.critical')) {
        this.recordAlert({
          severity: 'critical',
          metric: 'knowledge.search_latency',
          message: `Critical: Knowledge search average latency is ${avg.toFixed(0)}ms (threshold: ${ALERT_THRESHOLDS.knowledgeSearchLatency.critical}ms)`,
          currentValue: avg,
          threshold: ALERT_THRESHOLDS.knowledgeSearchLatency.critical,
          timestamp: Date.now(),
          metadata: {
            p95: stats.p95,
            count: stats.count,
          },
        });
      }
    } else if (avg > ALERT_THRESHOLDS.knowledgeSearchLatency.warning) {
      if (!this.shouldSuppress('knowledge.search_latency.warning')) {
        this.recordAlert({
          severity: 'warning',
          metric: 'knowledge.search_latency',
          message: `Warning: Knowledge search average latency is ${avg.toFixed(0)}ms (threshold: ${ALERT_THRESHOLDS.knowledgeSearchLatency.warning}ms)`,
          currentValue: avg,
          threshold: ALERT_THRESHOLDS.knowledgeSearchLatency.warning,
          timestamp: Date.now(),
          metadata: {
            p95: stats.p95,
            count: stats.count,
          },
        });
      }
    }
  }

  /**
   * Check database query time
   */
  checkDatabaseQueryTime(stats: AggregatedMetrics): void {
    const avg = stats.avg;

    if (avg > ALERT_THRESHOLDS.databaseQueryTime.critical) {
      if (!this.shouldSuppress('database.query_time.critical')) {
        this.recordAlert({
          severity: 'error',
          metric: 'database.query_time',
          message: `Error: Database average query time is ${avg.toFixed(0)}ms (threshold: ${ALERT_THRESHOLDS.databaseQueryTime.critical}ms)`,
          currentValue: avg,
          threshold: ALERT_THRESHOLDS.databaseQueryTime.critical,
          timestamp: Date.now(),
          metadata: {
            p95: stats.p95,
            count: stats.count,
          },
        });
      }
    } else if (avg > ALERT_THRESHOLDS.databaseQueryTime.warning) {
      if (!this.shouldSuppress('database.query_time.warning')) {
        this.recordAlert({
          severity: 'warning',
          metric: 'database.query_time',
          message: `Warning: Database average query time is ${avg.toFixed(0)}ms (threshold: ${ALERT_THRESHOLDS.databaseQueryTime.warning}ms)`,
          currentValue: avg,
          threshold: ALERT_THRESHOLDS.databaseQueryTime.warning,
          timestamp: Date.now(),
          metadata: {
            p95: stats.p95,
            count: stats.count,
          },
        });
      }
    }
  }

  /**
   * Check token usage
   */
  checkTokenUsage(stats: AggregatedMetrics): void {
    const avg = stats.avg;

    if (avg > ALERT_THRESHOLDS.tokenUsage.critical) {
      if (!this.shouldSuppress('ai.tokens_used.critical')) {
        this.recordAlert({
          severity: 'warning',
          metric: 'ai.tokens_used',
          message: `Warning: Average token usage is ${avg.toFixed(0)} tokens/request (threshold: ${ALERT_THRESHOLDS.tokenUsage.critical})`,
          currentValue: avg,
          threshold: ALERT_THRESHOLDS.tokenUsage.critical,
          timestamp: Date.now(),
          metadata: {
            total: stats.sum,
            count: stats.count,
          },
        });
      }
    } else if (avg > ALERT_THRESHOLDS.tokenUsage.warning) {
      if (!this.shouldSuppress('ai.tokens_used.warning')) {
        this.recordAlert({
          severity: 'info',
          metric: 'ai.tokens_used',
          message: `Info: Average token usage is ${avg.toFixed(0)} tokens/request (threshold: ${ALERT_THRESHOLDS.tokenUsage.warning})`,
          currentValue: avg,
          threshold: ALERT_THRESHOLDS.tokenUsage.warning,
          timestamp: Date.now(),
          metadata: {
            total: stats.sum,
            count: stats.count,
          },
        });
      }
    }
  }

  /**
   * Run all alert checks
   */
  checkAllMetrics(windowMs = 5 * 60 * 1000): Alert[] {
    const metrics = getMetricsSummary(windowMs);
    const triggeredAlerts: Alert[] = [];

    // Check chat response time
    if (metrics['chat.response_time']) {
      this.checkResponseTime('chat', metrics['chat.response_time']);
    }

    // Check API response time
    if (metrics['api.response_time']) {
      this.checkResponseTime('api', metrics['api.response_time']);
    }

    // Check knowledge search latency
    if (metrics['knowledge.search_latency']) {
      this.checkKnowledgeSearchLatency(metrics['knowledge.search_latency']);
    }

    // Check database query time
    if (metrics['database.query_time']) {
      this.checkDatabaseQueryTime(metrics['database.query_time']);
    }

    // Check token usage
    if (metrics['ai.tokens_used']) {
      this.checkTokenUsage(metrics['ai.tokens_used']);
    }

    // Return alerts triggered in this check
    const cutoff = Date.now() - 1000; // Last second
    return this.recentAlerts.filter(a => a.timestamp > cutoff);
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(sinceMs = 60 * 60 * 1000): Alert[] {
    const cutoff = Date.now() - sinceMs;
    return this.recentAlerts.filter(a => a.timestamp > cutoff);
  }

  /**
   * Get alert summary by severity
   */
  getAlertSummary(sinceMs = 60 * 60 * 1000): Record<AlertSeverity, number> {
    const recent = this.getRecentAlerts(sinceMs);
    return {
      info: recent.filter(a => a.severity === 'info').length,
      warning: recent.filter(a => a.severity === 'warning').length,
      error: recent.filter(a => a.severity === 'error').length,
      critical: recent.filter(a => a.severity === 'critical').length,
    };
  }

  /**
   * Clear all alerts (for testing)
   */
  clearAlerts(): void {
    this.recentAlerts = [];
    this.lastAlertTime.clear();
  }
}

// Singleton instance
const alertManager = new AlertManager();

// Periodic alert checking (every 1 minute)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    alertManager.checkAllMetrics();
  }, 60 * 1000);
}

// Export alert functions

/**
 * Check all metrics and trigger alerts if needed
 */
export function checkAlerts(windowMs?: number): Alert[] {
  return alertManager.checkAllMetrics(windowMs);
}

/**
 * Get recent alerts
 */
export function getRecentAlerts(sinceMs?: number): Alert[] {
  return alertManager.getRecentAlerts(sinceMs);
}

/**
 * Get alert summary by severity
 */
export function getAlertSummary(sinceMs?: number): Record<AlertSeverity, number> {
  return alertManager.getAlertSummary(sinceMs);
}

/**
 * Clear all alerts (for testing)
 */
export function clearAlerts(): void {
  alertManager.clearAlerts();
}

/**
 * Get alert health status
 */
export function getAlertHealthStatus(): {
  healthy: boolean;
  criticalAlerts: number;
  errorAlerts: number;
  warningAlerts: number;
  lastCheckTime: number;
} {
  const summary = alertManager.getAlertSummary(15 * 60 * 1000); // Last 15 minutes

  return {
    healthy: summary.critical === 0 && summary.error === 0,
    criticalAlerts: summary.critical,
    errorAlerts: summary.error,
    warningAlerts: summary.warning,
    lastCheckTime: Date.now(),
  };
}