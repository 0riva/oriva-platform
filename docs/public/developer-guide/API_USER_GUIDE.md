# Oriva Platform API - Complete User Guide

**The comprehensive reference for all Oriva Platform API endpoints**

[![API Version](https://img.shields.io/badge/API-v1.0-blue)]()
[![Endpoints](https://img.shields.io/badge/Endpoints-150+-green)]()
[![Last Updated](https://img.shields.io/badge/Updated-January%202025-blue)]()

> **Quick Navigation:** [Overview](./API_OVERVIEW.md) | [Patterns](./API_PATTERNS.md) | [Security](./API_SECURITY.md) | [Troubleshooting](./api-troubleshooting-guide.md)

---

## 📖 Table of Contents

### Getting Started
- [Authentication](#authentication)
- [Base URL & Headers](#base-url--headers)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [Rate Limits](#rate-limits)

### API Categories
1. [Health & Diagnostics](#1-health--diagnostics) - 5 endpoints
2. [Authentication & Account](#2-authentication--account) - 9 endpoints
3. [User & Profile Management](#3-user--profile-management) - 12 endpoints
4. [Sessions & Coaching (Hugo AI)](#4-sessions--coaching-hugo-ai) - 8 endpoints
5. [Insights & Analytics (Hugo AI)](#5-insights--analytics-hugo-ai) - 7 endpoints
6. [Team & Groups](#6-team--groups) - 3 endpoints
7. [Analytics & Usage Metrics](#7-analytics--usage-metrics) - 1 endpoint
8. [Marketplace - Apps Management](#8-marketplace---apps-management) - 8 endpoints
9. [Marketplace - Items/Commerce](#9-marketplace---itemscommerce) - 7 endpoints
10. [Marketplace - Categories](#10-marketplace---categories) - 6 endpoints
11. [Developer Tools - App Management](#11-developer-tools---app-management) - 7 endpoints
12. [Admin Tools](#12-admin-tools) - 1 endpoint
13. [Entries & Data](#13-entries--data) - 3 endpoints
14. [Notifications & UI](#14-notifications--ui) - 5 endpoints
15. [Events & Webhooks](#15-events--webhooks) - 10 endpoints
16. [Platform Apps](#16-platform-apps) - 4 endpoints
17. [Data Extraction (GDPR)](#17-data-extraction-gdpr) - 6 endpoints
18. [Photos & Media](#18-photos--media) - 2 endpoints
19. [Ice Breakers](#19-ice-breakers) - 8 endpoints
20. [Work Buddy (Career/Productivity)](#20-work-buddy-careerproductivity) - 15 endpoints
21. [Hugo-Love (Dating/Matching)](#21-hugo-love-datingmatching) - 30+ endpoints
22. [Hugo AI Consolidated Routes](#22-hugo-ai-consolidated-routes) - 4 endpoints

---

## Authentication

### Authentication Methods

The Oriva Platform API supports three authentication methods:

| Method | Header Format | Use Case |
|--------|--------------|----------|
| **API Key** | `Authorization: Bearer oriva_pk_live_...` | Server-side integrations, developer apps |
| **Auth Token** | `Authorization: Bearer <jwt-token>` | User-specific actions, authenticated requests |
| **Admin Token** | `X-Admin-Token: <admin-token>` | Administrative operations |

### Getting Your API Key

1. Log into [Oriva Core](https://oriva.io)
2. Navigate to **Settings → Developer Settings**
3. Click **"Generate Live API Key"**
4. Copy your key (format: `oriva_pk_live_...`)

**🔐 Security:** Store API keys in environment variables. Never expose them in client-side code.

```javascript
// ✅ Secure
const apiKey = process.env.ORIVA_API_KEY;

// ❌ Never do this
const apiKey = 'oriva_pk_live_abc123...';
```

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
```

### Recommended Headers

```http
User-Agent: your-app-name/1.0.0
X-Client-ID: your-app-name
```

### Example Request

```javascript
const response = await fetch('https://api.oriva.io/api/v1/user/me', {
  headers: {
    'Authorization': `Bearer ${process.env.ORIVA_API_KEY}`,
    'Content-Type': 'application/json',
    'User-Agent': 'my-app/1.0.0',
    'X-Client-ID': 'my-app'
  }
});

const data = await response.json();
```

---

## Response Format

All API endpoints return consistent JSON responses:

### Success Response

```json
{
  "success": true,
  "ok": true,
  "data": {
    // Response data (object or array)
  },
  "meta": {
    // Optional metadata (pagination, counts, etc.)
  }
}
```

### Error Response

```json
{
  "success": false,
  "ok": false,
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {
    // Optional error details
  }
}
```

### Pagination Response

```json
{
  "success": true,
  "data": [...],
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

### Common HTTP Status Codes

| Code | Meaning | Action Required |
|------|---------|-----------------|
| 200 | Success | Request completed successfully |
| 400 | Bad Request | Check request parameters |
| 401 | Unauthorized | Verify API key/authentication |
| 403 | Forbidden | Check permissions |
| 404 | Not Found | Verify endpoint URL and resource ID |
| 429 | Too Many Requests | Implement rate limiting/backoff |
| 500 | Server Error | Retry with exponential backoff |

### Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| `UNAUTHORIZED` | Invalid or missing API key | Check authentication headers |
| `FORBIDDEN` | Insufficient permissions | Review required scopes |
| `NOT_FOUND` | Resource not found | Verify resource ID |
| `VALIDATION_ERROR` | Invalid request data | Fix request format |
| `RATE_LIMITED` | Too many requests | Implement backoff strategy |
| `SERVER_ERROR` | Internal server error | Retry with backoff |

---

## Rate Limits

| Endpoint Type | Requests | Window | Burst Allowance |
|---------------|----------|--------|-----------------|
| **Core API** | 1,000 | 15 minutes | 50 requests |
| **Marketplace** | 1,000 | 1 hour | 20 requests |
| **Admin Endpoints** | 30 | 1 minute | 5 requests |

### Rate Limit Headers

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1643648400
X-RateLimit-Window: 900
```

---

## 1. Health & Diagnostics

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

### GET /api/v1/dev/permissions

**Description:** Get available API permissions documentation

**Authentication:** None

**Response:**
```json
{
  "success": true,
  "permissions": [
    "user:read",
    "user:write",
    "profiles:read",
    "profiles:write",
    "groups:read",
    "entries:read"
  ]
}
```

---

### GET /api/v1/debug/cors

**Description:** CORS debugging endpoint (admin only)

**Authentication:** Admin Token

**Request:**
```bash
curl -H "X-Admin-Token: YOUR_ADMIN_TOKEN" \
  https://api.oriva.io/api/v1/debug/cors
```

---

## 2. Authentication & Account

### POST /api/v1/auth/register

**Description:** Create a new user account

**Authentication:** None

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user_id": "ext_user_abc123",
    "email": "user@example.com",
    "name": "John Doe",
    "access_token": "eyJhbGci...",
    "refresh_token": "eyJhbGci..."
  }
}
```

---

### POST /api/v1/auth/login

**Description:** Authenticate user and get tokens

**Authentication:** None

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user_id": "ext_user_abc123",
    "access_token": "eyJhbGci...",
    "refresh_token": "eyJhbGci...",
    "expires_at": "2025-01-27T12:00:00Z"
  }
}
```

---

### POST /api/v1/auth/logout

**Description:** Log out current user

**Authentication:** API Key

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### POST /api/v1/auth/token/refresh

**Description:** Refresh access token using refresh token

**Authentication:** None

**Request:**
```json
{
  "refresh_token": "eyJhbGci..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGci...",
    "expires_at": "2025-01-27T12:00:00Z"
  }
}
```

---

### GET /api/v1/auth/profile

**Description:** Get authenticated user's profile

**Authentication:** Auth Token

**Request:**
```bash
curl -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  https://api.oriva.io/api/v1/auth/profile
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "ext_user_abc123",
    "email": "user@example.com",
    "name": "John Doe",
    "avatar": "https://example.com/avatar.jpg",
    "created_at": "2024-01-15T10:00:00Z"
  }
}
```

---

### PATCH /api/v1/auth/profile

**Description:** Update user profile (partial update)

**Authentication:** Auth Token

**Request:**
```json
{
  "name": "Jane Doe",
  "avatar": "https://example.com/new-avatar.jpg"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "ext_user_abc123",
    "name": "Jane Doe",
    "avatar": "https://example.com/new-avatar.jpg"
  }
}
```

---

### PUT /api/v1/auth/profile

**Description:** Update user profile (full update)

**Authentication:** Auth Token

**Request:**
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "avatar": "https://example.com/avatar.jpg",
  "bio": "Software developer"
}
```

---

### DELETE /api/v1/auth/account

**Description:** Permanently delete user account

**Authentication:** Auth Token

**Request:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  https://api.oriva.io/api/v1/auth/account
```

**Response:**
```json
{
  "success": true,
  "message": "Account deleted successfully"
}
```

---

## 3. User & Profile Management

### GET /api/v1/user/me

**Description:** Get current user's profile and API key information

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
    "created_at": "2024-01-15T10:00:00Z"
  }
}
```

---

### GET /api/v1/users/me

**Description:** Alias for `/api/v1/user/me`

**Authentication:** API Key

---

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
      "created_at": "2024-06-01T09:00:00Z"
    }
  ],
  "meta": {
    "total_count": 3
  }
}
```

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

**Authentication:** API Key

**Request:**
```json
{
  "name": "Updated Profile Name",
  "description": "New description",
  "avatar": "https://example.com/new-avatar.jpg"
}
```

---

### POST /api/v1/profiles/:profileId/activate

**Description:** Switch to a different profile

**Authentication:** API Key

**Request:**
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.oriva.io/api/v1/profiles/ext_profile_xyz789/activate
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "ext_profile_xyz789",
    "name": "Work Profile",
    "is_active": true
  }
}
```

---

### POST /api/v1/apps/profiles

**Description:** Create app-specific user profile

**Authentication:** API Key

**Request:**
```json
{
  "name": "My App Profile",
  "metadata": {
    "theme": "dark",
    "preferences": {}
  }
}
```

---

### GET /api/v1/apps/profiles/:userId

**Description:** Get user's app profile

**Authentication:** API Key

---

### PATCH /api/v1/apps/profiles/:userId

**Description:** Update user's app profile

**Authentication:** API Key

---

### DELETE /api/v1/apps/profiles/:userId

**Description:** Delete user's app profile

**Authentication:** API Key

---

### GET /api/v1/apps/profiles

**Description:** List user's app profiles

**Authentication:** API Key

---

### GET /api/v1/apps/profiles/stats/:userId

**Description:** Get profile statistics

**Authentication:** API Key

---

## 4. Sessions & Coaching (Hugo AI)

### POST /api/v1/hugo-ai/sessions

**Description:** Create new coaching session

**Authentication:** API Key

**Request:**
```json
{
  "title": "Weekly Check-in",
  "type": "coaching",
  "metadata": {
    "focus_area": "career_development"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "ext_session_abc123",
    "title": "Weekly Check-in",
    "type": "coaching",
    "status": "active",
    "created_at": "2025-01-26T12:00:00Z"
  }
}
```

---

### PATCH /api/v1/hugo-ai/sessions/:sessionId

**Description:** Update coaching session

**Authentication:** API Key

**Request:**
```json
{
  "title": "Updated Session Title",
  "metadata": {
    "notes": "Session notes"
  }
}
```

---

### GET /api/v1/hugo-ai/sessions/:sessionId

**Description:** Get session details

**Authentication:** API Key

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "ext_session_abc123",
    "title": "Weekly Check-in",
    "status": "active",
    "duration": 1800,
    "created_at": "2025-01-26T12:00:00Z"
  }
}
```

---

### GET /api/v1/hugo-ai/sessions

**Description:** List user's coaching sessions

**Authentication:** API Key

**Query Parameters:**
- `limit` (optional): Max sessions to return (default: 50)
- `offset` (optional): Pagination offset
- `status` (optional): Filter by status (active, concluded, cancelled)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "ext_session_abc123",
      "title": "Weekly Check-in",
      "status": "active",
      "created_at": "2025-01-26T12:00:00Z"
    }
  ],
  "meta": {
    "pagination": {
      "total_count": 10,
      "page": 1,
      "per_page": 50
    }
  }
}
```

---

### DELETE /api/v1/hugo-ai/sessions/:sessionId

**Description:** Delete coaching session

**Authentication:** API Key

**Response:**
```json
{
  "success": true,
  "message": "Session deleted successfully"
}
```

---

### POST /api/v1/hugo-ai/sessions/:sessionId/conclude

**Description:** Mark session as concluded

**Authentication:** API Key

**Request:**
```json
{
  "summary": "Session summary",
  "action_items": ["Follow up on goals", "Schedule next session"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "ext_session_abc123",
    "status": "concluded",
    "concluded_at": "2025-01-26T13:00:00Z"
  }
}
```

---

### GET /api/v1/hugo-ai/sessions/stats

**Description:** Get session statistics

**Authentication:** API Key

**Response:**
```json
{
  "success": true,
  "data": {
    "total_sessions": 42,
    "active_sessions": 3,
    "concluded_sessions": 39,
    "total_duration": 75600,
    "average_duration": 1800
  }
}
```

---

## 5. Insights & Analytics (Hugo AI)

### POST /api/v1/hugo-ai/insights

**Description:** Create insight entry

**Authentication:** API Key

**Request:**
```json
{
  "title": "Career Insight",
  "content": "Insight content here",
  "category": "career",
  "tags": ["goal-setting", "productivity"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "ext_insight_xyz123",
    "title": "Career Insight",
    "content": "Insight content here",
    "created_at": "2025-01-26T12:00:00Z"
  }
}
```

---

### GET /api/v1/hugo-ai/insights

**Description:** List insights for user

**Authentication:** API Key

**Query Parameters:**
- `limit` (optional): Max insights to return
- `offset` (optional): Pagination offset
- `category` (optional): Filter by category

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "ext_insight_xyz123",
      "title": "Career Insight",
      "category": "career",
      "created_at": "2025-01-26T12:00:00Z"
    }
  ]
}
```

---

### GET /api/v1/hugo-ai/insights/:insightId

**Description:** Get specific insight

**Authentication:** API Key

---

### GET /api/v1/hugo-ai/insights/latest

**Description:** Get latest insight

**Authentication:** API Key

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "ext_insight_xyz123",
    "title": "Latest Insight",
    "content": "...",
    "created_at": "2025-01-26T12:00:00Z"
  }
}
```

---

### PATCH /api/v1/hugo-ai/insights/:insightId

**Description:** Update insight

**Authentication:** API Key

---

### GET /api/v1/hugo-ai/insights/stats

**Description:** Get insight statistics

**Authentication:** API Key

**Response:**
```json
{
  "success": true,
  "data": {
    "total_insights": 127,
    "by_category": {
      "career": 45,
      "personal": 32,
      "health": 50
    }
  }
}
```

---

### DELETE /api/v1/hugo-ai/insights/:insightId

**Description:** Delete insight

**Authentication:** API Key

---

## 6. Team & Groups

### GET /api/v1/team/members

**Description:** Get user's team members (groups)

**Authentication:** API Key

**Response:**
```json
{
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

### GET /api/v1/groups

**Description:** Get user's groups

**Authentication:** API Key

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
      "member_count": 12,
      "created_at": "2024-03-15T11:45:00Z"
    }
  ]
}
```

---

### GET /api/v1/groups/:groupId/members

**Description:** Get group members and their details

**Authentication:** API Key

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "memberId": "ext_member_xyz",
      "displayName": "Alice Johnson",
      "role": "admin",
      "joinedAt": "2024-01-15T10:00:00Z"
    }
  ]
}
```

---

## 7. Analytics & Usage Metrics

### GET /api/v1/analytics/summary

**Description:** Get user analytics overview (entries, responses, groups, apps)

**Authentication:** API Key

**Response:**
```json
{
  "success": true,
  "data": {
    "total_entries": 125,
    "total_sessions": 42,
    "active_users": 15,
    "period": "last_30_days",
    "breakdown": {
      "entries_by_week": [12, 15, 18, 22],
      "sessions_by_week": [4, 5, 6, 8]
    }
  }
}
```

---

## 8. Marketplace - Apps Management

### GET /api/v1/marketplace/apps

**Description:** Get all approved marketplace apps

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
      "description": "Advanced task management",
      "category": "productivity",
      "icon": "https://example.com/icon.png",
      "developer": {
        "name": "ProductiveCorp",
        "verified": true
      },
      "install_count": 5000,
      "ratings": {
        "average": 4.7,
        "count": 1250
      }
    }
  ],
  "meta": {
    "pagination": {
      "total_count": 145,
      "page": 1,
      "per_page": 10
    }
  }
}
```

---

### GET /api/v1/marketplace/trending

**Description:** Get trending apps based on install count

**Authentication:** API Key

**Query Parameters:**
- `limit` (optional): Max apps to return (default: 10, max: 50)

---

### GET /api/v1/marketplace/featured

**Description:** Get featured apps (curated by admin)

**Authentication:** API Key

**Query Parameters:**
- `limit` (optional): Max apps to return (default: 6, max: 50)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "ext_app_xyz",
      "name": "Featured App",
      "is_featured": true,
      "featured_order": 1
    }
  ]
}
```

---

### GET /api/v1/marketplace/categories

**Description:** Get marketplace categories

**Authentication:** API Key or None

**Response:**
```json
{
  "success": true,
  "data": [
    "productivity",
    "communication",
    "analytics",
    "utilities",
    "entertainment"
  ]
}
```

---

### GET /api/v1/marketplace/apps/:appId

**Description:** Get app details by ID

**Authentication:** API Key

---

### GET /api/v1/marketplace/installed

**Description:** Get user's installed apps

**Authentication:** API Key

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
      "status": "active"
    }
  ]
}
```

---

### POST /api/v1/marketplace/install/:appId

**Description:** Install an app for the authenticated user

**Authentication:** Auth Token

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
  "success": true,
  "data": {
    "installation_id": "ext_install_abc",
    "app_id": "ext_app_xyz",
    "installed_at": "2025-01-26T10:00:00Z",
    "is_active": true
  }
}
```

---

### DELETE /api/v1/marketplace/uninstall/:appId

**Description:** Uninstall an app

**Authentication:** Auth Token

**Response:**
```json
{
  "success": true,
  "message": "App uninstalled successfully"
}
```

---

## 9. Marketplace - Items/Commerce

### GET /api/v1/marketplace/items

**Description:** List/search marketplace items (public)

**Authentication:** None

**Query Parameters:**
- `search` (optional): Search query
- `category` (optional): Filter by category
- `limit` (optional): Max items to return
- `offset` (optional): Pagination offset

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "ext_item_abc123",
      "title": "Premium Widget",
      "description": "High-quality widget",
      "price": 29.99,
      "category": "tools",
      "seller": {
        "name": "WidgetCo",
        "verified": true
      }
    }
  ]
}
```

---

### POST /api/v1/marketplace/items/create

**Description:** Create marketplace item

**Authentication:** Auth Token

**Request:**
```json
{
  "title": "My Product",
  "description": "Product description",
  "price": 49.99,
  "category": "tools",
  "images": ["https://example.com/image1.jpg"]
}
```

---

### GET /api/v1/marketplace/items/:id

**Description:** Get marketplace item details

**Authentication:** None

---

### PUT /api/v1/marketplace/items/:id

**Description:** Update marketplace item

**Authentication:** Auth Token (must be owner)

---

### DELETE /api/v1/marketplace/items/:id

**Description:** Delete marketplace item

**Authentication:** Auth Token (must be owner)

---

### POST /api/v1/marketplace/search

**Description:** Advanced marketplace search

**Authentication:** None

**Request:**
```json
{
  "query": "productivity tools",
  "filters": {
    "category": "productivity",
    "price_min": 0,
    "price_max": 50
  }
}
```

---

## 10. Marketplace - Categories

### GET /api/v1/marketplace/categories

**Description:** List all categories

**Authentication:** None

---

### POST /api/v1/marketplace/categories

**Description:** Create category (admin only)

**Authentication:** Admin Token

---

### GET /api/v1/marketplace/categories/tree

**Description:** Get category hierarchy/tree

**Authentication:** None

---

### GET /api/v1/marketplace/categories/:id

**Description:** Get category by ID

**Authentication:** None

---

### PUT /api/v1/marketplace/categories/:id

**Description:** Update category (admin)

**Authentication:** Admin Token

---

### DELETE /api/v1/marketplace/categories/:id

**Description:** Delete category (admin)

**Authentication:** Admin Token

---

## 11. Developer Tools - App Management

### GET /api/v1/developer/apps

**Description:** List developer's apps

**Authentication:** API Key

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "ext_app_xyz123",
      "name": "My Awesome App",
      "slug": "my-awesome-app",
      "status": "approved",
      "install_count": 150,
      "created_at": "2025-01-01T10:00:00Z"
    }
  ]
}
```

---

### GET /api/v1/developer/apps/:appId

**Description:** Get app details (must be owner)

**Authentication:** API Key

---

### POST /api/v1/developer/apps

**Description:** Create new app

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
  "execution_url": "https://myapp.com",
  "pricing_model": "free"
}
```

**Response:**
```json
{
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

**Description:** Update app details

**Authentication:** API Key (must be owner)

---

### DELETE /api/v1/developer/apps/:appId

**Description:** Delete app (draft only)

**Authentication:** API Key (must be owner)

**Response:**
```json
{
  "success": true,
  "message": "App deleted successfully"
}
```

**Note:** Can only delete apps with status `draft`

---

### POST /api/v1/developer/apps/:appId/submit

**Description:** Submit app for review

**Authentication:** API Key (must be owner)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "ext_app_xyz123",
    "status": "pending_review",
    "submitted_at": "2025-01-26T10:00:00Z"
  }
}
```

---

### POST /api/v1/developer/apps/:appId/resubmit

**Description:** Resubmit rejected app

**Authentication:** API Key (must be owner)

**Request:**
```json
{
  "notes": "Fixed issues mentioned in review"
}
```

---

## 12. Admin Tools

### POST /api/v1/admin/apps/:appId/review

**Description:** Approve or reject app submission (admin only)

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

---

## 13. Entries & Data

### GET /api/v1/entries

**Description:** Get user's entries

**Authentication:** API Key

**Query Parameters:**
- `limit` (optional): Items per page (default: 50, max: 100)
- `offset` (optional): Pagination offset
- `profile_id` (optional): Filter by profile
- `group_id` (optional): Filter by group
- `audience` (optional): Filter by audience type (public, private, group_only)

**Response:**
```json
{
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
  ]
}
```

---

### GET /api/v1/templates

**Description:** Get available templates

**Authentication:** API Key

---

### GET /api/v1/storage

**Description:** Get storage information

**Authentication:** API Key

**Response:**
```json
{
  "success": true,
  "data": {
    "used_bytes": 1024000,
    "total_bytes": 10737418240,
    "used_percentage": 0.01
  }
}
```

---

## 14. Notifications & UI

### POST /api/v1/ui/notifications

**Description:** Create UI notification

**Authentication:** API Key

**Request:**
```json
{
  "title": "New Message",
  "message": "You have a new message",
  "type": "info",
  "action_url": "https://example.com/messages"
}
```

---

### POST /api/v1/apps/:appId/notifications

**Description:** Create notification from app

**Authentication:** Auth Token

---

### GET /api/v1/users/:userId/notifications

**Description:** Get user's notifications

**Authentication:** Auth Token

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "ext_notif_xyz",
      "title": "New Message",
      "message": "You have a new message",
      "type": "info",
      "read": false,
      "created_at": "2025-01-26T12:00:00Z"
    }
  ]
}
```

---

### PATCH /api/v1/notifications/:id

**Description:** Update notification status (read/dismissed/clicked)

**Authentication:** Auth Token

**Request:**
```json
{
  "read": true,
  "dismissed": false
}
```

---

### DELETE /api/v1/notifications/:id

**Description:** Delete notification

**Authentication:** Auth Token

---

## 15. Events & Webhooks

### POST /api/v1/events

**Description:** Publish event to event bus

**Authentication:** API Key

**Request:**
```json
{
  "event_type": "user.action",
  "data": {
    "action": "button_click",
    "metadata": {}
  }
}
```

---

### GET /api/v1/events

**Description:** Get event history

**Authentication:** API Key

---

### POST /api/v1/events/subscribe

**Description:** Subscribe to events

**Authentication:** API Key

**Request:**
```json
{
  "event_types": ["user.action", "app.installed"],
  "webhook_url": "https://myapp.com/webhook"
}
```

---

### GET /api/v1/events/subscriptions

**Description:** List event subscriptions

**Authentication:** API Key

---

### DELETE /api/v1/events/subscriptions/:id

**Description:** Delete subscription

**Authentication:** API Key

---

### POST /api/v1/apps/:appId/events

**Description:** Publish an event from app

**Authentication:** Auth Token

---

### GET /api/v1/apps/:appId/events

**Description:** Query events for app

**Authentication:** Auth Token

---

### POST /api/v1/apps/:appId/webhooks

**Description:** Create webhook for app

**Authentication:** Auth Token

**Request:**
```json
{
  "url": "https://myapp.com/webhook",
  "events": ["user.created", "user.updated"],
  "secret": "webhook_secret_key"
}
```

---

### GET /api/v1/apps/:appId/webhooks

**Description:** List webhooks for app

**Authentication:** Auth Token

---

### PATCH /api/v1/apps/:appId/webhooks/:id

**Description:** Update webhook

**Authentication:** Auth Token

---

### DELETE /api/v1/apps/:appId/webhooks/:id

**Description:** Delete webhook

**Authentication:** Auth Token

---

## 16. Platform Apps

### POST /api/v1/platform/apps

**Description:** Create platform app

**Authentication:** API Key

---

### GET /api/v1/platform/apps

**Description:** List platform apps

**Authentication:** API Key

---

### GET /api/v1/platform/apps/:appId

**Description:** Get platform app details

**Authentication:** API Key

---

### PATCH /api/v1/platform/apps/:appId

**Description:** Update platform app

**Authentication:** API Key

---

## 17. Data Extraction (GDPR)

### POST /api/v1/platform/extraction/prepare

**Description:** Prepare user data extraction

**Authentication:** API Key

**Request:**
```json
{
  "data_types": ["profile", "entries", "sessions"],
  "format": "json"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "manifest_id": "ext_manifest_abc123",
    "status": "preparing",
    "estimated_completion": "2025-01-26T12:30:00Z"
  }
}
```

---

### POST /api/v1/platform/extraction/:manifestId/execute

**Description:** Execute and download extracted data

**Authentication:** API Key

---

### GET /api/v1/platform/extraction/:manifestId

**Description:** Get extraction manifest status

**Authentication:** API Key

**Response:**
```json
{
  "success": true,
  "data": {
    "manifest_id": "ext_manifest_abc123",
    "status": "completed",
    "download_url": "https://example.com/download/abc123",
    "expires_at": "2025-01-27T12:00:00Z"
  }
}
```

---

### GET /api/v1/platform/extraction

**Description:** List user's extraction manifests

**Authentication:** API Key

---

### DELETE /api/v1/platform/extraction/:manifestId

**Description:** Cancel extraction

**Authentication:** API Key

---

### GET /api/v1/platform/users/data/export

**Description:** Export user's data (GDPR)

**Authentication:** API Key

---

## 18. Photos & Media

### POST /api/v1/apps/photos/generate-signed-url

**Description:** Generate signed URL for photo upload

**Authentication:** API Key

**Request:**
```json
{
  "filename": "photo.jpg",
  "content_type": "image/jpeg",
  "size": 1024000
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "upload_url": "https://storage.example.com/upload/...",
    "photo_id": "ext_photo_xyz123",
    "expires_at": "2025-01-26T13:00:00Z"
  }
}
```

---

### POST /api/v1/apps/photos/process-upload

**Description:** Process uploaded photo

**Authentication:** API Key

**Request:**
```json
{
  "photo_id": "ext_photo_xyz123",
  "metadata": {
    "caption": "My photo",
    "tags": ["travel", "adventure"]
  }
}
```

---

## 19. Ice Breakers

### POST /api/v1/apps/ice-breakers

**Description:** Create ice breaker

**Authentication:** API Key

**Request:**
```json
{
  "question": "What's your favorite hobby?",
  "category": "personal",
  "difficulty": "easy"
}
```

---

### GET /api/v1/apps/ice-breakers

**Description:** List ice breakers

**Authentication:** API Key

---

### GET /api/v1/apps/ice-breakers/:iceBrakerId

**Description:** Get ice breaker details

**Authentication:** API Key

---

### GET /api/v1/apps/ice-breakers/by-category/:category

**Description:** Get ice breakers by category

**Authentication:** API Key

---

### POST /api/v1/apps/ice-breakers/:iceBrakerId/respond

**Description:** Respond to ice breaker

**Authentication:** API Key

**Request:**
```json
{
  "response": "I love hiking and photography"
}
```

---

### PATCH /api/v1/apps/ice-breakers/:iceBrakerId

**Description:** Update ice breaker

**Authentication:** API Key

---

### DELETE /api/v1/apps/ice-breakers/:iceBrakerId

**Description:** Delete ice breaker

**Authentication:** API Key

---

### GET /api/v1/apps/ice-breakers/stats

**Description:** Get ice breaker statistics

**Authentication:** API Key

**Response:**
```json
{
  "success": true,
  "data": {
    "total_ice_breakers": 50,
    "total_responses": 200,
    "by_category": {
      "personal": 20,
      "professional": 15,
      "fun": 15
    }
  }
}
```

---

## 20. Work Buddy (Career/Productivity)

### GET /api/v1/apps/work-buddy/goals

**Description:** Get user's work goals

**Authentication:** API Key

---

### POST /api/v1/apps/work-buddy/goals

**Description:** Create work goal

**Authentication:** API Key

**Request:**
```json
{
  "title": "Complete project milestone",
  "description": "Finish Phase 1 by end of month",
  "deadline": "2025-02-01T00:00:00Z",
  "category": "project"
}
```

---

### GET /api/v1/apps/work-buddy/goals/:goalId

**Description:** Get goal details

**Authentication:** API Key

---

### PATCH /api/v1/apps/work-buddy/goals/:goalId

**Description:** Update goal

**Authentication:** API Key

---

### DELETE /api/v1/apps/work-buddy/goals/:goalId

**Description:** Delete goal

**Authentication:** API Key

---

### POST /api/v1/apps/work-buddy/goals/:goalId/progress

**Description:** Log goal progress

**Authentication:** API Key

**Request:**
```json
{
  "progress_percentage": 75,
  "notes": "Made significant progress this week"
}
```

---

### POST /api/v1/apps/work-buddy/check-ins

**Description:** Create check-in

**Authentication:** API Key

**Request:**
```json
{
  "mood": "productive",
  "accomplishments": ["Completed task A", "Started task B"],
  "challenges": ["Time management"],
  "notes": "Good day overall"
}
```

---

### POST /api/v1/apps/work-buddy/check-ins/ai-analysis

**Description:** Get AI analysis of check-ins

**Authentication:** API Key

---

### GET /api/v1/apps/work-buddy/stats

**Description:** Get work buddy statistics

**Authentication:** API Key

---

### GET /api/v1/apps/work-buddy/analytics

**Description:** Get detailed analytics

**Authentication:** API Key

**Response:**
```json
{
  "success": true,
  "data": {
    "goals": {
      "total": 15,
      "completed": 10,
      "in_progress": 5,
      "completion_rate": 0.67
    },
    "check_ins": {
      "total": 30,
      "this_week": 5,
      "average_mood": "productive"
    },
    "productivity_trends": {
      "weekly": [85, 90, 88, 92],
      "monthly": [87, 89, 90]
    }
  }
}
```

---

### GET /api/v1/apps/work-buddy/recommendations

**Description:** Get AI recommendations

**Authentication:** API Key

---

### GET /api/v1/apps/work-buddy/trends

**Description:** Get progress trends

**Authentication:** API Key

---

## 21. Hugo-Love (Dating/Matching)

The Hugo-Love app provides comprehensive dating and matching functionality.

### Profile Management

#### POST /api/v1/apps/hugo-love/profiles

**Description:** Create Hugo Love profile

**Authentication:** Auth Token

**Request:**
```json
{
  "display_name": "Alex",
  "age": 28,
  "bio": "Love hiking and coffee",
  "photos": ["https://example.com/photo1.jpg"],
  "preferences": {
    "age_min": 25,
    "age_max": 35,
    "distance_max": 50
  }
}
```

---

#### GET /api/v1/apps/hugo-love/profiles/me

**Description:** Get own Hugo Love profile

**Authentication:** Auth Token

---

#### PATCH /api/v1/apps/hugo-love/profiles/me

**Description:** Update own profile

**Authentication:** Auth Token

---

#### GET /api/v1/apps/hugo-love/profiles/:userId

**Description:** Get user's profile

**Authentication:** Auth Token

---

### Blocking

#### POST /api/v1/apps/hugo-love/profiles/blocks

**Description:** Block a user

**Authentication:** Auth Token

**Request:**
```json
{
  "blocked_user_id": "ext_user_xyz123",
  "reason": "inappropriate_behavior"
}
```

---

#### GET /api/v1/apps/hugo-love/profiles/blocks

**Description:** Get blocked users

**Authentication:** Auth Token

---

### Swiping & Matching

#### POST /api/v1/apps/hugo-love/swipe

**Description:** Swipe on a profile

**Authentication:** Auth Token

**Request:**
```json
{
  "profile_id": "ext_profile_xyz123",
  "direction": "right",
  "super_like": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "is_match": true,
    "match_id": "ext_match_abc123"
  }
}
```

---

#### GET /api/v1/apps/hugo-love/swipe

**Description:** Get profiles to swipe on

**Authentication:** Auth Token

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "profile_id": "ext_profile_xyz123",
      "display_name": "Sam",
      "age": 27,
      "photos": ["https://example.com/photo.jpg"],
      "bio": "Adventure seeker"
    }
  ]
}
```

---

#### GET /api/v1/apps/hugo-love/swipe/today

**Description:** Get today's swipes

**Authentication:** Auth Token

---

### Matches

#### GET /api/v1/apps/hugo-love/matches

**Description:** Get user's matches

**Authentication:** Auth Token

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "match_id": "ext_match_abc123",
      "profile": {
        "id": "ext_profile_xyz",
        "display_name": "Jordan",
        "photo": "https://example.com/photo.jpg"
      },
      "matched_at": "2025-01-25T14:30:00Z",
      "last_message": "Hey! How are you?",
      "unread_count": 2
    }
  ]
}
```

---

#### GET /api/v1/apps/hugo-love/matches/:matchId

**Description:** Get match details

**Authentication:** Auth Token

---

#### PATCH /api/v1/apps/hugo-love/matches/:matchId

**Description:** Update match status

**Authentication:** Auth Token

---

### Messaging

#### GET /api/v1/apps/hugo-love/messages/:matchId

**Description:** Get messages with match

**Authentication:** Auth Token

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "ext_msg_xyz",
      "sender_id": "ext_user_abc",
      "content": "Hey! How are you?",
      "sent_at": "2025-01-26T10:00:00Z",
      "read": true
    }
  ]
}
```

