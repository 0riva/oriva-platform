# Monitoring Quick Start Guide

**Goal:** Get production monitoring running in under 1 hour.

## Option 1: Vercel + Datadog (Recommended - 30 minutes)

### Step 1: Install Datadog (5 min)

```bash
npm install --save dd-trace
```

### Step 2: Configure Environment Variables

Add to Vercel Dashboard → Settings → Environment Variables:

```bash
DD_API_KEY=<your-datadog-api-key>
DD_SERVICE=oriva-api
DD_ENV=production
DD_VERSION=1.0.0
DD_LOGS_INJECTION=true
DD_TRACE_SAMPLE_RATE=1.0
```

### Step 3: Initialize Tracer

Add to **TOP** of `api/index.ts` and `api/server.ts`:

```typescript
// Must be first import!
if (process.env.DD_API_KEY) {
  require('dd-trace').init({
    logInjection: true,
    analytics: true,
    runtimeMetrics: true,
  });
}
```

### Step 4: Enable Vercel Log Drain

```bash
# Via Vercel Dashboard
# Go to: Project → Settings → Integrations → Datadog
# Click "Add" and authorize

# Or via CLI
vercel integrations add datadog
```

### Step 5: Import Dashboards

1. Go to Datadog → Dashboards → New Dashboard
2. Click "Import Dashboard JSON"
3. Upload `monitoring/dashboards/datadog-security.json`
4. Upload `monitoring/dashboards/datadog-performance.json`

### Step 6: Set Up Alerts

1. Go to Datadog → Monitors → New Monitor
2. Choose "Metric Monitor"
3. Copy queries from `monitoring/alerts/critical-alerts.yaml`
4. Configure notification channels (Slack, PagerDuty)

**Done! You now have:**
- ✅ Automatic request tracing with request IDs
- ✅ Security event monitoring
- ✅ Performance dashboards
- ✅ Critical alerts

---

## Option 2: Sentry Only (Simpler - 15 minutes)

### Step 1: Install Sentry

```bash
npm install @sentry/node @sentry/tracing
```

### Step 2: Configure

Add to `api/index.ts` and `api/server.ts`:

```typescript
import * as Sentry from '@sentry/node';
import * as Tracing from '@sentry/tracing';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Tracing.Integrations.Express({ app }),
  ],
});

// After middleware setup
app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());

// Before error handlers
app.use(Sentry.Handlers.errorHandler());
```

### Step 3: Environment Variable

```bash
SENTRY_DSN=<your-sentry-dsn>
```

**Done! You now have:**
- ✅ Error tracking
- ✅ Performance monitoring
- ✅ Request breadcrumbs

---

## Using the Security Logger

### Step 1: Import

```typescript
import { securityEvents, extractSecurityMetadata } from '../utils/securityLogger';
```

### Step 2: Add to Middleware

Example - `src/express/middleware/auth.ts`:

```typescript
// In requireApiKey middleware
if (!apiKey.startsWith('oriva_pk_')) {
  securityEvents.invalidApiKey(
    apiKey.substring(0, 10),
    extractSecurityMetadata(req)
  );
  // ... rest of error handling
}

// In requireAuth middleware
if (now >= expiresAt) {
  securityEvents.expiredToken(
    user.id,
    new Date(expiresAt).toISOString(),
    extractSecurityMetadata(req)
  );
  // ... rest of error handling
}
```

Example - `api/index.ts` (Rate limiting):

```typescript
import { securityEvents } from '../src/utils/securityLogger';

const limiter = rateLimit({
  // ... config
  handler: (req, res) => {
    securityEvents.rateLimitExceeded({
      ip: req.ip || 'unknown',
      path: req.path,
      limit: API_RATE_LIMIT_MAX,
      current: req.rateLimit?.current || 0,
      requestId: req.requestId,
    });
    res.status(429).json({ error: 'Too many requests' });
  },
});
```

---

## Searching Logs

### By Request ID

```bash
# Local logs
grep "requestId\":\"abc123def456" logs/combined.log | jq '.'

# Datadog
requestId:abc123def456

# Vercel
requestId = "abc123def456"
```

### By Security Event

```bash
# Local logs
grep "event\":\"auth_failed" logs/combined.log | jq '.ip, .reason'

# Datadog
@event:auth_failed

# Filter by IP
@event:rate_limit_exceeded @ip:192.168.1.1
```

