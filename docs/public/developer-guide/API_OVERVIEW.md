# Oriva Platform API - Overview

**5-Minute Introduction for Developers**

[![API Version](https://img.shields.io/badge/API-v1.0-blue)]()
[![Security](https://img.shields.io/badge/Security-Audited-green)]()
[![Last Updated](https://img.shields.io/badge/Updated-January%202025-blue)]()

## 🎯 What is the Oriva Platform API?

The Oriva Platform API is a comprehensive REST API that powers the Oriva social network and enables third-party developers to build apps, integrations, and extensions for the Oriva ecosystem.

**Base URL:** `https://api.oriva.io/api/v1`

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

See the **[Complete API User Guide](./API_USER_GUIDE.md)** for all 150+ endpoints and detailed examples.

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

## 📚 API Categories

The Oriva Platform API is organized into 15 main categories:

### 1. **Authentication & Account** (9 endpoints)
User registration, login, logout, profile management, account deletion
- `POST /auth/register` - Create new account
- `POST /auth/login` - User authentication
- `GET /auth/profile` - Get user profile
- `DELETE /auth/account` - Delete account

### 2. **User & Profiles** (12 endpoints)
User information, app-specific profiles, profile switching
- `GET /user/me` - Current user info
- `GET /profiles/available` - List user profiles
- `POST /profiles/:id/activate` - Switch profiles

### 3. **Marketplace - Apps** (8 endpoints)
Browse, search, and manage marketplace applications
- `GET /marketplace/apps` - Browse apps
- `GET /marketplace/trending` - Trending apps
- `POST /marketplace/install/:id` - Install app

### 4. **Marketplace - Items/Commerce** (7 endpoints)
OrivaFlow commerce and marketplace items
- `GET /marketplace/items` - List items
- `POST /marketplace/items/create` - Create item
- `POST /marketplace/search` - Advanced search

### 5. **Developer Tools** (7 endpoints)
Create and manage your marketplace apps
- `POST /developer/apps` - Create app
- `POST /developer/apps/:id/submit` - Submit for review
- `GET /developer/apps` - List your apps

### 6. **Hugo AI - Sessions** (8 endpoints)
AI coaching sessions and analytics
- `POST /hugo-ai/sessions` - Create session
- `GET /hugo-ai/sessions` - List sessions
- `POST /hugo-ai/sessions/:id/conclude` - End session

### 7. **Hugo AI - Insights** (7 endpoints)
AI-generated insights and analytics
- `POST /hugo-ai/insights` - Create insight
- `GET /hugo-ai/insights/latest` - Latest insight
- `GET /hugo-ai/insights/stats` - Statistics

### 8. **Hugo AI - Chat** (4 endpoints)
Real-time AI chat with streaming responses
- `POST /hugo/chat` - Chat with AI (streaming)
- `POST /conversations` - Create conversation
- `GET /conversations/:id` - Get conversation

### 9. **Hugo-Love (Dating)** (30+ endpoints)
Complete dating app functionality
- Profile management, swiping, matching, messaging
- `POST /apps/hugo-love/profiles` - Create dating profile
- `POST /apps/hugo-love/swipe` - Swipe on profile
- `GET /apps/hugo-love/matches` - View matches
- `POST /apps/hugo-love/messages/:id` - Send message

### 10. **Work Buddy (Career)** (15+ endpoints)
Career goals, check-ins, and productivity tracking
- `POST /apps/work-buddy/goals` - Create goal
- `POST /apps/work-buddy/check-ins` - Log check-in
- `GET /apps/work-buddy/analytics` - Get analytics

### 11. **Ice Breakers** (8 endpoints)
Social connection and ice breaker questions
- `POST /apps/ice-breakers` - Create ice breaker
- `POST /apps/ice-breakers/:id/respond` - Respond
- `GET /apps/ice-breakers/stats` - Statistics

### 12. **Groups & Team** (3 endpoints)
Group memberships and team management
- `GET /groups` - List user groups
- `GET /groups/:id/members` - Group members
- `GET /team/members` - Team members

### 13. **Events & Webhooks** (12 endpoints)
Event publishing, webhooks, and subscriptions
- `POST /events` - Publish event
- `POST /apps/:id/webhooks` - Create webhook
- `GET /events/subscriptions` - List subscriptions

### 14. **Notifications** (5 endpoints)
User notifications and alerts
- `POST /ui/notifications` - Create notification
- `GET /users/:id/notifications` - Get notifications
- `PATCH /notifications/:id` - Update status

### 15. **Platform & Data** (10+ endpoints)
Platform apps, data extraction (GDPR), photos, analytics
- `POST /platform/extraction/prepare` - Prepare data export
- `POST /apps/photos/generate-signed-url` - Upload photo
- `GET /analytics/summary` - Analytics overview

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
- **[📘 API User Guide](./API_USER_GUIDE.md)** - **Main comprehensive guide with all 150+ endpoints**
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
