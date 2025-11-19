# Oriva Platform API - Complete User Guide

**The comprehensive reference for all Oriva Platform public API endpoints**

[![API Version](https://img.shields.io/badge/API-v1.0-blue)]()
[![Endpoints](https://img.shields.io/badge/Endpoints-37+-green)]()
[![Last Updated](https://img.shields.io/badge/Updated-January%202025-blue)]()

> **Quick Navigation:** [Overview](./API_OVERVIEW.md) | [Patterns](./API_PATTERNS.md) | [Troubleshooting](./api-troubleshooting-guide.md)

---

## 📖 Table of Contents

### Getting Started

- [Authentication Model](#authentication-model)
- [Base URL & Headers](#base-url--headers)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [Rate Limits](#rate-limits)

### API Categories

1. [Health & Test](#1-health--test) - 3 endpoints
2. [User & Authentication](#2-user--authentication) - 3 endpoints
3. [Profiles](#3-profiles) - 4 endpoints
4. [Groups](#4-groups) - 2 endpoints
5. [Sessions & Team](#5-sessions--team) - 4 endpoints
6. [Entries & Content](#6-entries--content) - 4 endpoints
7. [Developer Apps](#7-developer-apps) - 7 endpoints
8. [Marketplace](#8-marketplace) - 8 endpoints
9. [Admin](#9-admin) - 2 endpoints
10. [Hugo AI](#10-hugo-ai) - unspecified

**Total: ~37 public API endpoints**

---

## Authentication Model

### How Oriva Authentication Works

**Important:** Third-party apps do **NOT** implement their own authentication. Instead:

1. **Oriva Core handles all user authentication**
2. **Users authenticate with Oriva** (not with your app)
3. **Your app receives an API key** from the Oriva marketplace
4. **You access authenticated user data** via the API using your key
5. **Oriva manages user sessions, profiles, and permissions**

```
User → Logs into Oriva Core → Installs Your App → Your App Uses API Key
                                                     ↓
                                      Oriva API returns user's data
```

### Your Authentication Flow

```javascript
// You DON'T do this:
// ❌ app.post('/login', ...) - No auth endpoints in your app
// ❌ app.post('/register', ...) - Oriva handles this

// You DO this:
// ✅ Use your API key to access Oriva's authenticated users
const response = await fetch('https://api.oriva.io/api/v1/user/me', {
  headers: {
    Authorization: `Bearer ${process.env.ORIVA_API_KEY}`,
    'Content-Type': 'application/json',
  },
});

// Returns the current Oriva user's data
const user = await response.json();
```

### Getting Your API Key

1. Log into [Oriva Core](https://oriva.io)
2. Navigate to **Settings → Developer Settings**
3. Click **"Generate Live API Key"**
4. Copy your key (format: `oriva_pk_live_...`)
5. Store in environment variables: `ORIVA_API_KEY=oriva_pk_live_...`

**🔐 Security:** Never expose API keys in client-side code. Always use server-side proxies.

### iframe Authentication (for Marketplace Apps)

When your app runs inside Oriva (via iframe), you receive user-specific tokens through postMessage instead of using your API key directly.

#### How It Works

```
User launches your app → Oriva loads your execution_url in iframe
                                    ↓
                       Your app sends ORIVA_REQUEST_AUTH
                                    ↓
                       Oriva responds with ORIVA_AUTH_TOKEN
                                    ↓
                       Your app uses accessToken for API calls
```

#### Requesting Authentication

```javascript
class OrivaAuth {
  constructor(appId) {
    this.appId = appId;
    this.tokens = null;
  }

  async requestAuthentication() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Authentication timeout'));
      }, 15000);

      const handleMessage = (event) => {
        // Validate origin for security
        const allowedOrigins = ['https://app.oriva.io', 'https://oriva.io'];
        if (!allowedOrigins.includes(event.origin)) {
          return;
        }

        if (event.data?.type === 'ORIVA_AUTH_TOKEN') {
          clearTimeout(timeout);
          window.removeEventListener('message', handleMessage);
          resolve(event.data.data);
        }
      };

      window.addEventListener('message', handleMessage);

      // Request auth from Oriva
      window.parent.postMessage(
        {
          type: 'ORIVA_REQUEST_AUTH',
          appId: this.appId,
        },
        '*'
      );
    });
  }
}

// Usage
const auth = new OrivaAuth('my-app-id');
const tokens = await auth.requestAuthentication();
console.log('User:', tokens.user);
```

#### Token Structure

```javascript
{
  accessToken: 'eyJhbGciOiJIUzI1NiIs...',  // JWT for API calls
  expiresIn: 3600,                          // Seconds until expiration
  user: {
    id: 'user-uuid',
    email: 'user@example.com',
    name: 'John Doe',
    avatar: 'https://...'
  }
}
```

#### Token Refresh

Tokens expire after ~1 hour. To refresh, simply request authentication again:

```javascript
class OrivaAuth {
  constructor(appId) {
    this.appId = appId;
    this.tokens = null;
  }

  // Check if token needs refresh (5 minute buffer)
  needsRefresh() {
    if (!this.tokens) return true;
    return this.tokens.expiresIn < 300;
  }

  // Get valid token, refreshing if needed
  async getAccessToken() {
    if (this.needsRefresh()) {
      this.tokens = await this.requestAuthentication();
    }
    return this.tokens.accessToken;
  }

  async requestAuthentication() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout')), 15000);

      const handler = (event) => {
        const allowedOrigins = ['https://app.oriva.io', 'https://oriva.io'];
        if (!allowedOrigins.includes(event.origin)) return;

        if (event.data?.type === 'ORIVA_AUTH_TOKEN') {
          clearTimeout(timeout);
          window.removeEventListener('message', handler);
          resolve(event.data.data);
        }
      };

      window.addEventListener('message', handler);
      window.parent.postMessage(
        {
          type: 'ORIVA_REQUEST_AUTH',
          appId: this.appId,
        },
        '*'
      );
    });
  }
}

// Usage with automatic refresh
const auth = new OrivaAuth('my-app-id');
const token = await auth.getAccessToken();

// Make API call
const response = await fetch('https://api.oriva.io/api/v1/user/me', {
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
});
```

#### When to Use Each Auth Method

| Scenario                      | Auth Method       | Token Type                            |
| ----------------------------- | ----------------- | ------------------------------------- |
| **Your backend server**       | API Key           | `oriva_pk_live_...`                   |
| **Your app in Oriva iframe**  | postMessage       | `accessToken` from `ORIVA_AUTH_TOKEN` |
| **Managing your app listing** | API Key           | `oriva_pk_live_...`                   |
| **Accessing user's data**     | postMessage token | `accessToken`                         |

---

## Base URL & Headers

### Base URL

```
https://api.oriva.io/api/v1
```

### Required Headers

```http
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
User-Agent: YourApp/1.0.0
```

### Example Request

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -H "User-Agent: MyApp/1.0.0" \
     https://api.oriva.io/api/v1/user/me
```

---

## Response Format

### Success Response

All endpoints return consistent JSON structure:

```json
{
  "ok": true,
  "success": true,
  "data": {
    // Response data here
  },
  "meta": {
    // Optional metadata (pagination, etc.)
  }
}
```

**Note:** Both `ok` and `success` are provided for compatibility. New integrations should use `success`.

### Error Response

```json
{
  "ok": false,
  "success": false,
  "error": "Human-readable error message",
  "message": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Pagination Response

```json
{
  "success": true,
  "data": [
    /* items */
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

## Error Handling

### Common Error Codes

| Code               | HTTP Status | Description                | Action Required            |
| ------------------ | ----------- | -------------------------- | -------------------------- |
| `UNAUTHORIZED`     | 401         | Invalid or missing API key | Check authentication       |
| `FORBIDDEN`        | 403         | Insufficient permissions   | Review required scopes     |
| `NOT_FOUND`        | 404         | Resource not found         | Verify resource ID         |
| `VALIDATION_ERROR` | 400         | Invalid request data       | Fix request format         |
| `RATE_LIMITED`     | 429         | Too many requests          | Implement backoff strategy |
| `SERVER_ERROR`     | 500         | Internal server error      | Retry with backoff         |

---

## Rate Limits

| Endpoint Type       | Requests | Window     |
| ------------------- | -------- | ---------- |
| **Authentication**  | 100      | 15 minutes |
| **Core API**        | 1,000    | 15 minutes |
| **Marketplace**     | 1,000    | 1 hour     |
| **Admin Endpoints** | 30       | 1 minute   |

### Rate Limit Headers

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1643648400
X-RateLimit-Window: 900
```

---

## 1. Health & Test

### GET /health

**Description:** Basic server health check

**Authentication:** None

**Request:**

```bash
curl https://api.oriva.io/health
```

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2025-01-26T12:00:00Z"
}
```

---

### GET /api/v1/health

**Description:** API health status with details

**Authentication:** None

**Request:**

```bash
curl https://api.oriva.io/api/v1/health
```

**Response:**

```json
{
  "success": true,
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2025-01-26T12:00:00Z"
}
```

---

### GET /api/v1/test

**Description:** API connectivity test endpoint

**Authentication:** None

**Response:**

```json
{
  "success": true,
  "message": "API is working"
}
```

---

## 2. User & Authentication

**Note:** Users are authenticated by Oriva Core. Your app receives their data via API key.

### GET /api/v1/user/me

**Description:** Get current Oriva user's profile

**Authentication:** API Key

**Request:**

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.oriva.io/api/v1/user/me
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "ext_user_abc123",
    "name": "John Doe",
    "email": "user@example.com",
    "avatar": "https://example.com/avatar.jpg",
    "created_at": "2024-01-15T10:00:00Z",
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

| Property      | Type   | Description                  | Privacy Level |
| ------------- | ------ | ---------------------------- | ------------- |
| `id`          | string | External user ID (sanitized) | Public        |
| `name`        | string | User display name            | Public        |
| `email`       | string | User email address           | Restricted    |
| `avatar`      | string | Profile image URL            | Public        |
| `created_at`  | string | Account creation timestamp   | Public        |
| `last_login`  | string | Last login timestamp         | Restricted    |
| `preferences` | object | User preferences             | Private       |

---

### GET /api/v1/users/me

**Description:** Alias for `/api/v1/user/me`

**Authentication:** API Key

**Note:** Returns the same response as `/api/v1/user/me`

---

### GET /api/v1/auth/profile

**Description:** Get authenticated profile

**Authentication:** Auth Token (user-specific)

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "ext_profile_xyz",
    "name": "My Profile",
    "is_active": true
  }
}
```

---

## 3. Profiles

### GET /api/v1/profiles/available

**Description:** List profiles available to the current user

**Authentication:** API Key

**Request:**

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.oriva.io/api/v1/profiles/available
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

| Property       | Type    | Description                         | Privacy Level |
| -------------- | ------- | ----------------------------------- | ------------- |
| `id`           | string  | External profile ID (sanitized)     | Public        |
| `name`         | string  | Profile display name                | Public        |
| `description`  | string  | Profile description                 | Public        |
| `avatar`       | string  | Profile image URL                   | Public        |
| `is_active`    | boolean | Whether profile is currently active | Public        |
| `permissions`  | array   | User permissions in this profile    | Restricted    |
| `created_at`   | string  | Profile creation timestamp          | Public        |
| `member_count` | number  | Number of profile members           | Public        |
| `settings`     | object  | Profile configuration               | Restricted    |

---

### GET /api/v1/profiles/active

**Description:** Get currently active profile

**Authentication:** API Key

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "ext_profile_xyz789",
    "name": "Work Profile",
    "is_active": true,
    "avatar": "https://example.com/avatar.jpg"
  }
}
```

---

### PUT /api/v1/profiles/:profileId

**Description:** Update profile information

**Authentication:** API Key (must have write permissions)

**Request:**

```json
{
  "name": "Updated Profile Name",
  "description": "Updated description",
  "settings": {
    "visibility": "private"
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "ext_profile_xyz789",
    "name": "Updated Profile Name",
    "description": "Updated description",
    "updated_at": "2025-01-26T15:00:00Z"
  }
}
```

---

### POST /api/v1/profiles/:profileId/activate

**Description:** Activate (switch to) a different profile

**Authentication:** API Key

**Request Body:** None required

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "ext_profile_xyz789",
    "name": "Work Profile",
    "is_active": true,
    "activated_at": "2025-01-26T15:00:00Z"
  }
}
```

---

## 4. Groups

### GET /api/v1/groups

**Description:** Get user's group memberships

**Authentication:** API Key

**Request:**

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.oriva.io/api/v1/groups
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

| Property       | Type   | Description                   | Privacy Level |
| -------------- | ------ | ----------------------------- | ------------- |
| `id`           | string | External group ID (sanitized) | Public        |
| `name`         | string | Group display name            | Public        |
| `description`  | string | Group description             | Public        |
| `role`         | string | User's role in the group      | Public        |
| `permissions`  | array  | User permissions in group     | Restricted    |
| `member_count` | number | Total group members           | Public        |
| `created_at`   | string | Group creation timestamp      | Public        |
| `settings`     | object | Group configuration           | Restricted    |

---

### GET /api/v1/groups/:groupId/members

**Description:** Get group members and their details

**Authentication:** API Key

**Request:**

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.oriva.io/api/v1/groups/ext_group_def456/members
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "memberId": "ext_member_xyz",
      "displayName": "Alice Johnson",
      "role": "admin",
      "joinedAt": "2024-01-15T10:00:00Z",
      "avatar": "https://example.com/avatar.jpg"
    }
  ]
}
```

---

## 5. Sessions & Team

### GET /api/v1/sessions

**Description:** List user's sessions

**Authentication:** API Key

**Request:**

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.oriva.io/api/v1/sessions
```

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

**Description:** List upcoming sessions

**Authentication:** API Key

**Request:**

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.oriva.io/api/v1/sessions/upcoming
```

**Response:**

```json
{
  "ok": true,
  "success": true,
  "data": [
    {
      "id": "ext_session_abc",
      "name": "Project Review",
      "start_time": "2025-01-28T14:00:00Z",
      "duration": 60,
      "participants": 8
    }
  ]
}
```

---

### GET /api/v1/team/members

**Description:** Get team members

**Authentication:** API Key

**Request:**

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.oriva.io/api/v1/team/members
```

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

**Description:** Get analytics summary

**Authentication:** API Key

**Request:**

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.oriva.io/api/v1/analytics/summary
```

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

## 6. Entries & Content

### GET /api/v1/entries

**Description:** List entries with filtering

**Authentication:** API Key

**Query Parameters:**

- `limit` (optional): Items per page (default: 50, max: 100)
- `offset` (optional): Pagination offset
- `profile_id` (optional): Filter by profile
- `group_id` (optional): Filter by group
- `audience` (optional): Filter by audience type (public, private, group_only)

**Request:**

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://api.oriva.io/api/v1/entries?limit=20&audience=public"
```

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
      "limit": 20,
      "total": 125
    }
  }
}
```

---

### GET /api/v1/templates

**Description:** List available templates

**Authentication:** API Key

**Request:**

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.oriva.io/api/v1/templates
```

**Response:**

```json
{
  "ok": true,
  "success": true,
  "data": [
    {
      "id": "ext_template_xyz",
      "name": "Weekly Check-in",
      "description": "Weekly progress template",
      "category": "productivity",
      "fields": []
    }
  ]
}
```

---

### GET /api/v1/storage

**Description:** Get storage information

**Authentication:** API Key

**Request:**

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.oriva.io/api/v1/storage
```

**Response:**

```json
{
  "ok": true,
  "success": true,
  "data": {
    "used_bytes": 1024000,
    "total_bytes": 10737418240,
    "used_percentage": 0.01
  }
}
```

---

### POST /api/v1/ui/notifications

**Description:** Send UI notification to user

**Authentication:** API Key

**Request:**

```json
{
  "message": "Your report is ready",
  "type": "info",
  "duration": 5000
}
```

**Response:**

```json
{
  "ok": true,
  "success": true,
  "data": {
    "notification_id": "ext_notif_xyz",
    "sent_at": "2025-01-26T15:00:00Z"
  }
}
```

---

## 7. Developer Apps

### GET /api/v1/developer/apps

**Description:** List all apps you've created as a developer

**Authentication:** API Key (must be developer)

**Request:**

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.oriva.io/api/v1/developer/apps
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

**Status Values:**

- `draft` - App being edited, not submitted
- `pending_review` - Submitted, awaiting admin review
- `approved` - Approved and visible in marketplace
- `rejected` - Rejected by admin, can resubmit

---

### GET /api/v1/developer/apps/:appId

**Description:** Get app details (must be owner)

**Authentication:** API Key (must own the app)

**Response:** Same structure as listing, but single app object

---

### POST /api/v1/developer/apps

**Description:** Create a new marketplace application

**Authentication:** API Key

**Request:**

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
    "created_at": "2025-01-26T10:00:00Z"
  }
}
```

---

### PUT /api/v1/developer/apps/:appId

**Description:** Update an existing app (cannot change status)

**Authentication:** API Key (must own the app)

**Request Body:** Same as POST, all fields optional

**Response:** Updated app object

**Notes:**

- Cannot update `status` field via this endpoint
- Use submit/resubmit endpoints to change status

---

### DELETE /api/v1/developer/apps/:appId

**Description:** Delete an app (only if in draft status)

**Authentication:** API Key (must own the app)

**Response:**

```json
{
  "ok": true,
  "success": true,
  "message": "App deleted successfully"
}
```

**Restrictions:**

- Can only delete apps with status `draft`
- Returns 403 error if app is submitted, approved, or rejected

---

### POST /api/v1/developer/apps/:appId/submit

**Description:** Submit app for marketplace review

**Authentication:** API Key (must own the app)

**Request Body:** None required

**Response:**

```json
{
  "ok": true,
  "success": true,
  "data": {
    "id": "ext_app_xyz123",
    "status": "pending_review",
    "submitted_at": "2025-01-26T10:00:00Z"
  }
}
```

**Requirements:**

- App must be in `draft` status
- Returns 404 if app not found or already submitted

---

### POST /api/v1/developer/apps/:appId/resubmit

**Description:** Resubmit app after rejection

**Authentication:** API Key (must own the app)

**Request:**

```json
{
  "notes": "Fixed issues mentioned in review"
}
```

**Response:** Updated app with status `pending_review`

**Requirements:**

- App must be in `rejected` status

---

## 8. Marketplace

### GET /api/v1/marketplace/apps

**Description:** Get available marketplace applications

**Authentication:** API Key

**Query Parameters:**

- `limit` (optional): Max apps to return (default: 20, max: 50)
- `offset` (optional): Pagination offset
- `category` (optional): Filter by category

**Request:**

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://api.oriva.io/api/v1/marketplace/apps?limit=10&category=productivity"
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
      "per_page": 10,
      "total_count": 145
    },
    "categories": ["productivity", "communication", "analytics"]
  }
}
```

---

### GET /api/v1/marketplace/apps/:appId

**Description:** Get app details by ID

**Authentication:** API Key

**Response:** Single app object with same structure as listing

---

### GET /api/v1/marketplace/trending

**Description:** Get trending apps based on install count

**Authentication:** API Key

**Query Parameters:**

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

**Description:** Get featured apps (curated by admin)

**Authentication:** API Key

**Query Parameters:**

- `limit` (optional): Max apps to return (default: 6, max: 50)

**Response:** Same format as trending endpoint

**Notes:**

- Only apps with `is_featured` flag set to true
- Ordered by `featured_order` field

---

### GET /api/v1/marketplace/categories

**Description:** Get marketplace categories

**Authentication:** API Key or None

**Response:**

```json
{
  "success": true,
  "data": ["productivity", "communication", "analytics", "utilities"]
}
```

---

### GET /api/v1/marketplace/installed

**Description:** Get user's installed applications

**Authentication:** Auth Token (user-specific)

**Request:**

```bash
curl -H "Authorization: Bearer USER_AUTH_TOKEN" \
  https://api.oriva.io/api/v1/marketplace/installed
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

### POST /api/v1/marketplace/install/:appId

**Description:** Install an app for the authenticated user

**Authentication:** Auth Token (user-specific)

**Request:**

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

**Description:** Uninstall an app

**Authentication:** Auth Token (user-specific)

**Response:**

```json
{
  "ok": true,
  "success": true,
  "message": "App uninstalled successfully"
}
```

---

## 9. Admin

**Note:** Admin endpoints require admin-level authentication and are restricted to Oriva administrators.

### GET /api/v1/admin/apps/pending

**Description:** List apps pending review (admin only)

**Authentication:** Admin Token

**Request:**

```bash
curl -H "Authorization: Bearer ADMIN_TOKEN" \
  https://api.oriva.io/api/v1/admin/apps/pending
```

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
      "developer_name": "Developer Name",
      "category": "productivity"
    }
  ]
}
```

---

### POST /api/v1/admin/apps/:appId/review

**Description:** Approve or reject an app submission (admin only)

**Authentication:** Admin Token

**Request:**

```json
{
  "status": "approved",
  "reviewerNotes": "Looks good, approved for marketplace"
}
```

**Status Options:**

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

## 10. Hugo AI

**Description:** Hugo AI endpoints are available for apps that want to integrate Oriva's AI chat system.

**Base Path:** `/api/hugo/*`

**Authentication:** API Key

**Note:** Hugo AI endpoints are available for third-party apps that want to provide AI coaching, chat, or insights features to their users. Contact Oriva for detailed Hugo AI integration documentation.

**Example Endpoints:**

- Chat and messaging
- Session management
- AI insights and analytics
- Conversation history

For detailed Hugo AI integration documentation, please contact Oriva support or refer to the Hugo AI integration guide (coming soon).

---

## 🔒 Security Best Practices

### Server-Side Proxy Pattern (Recommended)

```javascript
// Your backend (Express.js example)
app.get('/api/oriva-proxy/user/me', async (req, res) => {
  try {
    const response = await fetch('https://api.oriva.io/api/v1/user/me', {
      headers: {
        Authorization: `Bearer ${process.env.ORIVA_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Rate Limiting Implementation

```javascript
class RateLimitHandler {
  async requestWithRetry(endpoint, options, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(endpoint, options);

        if (response.status === 429) {
          const retryAfter =
            parseInt(response.headers.get('Retry-After')) || 2 ** attempt;
          console.log(`Rate limited. Retrying in ${retryAfter} seconds...`);
          await this.sleep(retryAfter * 1000);
          continue;
        }

        return response;
      } catch (error) {
        if (attempt === maxRetries - 1) throw error;
        await this.sleep(1000 * 2 ** attempt);
      }
    }
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

---

## 📚 Additional Resources

### Related Documentation

- **[API Overview](./API_OVERVIEW.md)** - 5-minute introduction
- **[API Patterns](./API_PATTERNS.md)** - Production patterns and best practices
- **[API Troubleshooting Guide](./api-troubleshooting-guide.md)** - Debug and resolve issues
- **[Authentication Patterns](./authentication-patterns.md)** - Secure auth implementation
- **[Quick Start Guide](./quick-start.md)** - 15-minute integration

### Getting Help

- **Documentation:** [Developer Guide](./README.md)
- **Issues:** [GitHub Issues](https://github.com/0riva/oriva-platform/issues)
- **Security:** security@oriva.io

---

**Security Note:** Always implement proper authentication, never expose API keys in client-side code, and follow the security patterns outlined in this documentation.

_Last Updated: January 2025 | Security Audit: January 2025_