### By User (Sanitized)

```bash
# Datadog
@userId:12345678*

# Note: In production, only first 8 chars + hash are logged
```

---

## Creating Custom Alerts

### Datadog Alert Template

```
Query: sum(last_5m):sum:security.event{event:<EVENT_TYPE>}.as_count() > <THRESHOLD>

Message:
**ALERT: <Title>**

{{value}} events in 5 minutes.

**Actions**:
- <Action 1>
- <Action 2>

**Runbook**: https://docs.oriva.com/runbooks/<runbook-name>

Notify: @slack-engineering @pagerduty
```

### Common Alert Queries

```
# Auth failures
sum(last_5m):sum:security.event{event:auth_failed}.as_count() > 100

# Rate limits by IP
sum(last_1h):sum:security.event{event:rate_limit_exceeded} by {ip} > 50

# API errors
avg(last_15m):(sum:trace.express.request.errors / sum:trace.express.request.hits) * 100 > 5

# Slow requests
avg(last_10m):p95:trace.express.request.duration > 2000

# CORS violations
sum(last_30m):sum:security.event{event:cors_violation}.as_count() > 20
```

---

## Verifying Monitoring Works

### 1. Generate Test Events

```bash
# Test security events
curl -H "Authorization: Bearer invalid-token" https://your-api.com/protected
curl -H "X-API-Key: invalid-key" https://your-api.com/api/data

# Test with request ID
curl -H "X-Request-ID: test-12345" https://your-api.com/health

# Test rate limiting (150 requests)
for i in {1..150}; do curl https://your-api.com/endpoint; done
```

### 2. Check Logs

**Local:**
```bash
tail -f logs/combined.log | jq 'select(.requestId == "test-12345")'
```

**Datadog:**
- Go to Logs → Live Tail
- Filter: `requestId:test-12345`
- Should see request with X-Request-ID header

**Vercel:**
- Go to Project → Logs
- Search for `test-12345`

### 3. Verify Dashboards

- **Datadog**: Dashboards → Oriva API - Security Monitoring
- Check "Security Events (Last Hour)" widget shows non-zero value

### 4. Test Alerts

- Trigger alert condition (e.g., make 150 requests quickly)
- Check Slack channel receives notification
- Verify alert shows in Datadog Monitors

---

## Troubleshooting

### "No data in Datadog dashboard"

1. Check DD_API_KEY is set correctly
2. Verify `dd-trace` is initialized FIRST (before any imports)
3. Check logs for Datadog agent errors
4. Ensure Vercel log drain is configured

### "Request IDs not showing in logs"

1. Verify `requestIdMiddleware` is added to Express app
2. Check middleware order (should be early)
3. Confirm middleware is applied before routes

### "Security events not logging"

1. Check `securityLogger.ts` is imported
2. Verify calls to `securityEvents.*()` methods
3. Check log level allows `warn` and `info` levels
4. Ensure Winston logger is configured

### "Alerts not firing"

1. Verify metric query returns data in Datadog Metrics Explorer
2. Check alert evaluation window matches data availability
3. Confirm notification channels are configured
4. Test notification channel connectivity

---

## Next Steps After Setup

1. ✅ **Week 1**: Monitor baseline metrics, tune alert thresholds
2. ✅ **Week 2**: Create runbooks for each alert type
3. ✅ **Week 3**: Set up on-call rotation and escalation
4. ✅ **Week 4**: Review security events, identify patterns
5. ✅ **Month 2**: Add custom business metrics

---

## Cost Estimate

**Datadog (Recommended):**
- APM: $31/host/month (1 host)
- Logs: $1.70/million events (estimate 10M/mo = $17)
- Infrastructure: $15/host/month
- **Total: ~$60/month**

**Sentry (Cheaper alternative):**
- Team plan: $26/month (50K transactions)
- **Total: $26/month**

**Vercel Logs (Free):**
- Included in Vercel Pro plan
- **Total: $0 additional**

---

## Support & Documentation

- **Monitoring Setup Guide**: `MONITORING_SETUP.md`
- **Security Logger**: `src/utils/securityLogger.ts`
- **Alert Configs**: `monitoring/alerts/`
- **Dashboards**: `monitoring/dashboards/`

**Questions?** Contact #engineering on Slack or email engineering@oriva.com
