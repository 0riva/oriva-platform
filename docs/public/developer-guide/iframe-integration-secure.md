# Secure Iframe Integration Guide

**Security-first implementation patterns for iframe authentication and integration**

⚠️ **Security Notice**: This guide replaces previous iframe documentation that contained security vulnerabilities. Follow these patterns exactly for secure iframe integration.

## Security Principles

### ✅ Secure Patterns
- **Message-based authentication** with origin validation
- **Memory-only token storage** (localStorage blocked in iframes)
- **Timeout and retry logic** for reliable connections
- **Secure error handling** without exposing sensitive data

### ❌ Insecure Patterns (Never Use)
- URL-based token passing
- localStorage token storage in iframes
- Unvalidated message origins
- Hardcoded authentication fallbacks

## Secure Authentication Flow

### 1. Request Authentication from Parent

```javascript
class SecureIframeAuth {
  constructor(appId, allowedOrigins = ['https://app.oriva.io']) {
    this.appId = appId;
    this.allowedOrigins = allowedOrigins;
    this.tokens = null;
  }

  async requestAuthFromParent() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Authentication request timed out'));
      }, 15000); // 15-second timeout

      const handleMessage = (event) => {
        // Critical: Validate message origin
        if (!this.allowedOrigins.includes(event.origin)) {
          console.warn('Ignored message from unauthorized origin:', event.origin);
          return;
        }

        if (event.data?.type === 'ORIVA_AUTH_TOKEN') {
          clearTimeout(timeout);
          window.removeEventListener('message', handleMessage);
          resolve(event.data.data);
        }
      };

      window.addEventListener('message', handleMessage);

      // Send request to parent with origin validation
      window.parent.postMessage({
        type: 'ORIVA_REQUEST_AUTH',
        appId: this.appId,
        origin: window.location.origin
      }, '*');
    });
  }
}
```

### 2. Secure Token Storage

```javascript
class SecureTokenStorage {
  constructor() {
    this.tokens = null;
    this.expirationTime = null;
  }

  setTokens(authData) {
    // Validate token structure
    if (!authData.accessToken || !authData.user) {
      throw new Error('Invalid authentication data structure');
    }

    this.tokens = {
      accessToken: authData.accessToken,
      user: {
        id: authData.user.id,
        name: authData.user.name,
        email: authData.user.email
      }
    };

    // Set expiration (default 1 hour)
    this.expirationTime = Date.now() + (authData.expiresIn || 3600) * 1000;
  }

  getTokens() {
    // Check expiration
    if (this.expirationTime && Date.now() > this.expirationTime) {
      this.clearTokens();
      return null;
    }

    return this.tokens;
  }

  clearTokens() {
    this.tokens = null;
    this.expirationTime = null;
  }

  isAuthenticated() {
    return this.getTokens() !== null;
  }
}
```

### 3. Retry Logic with Exponential Backoff

```javascript
class ReliableAuth {
  async authenticateWithRetry(maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const authData = await this.auth.requestAuthFromParent();
        this.storage.setTokens(authData);
        return authData;
      } catch (error) {
        console.log(`Auth attempt ${attempt + 1} failed:`, error.message);

        if (attempt === maxRetries - 1) {
          throw new Error('Authentication failed after maximum retries');
        }

        // Exponential backoff: 1s, 2s, 4s
        const delay = 1000 * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
}
```

## Secure API Client

