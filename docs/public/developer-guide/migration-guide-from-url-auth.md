# Migration Guide: URL Authentication to Secure Pattern

**For existing implementations using URL-based authentication**

## Overview

If you currently use URL parameters for authentication in localhost development, this guide helps you migrate to secure patterns without breaking your workflow.

## Current Pattern Assessment

### If you're using this pattern:
```javascript
// Current approach - needs migration
window.location.href = `http://localhost:3000/?access_token=${token}&user_id=${userId}`;
```

**Risk Level**: High - tokens exposed in URLs
**Action**: Migrate to secure pattern
**Timeline**: Recommend within 30 days

## Migration Strategy

### Phase 1: Add Secure Authentication (Parallel)

Add the secure pattern alongside your existing one:

```typescript
// Add secure endpoint
// api/auth/secure-login.ts
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).end();
    }

    const { token, userId } = req.body;

    // Your existing validation logic
    const isValid = await validateToken(token);
    if (!isValid) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    // Set secure cookie instead of URL parameter
    res.setHeader('Set-Cookie', [
        `auth_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=3600`
    ]);

    res.status(200).json({ success: true });
}
```

### Phase 2: Update Login Flow

Create a secure login form:

```html
<!-- secure-dev-login.html -->
<form id="secureLogin">
    <input type="hidden" id="token" name="token">
    <input type="hidden" id="userId" name="userId">
    <button type="submit">Secure Login</button>
</form>

<script>
    // Get your existing token/userId (however you currently do it)
    const token = getExistingToken();
    const userId = getExistingUserId();

    document.getElementById('token').value = token;
    document.getElementById('userId').value = userId;

    document.getElementById('secureLogin').addEventListener('submit', async (e) => {
        e.preventDefault();

        const response = await fetch('/api/auth/secure-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, userId }),
            credentials: 'same-origin'
        });

        if (response.ok) {
            window.location.href = '/dashboard';
        }
    });
</script>
```

### Phase 3: Update API Calls

Modify your existing API calls to use cookies:

```typescript
// Before: Manual token handling
const response = await fetch('/api/data', {
    headers: {
        'Authorization': `Bearer ${urlToken}`
    }
});

// After: Automatic cookie handling
const response = await fetch('/api/data', {
    credentials: 'same-origin' // Includes cookies automatically
});
```

### Phase 4: Update Middleware

Modify your auth middleware to read from cookies:

```typescript
// middleware/auth.ts
export function authMiddleware(req: NextApiRequest, res: NextApiResponse, next: NextFunction) {
    // Support both patterns during migration
    let token = req.cookies.auth_session;  // New secure way

    if (!token) {
        // Fallback to existing URL method (remove after migration)
        token = req.query.access_token as string;
    }

    if (!token) {
        return res.status(401).json({ error: 'No authentication' });
    }

    // Your existing validation logic
    validateAndProceed(token, req, res, next);
}
```

## Testing Your Migration

### 1. Test Secure Flow
```bash
# Start your app
npm run dev

# Open secure login page
open http://localhost:3000/secure-dev-login.html

# Verify:
# ✅ No tokens in URL after login
# ✅ Authentication works
# ✅ API calls succeed
```

### 2. Verify Security
```bash
# Check browser dev tools:
# ✅ HttpOnly cookie set
# ✅ No tokens in Network tab URLs
# ✅ No tokens in browser history
```

## Rollback Plan

If something breaks during migration:

```typescript
// Keep your existing URL auth as backup
if (process.env.MIGRATION_ROLLBACK === 'true') {
    // Use your existing URL-based auth
    return useExistingURLAuth();
}

// Use new secure auth
return useSecureAuth();
```

## Timeline Recommendations

### Week 1: Setup
- Add secure endpoints
- Create secure login form
- Test in isolation

### Week 2: Migration
- Update your dev workflow to use secure form
- Test all functionality
- Keep URL method as backup

### Week 3: Validation
- Remove URL authentication fallback
- Update all API calls
- Security audit

### Week 4: Cleanup
- Remove old URL-based code
- Update documentation
- Security validation

## Minimal Changes Option

If you want to keep most of your existing code, this minimal change improves security:

```typescript
// Minimal security improvement
// Instead of: window.location.href = `/?access_token=${token}`

// Use sessionStorage + redirect:
sessionStorage.setItem('temp_auth', JSON.stringify({ token, userId }));
window.location.href = '/dashboard';

// In your app startup:
const tempAuth = sessionStorage.getItem('temp_auth');
if (tempAuth) {
    const { token, userId } = JSON.parse(tempAuth);
    sessionStorage.removeItem('temp_auth'); // Clean up immediately

    // Set secure cookie via API call
    await fetch('/api/auth/secure-login', {
        method: 'POST',
        body: JSON.stringify({ token, userId })
    });
}
```

## Benefits After Migration

### Security Improvements ✅
- No tokens in URLs, logs, or history
- HTTP-only cookies prevent XSS attacks
- Secure, SameSite cookies prevent CSRF
- No accidental token sharing via copy/paste URLs

### Developer Experience ✅
- Same functionality as before
- Better debugging (no tokens cluttering URLs)
- More professional development setup
- Easier to share localhost URLs with teammates

## Support

If you run into issues during migration:
1. Check the troubleshooting section in SECURE-localhost-development.md
2. Verify your cookie settings match the examples
3. Test with browser dev tools Network tab
4. Ensure your API endpoints support both patterns during transition

## Next Steps

After completing migration:
1. Review the full [SECURE Localhost Development Guide](./SECURE-localhost-development.md)
2. Consider implementing additional security features
3. Share your secure setup with your team
4. Document your specific configuration for future reference

---

**Timeline**: Most teams complete this migration in 1-2 weeks with minimal disruption to development workflow.