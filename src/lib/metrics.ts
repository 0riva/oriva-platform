// Task: T075 - Custom performance metrics
// Description: Track chat response time, knowledge search latency, token usage

interface MetricEvent {
  timestamp: number;
  value: number;
  tags?: Record<string, string>;
}

interface AggregatedMetrics {
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}

/**
 * Performance metrics collector
 * Tracks custom application metrics beyond Vercel's default monitoring
 */
class MetricsCollector {
  private metrics: Map<string, MetricEvent[]>;
  private readonly maxEvents = 1000;

  constructor() {
    this.metrics = new Map();
  }

  /**
   * Record a metric value
   */
  record(name: string, value: number, tags?: Record<string, string>): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const events = this.metrics.get(name)!;
    events.push({
      timestamp: Date.now(),
      value,
      tags,
    });

    // Keep only recent events
    if (events.length > this.maxEvents) {
      events.shift();
    }
  }

  /**
   * Get aggregated statistics for a metric
   */
  getStats(name: string, sinceMs?: number): AggregatedMetrics | null {
    const events = this.metrics.get(name);
    if (!events || events.length === 0) {
      return null;
    }

    // Filter by time window if specified
    let filteredEvents = events;
    if (sinceMs) {
      const cutoff = Date.now() - sinceMs;
      filteredEvents = events.filter(e => e.timestamp > cutoff);
    }

    if (filteredEvents.length === 0) {
      return null;
    }

    // Calculate statistics
    const values = filteredEvents.map(e => e.value).sort((a, b) => a - b);
    const count = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    const min = values[0];
    const max = values[count - 1];
    const avg = sum / count;

    // Calculate percentiles
    const p50 = values[Math.floor(count * 0.50)];
    const p95 = values[Math.floor(count * 0.95)];
    const p99 = values[Math.floor(count * 0.99)];

    return {
      count,
      sum,
      min,
      max,
      avg,
      p50,
      p95,
      p99,
    };
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Record<string, AggregatedMetrics> {
    const result: Record<string, AggregatedMetrics> = {};

    for (const [name, _] of this.metrics) {
      const stats = this.getStats(name);
      if (stats) {
        result[name] = stats;
      }
    }

    return result;
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
  }

  /**
   * Clear old events (older than 1 hour)
   */
  cleanup(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;

    for (const [name, events] of this.metrics) {
      const filtered = events.filter(e => e.timestamp > oneHourAgo);
      if (filtered.length === 0) {
        this.metrics.delete(name);
      } else {
        this.metrics.set(name, filtered);
      }
    }
  }
}

// Singleton instance
const metricsCollector = new MetricsCollector();

// Periodic cleanup (every 5 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(() => metricsCollector.cleanup(), 5 * 60 * 1000);
}

// Export convenience functions

/**
 * Track chat response time (T075)
 */
export function trackChatResponseTime(durationMs: number, metadata?: {
  model?: string;
  tokenCount?: number;
  conversationId?: string;
}): void {
  metricsCollector.record('chat.response_time', durationMs, {
    model: metadata?.model || 'unknown',
  });

  if (metadata?.tokenCount) {
    metricsCollector.record('chat.tokens_generated', metadata.tokenCount, {
      model: metadata?.model || 'unknown',
    });
  }

  // Track slow responses (> 5s)
  if (durationMs > 5000) {
    metricsCollector.record('chat.slow_response', 1, {
      duration: durationMs.toFixed(0),
    });
  }
}

/**
 * Track knowledge search latency (T075)
 */
export function trackKnowledgeSearchLatency(durationMs: number, metadata?: {
  resultCount?: number;
  queryLength?: number;
  category?: string;
}): void {
  metricsCollector.record('knowledge.search_latency', durationMs, {
    category: metadata?.category || 'general',
  });

  if (metadata?.resultCount !== undefined) {
    metricsCollector.record('knowledge.results_returned', metadata.resultCount);
  }

  // Track slow searches (> 1s)
  if (durationMs > 1000) {
    metricsCollector.record('knowledge.slow_search', 1, {
      duration: durationMs.toFixed(0),
    });
  }
}

/**
 * Track token usage (T075)
 */
