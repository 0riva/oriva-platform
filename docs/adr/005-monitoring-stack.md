# ADR-005: Monitoring and Observability Stack

**Status**: Accepted
**Date**: 2025-09-29
**Deciders**: Platform Team
**Related**: T073-T079 (Monitoring & Observability Phase)

## Context

The Oriva Platform requires comprehensive monitoring to:
- Detect and respond to performance degradation
- Track SLO compliance (99.9% availability, <1s p95 response time)
- Debug production issues quickly
- Optimize costs and resource usage
- Understand user behavior and system health

**Requirements**:
- Real user monitoring (RUM)
- Error tracking and alerting
- Performance metrics (custom + standard)
- Database and infrastructure monitoring
- Cost tracking (AI tokens, database usage)
- Minimal performance overhead

## Decision

We will implement a **multi-layered monitoring stack** combining managed services and custom instrumentation:

### Layer 1: Vercel Analytics (Infrastructure)

**Purpose**: Function-level monitoring
**Includes**:
- Function invocations and response times
- Error rates (4xx, 5xx)
- Regional distribution
- Cold start frequency
- Memory and CPU usage

**Access**: Vercel Dashboard → Analytics

### Layer 2: Vercel Speed Insights (User Experience)

**Purpose**: Real user monitoring (RUM)
**Includes**:
- Core Web Vitals (LCP, FID, CLS)
- Actual user response times
- Geographic performance
- Device/browser breakdown

**Access**: Vercel Dashboard → Speed Insights

### Layer 3: Sentry (Error Tracking)

**Purpose**: Error monitoring and debugging
**Includes**:
- Error tracking with stack traces
- Performance transaction monitoring
- Release tracking
- User context
- Breadcrumb trails

**Configuration**:
```typescript
Sentry.init({
  dsn: SENTRY_DSN,
  environment: SENTRY_ENVIRONMENT,
  release: SENTRY_RELEASE,
  tracesSampleRate: 0.1,  // 10% of transactions
  beforeSend: filterNonCriticalErrors,
});
```

### Layer 4: Custom Metrics (Domain-Specific)

**Purpose**: Application-specific performance tracking
**Implementation**: `api/lib/metrics.ts`

**Metrics Tracked**:
- Chat response time (p50, p95, p99)
- Knowledge search latency
- AI token usage
- Database query time
- Rate limit violations

**Storage**: In-memory with periodic aggregation
**Export**: Prometheus format via `/api/metrics`
**Access**: `/api/health` endpoint

### Layer 5: SQL Analytics (Database Performance)

**Purpose**: Historical performance analysis
**Implementation**: Supabase analytics views

**Views** (T076):
- `analytics_chat_performance`: Hourly chat metrics
- `analytics_knowledge_performance`: Search performance
- `analytics_user_activity`: User engagement
- `analytics_slo_compliance`: SLO tracking
- `analytics_token_usage`: Cost monitoring
- `analytics_slow_operations`: Performance debugging

**Access**: Supabase SQL Editor

### Layer 6: Alerting (Proactive Monitoring)

**Purpose**: Automated alert generation
**Implementation**: `api/lib/alerts.ts`

**Alert Thresholds** (T077):
- Chat p95 >3s: Critical
- Error rate >5%: Critical
- Knowledge search >1s: Warning
- DB queries >500ms: Error
- Rate limit violations >5%: Warning

**Delivery**:
- Console logging (all severities)
- Sentry (critical and error only)
- Future: PagerDuty, Slack integration

## Consequences

### Positive

✅ **Comprehensive Coverage**
- Infrastructure, application, and user metrics
- Full stack visibility from edge to database
- Multiple layers provide redundancy

✅ **Managed Services**
- Vercel and Sentry handle storage and infrastructure
- No monitoring infrastructure to maintain
- Automatic scaling with traffic

✅ **Cost Effective**
- Vercel Analytics included with platform
- Sentry free tier: 5K events/month
- Custom metrics: No external dependencies
- SQL analytics: No additional cost

✅ **Developer Experience**
- Centralized `/api/health` endpoint
- Dashboard for quick health checks
- API-first access for automation

✅ **Performance Overhead Minimal**
- Vercel analytics: Zero overhead (edge)
- Sentry: <1ms per request
- Custom metrics: In-memory, no I/O
- SQL views: Query-time aggregation

✅ **Actionable Insights**
- Real-time alerting on issues
- Historical trends for optimization
- Cost tracking for budget management
- SLO compliance monitoring

### Negative

⚠️ **Multiple Tools**
- Different interfaces to check
- Context switching between dashboards
- Mitigated by: Centralized `/api/health`, unified alerting

⚠️ **Data Retention Limits**
- Sentry free tier: 30 days
- Custom metrics: In-memory only (no persistence)
- Mitigated by: SQL analytics for long-term storage

⚠️ **Sampling Required**
- Sentry traces: 10% sample rate
- Some issues may be missed
- Mitigated by: 100% error capture, strategic sampling

⚠️ **Configuration Complexity**
- Multiple services to configure
- Environment-specific setup
- Mitigated by: Infrastructure as code, documentation

### Trade-offs Accepted

1. **Multiple monitoring tools** for comprehensive coverage
2. **In-memory custom metrics** for performance
3. **Sampling on transactions** to control costs

