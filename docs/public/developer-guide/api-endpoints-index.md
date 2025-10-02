# API Endpoints Quick Reference

**Complete index of all Oriva Platform API endpoints**

> 📖 **Full Documentation**: [Complete API Reference](./api-reference-complete.md)

## Quick Navigation

- [Health & Test](#health--test)
- [User & Authentication](#user--authentication)
- [Profiles](#profiles)
- [Groups](#groups)
- [Sessions & Team](#sessions--team)
- [Entries & Content](#entries--content)
- [Developer Apps](#developer-apps)
- [Marketplace](#marketplace)
- [Admin](#admin)
- [Hugo AI](#hugo-ai)

---

## 🔍 Endpoint Overview

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| **Health & Test** |
| GET | `/health` | ❌ No | Basic health check |
| GET | `/api/v1/health` | ❌ No | API health check with details |
| GET | `/api/v1/test` | ❌ No | API connectivity test |
| **User & Authentication** |
| GET | `/api/v1/user/me` | ✅ API Key | Get current user information |
| GET | `/api/v1/users/me` | ✅ API Key | Get current user (alias) |
| GET | `/api/v1/auth/profile` | ✅ Auth Token | Get authenticated profile |
| **Profiles** |
| GET | `/api/v1/profiles/available` | ✅ API Key | List available profiles |
| GET | `/api/v1/profiles/active` | ✅ API Key | Get active profile |
| PUT | `/api/v1/profiles/:profileId` | ✅ API Key | Update profile |
| POST | `/api/v1/profiles/:profileId/activate` | ✅ API Key | Activate profile |
| **Groups** |
| GET | `/api/v1/groups` | ✅ API Key | List user's groups |
| GET | `/api/v1/groups/:groupId/members` | ✅ API Key | Get group members |
| **Sessions & Team** |
| GET | `/api/v1/sessions` | ✅ API Key | List sessions |
| GET | `/api/v1/sessions/upcoming` | ✅ API Key | List upcoming sessions |
| GET | `/api/v1/team/members` | ✅ API Key | Get team members |
| GET | `/api/v1/analytics/summary` | ✅ API Key | Get analytics summary |
| **Entries & Content** |
| GET | `/api/v1/entries` | ✅ API Key | List entries with filtering |
| GET | `/api/v1/templates` | ✅ API Key | List templates |
| GET | `/api/v1/storage` | ✅ API Key | Get storage info |
| POST | `/api/v1/ui/notifications` | ✅ API Key | Send UI notification |
| **Developer Apps** |
| GET | `/api/v1/developer/apps` | ✅ API Key | List your apps |
| GET | `/api/v1/developer/apps/:appId` | ✅ API Key | Get app details |
| POST | `/api/v1/developer/apps` | ✅ API Key | Create new app |
| PUT | `/api/v1/developer/apps/:appId` | ✅ API Key | Update app |
| DELETE | `/api/v1/developer/apps/:appId` | ✅ API Key | Delete app (draft only) |
| POST | `/api/v1/developer/apps/:appId/submit` | ✅ API Key | Submit app for review |
| POST | `/api/v1/developer/apps/:appId/resubmit` | ✅ API Key | Resubmit after rejection |
| **Marketplace** |
| GET | `/api/v1/marketplace/apps` | ✅ API Key | List marketplace apps |
| GET | `/api/v1/marketplace/apps/:appId` | ✅ API Key | Get app details |
| GET | `/api/v1/marketplace/trending` | ✅ API Key | List trending apps |
| GET | `/api/v1/marketplace/featured` | ✅ API Key | List featured apps |
| GET | `/api/v1/marketplace/categories` | ✅ API Key | List categories |
| GET | `/api/v1/marketplace/installed` | ✅ Auth Token | List installed apps |
| POST | `/api/v1/marketplace/install/:appId` | ✅ Auth Token | Install app |
| DELETE | `/api/v1/marketplace/uninstall/:appId` | ✅ Auth Token | Uninstall app |
| **Admin** |
| GET | `/api/v1/admin/apps/pending` | ✅ Admin Token | List pending apps |
| POST | `/api/v1/admin/apps/:appId/review` | ✅ Admin Token | Approve/reject app |
| **Hugo AI** |
| * | `/api/hugo/*` | ✅ API Key | Hugo AI endpoints |

---

## 📊 Rate Limits

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Core API | 1,000 requests | 15 minutes |
| Marketplace | 1,000 requests | 1 hour |
| Admin | 30 requests | 1 minute |

---

## 🔐 Authentication Types

### API Key (Bearer Token)
```bash
Authorization: Bearer oriva_pk_live_xxxxx
```
Used for most endpoints. Get your API key from the developer dashboard.

### Auth Token
```bash
Authorization: Bearer <auth-token>
```
Used for user-specific actions (install/uninstall apps).

### Admin Token
```bash
Authorization: Bearer <admin-token>
```
Used for administrative operations only.

---

## 📝 Common Query Parameters

### Pagination
```
?limit=20          # Items per page (max: 100)
?offset=0          # Skip N items
```

### Filtering
```
?category=productivity    # Filter by category
?search=keyword          # Search term
```

### Sorting
```
?sort=name              # Sort field
?order=asc              # Sort order (asc/desc)
```

---

## 🎯 Quick Start Examples

### Get Current User
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.oriva.io/api/v1/user/me
```

### List Marketplace Apps
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://api.oriva.io/api/v1/marketplace/apps?limit=10&category=productivity"
```

### Create Developer App
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"My App","category":"productivity"}' \
  https://api.oriva.io/api/v1/developer/apps
```

---

## 📚 Related Documentation

- **[Complete API Reference](./api-reference-complete.md)** - Full endpoint documentation with examples
- **[Authentication Guide](./authentication-patterns.md)** - Authentication implementation patterns
- **[Error Handling](./api-troubleshooting-guide.md)** - Error codes and troubleshooting
- **[Quick Start](./quick-start.md)** - Getting started guide

---

*Last Updated: January 2025*
