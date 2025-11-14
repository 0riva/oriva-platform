# Oriva Platform API - Overview

**5-Minute Introduction for Developers**

[![API Version](https://img.shields.io/badge/API-v1.0-blue)]()
[![Endpoints](https://img.shields.io/badge/Endpoints-37+-green)]()
[![Security](https://img.shields.io/badge/Security-Audited-green)]()
[![Last Updated](https://img.shields.io/badge/Updated-January%202025-blue)]()

## 🎯 What is the Oriva Platform API?

The Oriva Platform API is a REST API that enables third-party developers to build apps and integrations for the Oriva ecosystem. Access Oriva's authenticated users, profiles, and platform features using your API key.

**Base URL:** `https://api.oriva.io/api/v1`
**Public Endpoints:** ~37

## ⚡ Quick Start (5 Minutes)

### 1. Get Your API Key

1. Log into [Oriva Core](https://oriva.io)
2. Go to **Settings → Developer Settings**
3. Click **"Generate Live API Key"**
4. Copy your key (format: `oriva_pk_live_...`)

### 2. Make Your First Request

```bash
# Test your API key
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.oriva.io/api/v1/user/me
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "ext_user_abc123",
    "name": "Your Name",
    "email": "your@email.com"
  }
}
```

### 3. Start Building

See the **[Complete API User Guide](./API_USER_GUIDE.md)** for all endpoints and detailed examples.

---

## 🏗️ API Architecture

### Authentication Methods

The Oriva Platform supports multiple authentication methods:

| Method | Format | Use Case | Security Level |
|--------|--------|----------|----------------|
| **API Key** | `Bearer oriva_pk_live_...` | Server-side apps, integrations | 🟢 Recommended |
| **Auth Token** | `Bearer <jwt-token>` | User-specific actions | 🟡 Session-based |
| **Admin Token** | Custom header | Admin operations | 🔴 Restricted |

**🔐 Security Rule:** Always use API keys server-side. Never expose them in client-side code.

### Response Format

All endpoints return consistent JSON responses:

**Success Response:**
```json
{
  "success": true,
  "ok": true,
  "data": { /* your data */ },
  "meta": { /* optional metadata */ }
}
```

**Error Response:**
```json
{
  "success": false,
  "ok": false,
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": { /* optional error details */ }
}
```

### Rate Limits

| Endpoint Type | Requests | Window |
|---------------|----------|--------|
| Core API | 1,000 | 15 minutes |
| Marketplace | 1,000 | 1 hour |
| Admin | 30 | 1 minute |

---

## 🔐 How Authentication Works

**Important:** Third-party apps do **NOT** implement their own authentication.

Instead:
1. **Oriva Core** handles all user authentication
2. **Users log into Oriva** (not your app)
3. **Your app gets an API key** from the Oriva marketplace
4. **You access authenticated user data** via the API using your key

```
User → Logs into Oriva Core → Installs Your App → Your App Uses API Key
                                                     ↓
                                      Oriva API returns user's data
```

---

## 📚 API Categories

The Oriva Platform API is organized into 9 main categories:

### 1. **Health & Test** (3 endpoints)
Server health checks and API testing
- `GET /health` - Basic health check
- `GET /api/v1/health` - Detailed API status
- `GET /api/v1/test` - Connectivity test

### 2. **User & Authentication** (3 endpoints)
Access to Oriva-authenticated user data
- `GET /api/v1/user/me` - Current user info
- `GET /api/v1/users/me` - Current user (alias)
- `GET /api/v1/auth/profile` - Authenticated profile

### 3. **Profiles** (4 endpoints)
User profile management
- `GET /api/v1/profiles/available` - List available profiles
- `GET /api/v1/profiles/active` - Get active profile
- `PUT /api/v1/profiles/:profileId` - Update profile
- `POST /api/v1/profiles/:profileId/activate` - Activate profile

### 4. **Groups** (2 endpoints)
Group memberships and management
- `GET /api/v1/groups` - List user groups
- `GET /api/v1/groups/:groupId/members` - Get group members

### 5. **Sessions & Team** (4 endpoints)
Session and team management
- `GET /api/v1/sessions` - List sessions
- `GET /api/v1/sessions/upcoming` - List upcoming sessions
- `GET /api/v1/team/members` - Get team members
- `GET /api/v1/analytics/summary` - Get analytics summary

### 6. **Entries & Content** (4 endpoints)
Content and platform resources
- `GET /api/v1/entries` - List entries with filtering
- `GET /api/v1/templates` - List templates
- `GET /api/v1/storage` - Get storage info
- `POST /api/v1/ui/notifications` - Send UI notification

### 7. **Developer Apps** (7 endpoints)
Create and manage marketplace apps
- `GET /api/v1/developer/apps` - List your apps
- `GET /api/v1/developer/apps/:appId` - Get app details
- `POST /api/v1/developer/apps` - Create new app
- `PUT /api/v1/developer/apps/:appId` - Update app
- `DELETE /api/v1/developer/apps/:appId` - Delete app (draft only)
- `POST /api/v1/developer/apps/:appId/submit` - Submit for review
- `POST /api/v1/developer/apps/:appId/resubmit` - Resubmit after rejection

### 8. **Marketplace** (8 endpoints)
Browse and manage marketplace applications
- `GET /api/v1/marketplace/apps` - List marketplace apps
- `GET /api/v1/marketplace/apps/:appId` - Get app details
- `GET /api/v1/marketplace/trending` - List trending apps
- `GET /api/v1/marketplace/featured` - List featured apps
- `GET /api/v1/marketplace/categories` - List categories
- `GET /api/v1/marketplace/installed` - List installed apps
- `POST /api/v1/marketplace/install/:appId` - Install app
- `DELETE /api/v1/marketplace/uninstall/:appId` - Uninstall app

### 9. **Admin** (2 endpoints)
Administrative operations (admin only)
- `GET /api/v1/admin/apps/pending` - List pending apps
- `POST /api/v1/admin/apps/:appId/review` - Approve/reject app

### 10. **Hugo AI** (unspecified)
AI integration endpoints for apps using Oriva's AI chat system
- `* /api/hugo/*` - Hugo AI endpoints

---

## 🔒 Security Best Practices

### ✅ DO

- **Store API keys in environment variables**
  ```javascript
  const apiKey = process.env.ORIVA_API_KEY;
  ```

- **Use server-side proxy patterns for production**
  ```javascript
  // Your backend proxies to Oriva API
  app.get('/api/oriva-proxy/user/me', async (req, res) => {
    const data = await fetch('https://api.oriva.io/api/v1/user/me', {
      headers: { 'Authorization': `Bearer ${process.env.ORIVA_API_KEY}` }
    });
    res.json(await data.json());
  });
  ```

- **Implement rate limiting and error handling**
- **Use HTTPS for all requests**
- **Validate and sanitize all inputs**

### ❌ DON'T

- **Never expose API keys in client-side code**
  ```javascript
  // ❌ NEVER DO THIS
  const apiKey = 'oriva_pk_live_abc123...';
  ```

- **Never commit credentials to version control**
- **Never log API keys or sensitive data**
- **Never skip HTTPS in production**

---

## 📖 Documentation Structure

We've organized our documentation to be both human-friendly and AI-agent friendly:

### For Quick Reference
- **[This Overview](./API_OVERVIEW.md)** - 5-minute introduction (you are here)
- **[API Endpoints Index](./api-endpoints-index.md)** - Quick endpoint lookup

### For Complete Information
- **[📘 API User Guide](./API_USER_GUIDE.md)** - **Main comprehensive guide with all endpoints**
- **[API Reference Complete](./api-reference-complete.md)** - Legacy detailed reference

### For Specialized Topics
- **[API Patterns](./API_PATTERNS.md)** - Common integration patterns and best practices
- **[API Security](./API_SECURITY.md)** - Security guidelines and examples
- **[API Troubleshooting](./api-troubleshooting-guide.md)** - Issue resolution and debugging
- **[Authentication Patterns](./authentication-patterns.md)** - Auth implementation details
- **[API Headers Reference](./api-headers-reference.md)** - Complete header documentation

### For Getting Started
- **[Quick Start Guide](./quick-start.md)** - 15-minute integration
- **[5-Minute API Test](./5-minute-api-test.md)** - Quick validation
- **[15-Minute Web App](./15-minute-web-app.md)** - Build working integration

---

## 🚀 Next Steps

### For Developers Just Starting

1. **[5-Minute API Test](./5-minute-api-test.md)** - Verify your setup
2. **[Quick Start Guide](./quick-start.md)** - Build your first integration
3. **[API User Guide](./API_USER_GUIDE.md)** - Explore all endpoints

### For Production Apps

1. **[API Patterns](./API_PATTERNS.md)** - Learn best practices
2. **[API Security](./API_SECURITY.md)** - Implement security
3. **[Production Deployment](./production-deployment.md)** - Deploy safely

### For Marketplace Publishing

1. **[App Integration Requirements](./app-integration-requirements.md)** - Technical specs
2. **[Iframe Integration](./iframe-integration-secure.md)** - Secure embedding
3. **[Start Guide](../START_GUIDE.md)** - Complete marketplace process

---

## 🆘 Getting Help

### Community & Support

- **📖 Documentation:** [Developer Guide](./README.md)
- **🐛 Report Issues:** [GitHub Issues](https://github.com/0riva/oriva-platform/issues)
- **💬 Discussions:** [GitHub Discussions](https://github.com/0riva/oriva-platform/discussions)
- **🔒 Security Issues:** security@oriva.io

### Common Issues

See the **[API Troubleshooting Guide](./api-troubleshooting-guide.md)** for systematic debugging workflows.

---

## 📊 API Health & Status

### Check API Status

```bash
# Health check
curl https://api.oriva.io/health

# Detailed API health
curl https://api.oriva.io/api/v1/health
```

### Monitor Your Usage

Track your API usage and rate limits in the **Developer Settings** dashboard.

---

**Ready to dive deeper?**

→ **[Start with the Complete API User Guide](./API_USER_GUIDE.md)** for all endpoints and examples.

---

*Last Updated: January 2025 | Security Audit: January 2025*
