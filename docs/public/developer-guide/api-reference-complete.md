# Complete API Reference Guide

**Comprehensive API documentation with security-first implementation patterns**

[![API Version](https://img.shields.io/badge/API-v1.0-blue)]()
[![Security Audit](https://img.shields.io/badge/Security-Audited-green)]()
[![Last Updated](https://img.shields.io/badge/Updated-January%202025-blue)]()

## 📋 Quick Navigation

- [Authentication & Security](#authentication--security)
- [Response Format Standards](#response-format-standards)
- [Core API Endpoints](#core-api-endpoints)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Best Practices](#best-practices)

---

## 🔐 Authentication & Security

### Secure Authentication Headers

**Required Headers:**
```javascript
const headers = {
  'Authorization': `Bearer ${process.env.ORIVA_API_KEY}`, // Server-side only
  'Content-Type': 'application/json',
  'User-Agent': 'your-app/1.0.0',
  'X-Client-ID': 'your-app-id'
};
```

**Security Requirements:**
- ✅ Store API keys in environment variables
- ✅ Use server-side proxy for sensitive operations
- ✅ Never expose API keys in client-side code
- ✅ Implement proper error handling
- ✅ Use HTTPS for all requests

### API Key Management

```javascript
// ✅ Secure: Server-side proxy pattern
// Client calls your API
fetch('/api/oriva-proxy/profiles')

// Your server proxies to Oriva
app.get('/api/oriva-proxy/profiles', async (req, res) => {
  const response = await fetch('https://api.oriva.io/api/v1/profiles/available', {
    headers: {
      'Authorization': `Bearer ${process.env.ORIVA_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  res.json(await response.json());
});
```

---

## 🏗️ Response Format Standards

### Success Response Format

All endpoints return consistent structure with dual boolean flags for compatibility:

```json
{
  "ok": true,
  "success": true,
  "data": {
    // Endpoint-specific data object or array
  },
  "meta": {
    // Optional metadata (pagination, counts, etc.)
  }
}
```

**Field Descriptions**:
- `ok` (boolean): Request succeeded (legacy compatibility)
- `success` (boolean): Request succeeded (modern apps)
- `data` (object|array): Response payload
- `meta` (object, optional): Metadata like pagination

**Note**: Both `ok` and `success` are provided for compatibility. New integrations should use `success`.

### Error Response Format

```json
{
  "ok": false,
  "success": false,
  "error": "Error message description",
  "message": "Error message description",
  "code": "VALIDATION_ERROR",
  "details": []
}
```

**Error Field Descriptions**:
- `ok` (boolean): false for errors
- `success` (boolean): false for errors
- `error` (string): Human-readable error message
- `message` (string): Same as error (for compatibility)
- `code` (string): Machine-readable error code
- `details` (array): Additional error information

### Pagination Response Format

```json
{
  "success": true,
  "data": [
    // Array of items
  ],
  "meta": {
    "pagination": {
      "current_page": 1,
      "per_page": 50,
      "total_pages": 3,
      "total_count": 127,
      "has_next": true,
      "has_prev": false
    }
  }
}
```

---

## 🚀 Core API Endpoints

### User Information

#### GET /api/v1/user/me

**Description**: Get current authenticated user information

**Security**: Requires valid authentication token

**Request:**
```javascript
const response = await fetch('/api/oriva-proxy/user/me', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
});
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "ext_user_abc123",
    "name": "John Doe",
    "email": "john@example.com",
    "avatar": "https://example.com/avatar.jpg",
    "created_at": "2024-01-15T10:30:00Z",
    "last_login": "2025-01-26T14:22:00Z",
    "preferences": {
      "theme": "light",
      "timezone": "UTC",
      "language": "en"
    }
  }
}
```

**Properties:**

| Property | Type | Description | Privacy Level |
|----------|------|-------------|---------------|
| `id` | string | External user ID (sanitized) | Public |
| `name` | string | User display name | Public |
| `email` | string | User email address | Restricted |
| `avatar` | string | Profile image URL | Public |
| `created_at` | string | Account creation timestamp | Public |
| `last_login` | string | Last login timestamp | Restricted |
| `preferences` | object | User preferences | Private |

### Profile Management

#### GET /api/v1/profiles/available

**Description**: Get list of profiles available to the current user

**Security**: User authorization required for profile access

**Request:**
```javascript
const response = await fetch('/api/oriva-proxy/profiles/available', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
});
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "ext_profile_xyz789",
      "name": "Work Profile",
      "description": "Professional workspace",
      "avatar": "https://example.com/work-avatar.jpg",
      "is_active": true,
      "permissions": ["read", "write"],
      "created_at": "2024-06-01T09:00:00Z",
      "member_count": 25,
      "settings": {
        "visibility": "team",
        "collaboration": true
      }
    }
  ],
  "meta": {
    "total_count": 3,
    "user_permissions": ["profile:read", "profile:switch"]
  }
}
```

**Properties:**

| Property | Type | Description | Privacy Level |
|----------|------|-------------|---------------|
| `id` | string | External profile ID (sanitized) | Public |
| `name` | string | Profile display name | Public |
| `description` | string | Profile description | Public |
| `avatar` | string | Profile image URL | Public |
| `is_active` | boolean | Whether profile is currently active | Public |
| `permissions` | array | User permissions in this profile | Restricted |
| `created_at` | string | Profile creation timestamp | Public |
| `member_count` | number | Number of profile members | Public |
| `settings` | object | Profile configuration | Restricted |

### Group Management

#### GET /api/v1/groups

**Description**: Get user's group memberships

**Security**: Group authorization and membership validation

**Request:**
```javascript
const response = await fetch('/api/oriva-proxy/groups', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
});
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "ext_group_def456",
      "name": "Development Team",
      "description": "Software development group",
      "role": "member",
      "permissions": ["read", "comment"],
      "member_count": 12,
      "created_at": "2024-03-15T11:45:00Z",
      "settings": {
        "privacy": "private",
        "join_policy": "invite_only"
      }
    }
  ],
  "meta": {
    "total_count": 5,
    "user_roles": ["member", "admin"]
  }
}
```

**Properties:**

| Property | Type | Description | Privacy Level |
|----------|------|-------------|---------------|
| `id` | string | External group ID (sanitized) | Public |
| `name` | string | Group display name | Public |
| `description` | string | Group description | Public |
| `role` | string | User's role in the group | Public |
| `permissions` | array | User permissions in group | Restricted |
| `member_count` | number | Total group members | Public |
| `created_at` | string | Group creation timestamp | Public |
| `settings` | object | Group configuration | Restricted |

### Marketplace Integration

#### GET /api/v1/marketplace/apps

**Description**: Get available marketplace applications

**Security**: Public endpoint with basic rate limiting

**Request:**
```javascript
const response = await fetch('/api/oriva-proxy/marketplace/apps', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
});
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "ext_app_ghi789",
      "name": "Task Manager Pro",
      "description": "Advanced task management and collaboration",
      "category": "productivity",
      "icon": "https://example.com/app-icon.png",
      "developer": {
        "name": "ProductiveCorp",
        "verified": true
      },
      "pricing": {
        "model": "freemium",
        "base_price": 0,
        "premium_price": 9.99
      },
      "ratings": {
        "average": 4.7,
        "count": 1250
      },
      "permissions": ["read:profiles", "write:tasks"],
      "updated_at": "2025-01-20T16:30:00Z"
    }
  ],
  "meta": {
    "pagination": {
      "current_page": 1,
      "per_page": 20,
      "total_count": 145
    },
    "categories": ["productivity", "communication", "analytics"]
  }
}
```

#### GET /api/v1/marketplace/installed

**Description**: Get user's installed applications

**Security**: Requires authentication and installation validation

**Request:**
```javascript
const response = await fetch('/api/oriva-proxy/marketplace/installed', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
});
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "ext_app_ghi789",
      "name": "Task Manager Pro",
      "version": "2.1.0",
      "installed_at": "2024-12-15T10:20:00Z",
      "last_used": "2025-01-25T14:15:00Z",
      "status": "active",
      "permissions_granted": ["read:profiles", "write:tasks"],
      "usage_stats": {
        "total_sessions": 47,
        "total_duration": 18240,
        "last_session": "2025-01-25T14:15:00Z"
      }
    }
  ],
  "meta": {
    "total_count": 8,
    "active_count": 6
  }
}
```

---

## 🛠️ Developer App Management

### GET /api/v1/developer/apps

**Description**: List all apps you've created as a developer

**Authentication**: API key required (must be developer)

**Query Parameters**:
- None (automatically filtered to your apps)

**Request:**
```javascript
const response = await fetch('/api/oriva-proxy/developer/apps', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
});
```

**Response:**
```json
{
  "ok": true,
  "success": true,
  "data": [
    {
      "id": "ext_app_xyz123",
      "name": "My Awesome App",
      "slug": "my-awesome-app",
      "tagline": "Short description",
      "description": "Full app description",
      "category": "productivity",
      "icon_url": "https://example.com/icon.png",
      "screenshots": ["url1", "url2"],
      "version": "1.0.0",
      "status": "draft",
      "is_active": false,
      "install_count": 0,
      "developer_id": "ext_user_abc",
      "developer_name": "Your Name",
      "created_at": "2025-01-26T10:00:00Z",
      "updated_at": "2025-01-26T10:00:00Z"
    }
  ]
}
```

**Status Values**:
- `draft` - App being edited, not submitted
- `pending_review` - Submitted, awaiting admin review
- `approved` - Approved and visible in marketplace
- `rejected` - Rejected by admin, can resubmit

---

### POST /api/v1/developer/apps

**Description**: Create a new marketplace application

**Authentication**: API key required

**Request Body:**
```json
{
  "name": "My App",
  "slug": "my-app",
  "tagline": "Short description",
  "description": "Full description",
  "category": "productivity",
  "icon_url": "https://example.com/icon.png",
  "screenshots": ["https://example.com/screen1.png"],
  "execution_url": "https://myapp.com",
  "homepage_url": "https://myapp.com",
  "privacy_policy_url": "https://myapp.com/privacy",
  "terms_url": "https://myapp.com/terms",
  "pricing_model": "free",
  "version": "1.0.0"
}
```

**Response:**
```json
{
  "ok": true,
  "success": true,
  "data": {
    "id": "ext_app_new123",
    "name": "My App",
    "status": "draft",
    "created_at": "2025-01-26T10:00:00Z",
    ...
  }
}
```

---

### PUT /api/v1/developer/apps/:appId

**Description**: Update an existing app (cannot change status)

**Authentication**: API key required (must own the app)

**Request Body:** (same as POST, all fields optional)

**Response:** Updated app object

**Notes**:
- Cannot update `status` field via this endpoint
- Use submit/resubmit endpoints to change status

---

### DELETE /api/v1/developer/apps/:appId

**Description**: Delete an app (only if in draft status)

**Authentication**: API key required (must own the app)

**Response:**
```json
{
  "ok": true,
  "success": true,
  "message": "App deleted successfully"
}
```

**Restrictions**:
- Can only delete apps with status `draft`
- Returns 403 error if app is submitted, approved, or rejected

---

### POST /api/v1/developer/apps/:appId/submit

**Description**: Submit app for marketplace review

**Authentication**: API key required (must own the app)

**Request Body:** None required

**Response:**
```json
{
  "ok": true,
  "success": true,
  "data": {
    "id": "ext_app_xyz123",
    "status": "pending_review",
    "submitted_at": "2025-01-26T10:00:00Z",
    ...
  }
}
```

**Requirements**:
- App must be in `draft` status
- Returns 404 if app not found or already submitted

---

### POST /api/v1/developer/apps/:appId/resubmit

**Description**: Resubmit app after rejection

**Authentication**: API key required (must own the app)

**Request Body:** Optional resubmission notes
```json
{
  "notes": "Fixed issues mentioned in review"
}
```

**Response:** Updated app with status `pending_review`

**Requirements**:
- App must be in `rejected` status

---

## 🏪 Marketplace Extended Endpoints

### GET /api/v1/marketplace/trending

**Description**: Get trending apps based on install count

**Authentication**: API key required

**Query Parameters**:
- `limit` (optional): Max apps to return (default: 10, max: 50)

**Response:**
```json
{
  "ok": true,
  "success": true,
  "data": [
    {
      "id": "ext_app_xyz",
      "name": "Trending App",
      "slug": "trending-app",
      "tagline": "Popular app",
      "category": "productivity",
      "icon_url": "https://example.com/icon.png",
      "install_count": 5000,
      "developer_name": "Dev Name"
    }
  ]
}
```

---

### GET /api/v1/marketplace/featured

**Description**: Get featured apps (curated by admin)

**Authentication**: API key required

**Query Parameters**:
- `limit` (optional): Max apps to return (default: 6, max: 50)

**Response:** Same format as trending endpoint

**Notes**:
- Only apps with `is_featured` flag set to true
- Ordered by `featured_order` field

---

### POST /api/v1/marketplace/install/:appId

**Description**: Install an app for the authenticated user

**Authentication**: Auth token required (user-specific)

**Request Body:**
```json
{
  "profile_id": "ext_profile_xyz",
  "settings": {
    "custom_setting": "value"
  }
}
```

**Response:**
```json
{
  "ok": true,
  "success": true,
  "data": {
    "installation_id": "ext_install_abc",
    "app_id": "ext_app_xyz",
    "profile_id": "ext_profile_xyz",
    "installed_at": "2025-01-26T10:00:00Z",
    "is_active": true,
    "settings": {}
  }
}
```

---

### DELETE /api/v1/marketplace/uninstall/:appId

**Description**: Uninstall an app

**Authentication**: Auth token required

**Response:**
```json
{
  "ok": true,
  "success": true,
  "message": "App uninstalled successfully"
}
```

---

## 👥 Sessions, Team & Analytics

### GET /api/v1/sessions

**Description**: List user's sessions

**Authentication**: API key required

**Response:**
```json
{
  "ok": true,
  "success": true,
  "data": [
    {
      "id": "ext_session_xyz",
      "name": "Team Standup",
      "start_time": "2025-01-27T09:00:00Z",
      "duration": 30,
      "participants": 5
    }
  ]
}
```

---

### GET /api/v1/sessions/upcoming

**Description**: List upcoming sessions

**Authentication**: API key required

**Response:** Same format as /sessions

---

### GET /api/v1/team/members

**Description**: Get team members

**Authentication**: API key required

**Response:**
```json
{
  "ok": true,
  "success": true,
  "data": [
    {
      "memberId": "ext_member_xyz",
      "displayName": "John Doe",
      "role": "member",
      "joinedAt": "2024-01-15T10:00:00Z",
      "avatar": "https://example.com/avatar.jpg"
    }
  ]
}
```

---

### GET /api/v1/analytics/summary

**Description**: Get analytics summary

**Authentication**: API key required

**Response:**
```json
{
  "ok": true,
  "success": true,
  "data": {
    "total_entries": 125,
    "total_sessions": 42,
    "active_users": 15,
    "period": "last_30_days"
  }
}
```

---

## 📝 Content Endpoints

### GET /api/v1/entries

**Description**: List entries with filtering

**Authentication**: API key required

**Query Parameters**:
- `limit` (optional): Items per page (default: 50, max: 100)
- `offset` (optional): Pagination offset
- `profile_id` (optional): Filter by profile
- `group_id` (optional): Filter by group
- `audience` (optional): Filter by audience type (public, private, group_only)

**Response:**
```json
{
  "ok": true,
  "success": true,
  "data": [
    {
      "id": "ext_entry_xyz",
      "content": "Entry content",
      "audience": "public",
      "created_at": "2025-01-26T10:00:00Z",
      "author": {
        "id": "ext_user_abc",
        "name": "John Doe"
      }
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 125
    }
  }
}
```

---

## 🛡️ Admin Endpoints

### GET /api/v1/admin/apps/pending

**Description**: List apps pending review (admin only)

**Authentication**: Admin token required

**Response:**
```json
{
  "ok": true,
  "success": true,
  "data": [
    {
      "id": "ext_app_xyz",
      "name": "Pending App",
      "status": "pending_review",
      "submitted_at": "2025-01-25T10:00:00Z",
      "developer_name": "Developer Name"
    }
  ]
}
```

---

### POST /api/v1/admin/apps/:appId/review

**Description**: Approve or reject an app submission (admin only)

**Authentication**: Admin token required

**Request Body:**
```json
{
  "status": "approved",
  "reviewerNotes": "Looks good, approved for marketplace"
}
```

**Status Options**:
- `approved` - Approve and publish to marketplace
- `rejected` - Reject and allow resubmission

**Response:**
```json
{
  "ok": true,
  "success": true,
  "data": {
    "id": "ext_app_xyz",
    "status": "approved",
    "reviewed_at": "2025-01-26T10:00:00Z",
    "reviewed_by": "ext_admin_abc",
    "reviewer_notes": "Looks good, approved for marketplace"
  }
}
```

---

## ⚠️ Error Handling

### Common Error Codes

| Code | HTTP Status | Description | Action Required |
|------|-------------|-------------|-----------------|
| `UNAUTHORIZED` | 401 | Invalid or missing API key | Check authentication |
| `FORBIDDEN` | 403 | Insufficient permissions | Review permissions |
| `NOT_FOUND` | 404 | Resource not found | Verify endpoint/ID |
| `VALIDATION_ERROR` | 400 | Invalid request data | Fix request format |
| `RATE_LIMITED` | 429 | Too many requests | Implement backoff |
| `SERVER_ERROR` | 500 | Internal server error | Retry with backoff |

### Error Response Examples

**Authentication Error:**
```json
{
  "success": false,
  "error": "Invalid API key",
  "error_code": "UNAUTHORIZED",
  "details": {
    "message": "The provided API key is invalid or expired",
    "suggestion": "Verify your API key in the developer dashboard"
  }
}
```

**Validation Error:**
```json
{
  "success": false,
  "error": "Validation failed",
  "error_code": "VALIDATION_ERROR",
  "details": {
    "fields": {
      "email": "Invalid email format",
      "name": "Name is required"
    }
  }
}
```

### Error Handling Best Practices

```javascript
class OrivaApiClient {
  async request(endpoint, options = {}) {
    try {
      const response = await fetch(endpoint, options);

      // Handle different status codes
      if (response.status === 401) {
        throw new Error('Authentication failed. Check your API key.');
      }

      if (response.status === 403) {
        throw new Error('Insufficient permissions for this operation.');
      }

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || 60;
        throw new Error(`Rate limited. Retry after ${retryAfter} seconds.`);
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'API request failed');
      }

