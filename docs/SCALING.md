# Oriva Platform Scaling Runbook

**Version**: 1.0.0
**Last Updated**: 2025-09-29
**Owner**: Platform Team

## Overview

This runbook documents scaling procedures, monitoring, and incident response for the Oriva Platform backend infrastructure.

## Architecture Overview

### Components

- **Vercel Edge Functions**: Serverless API endpoints deployed across multiple regions
- **Supabase (Oriva 101)**: PostgreSQL database with connection pooling
- **CDN**: Vercel Edge Network for static content and caching
- **Rate Limiting**: In-memory per-user rate limiting with tier-based quotas

### Regions

- **Primary**: `iad1` (US East - Virginia)
- **Secondary**: `sfo1` (US West - San Francisco)
- **Europe**: `fra1` (Europe - Frankfurt)

## Scaling Triggers

### Automatic Scaling

Vercel Edge Functions automatically scale based on:
- Request volume (up to 100 concurrent instances per region)
- CPU utilization (scales when >80% for 30 seconds)
- Memory usage (scales when >80% of allocated memory)

### Manual Intervention Required When:

1. **Database Connection Pool Exhaustion**
   - Symptom: `DB_POOL_WAITING_REQUESTS` > 50% of `DB_POOL_MAX`
   - Action: Increase `DB_POOL_MAX` environment variable

2. **High Error Rate**
   - Symptom: Error rate > 5% for 5 minutes
   - Action: Check error logs, database health, API dependencies

3. **Slow Query Performance**
   - Symptom: `db_pool_average_query_time` > 500ms
   - Action: Review slow query log, optimize queries, add indexes

4. **Rate Limit Breaches**
   - Symptom: High volume of 429 responses
   - Action: Review user patterns, adjust rate limits, upgrade tiers

## Monitoring Dashboards

### 1. Function Performance

**Metrics to Watch:**
- Response time (p50, p95, p99)
- Error rate (4xx, 5xx)
- Invocation count
- Cold start frequency
- Memory usage

**Thresholds:**
- ✅ Healthy: p95 < 1000ms, error rate < 1%
- ⚠️ Warning: p95 < 3000ms, error rate < 5%
- 🚨 Critical: p95 > 3000ms, error rate > 5%

### 2. Database Connection Pool

**Metrics to Watch:**
- `db_pool_total_connections`
- `db_pool_active_connections`
- `db_pool_idle_connections`
- `db_pool_waiting_requests`
- `db_pool_connection_errors`

**Access Metrics:**
```bash
curl https://api.oriva.ai/api/health
```

**Thresholds:**
- ✅ Healthy: utilization < 70%, waiting < 5
- ⚠️ Warning: utilization < 90%, waiting < 20
- 🚨 Critical: utilization > 90%, waiting > 20

### 3. Rate Limiting

**Metrics to Watch:**
- Rate limit violations (429 responses)
- Requests per user per minute
- Burst pattern detection

**Thresholds:**
- ✅ Healthy: < 1% rate limit violations
- ⚠️ Warning: 1-5% rate limit violations
- 🚨 Critical: > 5% rate limit violations

## Scaling Procedures

### Scale Up Database Connection Pool

**When**: Pool utilization > 80% consistently

**Steps**:
1. Update environment variable:
   ```bash
   vercel env add DB_POOL_MAX production
   # Enter new value (current: 20, recommend: 30-40)
   ```

2. Redeploy functions:
   ```bash
   vercel --prod
   ```

3. Monitor for 15 minutes:
   ```bash
   watch -n 10 'curl -s https://api.oriva.ai/api/health | jq .checks.database'
   ```

4. Verify metrics stabilize

### Scale Up Function Memory

**When**: Functions experiencing OOM errors or high memory pressure

**Steps**:
1. Update `vercel.json`:
   ```json
   {
     "functions": {
       "api/v1/hugo/chat.ts": {
         "memory": 3008  // Increase from 2048
       }
     }
   }
   ```

2. Deploy:
   ```bash
   git add vercel.json
   git commit -m "Scale up chat function memory to 3008MB"
   git push origin main
   vercel --prod
   ```

3. Monitor memory usage in Vercel dashboard

### Add New Region

**When**: High latency for users in specific geographic areas

**Steps**:
1. Update `vercel.json`:
   ```json
   {
     "regions": ["iad1", "sfo1", "fra1", "syd1"]  // Add Sydney
   }
   ```

2. Deploy and test:
   ```bash
   git add vercel.json
   git commit -m "Add Sydney region for APAC coverage"
   git push origin main
   vercel --prod
   ```

3. Verify region deployment:
   ```bash
   curl -I https://api.oriva.ai/api/health | grep x-vercel-id
   ```

