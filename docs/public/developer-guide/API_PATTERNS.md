# Oriva Platform API - Integration Patterns & Best Practices

**Production-ready patterns for building reliable Oriva integrations**

[![Last Updated](https://img.shields.io/badge/Updated-January%202025-blue)]()

> **Quick Navigation:** [Overview](./API_OVERVIEW.md) | [User Guide](./API_USER_GUIDE.md) | [Security](./API_SECURITY.md) | [Troubleshooting](./api-troubleshooting-guide.md)

---

## Table of Contents

1. [Server-Side Proxy Pattern (BFF)](#server-side-proxy-pattern-bff)
2. [Authentication Patterns](#authentication-patterns)
3. [Error Handling Patterns](#error-handling-patterns)
4. [Rate Limiting & Retry Logic](#rate-limiting--retry-logic)
5. [Caching Strategies](#caching-strategies)
6. [Pagination Handling](#pagination-handling)
7. [Real-Time Updates](#real-time-updates)
8. [Common Use Cases](#common-use-cases)

---

## Server-Side Proxy Pattern (BFF)

**Backend-for-Frontend (BFF)** is the recommended pattern for production applications.

### Why Use BFF?

- ✅ **Security**: API keys remain server-side only
- ✅ **CORS**: Bypass browser cross-origin restrictions
- ✅ **Rate Limiting**: Implement your own rate limiting
- ✅ **Error Handling**: Centralized error processing
- ✅ **Caching**: Server-side response caching
- ✅ **Authentication**: Add your own auth layer

### Architecture

```
Client App → Your Backend Proxy → Oriva API
```

### Implementation (Node.js/Express)

```javascript
// server.js
const express = require('express');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
app.use(express.json());

// CORS configuration for your frontend
app.use((req, res, next) => {
  const allowedOrigins = [
    'https://your-app.vercel.app',
    'https://oriva.io',
    'http://localhost:3000' // Development
  ];

  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Client-ID');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
});

// Rate limiting store
const rateLimitStore = new Map();

function rateLimit(clientId, limit = 100, window = 60000) {
  const now = Date.now();
  const key = clientId || 'anonymous';
  const requests = rateLimitStore.get(key) || [];

  // Remove old requests
  const validRequests = requests.filter(time => time > now - window);

  if (validRequests.length >= limit) {
    return false;
  }

  validRequests.push(now);
  rateLimitStore.set(key, validRequests);
  return true;
}

// Reusable Oriva API call function
async function callOrivaAPI(endpoint, options = {}) {
  const url = `https://api.oriva.io/api/v1${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${process.env.ORIVA_API_KEY}`,
      'Content-Type': 'application/json',
      'User-Agent': 'YourApp-BFF/1.0.0',
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// Proxy endpoint example
app.get('/api/oriva/user/me', async (req, res) => {
  try {
    // Validate client
    const clientId = req.headers['x-client-id'];
    if (!clientId || !rateLimit(clientId)) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests'
      });
    }

    // Call Oriva API
    const data = await callOrivaAPI('/user/me');

    res.json({
      success: true,
      data: data.data || data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Proxy for profiles
app.get('/api/oriva/profiles', async (req, res) => {
  try {
    const clientId = req.headers['x-client-id'];
    if (!rateLimit(clientId)) {
      return res.status(429).json({ error: 'Too many requests' });
    }

    const data = await callOrivaAPI('/profiles/available');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Proxy for POST requests
app.post('/api/oriva/sessions', async (req, res) => {
  try {
    const clientId = req.headers['x-client-id'];
    if (!rateLimit(clientId)) {
      return res.status(429).json({ error: 'Too many requests' });
    }

    const data = await callOrivaAPI('/hugo-ai/sessions', {
      method: 'POST',
      body: JSON.stringify(req.body)
    });

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3001, () => {
  console.log('BFF server running on port 3001');
});
```

### Serverless Function (Vercel/Netlify)

```javascript
// api/oriva/profiles.js
export default async function handler(req, res) {
  // CORS
  const allowedOrigins = [
    'https://your-app.vercel.app',
    'https://oriva.io',
    'http://localhost:3000'
  ];

  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Client-ID');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Validate client
  const clientId = req.headers['x-client-id'];
  const allowedClients = ['your-app-name'];

  if (!clientId || !allowedClients.includes(clientId)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const response = await fetch('https://api.oriva.io/api/v1/profiles/available', {
      headers: {
        'Authorization': `Bearer ${process.env.ORIVA_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
```

### Client-Side Service

```typescript
// services/orivaApi.ts
class OrivaApiService {
  private proxyUrl: string;
  private clientId: string;

  constructor() {
    this.proxyUrl = process.env.NEXT_PUBLIC_API_PROXY || 'http://localhost:3001/api/oriva';
    this.clientId = process.env.NEXT_PUBLIC_CLIENT_ID || 'your-app-name';
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.proxyUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Client-ID': this.clientId,
        ...options.headers
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async getUserProfile() {
    return this.makeRequest('/user/me');
  }

  async getProfiles() {
    return this.makeRequest('/profiles');
  }

  async createSession(data: any) {
    return this.makeRequest('/sessions', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
}

export const orivaApi = new OrivaApiService();
```

---

## Authentication Patterns

### API Key Authentication

```javascript
// Secure API key storage
const apiKey = process.env.ORIVA_API_KEY;

// Making authenticated requests
const response = await fetch('https://api.oriva.io/api/v1/user/me', {
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  }
});
```

### Token Refresh Pattern

```javascript
class AuthManager {
  constructor() {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
  }

  async login(email, password) {
    const response = await fetch('https://api.oriva.io/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    this.accessToken = data.data.access_token;
    this.refreshToken = data.data.refresh_token;
    this.tokenExpiry = new Date(data.data.expires_at);

    // Schedule token refresh
    this.scheduleTokenRefresh();

    return data;
  }

  scheduleTokenRefresh() {
    const refreshBuffer = 5 * 60 * 1000; // 5 minutes before expiry
    const refreshTime = this.tokenExpiry.getTime() - refreshBuffer - Date.now();

    if (refreshTime > 0) {
      setTimeout(() => this.refreshAccessToken(), refreshTime);
    }
  }

  async refreshAccessToken() {
    try {
      const response = await fetch('https://api.oriva.io/api/v1/auth/token/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: this.refreshToken })
      });

      const data = await response.json();

      this.accessToken = data.data.access_token;
      this.tokenExpiry = new Date(data.data.expires_at);

      // Schedule next refresh
      this.scheduleTokenRefresh();
    } catch (error) {
      // Handle refresh failure (e.g., redirect to login)
      console.error('Token refresh failed:', error);
      this.logout();
    }
  }

  async makeAuthenticatedRequest(url, options = {}) {
    return fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
  }

  logout() {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    // Redirect to login page
  }
}

const authManager = new AuthManager();
```

---

## Error Handling Patterns

### Comprehensive Error Handler

```typescript
interface ApiError {
  success: false;
  error: string;
  code: string;
  details?: any;
}

interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: any;
}

type ApiResponse<T> = ApiSuccess<T> | ApiError;

class OrivaApiClient {
  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(
        `https://api.oriva.io/api/v1${endpoint}`,
        {
          ...options,
          headers: {
            'Authorization': `Bearer ${process.env.ORIVA_API_KEY}`,
            'Content-Type': 'application/json',
            ...options.headers
          }
        }
      );

      // Handle different HTTP status codes
      if (response.status === 401) {
        return {
          success: false,
          error: 'Authentication failed. Check your API key.',
          code: 'UNAUTHORIZED'
        };
      }

      if (response.status === 403) {
        return {
          success: false,
          error: 'Insufficient permissions for this operation.',
          code: 'FORBIDDEN'
        };
      }

      if (response.status === 404) {
        return {
          success: false,
          error: 'Resource not found.',
          code: 'NOT_FOUND'
        };
      }

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || '60';
        return {
          success: false,
          error: `Rate limited. Retry after ${retryAfter} seconds.`,
          code: 'RATE_LIMITED',
          details: { retryAfter: parseInt(retryAfter) }
        };
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.error || `HTTP ${response.status}`,
          code: errorData.code || 'UNKNOWN_ERROR',
          details: errorData.details
        };
      }

      const data = await response.json();
      return {
        success: true,
        data: data.data || data,
        meta: data.meta
      };

    } catch (error) {
      // Network errors, timeouts, etc.
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
        code: 'NETWORK_ERROR'
      };
    }
  }
}

// Usage
const client = new OrivaApiClient();

const result = await client.request<UserProfile>('/user/me');

if (result.success) {
  console.log('User:', result.data);
} else {
  console.error('Error:', result.error);

  // Handle specific error codes
  switch (result.code) {
    case 'UNAUTHORIZED':
      // Redirect to login or refresh token
      break;
    case 'RATE_LIMITED':
      // Wait and retry
      setTimeout(() => {
        // Retry request
      }, result.details.retryAfter * 1000);
      break;
    default:
      // Show generic error message
      break;
  }
}
```

---

## Rate Limiting & Retry Logic

### Exponential Backoff

```javascript
class RetryHandler {
  async requestWithRetry(
    url,
    options = {},
    maxRetries = 3,
    baseDelay = 1000
  ) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, options);

        // Success
        if (response.ok) {
          return await response.json();
        }

        // Rate limited - use server-provided retry time
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('Retry-After')) || 60;
          console.log(`Rate limited. Waiting ${retryAfter}s before retry...`);
          await this.sleep(retryAfter * 1000);
          continue;
        }

        // Server error - retry with exponential backoff
        if (response.status >= 500) {
          if (attempt < maxRetries - 1) {
            const delay = baseDelay * Math.pow(2, attempt);
            console.log(`Server error. Retrying in ${delay}ms...`);
            await this.sleep(delay);
            continue;
          }
        }

        // Other errors - don't retry
        throw new Error(`HTTP ${response.status}`);

      } catch (error) {
        // Network error - retry with exponential backoff
        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.log(`Request failed. Retrying in ${delay}ms...`);
          await this.sleep(delay);
          continue;
        }

        throw error;
      }
    }

    throw new Error('Max retries exceeded');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Usage
const retryHandler = new RetryHandler();

try {
  const data = await retryHandler.requestWithRetry(
    'https://api.oriva.io/api/v1/user/me',
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    },
    3,  // max retries
    1000 // base delay (1 second)
  );

  console.log('Success:', data);
} catch (error) {
  console.error('Failed after retries:', error);
}
```

### Circuit Breaker Pattern

```javascript
class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000) {
    this.failureCount = 0;
    this.threshold = threshold;
    this.timeout = timeout;
    this.lastFailureTime = 0;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime >= this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
    }
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
    }
  }
}

// Usage
const breaker = new CircuitBreaker(5, 60000);

try {
  const data = await breaker.execute(async () => {
    const response = await fetch('https://api.oriva.io/api/v1/user/me', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    return response.json();
  });

  console.log('Success:', data);
} catch (error) {
  console.error('Circuit breaker error:', error);
}
```

---

## Caching Strategies

### In-Memory Cache with TTL

```javascript
class CacheManager {
  constructor(defaultTTL = 5 * 60 * 1000) { // 5 minutes
    this.cache = new Map();
    this.defaultTTL = defaultTTL;
  }

  set(key, value, ttl = this.defaultTTL) {
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttl
    });
  }

  get(key) {
    const item = this.cache.get(key);

    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  clear() {
    this.cache.clear();
  }

  delete(key) {
    this.cache.delete(key);
  }
}

class CachedOrivaClient {
  constructor() {
    this.cache = new CacheManager();
    this.apiKey = process.env.ORIVA_API_KEY;
  }

  async request(endpoint, options = {}, cacheTTL = 5 * 60 * 1000) {
    const cacheKey = `${endpoint}-${JSON.stringify(options)}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log('Cache hit:', endpoint);
      return cached;
    }

    // Fetch from API
    console.log('Cache miss:', endpoint);
    const response = await fetch(`https://api.oriva.io/api/v1${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    const data = await response.json();

    // Cache the response
    this.cache.set(cacheKey, data, cacheTTL);

    return data;
  }
}

// Usage
const client = new CachedOrivaClient();

// First call - fetches from API
const profiles1 = await client.request('/profiles/available');

// Second call within 5 minutes - returns cached data
const profiles2 = await client.request('/profiles/available');
```

### Cache Invalidation

```javascript
class SmartCacheManager extends CacheManager {
  constructor() {
    super();
    this.dependencies = new Map(); // Track cache dependencies
  }

  setWithDependencies(key, value, dependencies = [], ttl) {
    this.set(key, value, ttl);

    // Track dependencies
    dependencies.forEach(dep => {
      if (!this.dependencies.has(dep)) {
        this.dependencies.set(dep, new Set());
      }
      this.dependencies.get(dep).add(key);
    });
  }

  invalidate(key) {
    // Delete the key
    this.delete(key);

    // Invalidate all dependent keys
    const dependents = this.dependencies.get(key);
    if (dependents) {
      dependents.forEach(depKey => this.delete(depKey));
      this.dependencies.delete(key);
    }
  }
}

// Usage
const smartCache = new SmartCacheManager();

// Cache user profiles with dependency on user
smartCache.setWithDependencies(
  'profiles-list',
  profilesData,
  ['user-123'], // dependencies
  5 * 60 * 1000
);

// When user data changes, invalidate related caches
smartCache.invalidate('user-123'); // Also invalidates 'profiles-list'
```

---

## Pagination Handling

### Automatic Pagination

```javascript
class PaginationHandler {
  async fetchAllPages(endpoint, options = {}) {
    const allItems = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = `${endpoint}?page=${page}&limit=50`;

      const response = await fetch(`https://api.oriva.io/api/v1${url}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${process.env.ORIVA_API_KEY}`,
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      const data = await response.json();

      allItems.push(...data.data);

      // Check if there are more pages
      hasMore = data.meta?.pagination?.has_next || false;
      page++;

      // Safety limit to prevent infinite loops
      if (page > 100) {
        console.warn('Reached maximum page limit');
        break;
      }
    }

    return allItems;
  }

  async* fetchPagesIterator(endpoint, options = {}) {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = `${endpoint}?page=${page}&limit=50`;

      const response = await fetch(`https://api.oriva.io/api/v1${url}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${process.env.ORIVA_API_KEY}`,
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      const data = await response.json();

      yield data.data;

      hasMore = data.meta?.pagination?.has_next || false;
      page++;
    }
  }
}

// Usage - Fetch all at once
const handler = new PaginationHandler();
const allProfiles = await handler.fetchAllPages('/profiles/available');
console.log('Total profiles:', allProfiles.length);

// Usage - Iterator (memory efficient)
for await (const pageItems of handler.fetchPagesIterator('/entries')) {
  console.log('Processing page with', pageItems.length, 'items');
  // Process items
}
```

---

## Real-Time Updates

### Server-Sent Events (SSE) for Hugo AI Chat

```javascript
class HugoAIChat {
  async streamChat(conversationId, message) {
    const response = await fetch('https://api.oriva.io/api/v1/hugo/chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.ORIVA_API_KEY}`,
        'Content-Type': 'application/json',
        'X-App-ID': 'your-app-id'
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        message: message
      })
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = '';
    let fullMessage = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process SSE events
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('event:')) {
          const eventType = line.slice(6).trim();
          continue;
        }

        if (line.startsWith('data:')) {
          const data = JSON.parse(line.slice(5).trim());

          if (data.delta) {
            fullMessage += data.delta;
            // Update UI with delta
            console.log('Received delta:', data.delta);
          }

          if (data.message_id) {
            console.log('Message complete:', fullMessage);
            return { message_id: data.message_id, content: fullMessage };
          }
        }
      }
    }
  }
}

// Usage
const chat = new HugoAIChat();

const result = await chat.streamChat(
  '550e8400-e29b-41d4-a716-446655440000',
  'Help me plan my career goals'
);
```

### Webhooks

```javascript
// Setting up a webhook
async function createWebhook(appId, webhookUrl, events) {
  const response = await fetch(
    `https://api.oriva.io/api/v1/apps/${appId}/webhooks`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.ORIVA_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: webhookUrl,
        events: events,
        secret: process.env.WEBHOOK_SECRET
      })
    }
  );

  return response.json();
}

