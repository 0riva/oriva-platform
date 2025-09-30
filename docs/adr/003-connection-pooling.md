# ADR-003: Database Connection Pooling Strategy

**Status**: Accepted
**Date**: 2025-09-29
**Deciders**: Platform Team
**Related**: ADR-001 (Serverless), ADR-002 (Supabase), T068

## Context

Serverless functions create a unique challenge for database connections:

**The Problem**:
- Each function invocation may create new database connections
- Functions scale automatically (0 to N instances)
- PostgreSQL has connection limits (Supabase Pro: ~500)
- Connection setup has latency overhead (~50-200ms)
- Without pooling: Connection exhaustion and performance degradation

**Traditional Solutions**:
- Long-lived connections: Not possible in serverless (stateless)
- PgBouncer: Requires separate deployment and management
- Application-level pooling: Complex in serverless environment

## Decision

We will implement a **two-layer connection pooling strategy**:

### Layer 1: Supabase Connection Pooler (Supavisor)

**What**: Built-in connection pooling service provided by Supabase
**Mode**: Transaction mode (connection per transaction)
**Configuration**:
- Endpoint: `[project].pooler.supabase.com:6543`
- Pool mode: Transaction
- Max connections: Managed by Supabase based on plan

**Benefits**:
- Managed service (no infrastructure)
- Automatic connection lifecycle
- Optimized for serverless workloads

### Layer 2: Function-Level Connection Pool

**What**: In-memory connection pool per function instance
**Implementation**: Custom pool configuration in `api/config/supabase.ts`

**Configuration**:
```typescript
{
  max: 20,              // Max connections per function instance
  min: 2,               // Min idle connections to maintain
  idleTimeoutMillis: 30000,   // 30s idle timeout
  connectionTimeoutMillis: 5000,  // 5s connect timeout
  maxRetries: 3         // Retry attempts
}
```

**Tuneable via Environment Variables**:
- `DB_POOL_MAX`: Maximum connections (default: 20)
- `DB_POOL_MIN`: Minimum idle connections (default: 2)
- `DB_IDLE_TIMEOUT`: Idle connection timeout (default: 30000ms)
- `DB_CONNECT_TIMEOUT`: Connection timeout (default: 5000ms)
- `DB_MAX_RETRIES`: Retry attempts (default: 3)

### Pool Sizing Strategy

**Per-Function Allocation**:
- Low-traffic functions: 10 connections
- Medium-traffic functions: 20 connections
- High-traffic (chat): 30 connections

**Calculation**:
```
Total connections = Function instances × Connections per instance
Example: 10 function instances × 20 connections = 200 total
Well below Supabase Pro limit of ~500
```

## Consequences

### Positive

✅ **Prevents Connection Exhaustion**
- Function-level pools limit per-instance connections
- Supabase pooler provides additional layer of protection
- Automatic cleanup of idle connections

✅ **Improved Performance**
- Connection reuse reduces latency (no setup overhead)
- Min pool size keeps warm connections ready
- Faster response times (50-200ms savings per query)

✅ **Cost Efficiency**
- Efficient use of database connections
- No separate pooling infrastructure to manage
- Scales with actual usage

✅ **Operational Visibility**
- Connection metrics exposed via `/api/health`
- Monitoring via custom DBPoolMonitor
- Alerting on high utilization (>80%)

✅ **Flexible Configuration**
- Environment-specific tuning (dev vs. prod)
- No code changes to adjust pool size
- Can scale up during traffic spikes

### Negative

⚠️ **Complexity**
- Two-layer pooling adds conceptual overhead
- Requires monitoring and tuning
- Mitigated by: Default configuration works for most cases

⚠️ **Cold Start Impact**
- First request creates new connections
- Adds 100-500ms to cold start time
- Mitigated by: Min pool size keeps connections warm

⚠️ **Memory Usage**
- Each connection consumes memory in function
- 20 connections ≈ 50-100MB overhead
- Mitigated by: Generous function memory allocation (1-2GB)

### Trade-offs Accepted

1. **Slight cold start penalty** for connection reuse benefits
2. **Memory overhead** for performance gains
3. **Configuration complexity** for production-grade reliability

## Implementation Notes

### Connection Pool Configuration

```typescript
// api/config/supabase.ts
export const CONNECTION_POOL_CONFIG = {
  max: parseInt(process.env.DB_POOL_MAX || '20', 10),
  min: parseInt(process.env.DB_POOL_MIN || '2', 10),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECT_TIMEOUT || '5000', 10),
  maxRetries: parseInt(process.env.DB_MAX_RETRIES || '3', 10),
};
```

### Monitoring Implementation

