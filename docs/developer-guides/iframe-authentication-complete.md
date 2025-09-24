# Iframe Authentication - Complete Implementation

**Full implementation patterns and examples for iframe authentication.**

## Authentication Flow

1. **Request Authentication**: Send message to parent window
2. **Receive Tokens**: Parent responds with user authentication tokens
3. **Store in Memory**: Use memory-based storage (localStorage is blocked)
4. **API Integration**: Use tokens for all Oriva API calls

## Complete Implementation

### 1. Parent Authentication Request

```javascript
// Request auth tokens from Oriva parent window
const requestAuthFromParent = () => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Authentication request timed out'));
    }, 15000); // 15-second timeout recommended

    const handleMessage = (event) => {
      if (event.data?.type === 'ORIVA_AUTH_TOKEN') {
        clearTimeout(timeout);
        window.removeEventListener('message', handleMessage);
        resolve(event.data.data);
      }
    };

    window.addEventListener('message', handleMessage);

    // Send request to parent
    window.parent.postMessage({
      type: 'ORIVA_REQUEST_AUTH',
      appId: 'your-app-id'
    }, '*');
  });
};
```

### 2. Memory-Based Token Storage

```javascript
// Use memory storage instead of localStorage (blocked in iframe)
class IframeAuthStorage {
  private tokens: AuthTokens | null = null;

  async setTokens(tokens: AuthTokens): Promise<void> {
    this.tokens = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      user: tokens.user
    };
  }

  getTokens(): AuthTokens | null {
    return this.tokens;
  }

  clearTokens(): void {
    this.tokens = null;
  }

  isAuthenticated(): boolean {
    return this.tokens !== null && this.tokens.accessToken !== undefined;
  }
}
```

### 3. Retry Logic with Exponential Backoff

```javascript
const authenticateWithRetry = async (maxRetries = 3) => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const tokens = await requestAuthFromParent();
      await authStorage.setTokens(tokens);
      return tokens;
    } catch (error) {
      console.log(`Auth attempt ${attempt + 1} failed, retrying...`);
      if (attempt === maxRetries - 1) throw error;

      // Exponential backoff: 1s, 2s, 4s
      await new Promise(resolve =>
        setTimeout(resolve, 1000 * Math.pow(2, attempt))
      );
    }
  }
};
```

### 4. API Client with Authentication

```javascript
class OrivaApiClient {
  private authStorage: IframeAuthStorage;

  constructor() {
    this.authStorage = new IframeAuthStorage();
  }

  async request(endpoint: string, options: RequestInit = {}) {
    const tokens = this.authStorage.getTokens();
    if (!tokens) {
      throw new Error('No authentication tokens available');
    }

    const response = await fetch(endpoint, {
      ...options,
      headers: {
        'Authorization': `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    return response.json();
  }
}
```

## URL Parameter Fallback

Support authentication via URL parameters as a backup method:

```javascript
const getAuthFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  const accessToken = params.get('access_token');
  const userId = params.get('user_id');

  if (accessToken && userId) {
    return {
      accessToken,
      user: { id: userId },
      expiresIn: 3600 // 1 hour default
    };
  }
  return null;
};

// Initialize authentication
const initializeAuth = async () => {
  try {
    // Try URL parameters first
    const urlAuth = getAuthFromUrl();
    if (urlAuth) {
      await authStorage.setTokens(urlAuth);
      return;
    }

    // Fall back to parent window authentication
    await authenticateWithRetry();
  } catch (error) {
    console.error('Authentication failed:', error);
    showAuthError('Unable to connect. Please refresh and try again.');
  }
};
```

## Error Handling Best Practices

```javascript
const handleAuthError = (error: Error) => {
  console.error('Authentication error:', error);

  // Clear any invalid tokens
  authStorage.clearTokens();

  // Show user-friendly message
  const errorMessages = {
    'Authentication request timed out': 'Connection timeout. Please refresh the page.',
    'No authentication tokens available': 'Please log in to continue.',
    'API request failed': 'Service temporarily unavailable. Please try again.'
  };

  const userMessage = errorMessages[error.message] || 'An error occurred. Please refresh and try again.';
  showNotification(userMessage, 'error');
};
```

## Security Considerations

- **Token Validation**: Verify token format and expiration before use
- **Origin Validation**: Check message origin matches Oriva domain
- **Error Logging**: Log authentication failures for monitoring
- **Graceful Degradation**: Provide offline/limited functionality when auth fails

## Testing Checklist

- ✅ Authentication works in iframe context with 5+ second delays
- ✅ Memory storage works when localStorage is blocked
- ✅ Retry logic handles network delays gracefully
- ✅ URL parameter fallback functions correctly
- ✅ Error messages are user-friendly and actionable
- ✅ Token refresh works for long-running sessions

## Complete Example Integration

```javascript
// Complete iframe authentication setup
class IframeAuthenticator {
  constructor(appId) {
    this.appId = appId;
    this.storage = new IframeAuthStorage();
    this.apiClient = new OrivaApiClient();
  }

  async initialize() {
    try {
      await initializeAuth();
      console.log('Authentication initialized successfully');
      return true;
    } catch (error) {
      handleAuthError(error);
      return false;
    }
  }

  async makeApiCall(endpoint, options = {}) {
    return this.apiClient.request(endpoint, options);
  }

  isAuthenticated() {
    return this.storage.isAuthenticated();
  }
}

// Usage
const auth = new IframeAuthenticator('your-app-id');
await auth.initialize();

if (auth.isAuthenticated()) {
  const data = await auth.makeApiCall('/api/your-endpoint');
  console.log('API call successful:', data);
}
```

---

**Quick Reference**: For a shorter overview, see [iframe-authentication.md](./iframe-authentication.md)