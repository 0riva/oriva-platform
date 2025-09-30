// Task: T069 - Database connection pool monitoring
// Description: Monitor and track database connection pool metrics

interface PoolMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  connectionErrors: number;
  lastErrorTimestamp?: number;
  averageQueryTime: number;
  slowQueries: number;
}

interface ConnectionEvent {
  type: 'acquire' | 'release' | 'error' | 'timeout';
  timestamp: number;
  duration?: number;
  error?: string;
}

/**
 * Database connection pool monitor
 * Tracks pool health and performance metrics
 */
export class DBPoolMonitor {
  private static instance: DBPoolMonitor;
  private metrics: PoolMetrics;
  private recentEvents: ConnectionEvent[];
  private readonly maxEvents = 100;
  private queryTimes: number[];
  private readonly maxQueryTimes = 1000;

  private constructor() {
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingRequests: 0,
      connectionErrors: 0,
      averageQueryTime: 0,
      slowQueries: 0,
    };
    this.recentEvents = [];
    this.queryTimes = [];
  }

  static getInstance(): DBPoolMonitor {
    if (!DBPoolMonitor.instance) {
      DBPoolMonitor.instance = new DBPoolMonitor();
    }
    return DBPoolMonitor.instance;
  }

  /**
   * Record connection acquisition
   */
  recordAcquire(duration: number): void {
    this.recordEvent({ type: 'acquire', timestamp: Date.now(), duration });
    this.metrics.activeConnections++;
    this.metrics.idleConnections = Math.max(0, this.metrics.idleConnections - 1);
  }

  /**
   * Record connection release
   */
  recordRelease(): void {
    this.recordEvent({ type: 'release', timestamp: Date.now() });
    this.metrics.activeConnections = Math.max(0, this.metrics.activeConnections - 1);
    this.metrics.idleConnections++;
  }

  /**
   * Record connection error
   */
  recordError(error: string): void {
    this.recordEvent({ type: 'error', timestamp: Date.now(), error });
    this.metrics.connectionErrors++;
    this.metrics.lastErrorTimestamp = Date.now();
  }

  /**
   * Record connection timeout
   */
  recordTimeout(duration: number): void {
    this.recordEvent({ type: 'timeout', timestamp: Date.now(), duration });
    this.metrics.connectionErrors++;
  }

  /**
   * Record query execution time
   */
  recordQueryTime(durationMs: number): void {
    this.queryTimes.push(durationMs);

    // Keep only recent query times
    if (this.queryTimes.length > this.maxQueryTimes) {
      this.queryTimes.shift();
    }

    // Track slow queries (> 1000ms)
    if (durationMs > 1000) {
      this.metrics.slowQueries++;
    }

    // Update average query time
    const sum = this.queryTimes.reduce((a, b) => a + b, 0);
    this.metrics.averageQueryTime = sum / this.queryTimes.length;
  }

  /**
   * Update pool size metrics
   */
  updatePoolSize(total: number, active: number, idle: number, waiting: number): void {
    this.metrics.totalConnections = total;
    this.metrics.activeConnections = active;
    this.metrics.idleConnections = idle;
    this.metrics.waitingRequests = waiting;
  }

  /**
   * Get current pool metrics
   */
  getMetrics(): PoolMetrics {
    return { ...this.metrics };
  }

  /**
   * Get recent connection events
   */
  getRecentEvents(count: number = 20): ConnectionEvent[] {
    return this.recentEvents.slice(-count);
  }

  /**
   * Check if pool is healthy
   */
  isHealthy(): boolean {
    const metrics = this.getMetrics();

    // Pool is unhealthy if:
    // - Too many connection errors (> 10 in recent history)
    // - Too many waiting requests (> 50% of total connections)
    // - Recent errors (within last 60 seconds)

    const recentErrors = this.recentEvents
      .filter(e => e.type === 'error' && Date.now() - e.timestamp < 60000)
      .length;

    if (recentErrors > 10) {
      return false;
    }

    if (metrics.waitingRequests > metrics.totalConnections * 0.5) {
      return false;
    }

    if (metrics.lastErrorTimestamp && Date.now() - metrics.lastErrorTimestamp < 60000) {
      const errorRate = metrics.connectionErrors / (this.recentEvents.length || 1);
      if (errorRate > 0.1) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get health status with details
   */
  getHealthStatus(): {
    healthy: boolean;
    metrics: PoolMetrics;
    warnings: string[];
  } {
    const metrics = this.getMetrics();
    const warnings: string[] = [];

    // Check for high error rate
    if (metrics.connectionErrors > 50) {
      warnings.push(`High error count: ${metrics.connectionErrors} errors`);
    }

    // Check for slow queries
    if (metrics.slowQueries > 100) {
      warnings.push(`High slow query count: ${metrics.slowQueries} slow queries`);
    }

    // Check for high average query time
    if (metrics.averageQueryTime > 500) {
      warnings.push(`High average query time: ${metrics.averageQueryTime.toFixed(2)}ms`);
    }

    // Check for waiting requests
    if (metrics.waitingRequests > 10) {
      warnings.push(`High waiting requests: ${metrics.waitingRequests} waiting`);
    }

    // Check pool utilization
    const utilization = metrics.totalConnections > 0
      ? (metrics.activeConnections / metrics.totalConnections) * 100
      : 0;

    if (utilization > 90) {
      warnings.push(`High pool utilization: ${utilization.toFixed(1)}%`);
    }

    return {
      healthy: this.isHealthy(),
      metrics,
      warnings,
    };
  }

  /**
   * Reset metrics (for testing or periodic resets)
   */
  resetMetrics(): void {
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingRequests: 0,
      connectionErrors: 0,
      averageQueryTime: 0,
      slowQueries: 0,
    };
    this.recentEvents = [];
    this.queryTimes = [];
  }

  private recordEvent(event: ConnectionEvent): void {
    this.recentEvents.push(event);

    // Keep only recent events
    if (this.recentEvents.length > this.maxEvents) {
      this.recentEvents.shift();
    }
  }
}

