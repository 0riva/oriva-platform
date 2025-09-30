# ADR-006: User-Based Rate Limiting

**Status**: Accepted
**Date**: 2025-09-29
**Deciders**: Platform Team
**Related**: T071 (Rate Limiting Implementation)

## Context

The Oriva Platform needs to protect against:
- API abuse (malicious or accidental)
- Resource exhaustion
- Cost overruns (AI API costs)
- Unfair resource allocation

**Without Rate Limiting**:
- Single user could exhaust AI quotas
- Automated bots could overwhelm database
- Legitimate users affected by abuse
- Unpredictable costs

**Requirements**:
- Protect shared resources
- Support different subscription tiers
- Allow burst traffic patterns
- Provide clear feedback to clients (429 responses)
- Minimal performance overhead

## Decision

We will implement **user-based rate limiting** with tiered quotas and multi-window tracking:

### Tier-Based Quotas

**Free Tier**:
- 5 requests/second
- 100 requests/minute
- 1,000 requests/hour
- Burst size: 10 requests

**Premium Tier**:
- 20 requests/second
- 500 requests/minute
- 10,000 requests/hour
- Burst size: 40 requests

**Enterprise Tier**:
- 50 requests/second
- 2,000 requests/minute
- 50,000 requests/hour
- Burst size: 100 requests

### Multi-Window Tracking

Track usage across three time windows:
- **Second**: Prevent burst abuse
- **Minute**: Normal usage limits
- **Hour**: Protect against sustained abuse

All windows must be within limits to proceed.

### Rate Limiting Strategy

**Identification**: By user ID from JWT
**Storage**: In-memory per function instance
**Algorithm**: Sliding window counters
**Response**: HTTP 429 with Retry-After header

**Implementation**:
```typescript
// api/middleware/userRateLimit.ts
async function userRateLimit(req, res, next) {
  const userId = req.authContext.userId;
  const tier = req.authContext.tier;
  const config = RATE_LIMIT_TIERS[tier];

  const result = checkRateLimit(userId, config);

  if (!result.allowed) {
    res.status(429).json({
      error: 'Too many requests',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: result.retryAfter,
    });
    return;
  }

  recordRequest(userId);
  return next();
}
```

## Consequences

### Positive

✅ **Resource Protection**
- Prevents single user from exhausting shared resources
- Protects database, AI APIs, bandwidth
- Ensures fair allocation

✅ **Cost Control**
- Limits AI API costs per user
- Predictable monthly expenses
- Protection against runaway costs

✅ **Tier Monetization**
- Clear value proposition for upgrades
- Premium users get higher limits
- Supports subscription model

✅ **Abuse Prevention**
- Blocks automated scrapers
- Limits bot traffic
- Protects against DDoS

✅ **Performance Overhead Minimal**
- In-memory counters (<1ms)
- No external service calls
- Automatic cleanup

### Negative

⚠️ **Per-Instance Limits**
- Limits apply per function instance, not globally
- 10 instances × 100/min = 1000/min total possible
- Mitigated by: Conservative limits, monitoring

⚠️ **Memory Usage**
- Stores counters for active users
- ~1KB per user × 1000 users = 1MB
- Mitigated by: Automatic cleanup after 1 hour idle

⚠️ **User Experience Impact**
- Legitimate users may hit limits
- 429 errors require client handling
- Mitigated by: Generous limits, clear error messages, retry guidance

⚠️ **No Cross-Region Coordination**
- User in US and Europe could bypass limits
- Rare edge case (same user, multiple regions)
- Mitigated by: Acceptable trade-off for simplicity

### Trade-offs Accepted

1. **Per-instance limits** for performance (no external coordination)
2. **In-memory storage** for speed (no persistence)
3. **429 errors** for protection (user impact acceptable)

## Implementation Details

### Rate Limit Configuration

```typescript
const RATE_LIMIT_TIERS = {
  free: {
    requestsPerSecond: 5,
    requestsPerMinute: 100,
    requestsPerHour: 1000,
    burstSize: 10,
  },
  premium: {
    requestsPerSecond: 20,
    requestsPerMinute: 500,
    requestsPerHour: 10000,
    burstSize: 40,
  },
  enterprise: {
    requestsPerSecond: 50,
    requestsPerMinute: 2000,
    requestsPerHour: 50000,
    burstSize: 100,
  },
};
```

### Sliding Window Algorithm

```typescript
function checkRateLimit(userId, config, now) {
  const windows = {
    second: getWindow(userId, 'second', 1000),
    minute: getWindow(userId, 'minute', 60000),
    hour: getWindow(userId, 'hour', 3600000),
  };

  // Check all windows
  if (windows.second.count >= config.requestsPerSecond) {
    return { allowed: false, retryAfter: windows.second.resetIn };
  }
  if (windows.minute.count >= config.requestsPerMinute) {
    return { allowed: false, retryAfter: windows.minute.resetIn };
  }
  if (windows.hour.count >= config.requestsPerHour) {
    return { allowed: false, retryAfter: windows.hour.resetIn };
  }

  return { allowed: true };
}
```

### Response Format

```json
{
  "error": "Too many requests",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 42,
  "limits": {
    "tier": "free",
    "requestsPerMinute": 100,
    "remainingThisMinute": 0
  }
}
```

### Metrics Tracking