export function trackTokenUsage(tokens: number, metadata?: {
  model?: string;
  operation?: 'chat' | 'completion' | 'embedding';
}): void {
  metricsCollector.record('ai.tokens_used', tokens, {
    model: metadata?.model || 'unknown',
    operation: metadata?.operation || 'chat',
  });
}

/**
 * Track API response time
 */
export function trackAPIResponseTime(endpoint: string, durationMs: number): void {
  metricsCollector.record('api.response_time', durationMs, {
    endpoint,
  });

  // Track slow API calls (> 3s)
  if (durationMs > 3000) {
    metricsCollector.record('api.slow_response', 1, {
      endpoint,
      duration: durationMs.toFixed(0),
    });
  }
}

/**
 * Track database query time
 */
export function trackDatabaseQueryTime(queryName: string, durationMs: number): void {
  metricsCollector.record('database.query_time', durationMs, {
    query: queryName,
  });

  // Track slow queries (> 500ms)
  if (durationMs > 500) {
    metricsCollector.record('database.slow_query', 1, {
      query: queryName,
      duration: durationMs.toFixed(0),
    });
  }
}

/**
 * Track rate limit violations
 */
export function trackRateLimitViolation(userId: string, tier: string): void {
  metricsCollector.record('ratelimit.violation', 1, {
    tier,
  });
}

/**
 * Track authentication events
 */
export function trackAuthEvent(event: 'login' | 'register' | 'logout' | 'refresh', success: boolean): void {
  metricsCollector.record(`auth.${event}`, success ? 1 : 0);
}

/**
 * Get performance metrics summary
 */
export function getMetricsSummary(windowMs?: number): Record<string, AggregatedMetrics> {
  const summary: Record<string, AggregatedMetrics> = {};

  // Get stats for key metrics
  const metricNames = [
    'chat.response_time',
    'knowledge.search_latency',
    'ai.tokens_used',
    'api.response_time',
    'database.query_time',
  ];

  for (const name of metricNames) {
    const stats = metricsCollector.getStats(name, windowMs);
    if (stats) {
      summary[name] = stats;
    }
  }

  return summary;
}

/**
 * Get all metrics
 */
export function getAllMetrics(): Record<string, AggregatedMetrics> {
  return metricsCollector.getAllMetrics();
}

/**
 * Clear all metrics (for testing)
 */
export function clearMetrics(): void {
  metricsCollector.clear();
}

/**
 * Middleware to track API response times
 */
export function withMetrics<T extends (...args: any[]) => Promise<any>>(
  name: string,
  handler: T
): T {
  return (async (...args: any[]) => {
    const startTime = Date.now();

    try {
      const result = await handler(...args);
      const duration = Date.now() - startTime;
      trackAPIResponseTime(name, duration);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      trackAPIResponseTime(name, duration);
      throw error;
    }
  }) as T;
}

/**
 * Export metrics in Prometheus format
 */
export function getPrometheusMetrics(): string {
  const metrics = metricsCollector.getAllMetrics();
  const lines: string[] = [];

  for (const [name, stats] of Object.entries(metrics)) {
    const safeName = name.replace(/\./g, '_');

    lines.push(`# HELP ${safeName}_count Total count`);
    lines.push(`# TYPE ${safeName}_count counter`);
    lines.push(`${safeName}_count ${stats.count}`);
    lines.push('');

    lines.push(`# HELP ${safeName}_sum Total sum`);
    lines.push(`# TYPE ${safeName}_sum counter`);
    lines.push(`${safeName}_sum ${stats.sum}`);
    lines.push('');

    lines.push(`# HELP ${safeName}_avg Average value`);
    lines.push(`# TYPE ${safeName}_avg gauge`);
    lines.push(`${safeName}_avg ${stats.avg.toFixed(2)}`);
    lines.push('');

    lines.push(`# HELP ${safeName}_p95 95th percentile`);
    lines.push(`# TYPE ${safeName}_p95 gauge`);
    lines.push(`${safeName}_p95 ${stats.p95.toFixed(2)}`);
    lines.push('');

    lines.push(`# HELP ${safeName}_p99 99th percentile`);
    lines.push(`# TYPE ${safeName}_p99 gauge`);
    lines.push(`${safeName}_p99 ${stats.p99.toFixed(2)}`);
    lines.push('');
  }

  return lines.join('\n');
}