```typescript
// api/lib/dbMonitor.ts
export class DBPoolMonitor {
  recordAcquire(duration: number): void;
  recordRelease(): void;
  recordQueryTime(durationMs: number): void;
  isHealthy(): boolean;
  getMetrics(): PoolMetrics;
}
```

### Health Check Integration

```bash
curl https://api.oriva.ai/api/health | jq .checks.database

# Response includes:
# - Connection pool status
# - Active/idle connection counts
# - Average query time
# - Connection errors
```

### Alerting Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Pool utilization | >70% | >90% |
| Waiting requests | >10 | >20 |
| Connection errors | >1/min | >5/min |
| Avg query time | >300ms | >500ms |

## Configuration by Environment

### Development
```bash
DB_POOL_MAX=10      # Lower for local dev
DB_POOL_MIN=1       # Single warm connection
DB_IDLE_TIMEOUT=15000  # Faster cleanup
```

### Staging
```bash
DB_POOL_MAX=15      # Moderate traffic
DB_POOL_MIN=2
DB_IDLE_TIMEOUT=30000
```

### Production
```bash
DB_POOL_MAX=30      # High traffic capacity
DB_POOL_MIN=2       # Balance warmth vs. memory
DB_IDLE_TIMEOUT=30000
```

## Scaling Procedures

### When Pool Utilization >80%

1. **Verify it's not a slow query issue**:
   ```sql
   SELECT * FROM analytics_slow_operations LIMIT 10;
   ```

2. **Increase pool size**:
   ```bash
   vercel env add DB_POOL_MAX production  # Enter: 40
   vercel --prod
   ```

3. **Monitor for 15 minutes**:
   ```bash
   watch -n 10 'curl -s https://api.oriva.ai/api/health | jq .checks.database'
   ```

### When Connection Errors Spike

1. **Check Supabase dashboard** for database health
2. **Review connection pool metrics**
3. **Investigate slow queries** blocking connections
4. **Scale up pool size** if legitimate traffic

See [SCALING.md](../SCALING.md) for detailed procedures.

## Alternatives Considered

### 1. No Connection Pooling

**Approach**: Create new connection per request

**Pros**:
- Simplest implementation
- No pool management overhead

**Cons**:
- Connection setup latency (50-200ms per request)
- Connection exhaustion under load
- Poor database performance

**Rejected**: Unacceptable performance and reliability

### 2. External PgBouncer

**Approach**: Deploy PgBouncer as separate service

**Pros**:
- Battle-tested solution
- Fine-grained control
- Independent scaling

**Cons**:
- Additional infrastructure to manage
- Extra network hop (latency)
- Deployment complexity
- Additional cost

**Rejected**: Supabase pooler provides same benefits without overhead

### 3. Single Global Connection

**Approach**: One connection shared across all function invocations

**Pros**:
- Minimal connection count
- Simple implementation

**Cons**:
- Doesn't work in serverless (stateless)
- Connection bottleneck
- No concurrency

**Rejected**: Fundamentally incompatible with serverless

### 4. Serverless Aurora (AWS)

**Approach**: Use Aurora Serverless with Data API (HTTP-based)

**Pros**:
- No connection management needed
- HTTP-based (no connection pools)

**Cons**:
- AWS vendor lock-in
- Higher latency (HTTP overhead)
- Limited to AWS ecosystem
- More expensive

**Rejected**: Higher latency, AWS lock-in

## Performance Targets

- **Connection acquisition**: <10ms (p95)
- **Pool utilization**: <80%
- **Connection errors**: <0.1%
- **Query latency**: <100ms (p95)
- **Idle connection cleanup**: <30s

## Monitoring Dashboards

### Key Metrics to Watch

1. **Connection Pool Utilization**:
   ```bash
   curl https://api.oriva.ai/api/health | jq '.checks.database.pool_utilization'
   ```

2. **Waiting Requests**:
   - Count of requests waiting for connection
   - Should be <5 under normal load

3. **Connection Errors**:
   - Failed connection attempts
   - Should be near zero

4. **Query Performance**:
   ```sql
   SELECT * FROM analytics_slow_operations
   WHERE generation_time_ms > 500
   ORDER BY created_at DESC;
   ```

## Review Schedule

- **Weekly**: Review connection pool metrics
- **Monthly**: Tune pool size based on traffic patterns
- **Quarterly**: Comprehensive performance review
- **After incidents**: Post-mortem analysis and adjustment

## References

- [Supabase Connection Pooling Guide](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [PostgreSQL Connection Pooling](https://www.postgresql.org/docs/current/runtime-config-connection.html)
- [Serverless Database Patterns](https://aws.amazon.com/blogs/compute/serverless-database-patterns/)
- [SCALING.md](../SCALING.md) - Connection pool scaling procedures
- [MONITORING.md](../MONITORING.md) - Database monitoring dashboards