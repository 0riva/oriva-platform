# Security Findings & Remediation Log

**Last Updated:** 2025-12-21
**Scope:** Comprehensive security review and remediation

---

## ✅ REMEDIATED (2025-12-21)

### SQL Injection Prevention - CRITICAL FIXES

**Files Modified:**

- `src/express/middleware/auth.ts` - Added UUID validation for X-Profile-ID header
- `src/express/routes/hugo-love/profiles.ts` - Added `validateAndEscapeUuid()` helper, fixed all raw SQL interpolation
- `src/express/routes/hugo-love/matches.ts` - Added UUID validation for profileId and matchId
- `src/express/routes/hugo-love/messages.ts` - Added UUID validation for all IDs
- `src/express/routes/hugo-love/swipe.ts` - Added UUID validation for profileId and targetUserId

**Remediation Pattern Applied:**

```typescript
// Before (VULNERABLE):
const userId = req.profileId || req.user!.id;
.or(`user1_id.eq.${userId}...`)

// After (SECURE):
const rawUserId = req.profileId || req.user!.id;
if (!isValidUuid(rawUserId)) {
  res.status(400).json({ error: 'Invalid profile ID format', code: 'INVALID_PROFILE_ID' });
  return;
}
const userId = rawUserId;
```

### Dependency Vulnerabilities (Partial)

**Fixed via `npm audit fix`:**

- ✅ next.js 15.5.x → 15.5.9 (RCE vulnerability fixed)
- ✅ @sentry/node header leak fixed
- ✅ glob CLI command injection fixed
- ✅ js-yaml prototype pollution fixed

**Pending (transitive dependencies in @vercel/node@5.5.16):**

- ⚠️ esbuild <=0.24.2 - dev server vulnerability (moderate, dev-only)
- ⚠️ path-to-regexp 4.0.0-6.2.2 - regex DOS (high)
- ⚠️ undici <=5.28.5 - random values + DOS (moderate)

_Note: These are transitive deps from @vercel/node which we cannot directly fix. Vercel team has not updated._

---

# Additional Security Findings - Public API Best Practices

**Date:** 2025-11-14
**Scope:** Supplementary security review
**Priority:** MEDIUM to HIGH

These are additional security concerns identified beyond the 3 critical issues already fixed.

---

## 🟠 HIGH PRIORITY FINDINGS

### 1. ~~**CORS Configuration Allows Requests Without Origin**~~ ✅ ANALYZED - NOT A VULNERABILITY

**File:** `api/index.ts:284`

**Original Concern:**
CORS allows requests without Origin header while credentials are used.

**Analysis Result (2025-12-21):**
This is **NOT a vulnerability** for this API because:

1. This API uses **token-based authentication** (X-API-Key + Bearer JWT), NOT cookies
2. CSRF attacks exploit cookies that browsers automatically attach to requests
3. Since our auth is header-based (must be explicitly added by client code), CSRF is not applicable
4. No-origin requests come from: server-to-server, curl, monitoring, mobile apps, webhooks

**Documentation Added:**

```typescript
// SECURITY: Dynamic CORS for marketplace applications
// Note on CSRF: This API uses token-based authentication (X-API-Key + Bearer JWT), NOT cookies.
// CSRF attacks exploit cookies that browsers automatically attach to requests.
// Since our auth is header-based (must be explicitly added by client code), CSRF is not applicable.
// Therefore, allowing no-origin requests is safe as security is enforced by token validation.
```

**Status:** ✅ No action needed - correctly implemented

---

### 2. **HTTP Methods Too Permissive in CORS**

**File:** `api/index.ts:332`

**Issue:**

```typescript
methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],  // ❌ Too permissive
```

**Problem:**

- DELETE method allowed globally via CORS
- PUT method allowed globally
- Should be restricted per-endpoint based on actual needs

**Impact:** MEDIUM - Potential for unintended data modification

**Recommendation:**

```typescript
// Option 1: Restrict to safe methods globally
methods: (['GET', 'POST', 'OPTIONS'],
  // Option 2: Use per-route CORS configuration
  app.use(
    '/api/v1/admin/*',
    cors({ methods: ['GET', 'POST', 'PUT', 'DELETE'] })
  ));
app.use('/api/v1/public/*', cors({ methods: ['GET', 'POST'] }));
```

---

### 3. **Dependency Vulnerabilities Detected**

