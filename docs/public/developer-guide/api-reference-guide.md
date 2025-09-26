# 🔧 API Reference Guide for 3rd Party Developers

**Complete API reference with property lists and discovery guidance**

[![API Version](https://img.shields.io/badge/API-v1.0-blue)]()
[![Documentation Status](https://img.shields.io/badge/Docs-Complete-green)]()
[![Last Updated](https://img.shields.io/badge/Updated-January%202025-blue)]()

---

## 📋 Quick Navigation

- [Response Format Standards](#response-format-standards)
- [Authentication & Headers](#authentication--headers)
- [Core API Endpoints](#core-api-endpoints)
- [Property Discovery Guide](#property-discovery-guide)
- [Testing & Development Tools](#testing--development-tools)
- [Best Practices](#best-practices)

---

## 🏗️ Response Format Standards

All Oriva Platform API endpoints follow a consistent response structure:

### Success Response Format
```json
{
  "success": true,
  "data": {
    // Endpoint-specific data object or array
  },
  "meta": {
    // Optional metadata (pagination, counts, etc.)
  }
}
```

### Error Response Format
```json
{
  "success": false,
  "error": "Error message description",
  "details": {
    // Optional error details for validation errors
  }
}
```

### Pagination Response Format
```json
{
  "success": true,
  "data": [...],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8,
      "hasMore": true
    }
  }
}
```

---

## 🔑 Authentication & Headers

### Required Headers
```http
Authorization: Bearer oriva_pk_live_your_api_key_here
Content-Type: application/json
```

### Recommended Headers
```http
User-Agent: your-app-name/1.0.0 (web)
X-Client-ID: your-app-name
```

> 📖 **Complete Headers Guide**: See [API Headers Guide](./api-headers-guide.md) for detailed header documentation.

---

## 🌐 Core API Endpoints

### 👤 User Profile API

#### `GET /api/v1/user/me`
Get current user profile information.

**Response Properties:**
```json
{
  "success": true,
  "data": {
    "id": "string",                    // User ID
    "username": "string",              // Username
    "displayName": "string",           // Display name
    "email": "string",                 // Email address
    "bio": "string | null",            // User biography
    "location": "string | null",       // User location
    "website": "string | null",        // Website URL
    "avatar": "string | null",         // Avatar image URL
    "createdAt": "ISO 8601 string",    // Account creation timestamp
    "updatedAt": "ISO 8601 string",    // Last profile update timestamp
    "apiKeyInfo": {                    // API key metadata (for debugging)
      "keyId": "string",               // API key identifier
      "name": "string",                // API key name
      "userId": "string",              // Associated user ID
      "permissions": ["string"],       // Array of permissions
      "usageCount": number             // Usage count
    }
  }
}
```

**Example Request:**
```javascript
const response = await fetch('https://api.oriva.io/api/v1/user/me', {
  headers: {
    'Authorization': 'Bearer oriva_pk_live_your_key_here',
    'Content-Type': 'application/json',
    'User-Agent': 'your-app/1.0.0',
    'X-Client-ID': 'your-app'
  }
});
const user = await response.json();
```

---

### 🎭 Profile Management API

#### `GET /api/v1/profiles/available`
Get profiles available to your application.

**Response Properties:**
```json
{
  "success": true,
  "data": [
    {
      "profileId": "string",           // External profile ID (format: ext_16chars)
      "profileName": "string",         // Profile display name
      "isActive": boolean              // Whether this profile is currently active
    }
  ]
}
```

**Profile ID Format:**
- Format: `ext_` followed by 16 hexadecimal characters
- Example: `ext_1234567890abcdef`
- Privacy: IDs are sanitized and cannot be linked to internal data

#### `GET /api/v1/profiles/active`
Get currently active profile.

**Response Properties:**
```json
{
  "success": true,
  "data": {
    "profileId": "string",             // External profile ID
    "profileName": "string",           // Profile display name
    "isActive": true                   // Always true for active profile
  }
}
```

#### `POST /api/v1/profiles/{profileId}/activate`
Switch to a different profile.

**Path Parameters:**
- `profileId` (required): Profile ID in format `ext_[a-f0-9]{16}`

**Response Properties:**
```json
{
  "success": true,
  "data": {
    "activeProfile": "string",         // New active profile ID
    "switchedAt": "ISO 8601 string"    // Switch timestamp
  }
}
```

---

### 👥 Group Management API

#### `GET /api/v1/groups`
Get groups accessible to your application.

**Response Properties:**
```json
{
  "success": true,
  "data": [
    {
      "groupId": "string",             // External group ID (format: ext_16chars)
      "groupName": "string",           // Group display name
      "memberCount": number,           // Total number of members
      "isActive": boolean              // Group status
    }
  ]
}
```

#### `GET /api/v1/groups/{groupId}/members`
Get sanitized member information for a group.

**Path Parameters:**
- `groupId` (required): Group ID in format `ext_[a-f0-9]{16}`

**Response Properties:**
```json
{
  "success": true,
  "data": [
    {
      "memberId": "string",            // External member ID (format: ext_member_10chars)
      "displayName": "string",         // Member display name (sanitized)
      "role": "string",                // Member role (admin, member, etc.)
      "joinedAt": "ISO 8601 string"    // Join timestamp
    }
  ]
}
```

**Privacy Features:**
- All IDs are prefixed and sanitized (`ext_`, `ext_member_`)
- Only display names and essential information provided
- Cannot link members across groups or profiles
- Cross-profile protection ensures privacy

---

### 🏪 Marketplace API

#### `GET /api/v1/marketplace/apps`
Browse available marketplace applications.

**Query Parameters:**
- `category` (optional): Filter by app category
- `search` (optional): Search in name, tagline, description
- `limit` (optional): Number of apps to return (default: 20)
- `offset` (optional): Pagination offset (default: 0)

**Response Properties:**
```json
{
  "success": true,
  "data": [
    {
      "id": "string",                  // App identifier
      "name": "string",                // App name
      "slug": "string",                // URL-friendly app slug
      "tagline": "string",             // Short description
      "description": "string",         // Full description
      "category": "string",            // App category
      "icon_url": "string | null",     // App icon URL
      "screenshots": ["string"],       // Array of screenshot URLs
      "version": "string",             // Current version
      "pricing_model": "string",       // free, paid, freemium
      "pricing_config": "object",      // Pricing configuration
      "install_count": number,         // Total installs
      "developer_id": "string",        // Developer identifier
      "developer_name": "string",      // Developer display name
      "created_at": "ISO 8601 string", // Creation timestamp
      "updated_at": "ISO 8601 string"  // Last update timestamp
    }
  ]
}
```

#### `GET /api/v1/marketplace/trending`
Get trending applications.

**Query Parameters:**
- `limit` (optional): Number of apps to return (default: 10)

**Response Properties:**
```json
{
  "success": true,
  "data": [
    {
      "id": "string",                  // App identifier
      "name": "string",                // App name
      "slug": "string",                // URL-friendly slug
      "tagline": "string",             // Short description
      "category": "string",            // App category
      "icon_url": "string | null",     // App icon URL
      "install_count": number,         // Total installs
      "developer_name": "string"       // Developer name
    }
  ]
}
```

#### `GET /api/v1/marketplace/featured`
Get featured applications.

**Query Parameters:**
- `limit` (optional): Number of apps to return (default: 6)

**Response Properties:** Same as trending apps

#### `GET /api/v1/marketplace/categories`
Get available app categories with counts.

**Response Properties:**
```json
{
  "success": true,
  "data": [
    {
      "category": "string",            // Category name
      "count": number                  // Number of apps in category
    }
  ]
}
```

#### `GET /api/v1/marketplace/apps/{appId}`
Get detailed information about a specific app.

**Path Parameters:**
- `appId` (required): Application identifier

**Response Properties:**
```json
{
  "success": true,
  "data": {
    // All properties from the apps list endpoint, plus:
    "execution_url": "string",         // App execution URL
    "permissions": ["string"],         // Required permissions
    "sandbox_config": "object",        // Sandbox configuration
    "privacy_policy": "string | null", // Privacy policy URL
    "support_url": "string | null",    // Support URL
    "documentation_url": "string | null", // Documentation URL
    "plugin_versions": [               // Version history
      {
        "id": "string",                // Version identifier
        "version": "string",           // Version number
        "release_notes": "string",     // Release notes
        "created_at": "ISO 8601 string" // Release timestamp
      }
    ]
  }
}
```

---

### 📦 User App Management API

#### `GET /api/v1/marketplace/installed`
Get user's installed applications.

**Authentication:** Requires `validateAuth` middleware (supports both API keys and Supabase auth tokens)

**Query Parameters:**
- `limit` (optional): Number of apps to return (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Response Properties:**
```json
{
  "success": true,
  "data": [
    {
      "installationId": "string",      // Installation identifier
      "installedAt": "ISO 8601 string", // Installation timestamp
      "isActive": boolean,             // Installation status
      "settings": "object",            // User-specific app settings
      "app": {
        // App details (same properties as marketplace/apps endpoint)
        "id": "string",
        "name": "string",
        "slug": "string",
        "tagline": "string",
        "description": "string",
        "category": "string",
        "icon_url": "string | null",
        "version": "string",
        "developer_name": "string",
        "install_count": number
      }
    }
  ],
  "pagination": {
    "total": number,                   // Total installed apps
    "limit": number,                   // Applied limit
    "offset": number,                  // Applied offset
    "hasMore": boolean                 // Whether more results available
  }
}
```

#### `POST /api/v1/marketplace/install/{appId}`
Install an application.

**Authentication:** Requires `validateAuth` middleware

**Path Parameters:**
- `appId` (required): Application identifier

**Request Body:**
```json
{
  "settings": {                       // Optional app-specific settings
    // Custom configuration object
  }
}
```

**Response Properties:**
```json
{
  "success": true,
  "data": {
    "installationId": "string",       // New installation identifier
    "appId": "string",                // Installed app ID
    "installedAt": "ISO 8601 string", // Installation timestamp
    "message": "string"               // Success message
  }
}
```

**Error Responses:**
- `404`: App not found or not available for installation
- `409`: App is already installed

#### `DELETE /api/v1/marketplace/uninstall/{appId}`
Uninstall an application.

**Authentication:** Requires `validateAuth` middleware

**Path Parameters:**
- `appId` (required): Application identifier

**Response Properties:**
```json
{
  "success": true,
  "data": {
    "message": "string"               // Success message with app name
  }
}
```

**Error Responses:**
- `404`: App is not installed

---

### 📊 Session Management API

#### `GET /api/v1/sessions`
Get user's sessions.

**Response Properties:**
```json
{
  "success": true,
  "data": [
    {
      "sessionId": "string",           // Session identifier
      "title": "string",               // Session title
      "description": "string",         // Session description
      "startTime": "ISO 8601 string",  // Start timestamp
      "endTime": "ISO 8601 string",    // End timestamp
      "attendeeCount": number,         // Number of attendees
      "status": "string",              // scheduled, active, completed
      "type": "string"                 // meeting, review, etc.
    }
  ],
  "meta": {
    "pagination": {
      "page": number,
      "limit": number,
      "total": number,
      "totalPages": number
    }
  }
}
```

#### `GET /api/v1/sessions/upcoming`
Get upcoming sessions.

**Response Properties:**
```json
{
  "success": true,
  "data": [
    {
      "sessionId": "string",           // Session identifier
      "title": "string",               // Session title
      "startTime": "ISO 8601 string",  // Start timestamp
      "attendeeCount": number,         // Number of attendees
      "status": "string"               // Session status
    }
  ]
}
```

---

### 👥 Team Management API

#### `GET /api/v1/team/members`
Get team members.

**Response Properties:**
```json
{
  "success": true,
  "data": [
    {
      "memberId": "string",            // Member identifier
      "name": "string",                // Member name
      "email": "string",               // Member email
      "role": "string",                // team_lead, developer, designer, etc.
      "avatar": "string | null",       // Avatar URL
      "status": "string",              // active, inactive
      "joinedAt": "ISO 8601 string"    // Join timestamp
    }
  ],
  "meta": {
    "total": number,                   // Total team members
    "roles": ["string"]                // Available roles
  }
}
```

---

### 📈 Analytics API

#### `GET /api/v1/analytics/summary`
Get analytics summary.

**Response Properties:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalSessions": number,         // Total sessions count
      "totalUsers": number,            // Total users count
      "totalTeams": number,            // Total teams count
      "activeApps": number             // Active apps count
    },
    "metrics": {
      "sessionGrowth": "string",       // Growth percentage (e.g., "+15%")
      "userEngagement": "string",      // Engagement percentage
      "appUsage": "string",            // Usage percentage
      "teamActivity": "string"         // Activity percentage
    },
    "recentActivity": [
      {
        "type": "string",              // Activity type
        "description": "string",       // Activity description
        "timestamp": "ISO 8601 string", // Activity timestamp
        "userId": "string"             // User who performed activity
      }
    ],
    "timeRange": {
      "start": "ISO 8601 string",     // Analysis start time
      "end": "ISO 8601 string"       // Analysis end time
    }
  }
}
```

---

### 🔐 Authentication API

#### `GET /api/v1/auth/profile`
Get authentication profile information.

**Authentication:** Requires `validateAuth` middleware (supports both API keys and Supabase auth tokens)

**Response Properties:**
```json
{
  "success": true,
  "data": {
    "id": "string",                    // User identifier
    "email": "string",                 // Email address
    "displayName": "string",           // Display name
    "avatar": "string | null",         // Avatar URL
    "authType": "string",              // api_key or supabase_auth
    "permissions": ["string"],         // Array of permissions
    "lastLogin": "ISO 8601 string",    // Last login timestamp
    "accountStatus": "string",         // active, suspended, etc.
    "twoFactorEnabled": boolean,       // 2FA status
    "emailVerified": boolean           // Email verification status
  }
}
```

---

### 💾 Storage & Template APIs

#### `GET /api/v1/storage`
Get app-specific storage data.

**Response Properties:**
```json
{
  "success": true,
  "data": {
    // App-specific storage object
    // Structure varies by application
  }
}
```

#### `GET /api/v1/entries`
Get user entries.

**Response Properties:**
```json
{
  "success": true,
  "data": [],                         // Array of entry objects
  "meta": {
    "pagination": {
      "page": number,
      "limit": number,
      "total": number,
      "totalPages": number
    }
  }
}
```

#### `GET /api/v1/templates`
Get available templates.

**Response Properties:**
```json
{
  "success": true,
  "data": [],                         // Array of template objects
  "meta": {
    "pagination": {
      "page": number,
      "limit": number,
      "total": number,
      "totalPages": number
    }
  }
}
```

---

### 🔔 UI Integration API

#### `POST /api/v1/ui/notifications`
Show notifications to user.

**Request Body:**
```json
{
  "title": "string",                  // Notification title
  "message": "string",                // Notification message
  "type": "string",                   // info, success, warning, error
  "duration": number                  // Display duration in ms (optional)
}
```

**Response Properties:**
```json
{
  "success": true,
  "data": {
    "id": "string"                    // Notification identifier
  }
}
```

---

## 🔐 API Permissions Reference

### Available API Permissions

When creating an API key, you'll receive access to the following granular permissions:

| Permission | Description | Endpoints Affected |
|------------|-------------|-------------------|
| `user:read` | Read user profile information | `/api/v1/user/me`, `/api/v1/users/me` |
| `user:write` | Update user information | User update endpoints |
| `profiles:read` | Read authorized user profiles (excludes anonymous) | `/api/v1/profiles/available`, `/api/v1/profiles/active` |
| `profiles:write` | Switch between authorized profiles | `/api/v1/profiles/{profileId}/activate` |
| `groups:read` | Read user group memberships | `/api/v1/groups` |
| `groups:write` | Access group member information | `/api/v1/groups/{groupId}/members` |
| `entries:read` | Read entries | `/api/v1/entries` |
| `entries:write` | Create and update entries | Entry creation/update endpoints |
| `entries:delete` | Delete entries | Entry deletion endpoints |
| `templates:read` | Read templates | `/api/v1/templates` |
| `templates:write` | Create and update templates | Template management endpoints |
| `marketplace:read` | Browse public marketplace apps | `/api/v1/marketplace/*` |
| `storage:read` | Read storage data | `/api/v1/storage` |
| `storage:write` | Write storage data | Storage update endpoints |

### Permission Updates (January 2025)

**🔄 Recent Changes:**
- **Permission Format**: Updated from `read:profile` to `user:read` format for consistency
- **Anonymous Filtering**: Profile endpoints now exclude anonymous profiles for privacy
- **Storage Permissions**: Added `storage:read` and `storage:write` for app data access
- **Granular Control**: Expanded from 2 basic permissions to 12 specific permissions

**🔧 Migration Guide:**
If you have an existing API key created before January 2025:
1. **Old keys** retain their original limited permissions (`read:profile`, `read:entries`)
2. **Create new key** to access all 12 granular permissions
3. **Update integration** to handle new permission format and excluded anonymous profiles

### Permission Validation

Your API key's permissions are validated against the endpoints you access:

```json
{
  "success": true,
  "data": {
    "apiKeyInfo": {
      "permissions": [
        "user:read",
        "profiles:read",
        "groups:read",
        "entries:read",
        "marketplace:read",
        "storage:read"
      ]
    }
  }
}
```

**Privacy & Security:**
- Anonymous profiles are automatically excluded from all profile endpoints
- Each permission grants access only to data the authenticated user can access
- Cross-profile data isolation prevents unauthorized access
- All responses use sanitized external IDs (e.g., `ext_1234567890abcdef`)

---

## 🔍 Property Discovery Guide

### Interactive API Explorer

The easiest way to explore available properties is using the **Interactive API Tester**:

1. **Set up local server**: Follow the setup instructions in the API tester
2. **Configure API key**: Set your API key in environment variables
3. **Test endpoints**: Use the visual interface to test all endpoints
4. **Explore responses**: See complete response structures with all properties

> 📧 **API Tester Location**: `docs/api-tester.html` in the repository

### Command Line Exploration

```bash
# Test basic connectivity
curl https://api.oriva.io/api/v1/health

# Explore user profile structure
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.oriva.io/api/v1/user/me | jq '.'

# Discover available profiles
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.oriva.io/api/v1/profiles/available | jq '.'

# Explore marketplace apps with full properties
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://api.oriva.io/api/v1/marketplace/apps?limit=1" | jq '.'
```

### Browser Developer Tools

1. **Open DevTools**: F12 in your browser
2. **Network Tab**: Monitor API requests from your app
3. **Console**: Use `fetch()` to test endpoints interactively
4. **Response Inspection**: Expand JSON responses to see all properties

### JQ (JSON Query) Examples

```bash
# Extract specific properties
curl -s -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.oriva.io/api/v1/user/me | jq '.data | keys'

# Get profile IDs only
curl -s -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.oriva.io/api/v1/profiles/available | \
  jq '.data[].profileId'

# Count marketplace apps by category
curl -s -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.oriva.io/api/v1/marketplace/categories | \
  jq '.data | group_by(.category) | map({category: .[0].category, count: length})'
```

---

## 🧪 Testing & Development Tools

### Local Development Setup

```bash
# Clone the repository
git clone https://github.com/0riva/oriva-platform.git
cd oriva-platform

# Set up local API server
cd api && npm install
cp .env.example .env
# Edit .env with your configuration

# Start local development server
npm run dev
# Server available at http://localhost:3001
```

### Testing Different Endpoints

```javascript
// Test multiple endpoints in sequence
const endpoints = [
  '/api/v1/user/me',
  '/api/v1/profiles/available',
  '/api/v1/groups',
  '/api/v1/marketplace/apps?limit=5'
];

for (const endpoint of endpoints) {
  console.log(`Testing: ${endpoint}`);
  const response = await fetch(`https://api.oriva.io${endpoint}`, {
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY',
      'Content-Type': 'application/json'
    }
  });
  const data = await response.json();
  console.log(`Response:`, data);
}
```

### Postman Collection

Create a Postman collection with these pre-configured requests:

1. **Environment Variables**:
   - `api_url`: `https://api.oriva.io`
   - `api_key`: `your_api_key_here`

2. **Pre-request Script** (for all requests):
   ```javascript
   pm.request.headers.add({
     key: 'Authorization',
     value: 'Bearer ' + pm.environment.get('api_key')
   });
   ```

---

## 🎯 Best Practices

### 1. Property Validation

Always validate response properties before using them:

```javascript
function validateUserProfile(profile) {
  const required = ['id', 'displayName', 'email'];
  const missing = required.filter(field => !profile[field]);

  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }

  return profile;
}

// Usage
const response = await fetch('/api/v1/user/me', { headers });
const { data: profile } = await response.json();
const validatedProfile = validateUserProfile(profile);
```

### 2. Property Type Checking

```javascript
function safeProfileAccess(profile) {
  return {
    id: String(profile.id || ''),
    name: String(profile.displayName || 'Unknown'),
    email: String(profile.email || ''),
    avatar: typeof profile.avatar === 'string' ? profile.avatar : null,
    createdAt: profile.createdAt ? new Date(profile.createdAt) : null
  };
}
```

### 3. Progressive Enhancement

Use optional properties gracefully:

```javascript
function renderProfile(profile) {
  const html = `
    <div class="profile">
      <h2>${profile.displayName}</h2>
      ${profile.bio ? `<p>${profile.bio}</p>` : ''}
      ${profile.location ? `<span>📍 ${profile.location}</span>` : ''}
      ${profile.website ? `<a href="${profile.website}">🌐 Website</a>` : ''}
    </div>
  `;
  return html;
}
```

### 4. Error Handling for Missing Properties

```javascript
async function getProfileSafely() {
  try {
    const response = await fetch('/api/v1/user/me', { headers });
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error);
    }

    return {
      id: result.data?.id || null,
      name: result.data?.displayName || 'Anonymous',
      email: result.data?.email || '',
      // Provide defaults for optional properties
      bio: result.data?.bio || '',
      location: result.data?.location || '',
      avatar: result.data?.avatar || '/default-avatar.png'
    };
  } catch (error) {
    console.error('Failed to fetch profile:', error);
    return null;
  }
}
```

### 5. Property Documentation in Code

```javascript
/**
 * User Profile Properties
 * @typedef {Object} UserProfile
 * @property {string} id - Unique user identifier
 * @property {string} username - User's username
 * @property {string} displayName - Display name
 * @property {string} email - Email address
 * @property {string|null} bio - User biography (optional)
 * @property {string|null} location - User location (optional)
 * @property {string|null} website - Website URL (optional)
 * @property {string|null} avatar - Avatar image URL (optional)
 * @property {string} createdAt - Account creation timestamp (ISO 8601)
 * @property {string} updatedAt - Last update timestamp (ISO 8601)
 */
```

---

## 📊 Rate Limits & Performance

### Rate Limits
- **Standard API**: 1,000 requests per 15 minutes per IP
- **Marketplace**: 1,000 requests per hour
- **Admin Endpoints**: 30 requests per minute

### Performance Tips
1. **Cache responses** when possible
2. **Use pagination** for large datasets
3. **Batch requests** when appropriate
4. **Monitor rate limit headers** in responses

---

## 🆘 Troubleshooting

### Common Issues

1. **Missing Properties**: Check API version and endpoint documentation
2. **Unexpected null values**: Implement proper null checking
3. **Type mismatches**: Validate property types before use
4. **Rate limiting**: Implement exponential backoff

### Getting Help

- **GitHub Issues**: [Report problems](https://github.com/0riva/oriva-platform/issues)
- **GitHub Discussions**: [Ask questions](https://github.com/0riva/oriva-platform/discussions)
- **API Tester**: Use built-in testing tool for debugging

---

**Last Updated**: January 2025 | **API Version**: v1.0
**Questions?** [Open an issue](https://github.com/0riva/oriva-platform/issues/new) or contact support