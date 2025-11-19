# CORS Change (Stashed - 56858c3)

**Commit**: `56858c3 fix: CORS middleware now allows public endpoints without Origin header`

**File Modified**: `api/index.ts`

**What Changed**:
```javascript
// OLD: Rejected requests without Origin header
if (!origin) {
  logger.warn('CORS: Request without origin header', {...});
  return callback(new Error('Origin header required for CORS'));
}

// NEW: Allow requests without Origin header for public endpoints
if (!origin) {
  logger.debug('CORS: Public endpoint access without origin header', {
    timestamp: new Date().toISOString(),
  });
  return callback(null, true); // Allow access without origin
}
```

**Rationale** (from commit message):
- Allow public endpoints (health checks) without CORS origin validation
- They are non-state-changing operations (GET only)
- Logging changed from `warn` to `debug` level

**Security Note**:
- This RELAXES CORS validation
- Could allow CSRF if not carefully controlled
- Part of broader security review work (PR #14)

**Decision Made**: Reset to origin/main (56858c3 reverted)

**If Needed Again**:
1. Test failure in o-core/o-orig related to Origin header
2. Can re-apply this change with proper investigation
3. Check if requests from Metro bundlers (8081/8084) are missing Origin headers