      return await response.json();
    } catch (error) {
      // Log error for debugging (don't expose sensitive data)
      console.error('API Error:', {
        endpoint,
        error: error.message,
        timestamp: new Date().toISOString()
      });

      throw error;
    }
  }
}
```

---

## 🚦 Rate Limiting

### Current Limits

| Endpoint Type | Limit | Window | Burst Allowance |
|---------------|-------|--------|-----------------|
| **Authentication** | 100 requests | 15 minutes | 10 requests |
| **Core API** | 1,000 requests | 15 minutes | 50 requests |
| **Marketplace** | 1,000 requests | 1 hour | 20 requests |
| **Admin Endpoints** | 30 requests | 1 minute | 5 requests |

### Rate Limit Headers

Responses include rate limit information:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1643648400
X-RateLimit-Window: 900
```

### Handling Rate Limits

```javascript
class RateLimitHandler {
  async requestWithRetry(endpoint, options, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(endpoint, options);

        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('Retry-After')) || (2 ** attempt);

          console.log(`Rate limited. Retrying in ${retryAfter} seconds...`);
          await this.sleep(retryAfter * 1000);
          continue;
        }

        return response;
      } catch (error) {
        if (attempt === maxRetries - 1) throw error;
        await this.sleep(1000 * (2 ** attempt)); // Exponential backoff
      }
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

## 📊 Best Practices

### 1. Security Best Practices

```javascript
// ✅ Secure API client implementation
class SecureOrivaClient {
  constructor() {
    this.baseUrl = 'https://api.oriva.io/api/v1';
    this.apiKey = process.env.ORIVA_API_KEY; // Server-side only
  }