// Webhook receiver endpoint
app.post('/webhook/oriva', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-oriva-signature'];
  const secret = process.env.WEBHOOK_SECRET;

  // Verify signature
  const crypto = require('crypto');
  const hash = crypto
    .createHmac('sha256', secret)
    .update(req.body)
    .digest('hex');

  if (hash !== signature) {
    return res.status(401).send('Invalid signature');
  }

  // Process webhook
  const event = JSON.parse(req.body);

  console.log('Received webhook:', event.type);

  switch (event.type) {
    case 'user.created':
      // Handle user created
      break;
    case 'app.installed':
      // Handle app installed
      break;
    default:
      console.log('Unknown event type:', event.type);
  }

  res.status(200).send('OK');
});
```

---

## Common Use Cases

### 1. User Profile Management

```javascript
async function manageUserProfiles() {
  // Get current user
  const user = await orivaApi.request('/user/me');
  console.log('Current user:', user.data.name);

  // Get available profiles
  const profiles = await orivaApi.request('/profiles/available');
  console.log('Available profiles:', profiles.data.length);

  // Switch to a different profile
  if (profiles.data.length > 1) {
    const newProfile = profiles.data[1];
    await orivaApi.request(`/profiles/${newProfile.id}/activate`, {
      method: 'POST'
    });
    console.log('Switched to:', newProfile.name);
  }
}
```

### 2. Marketplace App Browsing

```javascript
async function browseMarketplace(category = 'productivity') {
  // Get marketplace apps
  const apps = await orivaApi.request(
    `/marketplace/apps?category=${category}&limit=10`
  );

  console.log(`Found ${apps.data.length} apps in ${category}`);

  apps.data.forEach(app => {
    console.log(`- ${app.name}: ${app.description}`);
    console.log(`  Installs: ${app.install_count}, Rating: ${app.ratings.average}`);
  });

  // Get trending apps
  const trending = await orivaApi.request('/marketplace/trending?limit=5');
  console.log('\nTrending apps:', trending.data.map(a => a.name));
}
```

### 3. Hugo AI Session Management

```javascript
async function manageHugoSession() {
  // Create new coaching session
  const session = await orivaApi.request('/hugo-ai/sessions', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Weekly Career Check-in',
      type: 'coaching',
      metadata: { focus_area: 'career_development' }
    })
  });

  console.log('Created session:', session.data.id);

  // List all sessions
  const sessions = await orivaApi.request('/hugo-ai/sessions');
  console.log('Total sessions:', sessions.meta.pagination.total_count);

  // Conclude session
  await orivaApi.request(`/hugo-ai/sessions/${session.data.id}/conclude`, {
    method: 'POST',
    body: JSON.stringify({
      summary: 'Great progress this week',
      action_items: ['Follow up on goals', 'Schedule next session']
    })
  });

  console.log('Session concluded');
}
```

### 4. Data Export (GDPR)

```javascript
async function exportUserData() {
  // Prepare data extraction
  const manifest = await orivaApi.request('/platform/extraction/prepare', {
    method: 'POST',
    body: JSON.stringify({
      data_types: ['profile', 'entries', 'sessions'],
      format: 'json'
    })
  });

  console.log('Extraction manifest:', manifest.data.manifest_id);
  console.log('Estimated completion:', manifest.data.estimated_completion);

  // Poll for completion
  let status = 'preparing';
  while (status === 'preparing') {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s

    const check = await orivaApi.request(
      `/platform/extraction/${manifest.data.manifest_id}`
    );

    status = check.data.status;
    console.log('Status:', status);
  }

  if (status === 'completed') {
    console.log('Download URL:', check.data.download_url);
    console.log('Expires at:', check.data.expires_at);
  }
}
```

---

## Summary

These patterns provide production-ready foundations for building reliable Oriva Platform integrations:

1. **Use BFF pattern** for security and control
2. **Implement comprehensive error handling** for robustness
3. **Add retry logic with exponential backoff** for resilience
4. **Cache responses** to reduce API calls and improve performance
5. **Handle pagination properly** for large datasets
6. **Use webhooks** for real-time updates when possible

For more information, see:
- **[API User Guide](./API_USER_GUIDE.md)** - Complete endpoint reference
- **[API Security](./API_SECURITY.md)** - Security best practices
- **[Troubleshooting](./api-troubleshooting-guide.md)** - Debug common issues

---

*Last Updated: January 2025*