**Severity:** MODERATE (dev dependencies)

**Issues Found:**

```bash
1. esbuild <=0.24.2 - Moderate severity
   - Enables websites to send requests to dev server
   - CVSS: Moderate
   - Fix: Update to esbuild >0.24.2

2. js-yaml <4.1.1 - Moderate severity
   - Prototype pollution vulnerability
   - Fix: Update to js-yaml >=4.1.1

3. Multiple Jest dependencies - Low severity
   - Testing framework vulnerabilities
   - Impact limited to development
```

**Impact:** MODERATE - Dev dependencies, but should be fixed

**Recommendation:**

```bash
# Update dependencies
npm update esbuild
npm update js-yaml

# For breaking changes:
npm audit fix --force  # Review changes carefully

# Or update package.json:
{
  "devDependencies": {
    "esbuild": "^0.24.3",  # Update version
    "js-yaml": "^4.1.1"     # Update version
  }
}
```

---

## 🟡 MEDIUM PRIORITY FINDINGS

### 4. **No HTTPS Enforcement**

**Issue:** No code found that forces HTTPS connections

**Problem:**

- API could be accessed over HTTP in misconfigured environments
- Credentials/tokens could be transmitted in plaintext

**Impact:** MEDIUM - Man-in-the-middle attacks possible

**Recommendation:**

```typescript
// Add HTTPS enforcement middleware
app.use((req, res, next) => {
  // Skip in development
  if (process.env.NODE_ENV === 'development') {
    return next();
  }

  // Check if request is secure
  if (!req.secure && req.get('x-forwarded-proto') !== 'https') {
    return res.status(403).json({
      code: 'HTTPS_REQUIRED',
      message: 'HTTPS required for API access',
    });
  }

  next();
});

// Or use Helmet's HSTS
app.use(
  helmet({
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);
```

---

### 5. **Sensitive Data in Console Logs**

**Files:** Multiple locations using `console.log`, `console.error`

**Issue:**

```typescript
// websocketHandler.ts:42
console.log(`[WebSocket] User ${userId} connected: ${connectionId}`);

// schemaRouter.ts:132
console.error('Schema routing error:', error);
// ^ Could expose sensitive error details
```

**Problem:**

- User IDs logged to console (PII)
- Error objects may contain sensitive data
- Console logs often sent to centralized logging (Vercel, CloudWatch)

**Impact:** MEDIUM - PII exposure, potential data breach

**Recommendation:**

```typescript
// Use structured logging with sanitization
import { logger } from '../utils/logger';

// Good: Sanitized logging
logger.info('WebSocket connection established', {
  userId: sanitizeUserId(userId), // Hash or mask
  connectionId: connectionId.substring(0, 8), // Truncate
});

// Good: Filtered error logging
logger.error('Schema routing error', {
  errorCode: error.code,
  errorMessage: error.message,
  // DON'T log: error.details, full stack traces with data
});

// Helper to sanitize
function sanitizeUserId(userId: string): string {
  // Return first 8 chars + hash of rest
  return userId ? `${userId.substring(0, 8)}...` : 'unknown';
}
```

---

### 6. **JWT Token Expiration Not Validated**

**File:** `src/express/middleware/auth.ts`

**Issue:**

```typescript
// No explicit check for token expiration in code
const {
  data: { user },
  error,
} = await supabase.auth.getUser(token);
// Relies on Supabase to validate expiration
```

**Problem:**

- Token expiration relies entirely on Supabase
- No explicit expiration time enforced in code
- No token refresh mechanism visible

**Impact:** MEDIUM - Long-lived tokens if Supabase configuration changes

**Recommendation:**

```typescript
// Add explicit token expiration check
const {
  data: { user },
  error,
} = await supabase.auth.getUser(token);

if (user) {
  // Check token expiration explicitly
  const tokenPayload = JSON.parse(atob(token.split('.')[1]));
  const expiresAt = tokenPayload.exp * 1000; // Convert to ms

  if (Date.now() >= expiresAt) {
    res.status(401).json({
      code: 'TOKEN_EXPIRED',
      message: 'Token has expired',
    });
    return;
  }

  // Warn if token expires soon (< 5 minutes)
  if (expiresAt - Date.now() < 5 * 60 * 1000) {
    res.setHeader('X-Token-Refresh-Required', 'true');
  }
}
```

---

