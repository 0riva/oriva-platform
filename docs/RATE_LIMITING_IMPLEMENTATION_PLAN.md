# Rate Limiting Implementation Plan

**Status**: Planned
**Priority**: Medium
**Target Date**: Q1 2025
**Last Updated**: 2025-10-01

## Current State

Rate limiting is currently **disabled in production and development** environments due to limitations with in-memory rate limiting in serverless functions.

### Why Disabled

1. **Serverless Architecture**: Vercel Functions are stateless - in-memory stores don't persist across invocations
2. **express-rate-limit Limitations**: Default implementation uses in-memory store unsuitable for distributed systems
3. **IPv6 Validation Issues**: Strict validation in express-rate-limit v8.x caused blocking errors

### Current Configuration

```typescript
// src/middleware/rateLimiter.ts
const skipRateLimiting = (isProduction || isDevelopment) ? () => true : undefined;
```

**Active Rate Limiters** (currently skipped):
- `authRateLimiter`: 5 requests per 15 minutes per IP
- `apiRateLimiter`: 100 requests per 15 minutes per IP
- `sensitiveOperationRateLimiter`: 3 requests per hour per IP
- `userRateLimiter`: 1000 requests per hour per user

## Implementation Plan

### Phase 1: Setup Vercel KV Store

**Objective**: Create distributed key-value store for rate limit tracking

**Steps**:
1. Provision Vercel KV store for the project
   ```bash
   vercel env add KV_REST_API_URL
   vercel env add KV_REST_API_TOKEN
   ```

2. Install Vercel KV SDK
   ```bash
   npm install @vercel/kv
   ```

3. Create KV client configuration
   ```typescript
   // src/lib/kv.ts
   import { createClient } from '@vercel/kv';

   export const kv = createClient({
     url: process.env.KV_REST_API_URL!,
     token: process.env.KV_REST_API_TOKEN!,
   });
   ```

### Phase 2: Implement Custom Rate Limit Store

**Objective**: Create Vercel KV-backed rate limit store compatible with express-rate-limit

**Steps**:
1. Create custom store implementation
   ```typescript
   // src/middleware/kvRateLimitStore.ts
   import { kv } from '../lib/kv';
   import type { Store, Options } from 'express-rate-limit';

   export class VercelKVStore implements Store {
     async increment(key: string): Promise<{ totalHits: number; resetTime?: Date }> {
       // Implementation details
     }

     async decrement(key: string): Promise<void> {
       // Implementation details
     }

     async resetKey(key: string): Promise<void> {
       // Implementation details
     }
   }
   ```

2. Key structure for KV store:
   ```
   ratelimit:auth:{ip}:{timestamp}
   ratelimit:api:{ip}:{timestamp}
   ratelimit:user:{userId}:{timestamp}
   ratelimit:sensitive:{ip}:{timestamp}
   ```

### Phase 3: Update Rate Limiter Middleware

**Objective**: Replace in-memory store with Vercel KV store

**Steps**:
1. Update rate limiter configuration
   ```typescript
   // src/middleware/rateLimiter.ts
   import { VercelKVStore } from './kvRateLimitStore';

   const store = new VercelKVStore();

   export const authRateLimiter = rateLimit({
     windowMs: 15 * 60 * 1000,
     max: 5,
     standardHeaders: true,
     legacyHeaders: false,
     store, // Use KV store
     validate: {
       trustProxy: false,
       xForwardedForHeader: false,
     },
   });
   ```

2. Remove skip logic (enable rate limiting)
   ```typescript
   // Remove this:
   // const skipRateLimiting = (isProduction || isDevelopment) ? () => true : undefined;
   ```

3. Configure trust proxy properly
   ```typescript
   // api/index.ts
   // Already configured:
   app.set('trust proxy', true);
   ```

### Phase 4: Testing

**Objective**: Verify rate limiting works correctly in all environments

**Test Cases**:

1. **Auth Endpoint Rate Limiting**
   - Test exceeding 5 requests in 15 minutes returns 429
   - Verify rate limit resets after window expires
   - Confirm different IPs have separate limits

2. **API Endpoint Rate Limiting**
   - Test exceeding 100 requests in 15 minutes returns 429
   - Verify authenticated requests count properly
   - Confirm rate limit headers in response