```typescript
trackRateLimitViolation(userId, tier);

// Exposed via /api/health
{
  "metrics": {
    "rate_limit_violations_total": 42,
    "rate_limit_violations_by_tier": {
      "free": 38,
      "premium": 4,
      "enterprise": 0
    }
  }
}
```

## Rate Limit Tuning

### Burst Handling

Burst size allows temporary spikes:
- Free: 10 requests in <1s
- Premium: 40 requests in <1s
- Enterprise: 100 requests in <1s

Prevents rejection of legitimate batch operations.

### Window Selection

**Second window**: Prevents rapid-fire abuse
**Minute window**: Normal usage limit
**Hour window**: Sustained abuse protection

All must pass for request to proceed.

### Automatic Cleanup

```typescript
// Clean up stale user data every 5 minutes
setInterval(() => {
  const oneHourAgo = Date.now() - 3600000;
  for (const [userId, data] of rateLimitStore) {
    if (data.lastRequest < oneHourAgo) {
      rateLimitStore.delete(userId);
    }
  }
}, 300000);
```

## User Experience

### Client Handling

**Recommended client behavior**:
```typescript
async function makeRequest(url, data) {
  const response = await fetch(url, { method: 'POST', body: data });

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    await sleep(retryAfter * 1000);
    return makeRequest(url, data);  // Retry
  }

  return response.json();
}
```

### Error Messages

Clear, actionable error messages:
- "Too many requests. Please wait 42 seconds and try again."
- Include tier information
- Suggest upgrade for premium features
- Link to documentation

### Upgrade Prompts

When free tier hits limits frequently:
- Show upgrade modal
- Highlight premium benefits
- Seamless upgrade flow

## Monitoring & Alerting

### Metrics to Track

- Rate limit violations (total and by tier)
- 429 response rate
- Retry patterns
- User tier distribution
- Average requests per user

### Alert Thresholds

- **Warning**: >2% requests result in 429
- **Critical**: >5% requests result in 429

High 429 rate indicates:
- Limits too strict
- Bot traffic
- API client misbehavior

### Dashboard

```bash
curl https://api.oriva.ai/api/health | jq .metrics.rate_limit_violations
```

## Scaling Strategy

### Current Limits (Launch)

Conservative limits to start:
- Free: 100/min (sufficient for interactive use)
- Premium: 500/min (power users)
- Enterprise: 2000/min (applications)

### Adjustment Triggers

**Increase limits if**:
- Low violation rate (<1%)
- User complaints
- Legitimate use cases blocked

**Decrease limits if**:
- High API costs
- Resource exhaustion
- Abuse patterns detected

### Future Enhancements

1. **Redis-based global limits**:
   - Coordinate across function instances
   - True global rate limiting
   - Trade-off: External dependency, latency

2. **Dynamic limits**:
   - Adjust based on system load
   - Higher limits during low traffic
   - Lower limits during spikes

3. **Usage-based billing**:
   - Pay-as-you-go for enterprise
   - Remove hard limits
   - Charge for overage

## Alternatives Considered

### 1. No Rate Limiting

**Pros**:
- Simplest implementation
- Best user experience
- No 429 errors

**Cons**:
- No abuse protection
- Unpredictable costs
- Resource exhaustion risk

**Rejected**: Unacceptable risk

### 2. Global Rate Limiting (Redis)

**Pros**:
- True global limits
- More accurate
- Cross-region coordination

**Cons**:
- External dependency
- Additional latency (10-50ms)
- Redis infrastructure to manage
- Additional cost

**Rejected**: Complexity not justified at launch scale

### 3. IP-Based Rate Limiting

**Pros**:
- Works without authentication
- Protects unauthenticated endpoints

**Cons**:
- Shared IPs punish all users
- NAT/proxy issues
- VPN bypass

**Rejected**: User-based more fair and effective

### 4. API Gateway Rate Limiting (Vercel Edge Config)

**Pros**:
- Platform-native solution
- Global coordination
- No custom code

**Cons**:
- Less flexible
- Harder to customize by tier
- Limited visibility

**Rejected**: Insufficient flexibility for tiered limits

## Security Considerations

### Attack Vectors

**Rate Limit Bypass Attempts**:
- Multiple accounts: Mitigated by account verification
- Multiple IPs: Doesn't help (user-based)
- Different regions: Partial bypass possible, acceptable trade-off

**Token Theft**:
- Stolen JWT could bypass limits
- Mitigated by: Token expiration, IP validation (future)

### Protection Strategies

- Rate limit authentication endpoints more strictly
- Monitor for unusual patterns (same user, multiple IPs)
- Ban users who consistently abuse limits
- CAPTCHA for repeated violations (future)

## Review Schedule

- **Weekly**: Review violation metrics
- **Monthly**: Adjust limits based on usage patterns
- **Quarterly**: Evaluate tier structure and pricing
- **Annually**: Consider architecture changes (Redis, etc.)

## References

- [Rate Limiting Patterns](https://www.nginx.com/blog/rate-limiting-nginx/)
- [Sliding Window Rate Limiting](https://blog.cloudflare.com/counting-things-a-lot-of-different-things/)
- [Token Bucket Algorithm](https://en.wikipedia.org/wiki/Token_bucket)
- [SCALING.md](../SCALING.md) - Rate limit scaling procedures