```javascript
class SecureApiClient {
  constructor(tokenStorage, baseUrl = 'https://api.oriva.io/api/v1') {
    this.storage = tokenStorage;
    this.baseUrl = baseUrl;
  }

  async request(endpoint, options = {}) {
    const tokens = this.storage.getTokens();
    if (!tokens) {
      throw new Error('No valid authentication tokens available');
    }

    const url = `${this.baseUrl}${endpoint}`;

    const requestOptions = {
      ...options,
      headers: {
        'Authorization': `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': `${this.appId}/1.0.0 (iframe)`,
        'X-Client-ID': this.appId,
        ...options.headers
      }
    };

    try {
      const response = await fetch(url, requestOptions);

      if (response.status === 401) {
        // Token expired, clear and request re-authentication
        this.storage.clearTokens();
        throw new Error('Authentication expired. Please refresh.');
      }

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      // Log error without exposing sensitive data
      console.error('API request failed:', {
        endpoint,
        status: error.status,
        message: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }
}
```

## Secure Error Handling

```javascript
class SecureErrorHandler {
  static handleAuthError(error) {
    // Clear any potentially invalid tokens
    this.storage?.clearTokens();

    // User-friendly error messages (no technical details)
    const userMessages = {
      'Authentication request timed out': 'Connection timeout. Please refresh the page.',
      'Authentication failed after maximum retries': 'Unable to connect. Please try again.',
      'No valid authentication tokens available': 'Please log in to continue.',
      'Authentication expired. Please refresh.': 'Session expired. Please refresh the page.'
    };

    const userMessage = userMessages[error.message] || 'An error occurred. Please refresh and try again.';

    this.showUserNotification(userMessage, 'error');

    // Log technical details for debugging (server-side only)
    if (typeof window === 'undefined') {
      console.error('Authentication error details:', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    }
  }

  static showUserNotification(message, type = 'info') {
    // Implement your user notification system
    // e.g., toast, modal, status bar
    console.log(`${type.toUpperCase()}: ${message}`);
  }
}
```

## Complete Secure Implementation

```javascript
class SecureIframeApp {
  constructor(appId) {
    this.appId = appId;
    this.auth = new SecureIframeAuth(appId);
    this.storage = new SecureTokenStorage();
    this.apiClient = new SecureApiClient(this.storage);
    this.reliableAuth = new ReliableAuth(this.auth, this.storage);
  }

  async initialize() {
    try {
      // Attempt authentication with retries
      await this.reliableAuth.authenticateWithRetry();

      console.log('Iframe app authenticated successfully');
      return true;
    } catch (error) {
      SecureErrorHandler.handleAuthError(error);
      return false;
    }
  }

  async makeSecureApiCall(endpoint, options = {}) {
    try {
      return await this.apiClient.request(endpoint, options);
    } catch (error) {
      if (error.message.includes('Authentication expired')) {
        // Attempt re-authentication
        const reauth = await this.initialize();
        if (reauth) {
          // Retry the original request
          return await this.apiClient.request(endpoint, options);
        }
      }
      throw error;
    }
  }

  isAuthenticated() {
    return this.storage.isAuthenticated();
  }

  logout() {
    this.storage.clearTokens();
    // Notify parent window of logout
    window.parent.postMessage({
      type: 'ORIVA_LOGOUT',
      appId: this.appId
    }, '*');
  }
}
```

## Usage Example

```javascript
// Initialize secure iframe app
const app = new SecureIframeApp('your-app-id');

// Setup and authenticate
async function setupApp() {
  const authenticated = await app.initialize();

  if (!authenticated) {
    console.error('Failed to authenticate iframe app');
    return;
  }

  // Make secure API calls
  try {
    const profiles = await app.makeSecureApiCall('/profiles/available');
    console.log('Profiles loaded:', profiles);

    const userData = await app.makeSecureApiCall('/user/me');
    console.log('User data:', userData);
  } catch (error) {
    console.error('API call failed:', error.message);
  }
}

// Start the app
setupApp();
```

## Security Validation Checklist

### Before Deployment
- [ ] Origin validation implemented for all message handling
- [ ] No tokens stored in localStorage or sessionStorage
- [ ] All API calls use HTTPS endpoints
- [ ] Error messages don't expose sensitive information
- [ ] Authentication timeout and retry logic tested
- [ ] Token expiration handling verified

### Testing Security
- [ ] Test with invalid origins (should be rejected)
- [ ] Test authentication timeout scenarios
- [ ] Verify tokens are cleared on errors
- [ ] Test API calls with expired tokens
- [ ] Verify no sensitive data in console logs
- [ ] Test iframe isolation (localStorage blocked)

## Common Security Mistakes to Avoid

### ❌ Never Do This

```javascript
// Don't store tokens in browser storage
localStorage.setItem('auth_token', token);

// Don't accept messages from any origin
window.addEventListener('message', (event) => {
  // Missing origin validation
  if (event.data?.type === 'AUTH_TOKEN') {
    useToken(event.data.token);
  }
});

// Don't expose API keys in client code
const apiKey = 'oriva_pk_live_12345...';

// Don't use URL parameters for authentication
const token = new URLSearchParams(window.location.search).get('token');
```

### ✅ Always Do This

```javascript
// Use memory-only storage
this.tokens = authData; // Class property

// Validate message origins
if (this.allowedOrigins.includes(event.origin)) {
  // Process message
}

// Use environment variables for keys (server-side)
const apiKey = process.env.ORIVA_API_KEY;

// Use secure message-based authentication
window.parent.postMessage({ type: 'REQUEST_AUTH' }, '*');
```

## Testing Guide

### Manual Testing
1. Load your iframe in the Oriva environment
2. Verify authentication completes within 15 seconds
3. Test API calls work correctly
4. Test token expiration handling
5. Verify error messages are user-friendly

### Automated Testing
```javascript
// Test authentication flow
describe('Secure Iframe Authentication', () => {
  test('should authenticate successfully', async () => {
    const app = new SecureIframeApp('test-app');
    const result = await app.initialize();
    expect(result).toBe(true);
    expect(app.isAuthenticated()).toBe(true);
  });

  test('should handle authentication timeout', async () => {
    // Mock timeout scenario
    jest.spyOn(global, 'setTimeout').mockImplementation((fn) => fn());

    const app = new SecureIframeApp('test-app');
    await expect(app.initialize()).rejects.toThrow('Authentication request timed out');
  });
});
```

---

**Security Note**: Iframe security is critical since your app runs in a restricted environment. Always validate origins, use memory-only storage, and implement proper error handling.

*Last Updated: January 2025*