# Oriva Platform Monitoring & Observability Runbook

**Version**: 1.0.0
**Last Updated**: 2025-09-29
**Owner**: Platform Team

## Overview

This runbook provides comprehensive guidance for monitoring, alerting, and responding to performance issues in the Oriva Platform backend infrastructure.

## Table of Contents

1. [Monitoring Stack](#monitoring-stack)
2. [Key Dashboards](#key-dashboards)
3. [Metrics Reference](#metrics-reference)
4. [Alert Response Procedures](#alert-response-procedures)
5. [Performance SLOs](#performance-slos)
6. [Debugging Workflows](#debugging-workflows)
7. [Common Issues](#common-issues)

## Monitoring Stack

### Components

| Component | Purpose | Access |
|-----------|---------|--------|
| **Vercel Analytics** | Function invocations, response times, errors | Vercel Dashboard |
| **Vercel Speed Insights** | Real user monitoring (RUM), Core Web Vitals | Vercel Dashboard |
| **Sentry** | Error tracking, performance monitoring, transactions | sentry.io |
| **Custom Metrics** | Domain-specific metrics (chat, knowledge, tokens) | `/api/health`, `/api/alerts` |
| **Supabase Dashboard** | Database performance, connection pool, queries | Supabase Console |
| **Analytics Views** | SQL-based performance dashboards | Supabase SQL Editor |

### Monitoring Endpoints

```bash
# Health check with metrics
curl https://api.oriva.ai/api/health | jq

# Alert status
curl https://api.oriva.ai/api/alerts?action=status | jq

# Recent alerts
curl https://api.oriva.ai/api/alerts?action=recent&window_ms=3600000 | jq

# Trigger alert check
curl https://api.oriva.ai/api/alerts?action=check | jq
```

## Key Dashboards

### 1. Vercel Analytics Dashboard

**Access**: Vercel Dashboard → Analytics

**Key Metrics**:
- Function invocations per minute
- Response time (p50, p95, p99)
- Error rate (4xx, 5xx)
- Cold start frequency
- Memory usage
- Regional distribution

**When to check**:
- During deployments
- After traffic spikes
- When investigating performance issues

### 2. Sentry Performance Dashboard

**Access**: sentry.io → Performance

**Key Views**:
- Transaction overview (endpoints, durations)
- Slow operations (outliers)
- Error rate by endpoint
- User-reported errors
- Release tracking

**When to check**:
- When error rate alerts trigger
- After new deployments
- User-reported issues

### 3. Custom Metrics Dashboard

**Access**: `GET /api/health`

**Response Example**:
```json
{
  "status": "healthy",
  "timestamp": "2025-09-29T12:00:00.000Z",
  "response_time_ms": 45,
  "checks": {
    "database": "healthy",
    "environment": "healthy",
    "alerts": "healthy"
  },
  "alerts": {
    "critical": 0,
    "errors": 0,
    "warnings": 1,
    "summary": {
      "info": 0,
      "warning": 1,
      "error": 0,
      "critical": 0
    }
  },
  "metrics": {
    "chat_response_time_p95": 854,
    "chat_response_time_avg": 542,
    "knowledge_search_latency_avg": 123,
    "api_response_time_p95": 234,
    "database_query_time_avg": 45,
    "tokens_used_total": 12450
  }
}
```

**When to check**:
- Real-time health monitoring
- Alert investigation
- Performance debugging

### 4. Supabase Performance Dashboard

**Access**: Supabase Console → Database → Performance

**Key Metrics**:
- Active connections
- Connection pool utilization
- Query execution time
- Slow queries (> 500ms)
- Cache hit rate
- Database CPU/memory usage

**When to check**:
- Database connection pool alerts
- Slow query investigations
- Capacity planning

### 5. Analytics SQL Views

**Access**: Supabase Console → SQL Editor

**Available Views**:

#### Chat Performance
```sql
SELECT * FROM analytics_chat_performance
WHERE hour > NOW() - INTERVAL '24 hours'
ORDER BY hour DESC
LIMIT 24;
```

#### Knowledge Search Performance
```sql
SELECT * FROM analytics_knowledge_performance
WHERE hour > NOW() - INTERVAL '24 hours'
ORDER BY hour DESC, category;
```

#### SLO Compliance
```sql
SELECT * FROM analytics_slo_compliance
WHERE hour > NOW() - INTERVAL '24 hours'
ORDER BY hour DESC;
```

#### Token Usage & Costs
```sql
SELECT * FROM analytics_token_usage
WHERE day > NOW() - INTERVAL '7 days'
ORDER BY day DESC, model;
```

#### Slow Operations
```sql
SELECT * FROM analytics_slow_operations
ORDER BY generation_time_ms DESC
LIMIT 20;
```

## Metrics Reference

### HTTP Metrics (Vercel Analytics)

| Metric | Description | Healthy | Warning | Critical |
|--------|-------------|---------|---------|----------|
| `http_req_duration_p95` | 95th percentile response time | < 1000ms | < 3000ms | > 3000ms |
| `http_req_duration_p99` | 99th percentile response time | < 1500ms | < 5000ms | > 5000ms |
| `http_req_failed` | HTTP failure rate | < 1% | < 5% | > 5% |
| `invocations_per_minute` | Request rate | Normal | High | Very High |

### Custom Metrics (api/lib/metrics.ts)

| Metric | Description | Healthy | Warning | Critical |
|--------|-------------|---------|---------|----------|
| `chat.response_time` | Chat API response time | < 1000ms | < 3000ms | > 3000ms |
| `chat.tokens_generated` | Tokens per chat response | < 1000 | < 2000 | > 4000 |
| `chat.slow_response` | Responses > 5s | 0 | < 5/min | > 10/min |
| `knowledge.search_latency` | Search query time | < 300ms | < 500ms | > 1000ms |
| `knowledge.slow_search` | Searches > 1s | 0 | < 5/min | > 10/min |
| `ai.tokens_used` | Total token consumption | Normal | High | Very High |
| `api.response_time` | API endpoint latency | < 500ms | < 1000ms | > 3000ms |
| `database.query_time` | Database query duration | < 100ms | < 300ms | > 500ms |
| `database.slow_query` | Queries > 500ms | 0 | < 10/min | > 20/min |
| `ratelimit.violation` | Rate limit hits (429) | < 1% | < 2% | > 5% |

### Database Metrics (Supabase)

| Metric | Description | Healthy | Warning | Critical |
|--------|-------------|---------|---------|----------|
| `db_pool_utilization` | Connection pool usage | < 70% | < 90% | > 90% |
| `db_pool_waiting_requests` | Queued connection requests | < 5 | < 20 | > 20 |
| `db_pool_average_query_time` | Average query execution | < 100ms | < 300ms | > 500ms |
| `db_cache_hit_rate` | Query cache efficiency | > 80% | > 60% | < 60% |

## Alert Response Procedures

### Alert Severity Levels

| Severity | Response Time | Escalation | Examples |
|----------|---------------|------------|----------|
| **Critical** | Immediate | Page on-call | p95 > 3s, error rate > 5%, DB down |
| **Error** | 15 minutes | Notify team | DB queries > 500ms, errors > 1% |
| **Warning** | 1 hour | Monitor | p95 > 1s, searches > 500ms |
| **Info** | 4 hours | Log only | Token usage high, cache miss rate |

### Critical Alert: High Response Time (p95 > 3s)

**Symptoms**:
- Chat API p95 response time > 3000ms
- Alert severity: Critical
- User impact: Slow chat responses, poor UX

**Immediate Actions**:

1. Check health endpoint for current metrics:
   ```bash
   curl https://api.oriva.ai/api/health | jq .metrics
   ```

2. Review Sentry performance dashboard for slow transactions

3. Check database connection pool:
   ```bash
   curl https://api.oriva.ai/api/health | jq .checks.database
   ```

4. Check for slow queries in Supabase:
   ```sql
   SELECT * FROM analytics_slow_operations
   ORDER BY generation_time_ms DESC
   LIMIT 10;
   ```

**Investigation Steps**:

1. Identify slow endpoint(s) from metrics
2. Check external API latency (OpenAI/Anthropic status pages)
3. Review recent deployments (potential regression)
4. Check for traffic spikes or unusual patterns

**Resolution**:

- **If database bottleneck**: Scale connection pool (see [SCALING.md](./SCALING.md))
- **If external API slow**: Implement circuit breaker or fallback
- **If code regression**: Rollback deployment
- **If traffic spike**: Scale function memory/timeout

**Post-incident**:
- Document root cause in incident report
- Update runbook if new patterns discovered
- Review and adjust alert thresholds if needed

### Error Alert: High Error Rate (> 5%)

**Symptoms**:
- HTTP error rate > 5%
- Alert severity: Critical/Error
- User impact: Failed requests, broken functionality

**Immediate Actions**:

1. Check recent alerts:
   ```bash
   curl https://api.oriva.ai/api/alerts?action=recent | jq
   ```

2. Review Sentry error dashboard for error patterns

3. Check Vercel function logs for error messages

4. Verify external service status:
   - Supabase status page
   - OpenAI status page
   - Anthropic status page

**Investigation Steps**:

1. Group errors by type and endpoint
2. Check error messages and stack traces
3. Review recent code changes
4. Check for database connection errors

**Resolution**:

- **If bad deployment**: Rollback immediately
- **If database issue**: Check connection pool, restart if needed
- **If external API down**: Implement fallback, notify users
- **If rate limiting**: Review rate limit config

### Warning Alert: Slow Knowledge Search (avg > 500ms)

**Symptoms**:
- Knowledge search average latency > 500ms
- Alert severity: Warning
- User impact: Slow search results

**Immediate Actions**:

1. Check search performance metrics:
   ```sql
   SELECT * FROM analytics_knowledge_performance
   WHERE hour > NOW() - INTERVAL '1 hour'
   ORDER BY hour DESC;
   ```

2. Review slow search queries in database

3. Check database load and connection pool

**Investigation Steps**:

1. Identify slow search patterns (category, query length)
2. Review database indexes on knowledge_entries table
3. Check for full-text search performance
4. Analyze query execution plans

**Resolution**:

- **If missing indexes**: Add indexes to knowledge_entries
- **If query optimization**: Optimize search query
- **If database load**: Scale database resources
- **If stale data**: Review caching strategy

### Warning Alert: High Token Usage

**Symptoms**:
- Average tokens/request > 2000
- Alert severity: Warning
- User impact: Higher costs, potential rate limits

**Investigation Steps**:

1. Check token usage by model:
   ```sql
   SELECT * FROM analytics_token_usage
   WHERE day > NOW() - INTERVAL '7 days'
   ORDER BY total_tokens DESC;
   ```

2. Review conversation length and complexity

3. Check for prompt engineering issues

4. Analyze token usage patterns by user tier

**Resolution**:

- **If prompt too long**: Optimize system prompts
- **If context too large**: Implement context pruning
- **If abuse**: Review rate limits by tier
- **If cost concern**: Switch to cheaper models for simple queries

## Performance SLOs

### Service Level Objectives

| Metric | Target | Measurement Window |
|--------|--------|-------------------|
| **Availability** | 99.9% uptime | 30 days |
| **Response Time (p95)** | < 1000ms | 24 hours |
| **Response Time (p99)** | < 3000ms | 24 hours |
| **Error Rate** | < 1% | 24 hours |
| **Database Uptime** | 99.95% | 30 days |
| **Knowledge Search Latency** | < 500ms avg | 24 hours |

### SLO Tracking Query

```sql
-- Check SLO compliance for last 24 hours
SELECT
  hour,
  p95_under_1s_percent,
  p99_under_3s_percent,
  avg_confidence_percent,
  p95_slo_status,
  p99_slo_status
FROM analytics_slo_compliance
WHERE hour > NOW() - INTERVAL '24 hours'
ORDER BY hour DESC;
```

### Error Budget

Based on 99.9% availability SLO:

- **Monthly downtime budget**: 43.2 minutes
- **Daily downtime budget**: 1.44 minutes
- **Hourly downtime budget**: 0.06 minutes (3.6 seconds)

Track error budget consumption:

```sql
SELECT
  DATE_TRUNC('day', created_at) as day,
  COUNT(*) as total_requests,
  COUNT(CASE WHEN confidence_score < 0.5 THEN 1 END) as failed_requests,
  ROUND(100.0 * COUNT(CASE WHEN confidence_score < 0.5 THEN 1 END) / COUNT(*), 2) as error_rate
FROM messages
WHERE role = 'assistant'
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY day DESC;
```

## Debugging Workflows

### Debugging Slow API Responses

1. **Identify the slow endpoint**:
   ```bash
   curl https://api.oriva.ai/api/health | jq .metrics
   ```

2. **Check Sentry transactions** for detailed timing:
   - Go to Sentry → Performance → Transactions
   - Filter by endpoint
   - Look for outliers and spans

3. **Review database queries**:
   ```sql
   SELECT * FROM analytics_slow_operations
   WHERE generation_time_ms > 3000
   ORDER BY created_at DESC
   LIMIT 20;
   ```

4. **Check connection pool status**:
   ```bash
   curl https://api.oriva.ai/api/health | jq .checks
   ```

5. **Profile the slow request**:
   - Enable detailed logging
   - Add timing instrumentation
   - Check external API latency

### Debugging High Error Rates

1. **Check recent errors in Sentry**:
   - Go to Sentry → Issues
   - Sort by frequency
   - Review error details and stack traces

2. **Review Vercel function logs**:
   ```bash
   vercel logs [deployment-url]
   ```

3. **Check database connectivity**:
   ```bash
   curl https://api.oriva.ai/api/health | jq .checks.database
   ```

4. **Analyze error patterns**:
   ```sql
   SELECT
     DATE_TRUNC('hour', created_at) as hour,
     COUNT(*) as total_errors
   FROM messages
   WHERE role = 'assistant'
     AND (confidence_score IS NULL OR confidence_score < 0.5)
     AND created_at > NOW() - INTERVAL '24 hours'
   GROUP BY hour
   ORDER BY hour DESC;
   ```

### Debugging Database Performance

1. **Check connection pool metrics**:
   ```bash
   curl https://api.oriva.ai/api/health
   ```

2. **Review slow queries**:
   ```sql
   SELECT
     query,
     calls,
     mean_exec_time,
     max_exec_time
   FROM pg_stat_statements
   ORDER BY mean_exec_time DESC
   LIMIT 10;
   ```

3. **Check for blocking queries**:
   ```sql
   SELECT
     pid,
     usename,
     state,
     query,
     age(clock_timestamp(), query_start) as age
   FROM pg_stat_activity
   WHERE state != 'idle'
   ORDER BY age DESC;
   ```

4. **Analyze connection pool**:
   - Review pool configuration in `api/config/supabase.ts`
   - Check for connection leaks
   - Monitor waiting requests

## Common Issues

### Issue: Database Connection Pool Exhausted

**Symptoms**:
- `db_pool_waiting_requests` > 20
- Slow API responses
- Timeouts on database queries

**Causes**:
- Traffic spike exceeding pool capacity
- Connection leaks (not properly closed)
- Slow queries holding connections

**Resolution**:
1. Increase `DB_POOL_MAX` environment variable (see [SCALING.md](./SCALING.md))
2. Review code for connection leaks
3. Optimize slow queries
4. Implement connection timeout

### Issue: High Chat Response Times

**Symptoms**:
- `chat.response_time` p95 > 3000ms
- User complaints about slow responses

**Causes**:
- OpenAI/Anthropic API latency
- Large context window
- Database query slow
- Network latency

**Resolution**:
1. Check external API status pages
2. Reduce context window size
3. Implement response streaming
4. Optimize database queries
5. Add caching for common responses

### Issue: Rate Limit Violations

**Symptoms**:
- High number of 429 responses
- `ratelimit.violation` metric increasing

**Causes**:
- Legitimate user hitting limits
- Automated scripts/bots
- Rate limit config too strict

**Resolution**:
1. Review user patterns in logs
2. Adjust rate limits for tier (see `api/middleware/userRateLimit.ts`)
3. Implement progressive rate limiting
4. Contact abusive users if automated

### Issue: High Token Usage Costs

**Symptoms**:
- `ai.tokens_used` trending upward
- Higher than expected API costs

**Causes**:
- Verbose system prompts
- Large context windows
- Inefficient prompt engineering
- Model selection (GPT-4 vs GPT-3.5)

**Resolution**:
1. Audit system prompts for verbosity
2. Implement context pruning
3. Use cheaper models for simple queries
4. Add token usage alerts per user

## Maintenance and Review

### Daily Checks
- [ ] Review error rate in Sentry
- [ ] Check SLO compliance
- [ ] Monitor token usage and costs
- [ ] Review alert summary

### Weekly Checks
- [ ] Analyze performance trends
- [ ] Review slow query log
- [ ] Check database connection pool trends
- [ ] Capacity planning based on growth

### Monthly Checks
- [ ] Review SLO compliance for month
- [ ] Analyze error budget consumption
- [ ] Performance regression analysis
- [ ] Update alert thresholds based on patterns

### Version History
- v1.0.0 (2025-09-29): Initial monitoring runbook (T079)

## Contacts

- **Platform Team**: platform@oriva.ai
- **On-Call**: Use PagerDuty rotation
- **Vercel Support**: https://vercel.com/support
- **Supabase Support**: https://supabase.com/support
- **Sentry Support**: https://sentry.io/support

## Related Documentation

- [Scaling Runbook](./SCALING.md) - Infrastructure scaling procedures
- [Load Testing Guide](../tests/load/README.md) - Performance testing with k6
- [API Documentation](./API.md) - API endpoints and usage