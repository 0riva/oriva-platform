# 🚀 Oriva Platform API - Start Guide

**Complete integration guide for AI agents and developers**

[![API Status](https://img.shields.io/badge/API-Live-green)](https://api.oriva.io)
[![Version](https://img.shields.io/badge/Version-v1.0-blue)]()
[![Updated](https://img.shields.io/badge/Updated-January%202025-blue)]()

---

## 🎯 Quick Integration (AI Agents)

### Core Requirements
```http
Base URL: https://api.oriva.io
Authentication: Bearer oriva_pk_live_your_api_key_here
Content-Type: application/json
```

### Essential Endpoints
```javascript
// Get user profile
GET /api/v1/user/me

// Get available profiles (excludes anonymous)
GET /api/v1/profiles/available

// Get active profile
GET /api/v1/profiles/active

// Switch profile
POST /api/v1/profiles/{profileId}/activate

// Get groups
GET /api/v1/groups

// Get group members
GET /api/v1/groups/{groupId}/members
```

### Response Format
```json
{
  "success": true,
  "data": { /* endpoint data */ },
  "meta": { /* pagination/metadata */ }
}
```

### Error Format
```json
{
  "success": false,
  "error": "Error description"
}
```

---

## 🔑 API Key & Permissions

### Getting Started
1. **Create API Key**: Use Oriva developer dashboard
2. **Key Format**: `oriva_pk_live_` + 64 characters
3. **Permissions**: Keys include all 12 granular permissions

### Available Permissions
| Permission | Description |
|------------|-------------|
| `user:read` | Read user profile information |
| `profiles:read` | Read authorized profiles (excludes anonymous) |
| `profiles:write` | Switch between profiles |
| `groups:read` | Read group memberships |
| `groups:write` | Access group member information |
| `entries:read` | Read entries |
| `entries:write` | Create/update entries |
| `templates:read` | Read templates |
| `marketplace:read` | Browse marketplace apps |
| `storage:read` | Read app storage data |
| `storage:write` | Write app storage data |

---

## 🌐 Core Endpoints Reference

### User Profile
```http
GET /api/v1/user/me
Authorization: Bearer oriva_pk_live_your_key_here
```
**Response:**
```json
{
  "success": true,
  "data": {
    "id": "string",
    "username": "string",
    "displayName": "string",
    "email": "string",
    "bio": "string|null",
    "avatar": "string|null",
    "createdAt": "ISO 8601",
    "updatedAt": "ISO 8601"
  }
}
```

### Profile Management
```http
# Get available profiles
GET /api/v1/profiles/available

# Get active profile
GET /api/v1/profiles/active

# Switch profile
POST /api/v1/profiles/{profileId}/activate
```
**Profile Format:**
```json
{
  "profileId": "ext_1234567890abcdef",  // 16 hex chars
  "profileName": "string",
  "isActive": boolean
}
```

### Group Management
```http
# Get groups
GET /api/v1/groups

# Get group members
GET /api/v1/groups/{groupId}/members
```
**Group Format:**
```json
{
  "groupId": "ext_1234567890abcdef",
  "groupName": "string",
  "memberCount": number,
  "isActive": boolean
}
```

---

## 🔧 Integration Examples

### JavaScript/Node.js
```javascript
const ORIVA_API = 'https://api.oriva.io';
const API_KEY = 'oriva_pk_live_your_key_here';

const headers = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
  'User-Agent': 'your-app/1.0.0'
};

// Get user profile
const user = await fetch(`${ORIVA_API}/api/v1/user/me`, { headers })
  .then(r => r.json());

// Get available profiles
const profiles = await fetch(`${ORIVA_API}/api/v1/profiles/available`, { headers })
  .then(r => r.json());

// Switch profile
const switch_result = await fetch(`${ORIVA_API}/api/v1/profiles/${profileId}/activate`, {
  method: 'POST',
  headers
}).then(r => r.json());
```

### Python
```python
import requests

ORIVA_API = 'https://api.oriva.io'
API_KEY = 'oriva_pk_live_your_key_here'

headers = {
    'Authorization': f'Bearer {API_KEY}',
    'Content-Type': 'application/json',
    'User-Agent': 'your-app/1.0.0'
}

# Get user profile
user = requests.get(f'{ORIVA_API}/api/v1/user/me', headers=headers).json()

# Get available profiles
profiles = requests.get(f'{ORIVA_API}/api/v1/profiles/available', headers=headers).json()
```

### cURL
```bash
# Get user profile
curl -H "Authorization: Bearer oriva_pk_live_your_key_here" \
     -H "Content-Type: application/json" \
     https://api.oriva.io/api/v1/user/me

# Get available profiles
curl -H "Authorization: Bearer oriva_pk_live_your_key_here" \
     https://api.oriva.io/api/v1/profiles/available
```

---

## 🛡️ Privacy & Security

### Data Protection
- **Anonymous profiles excluded** from all profile endpoints
- **Sanitized IDs**: All IDs use `ext_` prefix (e.g., `ext_1234567890abcdef`)
- **Cross-profile isolation**: Data access limited to authorized profiles only
- **No PII exposure**: Only display names and essential metadata provided

### Rate Limits
- **Standard**: 1,000 requests per 15 minutes per IP
- **Marketplace**: 1,000 requests per hour
- **Headers included** in responses for monitoring

---

## 🎯 App Integration & Embedding

### Content Security Policy (CSP) Requirements

**For apps that will be embedded in Oriva's iframe environment:**

Your app must configure CSP headers to allow embedding from Oriva domains:

```javascript
// Required CSP configuration
{
  "frame-ancestors": "'self' https://oriva.io https://*.oriva.io",
  "script-src": "'self' 'unsafe-inline' https://oriva.io",
  "style-src": "'self' 'unsafe-inline' https://oriva.io",
  "connect-src": "'self' https://api.oriva.io"
}
```

### X-Frame-Options

**For Oriva iframe embedding, you have two options:**

```http
# Option 1: Remove X-Frame-Options header entirely (simplest)
# (No X-Frame-Options header)

# Option 2: Use ALLOW-FROM (limited browser support)
X-Frame-Options: ALLOW-FROM https://oriva.io

# ❌ BLOCKS EMBEDDING - Don't use these:
X-Frame-Options: DENY
X-Frame-Options: SAMEORIGIN
```

**⚠️ Important:** `SAMEORIGIN` **blocks** Oriva embedding since Oriva is a different domain.

### Implementation Examples

**Express.js/Node.js:**
```javascript
app.use((req, res, next) => {
  // Set CSP to allow Oriva embedding
  res.setHeader('Content-Security-Policy',
    "frame-ancestors 'self' https://oriva.io https://*.oriva.io; " +
    "script-src 'self' 'unsafe-inline' https://oriva.io; " +
    "style-src 'self' 'unsafe-inline' https://oriva.io"
  );
  // Option 1: Remove X-Frame-Options entirely (recommended)
  // (Don't set X-Frame-Options header)

  // Option 2: Use ALLOW-FROM (limited support)
  // res.setHeader('X-Frame-Options', 'ALLOW-FROM https://oriva.io');

  next();
});
```

**React/Next.js (next.config.js):**
```javascript
module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://oriva.io https://*.oriva.io"
          }
        ]
      }
    ];
  }
};
```

**Meta tag (if server headers not available):**
```html
<meta http-equiv="Content-Security-Policy"
      content="frame-ancestors 'self' https://oriva.io https://*.oriva.io">
```

---

## 🚨 Common Integration Issues

### 1. "Invalid API key" Error
**Cause**: Inactive or malformed API key
**Solution**: Create new API key from developer dashboard

### 2. "App has invalid permissions" Error
**Cause**: Missing required permissions for app launcher
**Solution**: Ensure API key has `storage:read` and `storage:write` permissions

### 3. No profiles returned
**Cause**: User only has anonymous profiles (excluded for privacy)
**Solution**: Expected behavior - anonymous profiles are not accessible

### 4. API calls returning 500 errors
**Cause**: Incorrect endpoint URLs or malformed requests
**Solution**: Verify endpoints match documentation, check request format

### 5. App won't load in iframe / CSP violations
**Cause**: Missing `frame-ancestors` directive in Content Security Policy
**Solution**: Add CSP header: `frame-ancestors 'self' https://oriva.io https://*.oriva.io`

### 6. "Refused to display in a frame" error
**Cause**: `X-Frame-Options: DENY`, `X-Frame-Options: SAMEORIGIN`, or `Cross-Origin-Resource-Policy: same-site` blocking iframe embedding
**Solution**: **Use Oriva's proxy service** or configure headers for cross-origin access

**Quick Fix - Enable Proxy Service:**
```javascript
// In your app configuration
{
  "iframe_options": {
    "bypass_xframe_protection": true
  }
}
```
This routes your app through `apps.oriva.io` proxy and strips X-Frame-Options headers automatically.

---

## 📚 Additional Documentation

### For Detailed Integration
- **[API Reference Guide](./developer-guides/api-reference-guide.md)** - Complete endpoint documentation with all properties
- **[API Headers Guide](./developer-guides/api-headers-guide.md)** - Comprehensive header requirements and best practices

### For Advanced Use Cases
- **Interactive API Tester**: `docs/api-tester.html` in repository
- **Postman Collection**: Import endpoints for testing
- **Property Discovery**: Use browser DevTools or jq for response exploration

### For Support
- **GitHub Issues**: [Report problems](https://github.com/0riva/oriva-platform/issues)
- **GitHub Discussions**: [Ask questions](https://github.com/0riva/oriva-platform/discussions)

---

## ✅ Integration Checklist

### Pre-Integration
- [ ] Create API key from developer dashboard
- [ ] Verify key has all 12 permissions
- [ ] Test basic connectivity with `/api/v1/user/me`

### Core Integration
- [ ] Implement authentication headers
- [ ] Handle success/error response format
- [ ] Test profile switching workflow
- [ ] Implement group data access
- [ ] Add proper error handling

### Production Readiness
- [ ] Add rate limit handling
- [ ] Implement retry logic with exponential backoff
- [ ] Add logging and monitoring
- [ ] Test CORS compatibility
- [ ] Validate privacy compliance (no anonymous profile access)

### App Embedding (if applicable)
- [ ] Configure CSP `frame-ancestors` directive for Oriva domains
- [ ] Remove or configure `X-Frame-Options` to allow embedding
- [ ] Test app loads correctly in iframe environment
- [ ] Verify no CSP violations in browser console

---

**API Base URL**: `https://api.oriva.io`
**Status**: ✅ Live and stable
**Support**: [GitHub Issues](https://github.com/0riva/oriva-platform/issues)