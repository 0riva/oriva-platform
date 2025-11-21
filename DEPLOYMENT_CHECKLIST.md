# Security Fixes Deployment Checklist

**Branch:** `claude/security-review-api-01879GCdRUkfFYvDEc34hrkK`
**Date:** 2025-11-14
**Impact:** Critical security improvements - Required for production

---

## 🚨 Pre-Deployment Requirements

### 1. Database Migration

- [ ] **Run database migration to create `developer_api_keys` table**

  ```bash
  # From o-core repository (migrations are managed there)
  cd o-core
  supabase db reset  # Applies all migrations including new API keys table

  # Or apply specific migration via Supabase dashboard:
  # SQL Editor > New Query > Paste contents from o-core/supabase/migrations/20251121220015_create_developer_api_keys.sql > Run
  ```

- [ ] **Verify table was created successfully**
  ```sql
  SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'oriva_platform'
    AND table_name = 'developer_api_keys'
  );
  ```

### 2. Redis Configuration (Production Only)

- [ ] **Create Upstash Redis instance**
  - Go to https://upstash.com
  - Create a new Redis database
  - Note the REST URL and token

- [ ] **Set environment variables in production**

  ```bash
  UPSTASH_REDIS_REST_URL=https://your-redis-instance.upstash.io
  UPSTASH_REDIS_REST_TOKEN=your-token-here
  ```

- [ ] **Verify Redis connection** (optional)
  ```bash
  curl -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN" \
    "$UPSTASH_REDIS_REST_URL/ping"
  # Should return: {"result":"PONG"}
  ```

### 3. API Key Migration

- [ ] **Install dependencies**

  ```bash
  npm install
  ```

- [ ] **Run API key migration script**

  ```bash
  # Generate new API keys
  SUPABASE_URL=your-url SUPABASE_SERVICE_ROLE_KEY=your-key \
    ts-node scripts/migrate-api-keys.ts

  # Save the generated keys securely!
  ```

- [ ] **Save generated API keys in secure location**
  - [ ] Add to password manager (1Password, LastPass, etc.)
  - [ ] Document which key belongs to which app
  - [ ] Note the creation date and expiration (if any)

- [ ] **Update application configurations**
  - [ ] Replace old API keys in client applications
  - [ ] Test each key individually before proceeding

### 4. Environment Variables Cleanup

- [ ] **Remove deprecated environment variables** (do this AFTER migration succeeds)
  - [ ] `API_KEY_PLATFORM` - No longer used
  - [ ] `API_KEY_HUGO_LOVE` - No longer used
  - [ ] `API_KEY_HUGO_CAREER` - No longer used

- [ ] **Ensure required variables are set**

  ```bash
  # Required in all environments:
  SUPABASE_URL=https://your-project.supabase.co
  SUPABASE_ANON_KEY=eyJ...
  SUPABASE_SERVICE_ROLE_KEY=eyJ...

  # Required in production only:
  UPSTASH_REDIS_REST_URL=https://...
  UPSTASH_REDIS_REST_TOKEN=...
  NODE_ENV=production

  # Optional - development only:
  DISABLE_RATE_LIMIT=true  # Only for local dev
  ```

- [ ] **Verify NO test-mode variables in production**
  - [ ] `ALLOW_TEST_TOKENS` should NOT be set
  - [ ] `DISABLE_RATE_LIMIT` should NOT be set

---

## 📋 Deployment Steps

### Step 1: Merge PR

- [ ] Review all code changes
- [ ] Ensure all tests pass
- [ ] Get team approval (if required)
- [ ] Merge PR to main branch

### Step 2: Deploy to Staging (if available)

- [ ] Deploy to staging environment
- [ ] Run database migration
- [ ] Configure Redis
- [ ] Migrate API keys
- [ ] Run integration tests
- [ ] Verify rate limiting works
- [ ] Verify API key authentication works
- [ ] Check logs for errors

### Step 3: Deploy to Production

- [ ] **Before deployment:**
  - [ ] Verify all pre-deployment requirements completed
  - [ ] Backup database (if not auto-backed up)
  - [ ] Notify team of deployment window

- [ ] **Deploy:**
  - [ ] Run database migration
  - [ ] Deploy application code
  - [ ] Verify deployment succeeded

- [ ] **Post-deployment verification:**
  - [ ] Check health endpoint: `/health`
  - [ ] Verify rate limiting is active (check logs)
  - [ ] Test API key authentication
  - [ ] Monitor error rates

---

## ✅ Post-Deployment Testing

### 1. Health Check

```bash
curl https://your-api.com/health

# Expected response:
# {
#   "status": "healthy",
#   "timestamp": "2025-11-14T...",
#   "version": "1.0.0"
# }
```

### 2. Rate Limiting Test

```bash
# Test auth rate limiting (should block after 5 attempts)
for i in {1..10}; do
  echo "Request $i:"
  curl -X POST https://your-api.com/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}' \
    -w "\nHTTP Status: %{http_code}\n\n"
  sleep 1
done

# Expected: First 5 return 401, remaining return 429 with retry-after header
```

