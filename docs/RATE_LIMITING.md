# Rate Limiting Implementation

## Overview

Rate limiting has been implemented to prevent brute force attacks, API abuse, and protect backend resources. Multiple tiers of rate limiting are applied based on endpoint sensitivity and user authentication status.

## Rate Limiting Tiers

### 1. Authentication Rate Limiter (Strictest)
**Applied to:** Authentication endpoints (login, token verification)
- **Limit:** 5 requests per 15 minutes per IP
- **Purpose:** Prevent brute force attacks on authentication
- **Resets:** After successful authentication
- **Response Code:** 429 Too Many Requests

**Example Response:**
```json
{
  "ok": false,
  "error": "Too many authentication attempts, please try again later",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": "15 minutes"
}
```

### 2. API Rate Limiter (General)
**Applied to:** All `/api/*` endpoints
- **Limit:** 100 requests per 15 minutes per IP
- **Purpose:** Prevent API abuse and DDoS
- **Response Code:** 429 Too Many Requests

### 3. Sensitive Operations Rate Limiter (Very Strict)
**Applied to:** Password resets, account deletion, etc.
- **Limit:** 3 requests per hour per IP
- **Purpose:** Extra protection for sensitive operations
- **Response Code:** 429 Too Many Requests

### 4. User Rate Limiter (Per-User)
**Applied to:** Authenticated user requests
- **Limit:** 1000 requests per hour per user
- **Purpose:** Prevent authenticated user abuse
- **Key By:** User ID (from auth context)
- **Fallback:** IP address if not authenticated

## Implementation Details

### File Structure
```
src/middleware/
├── auth.ts           # Authentication middleware (includes auth rate limiter)
└── rateLimiter.ts    # Rate limiting configurations
```

### Middleware Application

```typescript
// Authentication endpoints automatically include rate limiting
const validateAuth = createAuthMiddleware(); // Returns [rateLimiter, authHandler]

// General API rate limiting
app.use('/api', apiRateLimiter);
```

### Rate Limit Headers

Rate limit information is returned in response headers:
- `RateLimit-Limit` - Maximum requests allowed in window
- `RateLimit-Remaining` - Requests remaining in current window
- `RateLimit-Reset` - Time when the rate limit resets (Unix timestamp)

## Testing Rate Limits

### Manual Testing

1. **Test Authentication Rate Limit:**
```bash
# Make 6 requests to an auth endpoint
for i in {1..6}; do
  curl -X GET http://localhost:3000/api/v1/entries \
    -H "Authorization: Bearer invalid-token" \
    -w "\nStatus: %{http_code}\n"
done
```

Expected: First 5 requests return 401 (Unauthorized), 6th returns 429 (Rate Limited)

2. **Test General API Rate Limit:**
```bash
# Make 101 requests to any API endpoint
for i in {1..101}; do
  curl -X GET http://localhost:3000/api/v1/health \
    -w "Request $i - Status: %{http_code}\n"
done
```

Expected: First 100 requests return 200, 101st returns 429

3. **Check Rate Limit Headers:**
```bash
curl -I http://localhost:3000/api/v1/entries \
  -H "Authorization: Bearer your-token"
```

Look for:
```
RateLimit-Limit: 5
RateLimit-Remaining: 4
RateLimit-Reset: 1696176000
```

### Automated Testing

Create test file: `api/__tests__/rateLimiter.test.ts`

```typescript
import request from 'supertest';
import app from '../index';

describe('Rate Limiting', () => {
  it('should rate limit authentication attempts', async () => {
    const requests = [];

    // Make 6 auth requests
    for (let i = 0; i < 6; i++) {
      requests.push(
        request(app)
          .get('/api/v1/entries')
          .set('Authorization', 'Bearer invalid')
      );
    }

    const responses = await Promise.all(requests);

    // First 5 should fail auth (401)
    expect(responses.slice(0, 5).every(r => r.status === 401)).toBe(true);

    // 6th should be rate limited (429)
    expect(responses[5].status).toBe(429);
    expect(responses[5].body.code).toBe('RATE_LIMIT_EXCEEDED');
  });
});
```

## Monitoring Rate Limits

### Metrics Tracking

Rate limit violations are tracked in metrics:
```typescript
trackRateLimitViolation(userId, tier);
```

Tiers:
- `auth` - Authentication rate limit violations
- `api` - General API rate limit violations
- `sensitive` - Sensitive operation rate limit violations
- `user` - Per-user rate limit violations

### Logs

Rate limit violations are logged with:
```json
{
  "level": "warn",
  "message": "Authentication rate limit exceeded",
  "ip": "192.168.1.1",
  "userId": "user-123 or anonymous",
  "path": "/api/v1/entries",
  "userAgent": "Mozilla/5.0..."
}
```

### Metrics Dashboard

View rate limit metrics:
```typescript
import { getAllMetrics } from '../src/lib/metrics';

const metrics = getAllMetrics();
console.log(metrics['ratelimit.violation']);
```

## Security Considerations

### IP Spoofing Protection
- Rate limiters use `req.ip` which is properly handled by Express
- Configure Express trust proxy if behind a reverse proxy:
  ```typescript
  app.set('trust proxy', 1);
  ```

### Bypass for Authenticated Users
- Auth rate limiter skips successfully authenticated requests
- Prevents legitimate users from being blocked after successful auth

### Key Generation
- IP-based: Uses `req.ip || req.socket.remoteAddress`
- User-based: Uses `user:${userId}` for authenticated requests
- Fallback to IP if user context unavailable

## Configuration

### Adjusting Limits

Edit `src/middleware/rateLimiter.ts`:

```typescript
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // Adjust window
  max: 5,                    // Adjust max requests
  // ... other options
});
```

### Environment Variables

Consider making limits configurable:
```typescript
max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '5', 10)
windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000', 10)
```

## Production Recommendations

1. **Use Redis Store** for distributed rate limiting:
   ```bash
   npm install rate-limit-redis
   ```

   ```typescript
   import RedisStore from 'rate-limit-redis';

   const store = new RedisStore({
     client: redisClient,
     prefix: 'rl:',
   });
   ```

2. **Monitor Metrics** - Set up alerts for high rate limit violations

3. **Adjust Limits** - Fine-tune based on actual usage patterns

4. **Whitelist IPs** - Add trusted IPs to skip rate limiting

5. **Load Balancer** - Configure X-Forwarded-For headers properly

## Troubleshooting

### Common Issues

**Issue:** Legitimate users being blocked
**Solution:** Increase rate limits or implement user-specific whitelist

**Issue:** Rate limit not working
**Solution:** Check Express trust proxy settings if behind load balancer

**Issue:** Different instances have different counts
**Solution:** Implement Redis-based store for distributed rate limiting

### Debug Mode

Enable debug logging:
```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  // ... config
  skip: (req) => {
    console.log('Rate limit check:', req.ip, req.path);
    return false;
  }
});
```

## Related Files

- `src/middleware/auth.ts` - Authentication with rate limiting
- `src/middleware/rateLimiter.ts` - Rate limit configurations
- `src/lib/metrics.ts` - Metrics tracking
- `api/index.ts` - Express app with rate limiting applied

## References

- [express-rate-limit Documentation](https://github.com/express-rate-limit/express-rate-limit)
- [OWASP: Brute Force Protection](https://owasp.org/www-community/controls/Blocking_Brute_Force_Attacks)
- [RFC 6585: Additional HTTP Status Codes](https://tools.ietf.org/html/rfc6585#section-4)