---

#### POST /api/v1/apps/hugo-love/messages/:matchId

**Description:** Send message to match

**Authentication:** Auth Token

**Request:**
```json
{
  "content": "I'm doing great! How about you?",
  "type": "text"
}
```

---

#### PATCH /api/v1/apps/hugo-love/messages/:messageId/read

**Description:** Mark message as read

**Authentication:** Auth Token

---

#### DELETE /api/v1/apps/hugo-love/messages/:messageId

**Description:** Delete message

**Authentication:** Auth Token

---

### Ratings

#### POST /api/v1/apps/hugo-love/ratings

**Description:** Rate a user

**Authentication:** Auth Token

**Request:**
```json
{
  "rated_user_id": "ext_user_xyz",
  "rating": 5,
  "category": "conversation"
}
```

---

#### GET /api/v1/apps/hugo-love/ratings/:userId

**Description:** Get ratings for user

**Authentication:** Auth Token

---

#### GET /api/v1/apps/hugo-love/ratings/given

**Description:** Get ratings given by user

**Authentication:** Auth Token

---

### Journal

#### POST /api/v1/apps/hugo-love/journal

**Description:** Create journal entry

**Authentication:** Auth Token

**Request:**
```json
{
  "title": "First Date Reflections",
  "content": "Had a great time...",
  "mood": "happy",
  "tags": ["dating", "reflections"]
}
```