## Implementation Details

### Custom Metrics Collection

```typescript
// Track chat response time
trackChatResponseTime(durationMs, {
  model: 'gpt-4',
  tokenCount: 1234,
});

// Track knowledge search
trackKnowledgeSearchLatency(durationMs, {
  resultCount: 5,
  category: 'dating',
});

// Track token usage
trackTokenUsage(tokens, {
  model: 'gpt-4',
  operation: 'chat',
});
```

### Health Check Endpoint

```bash
curl https://api.oriva.ai/api/health

# Response includes:
{
  "status": "healthy",
  "checks": {
    "database": "healthy",
    "environment": "healthy",
    "alerts": "healthy"
  },
  "alerts": {
    "critical": 0,
    "errors": 0,
    "warnings": 1
  },
  "metrics": {
    "chat_response_time_p95": 854,
    "knowledge_search_latency_avg": 123,
    "tokens_used_total": 12450
  }
}
```

### SQL Analytics Queries

```sql
-- Check SLO compliance
SELECT * FROM analytics_slo_compliance
WHERE hour > NOW() - INTERVAL '24 hours';

-- Identify slow operations
SELECT * FROM analytics_slow_operations
ORDER BY generation_time_ms DESC LIMIT 10;

-- Monitor costs
SELECT * FROM analytics_token_usage
WHERE day > NOW() - INTERVAL '7 days';
```

## Monitoring Workflows

### Daily Health Check

```bash
# Quick system health
curl https://api.oriva.ai/api/health | jq

# Check for alerts
curl https://api.oriva.ai/api/alerts?action=status | jq

# Review Sentry for errors
# Visit Sentry dashboard
```

### Weekly Performance Review

```sql
-- SLO compliance
SELECT * FROM analytics_slo_compliance
WHERE hour > NOW() - INTERVAL '7 days';

-- Cost trends
SELECT day, SUM(estimated_cost_usd) as daily_cost
FROM analytics_token_usage
WHERE day > NOW() - INTERVAL '7 days'
GROUP BY day;
```

### Incident Investigation

1. Check `/api/health` for system status
2. Review `/api/alerts` for recent alerts
3. Check Sentry for error patterns
4. Query SQL analytics for historical context
5. Review Vercel logs for detailed traces

## Alert Response Procedures

### Critical: Response Time >3s

1. Check `/api/health` metrics
2. Query `analytics_slow_operations`
3. Review database connection pool
4. Check external AI provider status
5. Scale resources if needed (see SCALING.md)

### Error: High Error Rate (>5%)

1. Check Sentry for error patterns
2. Review recent deployments
3. Check database connectivity
4. Verify environment variables
5. Rollback if bad deployment (see ROLLBACK.md)

See [MONITORING.md](../MONITORING.md) for complete runbook.

## Alternatives Considered

### 1. DataDog APM

**Pros**:
- Comprehensive all-in-one solution
- Excellent visualization
- Powerful querying

**Cons**:
- Expensive ($31/host/month)
- Overkill for current scale
- Additional vendor to manage

**Rejected**: Cost not justified for launch scale

### 2. CloudWatch (AWS)

**Pros**:
- Deep AWS integration
- Powerful log aggregation

**Cons**:
- Requires AWS infrastructure
- Steeper learning curve
- Not optimized for Vercel

**Rejected**: Platform mismatch (not using AWS)

### 3. Self-Hosted Prometheus + Grafana

**Pros**:
- Full control
- No vendor costs
- Industry standard

**Cons**:
- Infrastructure to maintain
- Setup complexity
- Storage management
- Team expertise required

**Rejected**: Operational overhead too high

### 4. Custom Metrics Only (No External Services)

**Pros**:
- Maximum simplicity
- No external dependencies
- Zero external costs

**Cons**:
- No error tracking with stack traces
- No real user monitoring
- Limited retention
- No alerting infrastructure

**Rejected**: Insufficient visibility for production

## Cost Analysis

**Monthly Costs**:
- Vercel Analytics: $0 (included)
- Vercel Speed Insights: $0 (included)
- Sentry: $0 (free tier, <5K events/month)
- Custom metrics: $0 (in-memory)
- SQL analytics: $0 (Supabase included)

**Total**: $0/month at launch scale

**Future Growth**:
- Sentry Team ($26/month): When >5K events/month
- Additional Vercel features: As needed

## Performance SLOs

| Metric | Target | Measurement |
|--------|--------|-------------|
| Availability | 99.9% | 30 days |
| Response time (p95) | <1000ms | 24 hours |
| Response time (p99) | <3000ms | 24 hours |
| Error rate | <1% | 24 hours |

Tracked via `analytics_slo_compliance` view.

## Review Schedule

- **Daily**: Check `/api/health` and `/api/alerts`
- **Weekly**: Review Sentry errors and SQL analytics
- **Monthly**: SLO compliance, cost analysis
- **Quarterly**: Stack evaluation, tool effectiveness

## References

- [Vercel Analytics](https://vercel.com/docs/analytics)
- [Sentry Documentation](https://docs.sentry.io)
- [Prometheus Best Practices](https://prometheus.io/docs/practices/)
- [MONITORING.md](../MONITORING.md) - Complete monitoring runbook
- [SCALING.md](../SCALING.md) - Scaling based on metrics