### 7. **No Content-Type Validation**

**Issue:** No middleware to validate request Content-Type

**Problem:**

- Accepts any Content-Type
- Could lead to parsing errors or unexpected behavior
- CSRF attacks may exploit missing Content-Type checks

**Impact:** LOW-MEDIUM - Potential for CSRF, parser confusion

**Recommendation:**

```typescript
// Add Content-Type validation middleware
const validateContentType = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Skip for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const contentType = req.get('content-type');

  if (!contentType) {
    return res.status(400).json({
      code: 'MISSING_CONTENT_TYPE',
      message: 'Content-Type header required',
    });
  }

  // Allow only specific content types
  const allowedTypes = [
    'application/json',
    'application/x-www-form-urlencoded',
    'multipart/form-data',
  ];

  if (!allowedTypes.some((type) => contentType.includes(type))) {
    return res.status(415).json({
      code: 'UNSUPPORTED_MEDIA_TYPE',
      message: `Content-Type must be one of: ${allowedTypes.join(', ')}`,
    });
  }

  next();
};

app.use(validateContentType);
```

---

### 8. ~~**Missing Security Headers in Some Responses**~~ ✅ FIXED

**Issue:** Helmet is used in `server.ts` but not in legacy `api/index.ts`

**Fixed (2025-12-21):**
Helmet is now properly configured in `api/index.ts` with API-appropriate settings:

```typescript
app.use(
  helmet({
    contentSecurityPolicy: false, // APIs don't serve HTML
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    frameguard: { action: 'deny' },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginEmbedderPolicy: false, // APIs don't embed cross-origin content
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow cross-origin API access
    dnsPrefetchControl: { allow: false },
    ieNoOpen: true,
    originAgentCluster: true,
  })
);
```

**Status:** ✅ Fixed

---

## 🟢 LOW PRIORITY (BEST PRACTICES)

### 9. **API Versioning Not Strictly Enforced**

**Issue:** `/api/v1` prefix exists but no version negotiation

**Recommendation:** Add version validation, deprecation headers

---

### 10. **No Request ID Tracking**

**Issue:** No unique request ID for correlation

**Recommendation:**

```typescript
import { v4 as uuidv4 } from 'uuid';

app.use((req, res, next) => {
  req.id = req.get('x-request-id') || uuidv4();
  res.setHeader('x-request-id', req.id);
  next();
});
```

---

## 📊 Priority Summary

| Issue                | Severity  | Effort | Impact            |
| -------------------- | --------- | ------ | ----------------- |
| 1. CORS no-origin    | 🟠 HIGH   | Low    | CSRF attacks      |
| 2. CORS methods      | 🟠 HIGH   | Low    | Data modification |
| 3. Dependencies      | 🟡 MEDIUM | Low    | Dev environment   |
| 4. HTTPS enforcement | 🟡 MEDIUM | Low    | MITM attacks      |
| 5. Sensitive logging | 🟡 MEDIUM | Medium | PII exposure      |
| 6. JWT expiration    | 🟡 MEDIUM | Low    | Token security    |
| 7. Content-Type      | 🟡 MEDIUM | Low    | CSRF, parsing     |
| 8. Security headers  | 🟡 MEDIUM | Low    | XSS, clickjacking |
| 9. API versioning    | 🟢 LOW    | Medium | Future-proofing   |
| 10. Request ID       | 🟢 LOW    | Low    | Observability     |

---

## 🚀 Recommended Action Plan

### Immediate (This Sprint)

1. ✅ Fix CORS no-origin issue
2. ✅ Restrict CORS methods
3. ✅ Add HTTPS enforcement
4. ✅ Update dependencies

### Short Term (Next Sprint)

5. ✅ Sanitize console logs
6. ✅ Add Content-Type validation
7. ✅ Add security headers to legacy API
8. ✅ Add explicit JWT expiration check

### Long Term (Backlog)

9. ✅ Implement proper API versioning with deprecation
10. ✅ Add request ID tracking for better observability

---

## 📝 Notes

- All critical vulnerabilities from initial audit are already fixed ✅
- These additional findings are **enhancements** to further harden security
- Priority is **MEDIUM** - address in next sprint, not blocking production
- Total estimated effort: **~8 hours** for all fixes

---

## 🔗 References

- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [CORS Security Best Practices](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Helmet.js Security Headers](https://helmetjs.github.io/)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