### 3. API Key Authentication Test

```bash
# Test with valid key
curl https://your-api.com/api/v1/platform/apps \
  -H "X-API-Key: oriva_pk_live_your_key_here" \
  -w "\nHTTP Status: %{http_code}\n"

# Expected: 200 OK with app list

# Test with invalid key
curl https://your-api.com/api/v1/platform/apps \
  -H "X-API-Key: invalid_key" \
  -w "\nHTTP Status: %{http_code}\n"

# Expected: 401 UNAUTHORIZED
```

### 4. RLS Enforcement Test

```bash
# Test user request (should enforce RLS)
curl https://your-api.com/api/v1/apps/profiles \
  -H "Authorization: Bearer <valid-user-jwt>" \
  -H "X-App-ID: your-app-id" \
  -w "\nHTTP Status: %{http_code}\n"

# Expected: 200 OK with only user's accessible data
```

### 5. Verify Rate Limiting Metrics

```bash
# Check application logs for rate limiting initialization
# Should see: "Rate limiting enabled with Redis store"

# If using Vercel, check logs:
vercel logs --follow

# Look for:
# ✓ Rate limiting enabled with Redis store
# ⚠ Rate limit exceeded for auth endpoint (when testing)
```

---

## 🔍 Monitoring

### Metrics to Watch (First 24 Hours)

- [ ] **Error rate** - Should remain stable or decrease
- [ ] **Authentication failures** - Expected increase due to rate limiting (this is good!)
- [ ] **429 responses** - Monitor for false positives
- [ ] **API latency** - Should remain stable (minimal impact from hashing)
- [ ] **Redis connection errors** - Should be zero

### Alerts to Configure

```bash
# Example alerts (adjust for your monitoring system)

# 1. High rate of API key validation failures
#    Alert if: validation_failures > 100/min for 5 min

# 2. Rate limiting not working
#    Alert if: rate_limit_store_errors > 0

# 3. Redis connection failures
#    Alert if: redis_connection_errors > 0

# 4. Excessive rate limit blocks
#    Alert if: 429_responses > 1000/hour (adjust threshold)
```

### Log Queries

```bash
# Search for rate limit violations
grep "Rate limit exceeded" logs.txt

# Search for API key failures
grep "Invalid API key" logs.txt

# Search for Redis errors
grep "Redis" logs.txt | grep -i error
```

---

## 🚨 Rollback Plan

If critical issues occur:

### Option 1: Quick Rollback (Disable Rate Limiting)

```bash
# Temporary workaround - set in production:
DISABLE_RATE_LIMIT=true

# Re-deploy
# This re-enables the vulnerability but restores service
```

### Option 2: Full Rollback

```bash
# Revert to previous deployment
git revert <commit-hash>
git push

# Re-deploy previous version
# Note: This reverts ALL security fixes
```

### Option 3: Partial Rollback (Keep some fixes)

1. Keep rate limiting disabled temporarily
2. Keep API key hashing (must migrate keys back if reverting)
3. Keep RLS enforcement
4. Investigate and fix issues
5. Re-enable rate limiting when ready

---

## 📊 Success Criteria

Deployment is considered successful when:

- [x] All tests pass in production
- [x] Rate limiting is active and working correctly
- [x] API key authentication works with new keys
- [x] No increase in error rates (except expected 429s)
- [x] No Redis connection errors
- [x] No critical errors in logs
- [x] User authentication still works normally
- [x] All client applications can authenticate

---

## 📞 Support Contacts

If you encounter issues:

1. **Check the logs first**
   - Application logs
   - Redis logs (Upstash dashboard)
   - Supabase logs

2. **Common Issues:**
   - Redis not configured → Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
   - API keys not working → Verify keys were migrated correctly
   - Rate limiting too aggressive → Adjust limits in `src/middleware/rateLimiter.ts`
   - RLS blocking requests → Verify user has correct permissions in database

3. **Emergency Contacts:**
   - Platform Team: [contact info]
   - Security Team: [contact info]
   - On-Call Engineer: [contact info]

---

## 📚 Additional Resources

- **Security Audit Report:** See initial security review in conversation
- **Implementation Guide:** `SECURITY_FIXES.md`
- **Migration Script:** `scripts/migrate-api-keys.ts`
- **Database Schema:** `o-core/supabase/migrations/20251121220015_create_developer_api_keys.sql`
- **Migration Authority:** All database migrations managed in o-core repository

---

## ✅ Final Checklist

Before marking deployment complete:

- [ ] All pre-deployment requirements met
- [ ] Database migration successful
- [ ] Redis configured and connected
- [ ] API keys migrated and tested
- [ ] Old environment variables removed
- [ ] All post-deployment tests passed
- [ ] Monitoring and alerts configured
- [ ] Team notified of changes
- [ ] Documentation updated
- [ ] Rollback plan reviewed and understood

**Deployment Completed By:** ******\_\_\_******
**Date:** ******\_\_\_******
**Time:** ******\_\_\_******

**Sign-off:**

- [ ] DevOps Lead
- [ ] Security Lead
- [ ] Platform Lead
