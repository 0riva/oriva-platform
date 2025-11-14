# Monitoring Setup Guide

This guide shows how to set up monitoring for the security and observability enhancements implemented in the security review.

## Table of Contents

1. [Log Aggregation](#log-aggregation)
2. [Security Event Monitoring](#security-event-monitoring)
3. [APM & Distributed Tracing](#apm--distributed-tracing)
4. [Metrics & Dashboards](#metrics--dashboards)
5. [Alerts](#alerts)
6. [Vercel-Specific Setup](#vercel-specific-setup)

---

## 1. Log Aggregation

### Option A: Datadog (Recommended for Production)

**Install Datadog Agent:**

```bash
npm install --save dd-trace
```

**Configure in `api/index.ts` and `api/server.ts`:**

```typescript
// At the very top of the file, before any other imports
if (process.env.NODE_ENV === 'production' && process.env.DD_API_KEY) {
  require('dd-trace').init({
    logInjection: true, // Automatically inject trace IDs into logs
    analytics: true,
    runtimeMetrics: true,
  });
}
```

**Environment Variables:**

```bash
DD_API_KEY=your_datadog_api_key
DD_SERVICE=oriva-api
DD_ENV=production
DD_VERSION=1.0.0
DD_LOGS_INJECTION=true
```

**Benefits:**
- Automatic request ID correlation
- Distributed tracing across microservices
- Built-in APM and profiling
- Security monitoring dashboards

---

### Option B: Vercel Log Drains (Simpler, Vercel-Native)

**Setup:**

1. Go to Vercel Dashboard → Project → Settings → Log Drains
2. Add integration:
   - **Datadog**: Direct integration available
   - **LogDNA/New Relic/Splunk**: Use webhook URL
   - **Custom**: Any HTTPS endpoint

**Log Drain Format:**
Vercel automatically forwards logs with:
- Request ID
- Timestamp
- Log level
- Message
- Metadata

**No code changes needed** - works with existing Winston logger!

---

### Option C: CloudWatch (AWS)

```bash
npm install --save winston-cloudwatch
```

**Configure logger in `src/utils/logger.ts`:**

```typescript
import CloudWatchTransport from 'winston-cloudwatch';

// Add to transports array
...(process.env.NODE_ENV === 'production' && process.env.AWS_REGION ? [
  new CloudWatchTransport({
    logGroupName: '/oriva/api',
    logStreamName: `${process.env.NODE_ENV}-${new Date().toISOString().split('T')[0]}`,
    awsRegion: process.env.AWS_REGION,
    jsonMessage: true,
  })
] : [])
```

---

## 2. Security Event Monitoring

### Key Security Events to Track

Create dedicated log entries for security events:

**File: `src/utils/securityLogger.ts`** (New)

```typescript
import { logger } from './logger';

export const securityEvents = {
  // Authentication failures
  authFailed: (reason: string, metadata: Record<string, unknown>) => {
    logger.warn('Security: Authentication failed', {
      event: 'auth_failed',
      reason,
      ...metadata,
    });
  },

  // Rate limit exceeded
  rateLimitExceeded: (ip: string, path: string, limit: number) => {
    logger.warn('Security: Rate limit exceeded', {
      event: 'rate_limit_exceeded',
      ip,
      path,
      limit,
    });
  },

  // Invalid API key
  invalidApiKey: (keyPrefix: string, ip: string) => {
    logger.warn('Security: Invalid API key', {
      event: 'invalid_api_key',
      keyPrefix,
      ip,
    });
  },

  // Expired token
  expiredToken: (userId: string, expiresAt: string) => {
    logger.warn('Security: Expired token rejected', {
      event: 'expired_token',
      userId,
      expiresAt,
    });
  },

  // CORS violation
  corsViolation: (origin: string, ip: string) => {
    logger.warn('Security: CORS violation', {
      event: 'cors_violation',
      origin,
      ip,
    });
  },

  // Content-Type validation failure
  contentTypeRejected: (contentType: string, path: string, ip: string) => {
    logger.warn('Security: Invalid Content-Type', {
      event: 'content_type_rejected',
      contentType,
      path,
      ip,
    });
  },

  // Successful high-privilege operations
  privilegedOperation: (userId: string, operation: string, resource: string) => {
    logger.info('Security: Privileged operation', {
      event: 'privileged_operation',
      userId,
      operation,
      resource,
    });
  },
};
```

### Integrate Security Events

Update existing middleware to use security logger:

**Example: `src/express/middleware/auth.ts`**

```typescript
import { securityEvents } from '../../utils/securityLogger';

// In requireAuth middleware
if (now >= expiresAt) {
  securityEvents.expiredToken(
    sanitizeUserId(userId),
    new Date(expiresAt).toISOString()
  );
  // ... rest of error handling
}

// In requireApiKey middleware
if (!apiKey.startsWith('oriva_pk_')) {
  securityEvents.invalidApiKey(
    apiKey.substring(0, 10),
    req.ip || 'unknown'
  );
  // ... rest of error handling
}
```

---

## 3. APM & Distributed Tracing

### Datadog APM Setup

**Configuration:**

```typescript
// api/index.ts and api/server.ts - top of file
const tracer = require('dd-trace').init({
  service: 'oriva-api',
  version: process.env.API_VERSION || '1.0.0',
  env: process.env.NODE_ENV || 'development',

  // Automatic instrumentation
  plugins: true,

  // Sample rate (1.0 = 100%)
  sampleRate: process.env.DD_TRACE_SAMPLE_RATE || 1.0,

  // Log injection (includes trace ID in logs)
  logInjection: true,
});

// Export for custom spans
export { tracer };
```

**Custom Spans for Critical Operations:**

```typescript
import { tracer } from '../config/tracer';

// Example: Track API key validation
const span = tracer.startSpan('api_key.validate');
span.setTag('key_prefix', keyPrefix);

try {
  const result = await validateApiKey(key);
  span.setTag('validation.success', true);
  return result;
} catch (error) {
  span.setTag('error', true);
  span.setTag('error.message', error.message);
  throw error;
} finally {
  span.finish();
}
```

### New Relic Setup

```bash
npm install --save newrelic
```

**Create `newrelic.js` in project root:**

```javascript
exports.config = {
  app_name: ['Oriva API'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY,
  logging: {
    level: 'info',
  },
  distributed_tracing: {
    enabled: true,
  },
  transaction_tracer: {
    enabled: true,
  },
};
```

**Load at app start:**

```typescript
// At very top of api/index.ts
if (process.env.NEW_RELIC_LICENSE_KEY) {
  require('newrelic');
}
```

---

## 4. Metrics & Dashboards

### Key Metrics to Track

**Security Metrics:**
1. **Authentication failures** (by reason)
2. **Rate limit violations** (by IP, by endpoint)
3. **Invalid API keys** (count, unique IPs)
4. **Expired tokens** (count, timing)
5. **CORS violations** (by origin)
6. **Content-Type rejections** (by type)

**Performance Metrics:**
1. **Request duration** (p50, p95, p99)
2. **Requests per second** (by endpoint)
3. **Error rate** (4xx, 5xx)
4. **Database query time**
5. **External API latency**

**Business Metrics:**
1. **Active users** (by time window)
2. **API key usage** (by key, by app)
3. **Feature usage** (by endpoint)

### Datadog Dashboard Example

**File: `monitoring/datadog-dashboard.json`** (New)

```json
{
  "title": "Oriva API Security & Performance",
  "description": "Security events, performance metrics, and request tracing",
  "widgets": [
    {
      "definition": {
        "title": "Security Events (Last Hour)",
        "type": "query_value",
        "requests": [
          {
            "q": "sum:custom.security.event{event:auth_failed}.as_count()",
            "aggregator": "sum"
          }
        ]
      }
    },
    {
      "definition": {
        "title": "Rate Limit Violations by IP",
        "type": "toplist",
        "requests": [
          {
            "q": "top(sum:custom.security.event{event:rate_limit_exceeded} by {ip}, 10, 'sum', 'desc')"
          }
        ]
      }
    },
    {
      "definition": {
        "title": "Request Duration (p95)",
        "type": "timeseries",
        "requests": [
          {
            "q": "p95:trace.express.request{service:oriva-api}",
            "display_type": "line"
          }
        ]
      }
    },
    {
      "definition": {
        "title": "API Errors by Status Code",
        "type": "timeseries",
        "requests": [
          {
            "q": "sum:trace.express.request.hits{service:oriva-api} by {http.status_code}",
            "display_type": "bars"
          }
        ]
      }
    }
  ],
  "layout_type": "ordered"
}
```

### Grafana Dashboard Example (for Prometheus)

**File: `monitoring/grafana-dashboard.json`**

```json
{
  "dashboard": {
    "title": "Oriva API Monitoring",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total{job=\"oriva-api\"}[5m])"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total{job=\"oriva-api\",status=~\"5..\"}[5m])"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Security Events",
        "targets": [
          {
            "expr": "increase(security_events_total[1h])"
          }
        ],
        "type": "stat"
      }
    ]
  }
}
```

---

## 5. Alerts

### Critical Alerts

**Datadog Alert Examples:**

1. **High Rate of Auth Failures**
   - Query: `sum(last_5m):sum:custom.security.event{event:auth_failed}.as_count() > 100`
   - Alert: "More than 100 authentication failures in 5 minutes"
   - Severity: High
   - Notify: Security team

2. **Rate Limit Abuse**
   - Query: `sum(last_1h):sum:custom.security.event{event:rate_limit_exceeded} by {ip} > 50`
   - Alert: "IP {{ip.name}} exceeded rate limit 50+ times in 1 hour"
   - Severity: Medium
   - Action: Consider IP blocking

3. **API Error Spike**
   - Query: `avg(last_15m):avg:trace.express.request{service:oriva-api,http.status_code:5*} > 0.05`
   - Alert: "5xx error rate above 5% for 15 minutes"
   - Severity: Critical
   - Notify: On-call engineer

4. **High Latency**
   - Query: `avg(last_10m):p95:trace.express.request.duration{service:oriva-api} > 2000`
   - Alert: "p95 latency above 2 seconds for 10 minutes"
   - Severity: Medium
   - Notify: Engineering team

### Alert Configuration File

**File: `monitoring/alerts.yaml`**

```yaml
alerts:
  - name: auth_failure_spike
    condition: "sum(last_5m):security_events{type:auth_failed} > 100"
    severity: high
    message: |
      Authentication failures spiked to {{value}} in the last 5 minutes.
      This may indicate a credential stuffing attack.
    escalation: security-team

  - name: rate_limit_abuse
    condition: "sum(last_1h):security_events{type:rate_limit_exceeded} by ip > 50"
    severity: medium
    message: |
      IP {{ip}} exceeded rate limit {{value}} times in the last hour.
      Consider blocking this IP.
    escalation: ops-team

  - name: api_error_rate
    condition: "avg(last_15m):http_errors{status:5xx} / http_requests > 0.05"
    severity: critical
    message: |
      5xx error rate is {{value}}% (above 5% threshold).
      Check logs for request ID correlation.
    escalation: on-call

  - name: expired_token_pattern
    condition: "sum(last_30m):security_events{type:expired_token} > 1000"
    severity: low
    message: |
      High volume of expired tokens ({{value}} in 30 min).
      Users may need token refresh prompt.
    escalation: product-team
```

---

## 6. Vercel-Specific Setup

### Vercel Analytics

**Enable in `vercel.json`:**

```json
{
  "analytics": {
    "enable": true
  }
}
```

**Add Web Vitals tracking:**

```typescript
// pages/_app.tsx or similar
export function reportWebVitals(metric) {
  if (metric.label === 'web-vital') {
    console.log(metric); // Automatically sent to Vercel Analytics
  }
}
```

### Vercel Log Drains

**Setup via CLI:**

```bash
# Datadog
vercel env add DD_API_KEY
vercel integrations add datadog

# Custom webhook
vercel log-drain add https://your-logging-service.com/webhook
```

### Environment Variables for Monitoring

```bash
# Vercel Dashboard → Settings → Environment Variables
API_VERSION=1.0.0
DD_API_KEY=<datadog-key>
DD_SERVICE=oriva-api
DD_ENV=production
LOG_LEVEL=info
NEW_RELIC_LICENSE_KEY=<newrelic-key>
SENTRY_DSN=<sentry-dsn>
```

---

## 7. Quick Start Recommendations

### For Immediate Setup (< 1 hour):

1. **Enable Vercel Log Drains** → Datadog integration
   - Zero code changes
   - Automatic request ID correlation
   - Instant dashboards

2. **Add Sentry for Error Tracking:**
   ```bash
   npm install @sentry/node @sentry/tracing
   ```

   ```typescript
   import * as Sentry from '@sentry/node';

   Sentry.init({
     dsn: process.env.SENTRY_DSN,
     environment: process.env.NODE_ENV,
     tracesSampleRate: 1.0,
   });

   // Add to Express
   app.use(Sentry.Handlers.requestHandler());
   app.use(Sentry.Handlers.errorHandler());
   ```

3. **Create security event logger** (as shown above)

4. **Set up 3 critical alerts:**
   - Auth failure spike
   - 5xx error rate
   - Rate limit abuse

### For Production-Grade Setup (1-2 days):

1. Full Datadog APM integration
2. Custom security event tracking
3. Comprehensive dashboards
4. Alert runbooks
5. On-call rotation setup
6. Incident response procedures

---

## 8. Testing Your Monitoring

### Generate Test Events:

```bash
# Test rate limiting
for i in {1..150}; do curl https://your-api.com/endpoint; done

# Test auth failures
curl -H "Authorization: Bearer invalid-token" https://your-api.com/protected

# Test Content-Type validation
curl -X POST -H "Content-Type: text/plain" https://your-api.com/api/data

# Test with custom request ID
curl -H "X-Request-ID: test-trace-12345" https://your-api.com/endpoint
```

### Verify in Logs:

```bash
# Search by request ID
grep "test-trace-12345" logs/combined.log

# Search security events
grep "event:auth_failed" logs/combined.log | tail -10

# Check structured logging
cat logs/combined.log | jq '.requestId, .event, .ip'
```

---

## 9. Cost Considerations

| Tool | Free Tier | Paid Tier | Best For |
|------|-----------|-----------|----------|
| **Datadog** | 15-day trial | $15/host/month | Full APM + logs + metrics |
| **New Relic** | 100GB/month free | $0.25/GB | APM with retention |
| **Sentry** | 5K events/month | $26/month | Error tracking |
| **Vercel Logs** | Included | Included | Simple setup |
| **CloudWatch** | 5GB free | $0.50/GB | AWS-native |
| **LogDNA** | 50MB/day free | $1.50/GB | Log search |

**Recommendation for Oriva:**
- **Start**: Vercel Log Drains → Datadog (free trial)
- **Production**: Datadog full platform ($15-30/mo) + Sentry ($26/mo)
- **Budget**: Vercel Logs + CloudWatch ($10-20/mo)

---

## Next Steps

1. ✅ Choose log aggregation tool (Datadog recommended)
2. ✅ Create `src/utils/securityLogger.ts`
3. ✅ Integrate security events in middleware
4. ✅ Set up 3 critical alerts
5. ✅ Create initial dashboard
6. ✅ Test with sample security events
7. ✅ Document runbooks for common incidents

**Need help with specific tool setup?** Let me know which monitoring solution you prefer and I'll provide detailed implementation.
