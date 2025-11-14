# Security Fixes - 2025-11-14

This document outlines critical security improvements implemented to address vulnerabilities identified in the security audit.

## Critical Fixes Implemented

### 1. Rate Limiting Enabled in Production ✅

**Issue:** Rate limiting was completely disabled in production, leaving the API vulnerable to DoS attacks and brute force attempts.

**Fix:**
- Implemented distributed rate limiting using Upstash Redis for production
- Falls back to in-memory rate limiting for development
- Rate limits now actively protect all endpoints

**Configuration Required:**
```bash
# Add to production environment variables:
UPSTASH_REDIS_REST_URL=https://your-redis-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here

# Optional: Disable rate limiting in development only
DISABLE_RATE_LIMIT=true  # Development only - DO NOT use in production
```

**Rate Limits:**
- Authentication endpoints: 5 requests per 15 minutes
- General API endpoints: 100 requests per 15 minutes
- Sensitive operations: 3 requests per hour
- Authenticated users: 1000 requests per hour

**Files Modified:**
- `src/middleware/rateLimiter.ts`

---

### 2. API Key Hashing Implemented ✅

**Issue:** API keys were stored as plaintext in environment variables, vulnerable to leaks and timing attacks.

**Fix:**
- API keys now stored as SHA-256 hashes in `developer_api_keys` table
- Constant-time hash comparison prevents timing attacks
- Keys validated against database, not environment variables
- Automatic usage tracking and expiration checking

**Migration Required:**
```sql
-- The developer_api_keys table should have these columns:
-- id, app_id, key_hash (SHA-256), is_active, usage_count, last_used_at, expires_at

-- To generate a key hash (Node.js):
const crypto = require('crypto');
const key = 'oriva_pk_live_your_secret_key_here';
const hash = crypto.createHash('sha256').update(key).digest('hex');
console.log(hash);
```

**Breaking Change:** Old environment-based API keys (`API_KEY_PLATFORM`, etc.) are no longer used. All API keys must be:
1. Prefixed with `oriva_pk_` (e.g., `oriva_pk_live_abc123...`)
2. Hashed with SHA-256 and stored in `developer_api_keys` table
3. Marked as `is_active = true` in the database

**Files Modified:**
- `src/express/middleware/auth.ts`

---

### 3. Service Role Key Removed from User Requests ✅

**Issue:** Service role key (which bypasses Row-Level Security) was being used for user-initiated requests, creating privilege escalation risk.

**Fix:**
- All user-facing requests now use anon key with RLS enforcement
- Service role key reserved for admin-only operations
- Clear documentation on when to use each client type

**Important:**
- User requests automatically enforce RLS policies
- For admin operations that need to bypass RLS, explicitly use:
  ```typescript
  import { getSupabaseServiceClient } from '../config/supabase';
  const adminClient = getSupabaseServiceClient();
  ```

**Files Modified:**
- `src/express/middleware/schemaRouter.ts`

---

### 4. Test Mode Bypass Hardened ✅

**Issue:** Test authentication bypass could potentially be left enabled in production.

**Fix:**
- Test bypass now requires THREE conditions:
  1. `NODE_ENV=test`
  2. `ALLOW_TEST_TOKENS=true`
  3. `VERCEL_ENV` must be undefined (not running on Vercel)
- Impossible to accidentally enable in production deployments

**Files Modified:**
- `src/express/middleware/auth.ts`

---

## Additional Security Improvements

### Request Size Limits ✅
Already configured:
- JSON body limit: 10mb
- URL-encoded body limit: 10mb
- Prevents memory exhaustion attacks

### Security Headers ✅
Already configured via Helmet:
- Content Security Policy
- X-Frame-Options
- X-Content-Type-Options
- Strict-Transport-Security

### Request Timeout ✅
Already configured:
- 30 second timeout on all requests
- Prevents slowloris attacks

---

## Environment Variables Required

### Production (Required):
```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ... # For RLS-protected operations
SUPABASE_SERVICE_ROLE_KEY=eyJ... # For admin operations only

# Rate Limiting (Production)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# Environment
NODE_ENV=production
```

### Development (Optional):
```bash
# Development only - allows disabling rate limiting
DISABLE_RATE_LIMIT=true

# Never set these in production:
ALLOW_TEST_TOKENS=true  # Only for test environment
```

---

## Security Checklist

Before deploying to production:

- [ ] `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` configured
- [ ] All API keys migrated to database with SHA-256 hashing
- [ ] Old environment-based API keys removed
- [ ] `ALLOW_TEST_TOKENS` NOT set in production environment
- [ ] `DISABLE_RATE_LIMIT` NOT set in production environment
- [ ] Service role key kept secret and never exposed to client
- [ ] CORS origins properly configured for production domains

---

## Testing the Fixes

### Test Rate Limiting:
```bash
# Should be blocked after 5 attempts:
for i in {1..10}; do
  curl -X POST https://your-api.com/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}'
  sleep 1
done
```

### Test API Key Validation:
```bash
# Valid key (replace with your actual key):
curl https://your-api.com/api/v1/platform/apps \
  -H "X-API-Key: oriva_pk_live_your_key_here"

# Invalid key (should return 401):
curl https://your-api.com/api/v1/platform/apps \
  -H "X-API-Key: invalid_key"
```

### Test RLS Enforcement:
```bash
# User requests should enforce RLS:
curl https://your-api.com/api/v1/apps/profiles \
  -H "Authorization: Bearer <user-jwt-token>" \
  -H "X-App-ID: your-app-id"

# Should only return data user has access to
```

---

## Monitoring Recommendations

1. **Set up alerts for:**
   - Rate limit violations (429 responses)
   - Failed authentication attempts
   - API key validation failures
   - Service role key usage (should be rare)

2. **Monitor metrics:**
   - Request rate per IP
   - Authentication success/failure ratio
   - API key usage patterns
   - Response times

3. **Regular audits:**
   - Review active API keys monthly
   - Check for expired keys
   - Audit service role key usage
   - Review rate limit effectiveness

---

## Next Steps (Recommended)

### Short Term:
- [ ] Implement CSRF protection for cookie-based sessions (if added)
- [ ] Add security event logging with structured logs
- [ ] Set up automated security scanning (Snyk, Semgrep)

### Medium Term:
- [ ] Implement API key rotation mechanism
- [ ] Add IP allowlisting for admin operations
- [ ] Set up anomaly detection for suspicious patterns

### Long Term:
- [ ] Regular penetration testing
- [ ] Security awareness training
- [ ] Incident response planning
- [ ] Bug bounty program

---

## Support

For questions about these security fixes:
1. Review this document thoroughly
2. Check the inline code comments
3. Consult the main security audit report
4. Contact the security team

**Last Updated:** 2025-11-14
