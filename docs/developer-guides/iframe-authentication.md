# Iframe Authentication Bridge

**For apps running embedded within Oriva platform**

## Quick Setup

When your app runs in an iframe, localStorage is blocked. Use this authentication pattern:

### 1. Request Tokens from Parent
```javascript
window.parent.postMessage({
  type: 'ORIVA_REQUEST_AUTH',
  appId: 'your-app-id'
}, '*');
```

### 2. Receive & Store Tokens
```javascript
window.addEventListener('message', (event) => {
  if (event.data?.type === 'ORIVA_AUTH_TOKEN') {
    // Store in memory (not localStorage - blocked in iframe)
    this.authTokens = event.data.data;
  }
});
```

### 3. Use for API Calls
```javascript
fetch('/api/endpoint', {
  headers: {
    'Authorization': `Bearer ${this.authTokens.accessToken}`
  }
});
```

## Essential Requirements

- **15-second timeout** minimum (not 5 seconds)
- **Memory storage** (localStorage blocked in cross-origin iframe)
- **Retry logic** with exponential backoff
- **URL parameter fallback** for initial auth

## Message Types

| Send | Receive |
|------|------------|
| `ORIVA_REQUEST_AUTH` | `ORIVA_AUTH_TOKEN` |

## Common Issues

❌ **localStorage access** → Use memory storage
❌ **5-second timeout** → Increase to 15+ seconds
❌ **No retry logic** → Add exponential backoff

## Test Checklist

- ✅ Works with network delays (5+ seconds)
- ✅ Handles localStorage restrictions
- ✅ Shows user-friendly error messages
- ✅ Supports URL parameter auth fallback

---

**Need examples?** See [iframe-authentication-complete.md](./iframe-authentication-complete.md) for complete implementations.