---

#### GET /api/v1/apps/hugo-love/journal

**Description:** Get journal entries

**Authentication:** Auth Token

---

#### PATCH /api/v1/apps/hugo-love/journal/:entryId

**Description:** Update journal entry

**Authentication:** Auth Token

---

#### DELETE /api/v1/apps/hugo-love/journal/:entryId

**Description:** Delete journal entry

**Authentication:** Auth Token

---

### AI Chat

#### POST /api/v1/apps/hugo-love/ai-chat

**Description:** Chat with AI matchmaker

**Authentication:** Auth Token

**Request:**
```json
{
  "message": "Give me dating advice",
  "context": {
    "recent_matches": 3,
    "conversation_count": 5
  }
}
```

---

#### GET /api/v1/apps/hugo-love/ai-chat/history

**Description:** Get chat history

**Authentication:** Auth Token

---

#### POST /api/v1/apps/hugo-love/ai-chat/feedback

**Description:** Provide AI chat feedback

**Authentication:** Auth Token

---

### Moderation

#### POST /api/v1/apps/hugo-love/moderation

**Description:** Report user

**Authentication:** Auth Token

**Request:**
```json
{
  "reported_user_id": "ext_user_xyz",
  "reason": "inappropriate_content",
  "details": "Description of issue"
}
```