// Export singleton instance
export const dbMonitor = DBPoolMonitor.getInstance();

/**
 * Middleware to track query execution time
 */
export function withQueryMonitoring<T>(
  queryName: string,
  queryFn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();

  return queryFn()
    .then((result) => {
      const duration = Date.now() - startTime;
      dbMonitor.recordQueryTime(duration);

      if (duration > 1000) {
        console.warn(`Slow query detected: ${queryName} took ${duration}ms`);
      }

      return result;
    })
    .catch((error) => {
      const duration = Date.now() - startTime;
      dbMonitor.recordQueryTime(duration);
      dbMonitor.recordError(`Query ${queryName} failed: ${error.message}`);
      throw error;
    });
}

/**
 * Export metrics in Prometheus format (for future integration)
 */
export function getPrometheusMetrics(): string {
  const metrics = dbMonitor.getMetrics();

  return `
# HELP db_pool_total_connections Total database connections
# TYPE db_pool_total_connections gauge
db_pool_total_connections ${metrics.totalConnections}

# HELP db_pool_active_connections Active database connections
# TYPE db_pool_active_connections gauge
db_pool_active_connections ${metrics.activeConnections}

# HELP db_pool_idle_connections Idle database connections
# TYPE db_pool_idle_connections gauge
db_pool_idle_connections ${metrics.idleConnections}

# HELP db_pool_waiting_requests Waiting connection requests
# TYPE db_pool_waiting_requests gauge
db_pool_waiting_requests ${metrics.waitingRequests}

# HELP db_pool_connection_errors Total connection errors
# TYPE db_pool_connection_errors counter
db_pool_connection_errors ${metrics.connectionErrors}

# HELP db_pool_average_query_time Average query execution time in milliseconds
# TYPE db_pool_average_query_time gauge
db_pool_average_query_time ${metrics.averageQueryTime}

# HELP db_pool_slow_queries Total number of slow queries (>1000ms)
# TYPE db_pool_slow_queries counter
db_pool_slow_queries ${metrics.slowQueries}
  `.trim();
}