  async makeRequest(endpoint, options = {}) {
    // Validate inputs
    if (!endpoint) throw new Error('Endpoint is required');
    if (!this.apiKey) throw new Error('API key not configured');

    const url = `${this.baseUrl}${endpoint}`;
    const requestOptions = {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'YourApp/1.0.0',
        ...options.headers
      }
    };

    // Make request with error handling
    const response = await fetch(url, requestOptions);

    // Handle errors appropriately
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return response.json();
  }
}
```

### 2. Performance Optimization

```javascript
// Cache responses to reduce API calls
class CachedOrivaClient extends SecureOrivaClient {
  constructor() {
    super();
    this.cache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes
  }

  async getCached(endpoint, options = {}) {
    const cacheKey = `${endpoint}-${JSON.stringify(options)}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    const data = await this.makeRequest(endpoint, options);
    this.cache.set(cacheKey, { data, timestamp: Date.now() });

    return data;
  }
}
```

### 3. Error Resilience

```javascript
// Implement circuit breaker pattern
class ResilientOrivaClient extends CachedOrivaClient {
  constructor() {
    super();
    this.failureCount = 0;
    this.circuitBreakerThreshold = 5;
    this.circuitBreakerTimeout = 60000; // 1 minute
    this.lastFailureTime = 0;
  }

  async makeRequestWithCircuitBreaker(endpoint, options = {}) {
    // Check circuit breaker
    if (this.isCircuitOpen()) {
      throw new Error('Circuit breaker is open. Service temporarily unavailable.');
    }

    try {
      const result = await this.makeRequest(endpoint, options);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  isCircuitOpen() {
    return this.failureCount >= this.circuitBreakerThreshold &&
           Date.now() - this.lastFailureTime < this.circuitBreakerTimeout;
  }

  onSuccess() {
    this.failureCount = 0;
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
  }
}
```

### 4. Monitoring and Logging

```javascript
// Add comprehensive logging
class MonitoredOrivaClient extends ResilientOrivaClient {
  async makeRequest(endpoint, options = {}) {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      // Log request start
      this.logRequest(requestId, endpoint, options);

      const result = await super.makeRequest(endpoint, options);

      // Log successful response
      this.logResponse(requestId, endpoint, Date.now() - startTime, true);

      return result;
    } catch (error) {
      // Log error response
      this.logResponse(requestId, endpoint, Date.now() - startTime, false, error);
      throw error;
    }
  }

  logRequest(requestId, endpoint, options) {
    console.log({
      type: 'api_request',
      requestId,
      endpoint,
      method: options.method || 'GET',
      timestamp: new Date().toISOString()
    });
  }

  logResponse(requestId, endpoint, duration, success, error = null) {
    console.log({
      type: 'api_response',
      requestId,
      endpoint,
      duration,
      success,
      error: error?.message,
      timestamp: new Date().toISOString()
    });
  }

  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

---

## 🛠️ Development Tools

### API Testing Scripts

```javascript
// test-api-endpoints.js
const { MonitoredOrivaClient } = require('./oriva-client');

async function testAllEndpoints() {
  const client = new MonitoredOrivaClient();

  const tests = [
    { name: 'User Info', endpoint: '/user/me' },
    { name: 'Available Profiles', endpoint: '/profiles/available' },
    { name: 'User Groups', endpoint: '/groups' },
    { name: 'Marketplace Apps', endpoint: '/marketplace/apps' },
    { name: 'Installed Apps', endpoint: '/marketplace/installed' }
  ];

  for (const test of tests) {
    try {
      console.log(`Testing ${test.name}...`);
      const result = await client.makeRequest(test.endpoint);
      console.log(`✅ ${test.name}: ${result.data?.length || 'OK'}`);
    } catch (error) {
      console.error(`❌ ${test.name}: ${error.message}`);
    }
  }
}

testAllEndpoints();
```

### Response Schema Validation

```javascript
// validate-responses.js
const Joi = require('joi');

const schemas = {
  user: Joi.object({
    success: Joi.boolean().required(),
    data: Joi.object({
      id: Joi.string().pattern(/^ext_user_/).required(),
      name: Joi.string().required(),
      email: Joi.string().email().required(),
      avatar: Joi.string().uri().optional(),
      created_at: Joi.string().isoDate().required()
    }).required()
  }),

  profiles: Joi.object({
    success: Joi.boolean().required(),
    data: Joi.array().items(
      Joi.object({
        id: Joi.string().pattern(/^ext_profile_/).required(),
        name: Joi.string().required(),
        is_active: Joi.boolean().required(),
        permissions: Joi.array().items(Joi.string()).required()
      })
    ).required()
  })
};

function validateResponse(type, response) {
  const schema = schemas[type];
  if (!schema) throw new Error(`Unknown schema type: ${type}`);

  const { error } = schema.validate(response);
  if (error) throw new Error(`Validation failed: ${error.message}`);

  return true;
}

module.exports = { validateResponse, schemas };
```

---

## 📚 Additional Resources

### Related Documentation
- [Authentication Patterns](./authentication-patterns.md) - Secure auth implementation
- [API Headers Reference](./api-headers-reference.md) - Complete header documentation
- [API Troubleshooting Guide](./api-troubleshooting-guide.md) - Debug and resolve issues
- [Security Warning](./SECURITY-WARNING.md) - Critical security information

### Development Tools
- [Postman Collection](https://example.com/postman) - API testing collection
- [OpenAPI Specification](../openapi.yml) - Machine-readable API spec
- [SDK Libraries](https://github.com/oriva/sdks) - Official SDK implementations

---

**Security Note**: Always implement proper authentication, never expose API keys in client-side code, and follow the security patterns outlined in this documentation.

*Last Updated: January 2025 | Security Audit: January 2025*