3. **User-Specific Rate Limiting**
   - Test exceeding 1000 requests per hour per user
   - Verify different users have separate limits
   - Confirm fallback to IP-based for unauthenticated requests

4. **Sensitive Operations**
   - Test exceeding 3 requests per hour returns 429
   - Verify longer reset window

5. **Distributed Behavior**
   - Deploy to multiple Vercel regions
   - Verify rate limits work across regions
   - Test KV store synchronization

### Phase 5: Monitoring & Alerting

**Objective**: Track rate limiting effectiveness and issues

**Metrics to Monitor**:
- Rate limit violations per endpoint
- Most rate-limited IPs/users
- KV store latency
- Rate limit bypass attempts
- False positive rate (legitimate users blocked)

**Implementation**:
```typescript
// Existing metric tracking (already in place)
import { trackRateLimitViolation } from '../lib/metrics';

// Add KV-specific metrics
trackMetric('rate_limit_kv_latency', latencyMs);
trackMetric('rate_limit_kv_errors', errorCount);
```

### Phase 6: Documentation & Rollout

**Objective**: Document changes and deploy to production

**Steps**:
1. Update API documentation with rate limit details
2. Add rate limit headers documentation
3. Create runbook for debugging rate limit issues
4. Gradual rollout:
   - Enable for auth endpoints first (most critical)
   - Monitor for 1 week
   - Enable for API endpoints
   - Monitor for 1 week
   - Enable for all endpoints

## Configuration Reference

### Rate Limit Thresholds

| Limiter | Window | Max Requests | Use Case |
|---------|--------|--------------|----------|
| Auth | 15 min | 5 | Login, signup, password reset |
| API | 15 min | 100 | General API endpoints |
| User | 1 hour | 1000 | Per authenticated user |
| Sensitive | 1 hour | 3 | Account deletion, data exports |

### KV Store TTL

- Auth keys: 15 minutes
- API keys: 15 minutes
- User keys: 1 hour
- Sensitive keys: 1 hour

### Response Headers

```
RateLimit-Limit: 100
RateLimit-Remaining: 95
RateLimit-Reset: 1696176000
Retry-After: 900
```

## Migration Strategy

### Zero-Downtime Deployment

1. Deploy with KV store but keep `skip` enabled
2. Test KV store in production with logging only
3. Enable rate limiting for 10% of traffic (feature flag)
4. Monitor metrics for 24 hours
5. Gradually increase to 100% over 1 week
6. Remove `skip` logic completely

### Rollback Plan

If issues occur:
1. Re-enable `skip` logic via environment variable
2. Deploy immediately (< 5 minutes)
3. Investigate KV store issues
4. Fix and redeploy

## Cost Estimation

### Vercel KV Pricing (as of 2025)

- **Pro Plan**: 500MB storage, 10M operations/month included
- **Additional**: $0.40 per GB storage, $0.10 per 100K operations

### Expected Usage (conservative estimate)

- 1M API requests/month
- 3 KV operations per rate-limited request (check, increment, TTL)
- 3M KV operations/month
- ~10MB storage

**Estimated Cost**: $0-5/month (well within Pro plan limits)

## Success Criteria

- ✅ Rate limiting works across all Vercel regions
- ✅ No false positives (legitimate users blocked)
- ✅ < 10ms added latency per request
- ✅ 99.9% KV store availability
- ✅ Successful blocking of brute force attempts
- ✅ Zero production incidents during rollout

## References

- [Vercel KV Documentation](https://vercel.com/docs/storage/vercel-kv)
- [express-rate-limit with Redis](https://express-rate-limit.github.io/docs/guides/redis-store)
- [Rate Limiting Best Practices](https://cloud.google.com/architecture/rate-limiting-strategies-techniques)

## Related Files

- `src/middleware/rateLimiter.ts` - Current rate limiter implementation
- `api/index.ts` - Express app configuration with trust proxy
- `src/lib/metrics.ts` - Metrics tracking for violations

---

**Next Steps**:
1. Provision Vercel KV store
2. Create PoC implementation in feature branch
3. Testing in staging environment
4. Gradual production rollout