### Adjust Rate Limits

**When**: Legitimate users hitting rate limits frequently

**Steps**:
1. Update `api/middleware/userRateLimit.ts`:
   ```typescript
   const RATE_LIMIT_TIERS = {
     free: {
       requestsPerMinute: 150,  // Increase from 100
       // ...
     }
   };
   ```

2. Deploy:
   ```bash
   git add api/middleware/userRateLimit.ts
   git commit -m "Increase free tier rate limit to 150 req/min"
   git push origin main
   vercel --prod
   ```

## Incident Response

### High Error Rate (> 5%)

**Severity**: 🚨 Critical

**Immediate Actions**:
1. Check Vercel dashboard for error logs
2. Review database health:
   ```bash
   curl https://api.oriva.ai/api/health
   ```
3. Check Supabase dashboard for database issues
4. Review recent deployments (potential rollback)

**Investigation**:
1. Analyze error patterns (which endpoints, error types)
2. Check external dependencies (OpenAI API, Supabase)
3. Review recent code changes
4. Check for DDoS patterns

**Resolution**:
- If bad deployment: Rollback immediately
- If database issue: Scale up or contact Supabase support
- If external API issue: Implement fallback or circuit breaker

### Database Connection Pool Exhaustion

**Severity**: ⚠️ Warning → 🚨 Critical

**Immediate Actions**:
1. Increase `DB_POOL_MAX` temporarily:
   ```bash
   vercel env add DB_POOL_MAX production
   # Enter 40 (double current)
   ```

2. Redeploy functions:
   ```bash
   vercel --prod
   ```

3. Monitor pool metrics

**Investigation**:
1. Check for slow queries:
   ```sql
   SELECT * FROM pg_stat_statements
   ORDER BY mean_exec_time DESC
   LIMIT 10;
   ```

2. Review connection leak patterns
3. Check for long-running transactions

**Resolution**:
- Optimize slow queries
- Add database indexes
- Implement query timeouts
- Fix connection leaks in code

### High Latency (p95 > 3s)

**Severity**: ⚠️ Warning

**Immediate Actions**:
1. Check database query times:
   ```bash
   curl https://api.oriva.ai/api/health | jq .response_time_ms
   ```

2. Review function cold starts
3. Check external API latency (OpenAI)

**Investigation**:
1. Identify slow endpoints
2. Profile slow queries
3. Check CDN cache hit rates
4. Review function memory allocation

**Resolution**:
- Optimize database queries
- Increase function memory
- Implement caching
- Add database indexes
- Use connection pooling effectively

## Performance SLOs

### Service Level Objectives

| Metric | Target | Measurement Window |
|--------|--------|-------------------|
| Availability | 99.9% | 30 days |
| Response Time (p95) | < 1000ms | 24 hours |
| Response Time (p99) | < 3000ms | 24 hours |
| Error Rate | < 1% | 24 hours |
| Database Uptime | 99.95% | 30 days |

### Alert Thresholds

| Alert | Threshold | Action Required |
|-------|-----------|-----------------|
| High Error Rate | > 5% for 5 min | Immediate investigation |
| Slow Response | p95 > 3s for 10 min | Review and optimize |
| DB Pool Full | > 90% for 5 min | Scale up pool |
| High 429 Rate | > 5% for 15 min | Review rate limits |

## Configuration Reference

### Environment Variables

```bash
# Database Connection Pool (T068)
DB_POOL_MAX=20              # Max connections per instance
DB_POOL_MIN=2               # Min connections to maintain
DB_IDLE_TIMEOUT=30000       # 30s idle timeout
DB_CONNECT_TIMEOUT=5000     # 5s connect timeout
DB_MAX_RETRIES=3            # Max retry attempts

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# External APIs
OPENAI_API_KEY=xxx
ANTHROPIC_API_KEY=xxx
```

### Function Configuration

```json
{
  "functions": {
    "api/**/*.ts": {
      "runtime": "nodejs20.x",
      "maxDuration": 10,
      "memory": 1024
    },
    "api/v1/hugo/chat.ts": {
      "maxDuration": 30,
      "memory": 2048
    }
  }
}
```

## Runbook Maintenance

### Review Schedule
- Weekly: Review metrics and thresholds
- Monthly: Update procedures based on incidents
- Quarterly: Review SLOs and capacity planning

### Version History
- v1.0.0 (2025-09-29): Initial runbook with scaling procedures (T072)

## Contacts

- **Platform Team**: platform@oriva.ai
- **On-Call**: Use PagerDuty rotation
- **Vercel Support**: https://vercel.com/support
- **Supabase Support**: https://supabase.com/support