---

#### GET /api/v1/apps/hugo-love/moderation/my-reports

**Description:** Get own reports

**Authentication:** Auth Token

---

### Subscriptions

#### GET /api/v1/apps/hugo-love/subscriptions/me

**Description:** Get user's subscription

**Authentication:** Auth Token

---

#### POST /api/v1/apps/hugo-love/subscriptions

**Description:** Create subscription

**Authentication:** Auth Token

---

#### POST /api/v1/apps/hugo-love/subscriptions/cancel

**Description:** Cancel subscription

**Authentication:** Auth Token

---

#### GET /api/v1/apps/hugo-love/subscriptions/plans

**Description:** Get subscription plans

**Authentication:** None

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "plan_basic",
      "name": "Basic",
      "price": 0,
      "features": ["unlimited_swipes", "basic_matching"]
    },
    {
      "id": "plan_premium",
      "name": "Premium",
      "price": 9.99,
      "features": ["unlimited_swipes", "advanced_matching", "profile_boost"]
    }
  ]
}
```

---

## 22. Hugo AI Consolidated Routes

### POST /api/v1/hugo/chat

**Description:** Chat with Hugo AI (streaming via Server-Sent Events)

**Authentication:** Auth Token

**Headers:**
- `X-App-ID`: Required app identifier

**Request:**
```json
{
  "conversation_id": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Help me plan my career goals",
  "context": {
    "current_goals": ["Get promoted", "Learn new skills"],
    "metadata": {}
  }
}
```

**Response:** Server-Sent Events (SSE)
```
event: start
data: {"conversation_id":"...","message_id":"..."}

event: content
data: {"delta":"Hello"}

event: content
data: {"delta":" there!"}

event: done
data: {"message_id":"...","tokens":150}
```

---

### POST /api/v1/hugo/knowledge/search

**Description:** Search Hugo AI knowledge base

**Authentication:** Auth Token

**Request:**
```json
{
  "query": "career development tips",
  "category": "career",
  "limit": 10
}
```

---

### POST /api/v1/conversations

**Description:** Create conversation

**Authentication:** Auth Token

**Request:**
```json
{
  "title": "Career Planning Session"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Career Planning Session",
    "created_at": "2025-01-26T12:00:00Z"
  }
}
```

---

### GET /api/v1/conversations

**Description:** List conversations

**Authentication:** Auth Token

---

### GET /api/v1/conversations/:id

**Description:** Get conversation details with messages

**Authentication:** Auth Token

---

### DELETE /api/v1/conversations/:id

**Description:** Delete conversation

**Authentication:** Auth Token

---

## Appendix

### Common Query Parameters

#### Pagination
```
?limit=20          # Items per page (max: 100)
?offset=0          # Skip N items
?page=1            # Page number (alternative to offset)
```

#### Filtering
```
?category=productivity    # Filter by category
?search=keyword          # Search term
?status=active           # Filter by status
```

#### Sorting
```
?sort=name              # Sort field
?order=asc              # Sort order (asc/desc)
```

### Security Best Practices

1. **API Key Management**
   - Store in environment variables
   - Rotate keys regularly
   - Use different keys for dev/staging/production
   - Never commit keys to version control

2. **Request Security**
   - Always use HTTPS
   - Implement request signing for sensitive operations
   - Validate all inputs
   - Sanitize outputs

3. **Error Handling**
   - Don't expose sensitive information in errors
   - Log errors server-side
   - Return generic error messages to clients
   - Implement proper retry logic

4. **Rate Limiting**
   - Implement exponential backoff
   - Cache responses when appropriate
   - Monitor rate limit headers
   - Handle 429 responses gracefully

### Need Help?

- **[API Overview](./API_OVERVIEW.md)** - Quick introduction
- **[API Patterns](./API_PATTERNS.md)** - Integration patterns
- **[API Security](./API_SECURITY.md)** - Security guidelines
- **[Troubleshooting](./api-troubleshooting-guide.md)** - Debug issues
- **[GitHub Issues](https://github.com/0riva/oriva-platform/issues)** - Report bugs
- **[GitHub Discussions](https://github.com/0riva/oriva-platform/discussions)** - Ask questions

---

*Last Updated: January 2025 | Security Audit: January 2025*

**Maintained by:** Oriva Platform Team
