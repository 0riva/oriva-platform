# 🚀 Developer Quickstart Guide

> **Build apps that extend the Oriva source code collaboration platform**

Welcome to the Oriva Platform! This guide will help you build powerful integrations that extend Oriva's functionality for millions of users.

[![API Version](https://img.shields.io/badge/API-v1.0-blue)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)]()
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)]()
[![License](https://img.shields.io/badge/License-MIT-green)]()

---

## 🎯 What You'll Build

By the end of this guide, you'll have:
- ✅ **Registered your app** with the Oriva platform
- ✅ **Set up OAuth authentication** for your app
- ✅ **Made your first API calls** to Oriva
- ✅ **Published your app** to the marketplace

---

## 📋 Prerequisites

Before you begin, ensure you have:

```bash
# Check your system requirements
node --version    # Should be 18+
npm --version     # Should be 8+
```

> **💡 Tip:** You don't need to set up any databases or servers - Oriva handles all the infrastructure for you!

---

## 🚀 Step 1: Register Your App

### 1.1 Access Developer Settings

1. **Log into your [Oriva Core account](https://oriva.io)**
2. **Go to Settings** (click your profile → Settings)
3. **Navigate to Developer Settings** in the left sidebar

### 1.2 Register Your App

1. **Click "Create New App"** in the Developer Settings
2. **Fill in your app details:**
   - **Name**: Your app's display name
   - **Description**: What your app does
   - **Category**: Choose from available categories

3. **Get your API key:**
   - **API Key**: Your app's authentication token
   - Copy this key and add it to your `.env` file

> **🔐 Security Note:** Keep your API key secure and never expose it in client-side code in production!

---

## 🔐 Step 2: Set Up Authentication

### 2.1 Environment Configuration

Create a `.env` file in your project root with your Oriva API credentials:

```bash
# Oriva Platform Configuration
REACT_APP_ORIVA_API_URL=https://api.oriva.io
REACT_APP_ORIVA_GRAPHQL_URL=https://api.oriva.io/graphql
REACT_APP_ORIVA_WS_URL=wss://api.oriva.io/graphql
REACT_APP_ORIVA_API_KEY=your_api_key_here
```

### 2.2 API Key Authentication

Oriva uses simple API key authentication for plugin operations. Include your API key in the Authorization header:

```javascript
const response = await fetch('https://api.oriva.io/api/v1/user/profile', {
  headers: {
    'Authorization': `Bearer ${process.env.REACT_APP_ORIVA_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
console.log('User:', data.name);
```

> **🔐 Security Note:** Never expose your API key in client-side code in production! Use environment variables and server-side proxies for sensitive operations.

---

## 📚 Step 3: Make Your First API Calls

### 3.1 Get User Profile

```javascript
const profile = await fetch('https://api.oriva.io/api/v1/user/profile', {
  headers: {
    'Authorization': `Bearer ${access_token}`
  }
}).then(r => r.json());

console.log('User:', profile.name);
```

### 3.2 List User Repositories

```javascript
const repos = await fetch('https://api.oriva.io/api/v1/repositories', {
  headers: {
    'Authorization': `Bearer ${access_token}`
  }
}).then(r => r.json());

console.log('Repositories:', repos.data);
```

### 3.3 Create an Issue

```javascript
const issue = await fetch('https://api.oriva.io/api/v1/repositories/123/issues', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: 'Bug in authentication',
    description: 'Users cannot log in with OAuth',
    labels: ['bug', 'high-priority']
  })
}).then(r => r.json());

console.log('Created issue:', issue.id);
```

---

## 🛠️ Step 4: Use the SDK (Recommended)

### 4.1 Install the SDK

```bash
npm install @oriva/plugin-sdk
```

### 4.2 Initialize the SDK

```javascript
import { OrivaPluginSDK } from '@oriva/plugin-sdk';

const sdk = new OrivaPluginSDK({
  pluginId: 'your-plugin-id',
  version: '1.0.0',
  userId: 'user-id',
  permissions: ['entries:read', 'entries:write'],
  apiKey: process.env.REACT_APP_ORIVA_API_KEY,
  baseUrl: process.env.REACT_APP_ORIVA_API_URL,
});
```

### 4.3 SDK Usage Examples

```javascript
// Set access token after OAuth
sdk.setAccessToken(access_token);

// Get user's repositories
const repositories = await sdk.repositories.list({
  visibility: 'all',
  sort: 'updated'
});

// Create a new issue
const issue = await sdk.issues.create({
  repositoryId: 'repo-123',
  title: 'Feature Request: Dark Mode',
  description: 'Add dark mode support to the code editor',
  labels: ['enhancement', 'ui']
});

// Get pull requests
const pullRequests = await sdk.pullRequests.list({
  repositoryId: 'repo-123',
  state: 'open'
});
```

> **⭐ Why Use the SDK?** The SDK provides type safety, automatic token management, and simplified API calls!

---

## 🏪 Step 5: Publish to Marketplace

### 5.1 Prepare Your App

1. **Complete your app description**
2. **Add screenshots and demo videos**
3. **Set your pricing** (free or paid)
4. **Define required permissions**

### 5.2 Submit for Review

1. **Go to your app dashboard**
2. **Click "Submit for Review"**
3. **Wait for approval** (typically 1-3 business days)

### 5.3 Launch Your App

Once approved, your app will be:
- ✅ **Available in the marketplace**
- ✅ **Discoverable by users**
- ✅ **Ready for installations**

---

## 🔧 Available Scopes

| Scope | Description | Use Case |
|-------|-------------|----------|
| `read:public-repositories` | Access public repositories only | Repository browsing |
| `read:issues` | Read issues | Issue tracking |
| `write:issues` | Create/update issues | Issue management |
| `read:pull-requests` | Read pull requests | Code review tools |
| `write:pull-requests` | Create/update pull requests | PR automation |
| `read:notifications` | Read notifications | Notification management |
| `write:notifications` | Mark notifications as read | Notification cleanup |
| `app:data:read` | Read app-specific data | Access your app's database |
| `app:data:write` | Write app-specific data | Store data in your app's database |

---

## 📊 Rate Limits

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| **Core API** | 5,000 requests | Per hour |
| **OAuth** | 100 requests | Per hour |
| **Marketplace** | 1,000 requests | Per hour |

---

## 🧪 Testing Your Integration

### Sandbox Environment

Use our sandbox for development and testing:

- **Sandbox API**: `https://sandbox-api.oriva.io`
- **Test Data**: Pre-populated with sample repositories and users
- **No Rate Limits**: Unlimited API calls for development

### Test Your App

```bash
# Test API connectivity
curl https://sandbox-api.oriva.io/health

# Test authentication
curl -H "Authorization: Bearer YOUR_SANDBOX_TOKEN" \
  https://sandbox-api.oriva.io/api/v1/user/profile
```

---

## 🚨 Common Issues

### 1. Authentication Errors

**Problem**: `401 Unauthorized`
**Solution**: Check that your access token is valid and not expired

```javascript
// Refresh expired tokens
const newToken = await sdk.auth.refreshToken(refresh_token);
sdk.setAccessToken(newToken.access_token);
```

### 2. Rate Limit Exceeded

**Problem**: `429 Too Many Requests`
**Solution**: Implement exponential backoff

```javascript
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const makeRequest = async (url, options, retries = 3) => {
  try {
    return await fetch(url, options);
  } catch (error) {
    if (error.status === 429 && retries > 0) {
      await delay(1000 * (4 - retries)); // Exponential backoff
      return makeRequest(url, options, retries - 1);
    }
    throw error;
  }
};
```

### 3. CORS Issues

**Problem**: Browser blocks API requests
**Solution**: Use server-side proxy or configure CORS

```javascript
// Use server-side proxy for sensitive operations
const response = await fetch('/api/proxy/oriva/user/profile', {
  headers: { 'Authorization': `Bearer ${access_token}` }
});
```

---

## 📚 Next Steps

### Learn More

- **📖 [API Reference](https://github.com/0riva/oriva-platform/blob/main/docs/openapi.yml)** - Complete API documentation
- **🔧 [SDK Documentation](https://github.com/0riva/oriva-platform/tree/main/packages/plugin-sdk)** - SDK usage guide
- **🔐 [OAuth Guide](https://github.com/0riva/oriva-platform)** - Authentication details (coming soon)
- **🏪 [Marketplace Guide](https://github.com/0riva/oriva-platform)** - Publishing apps (coming soon)

### Join the Community

- **🐛 [GitHub Issues](https://github.com/0riva/oriva-platform/issues)** - Report bugs
- **💡 [GitHub Discussions](https://github.com/0riva/oriva-platform/discussions)** - Ask questions

### Get Support

- **📧 Support**: Use the support system within Oriva Core
- **📚 Documentation**: [GitHub Repository](https://github.com/0riva/oriva-platform)
- **🆘 Status Page**: [GitHub Issues](https://github.com/0riva/oriva-platform/issues)

---

## 🎉 Congratulations!

You've successfully:
- ✅ **Registered your app** with Oriva
- ✅ **Set up OAuth authentication**
- ✅ **Made API calls** to the platform
- ✅ **Used the SDK** for easier development
- ✅ **Published your app** to the marketplace

**Ready to build the next generation of development tools?** Start building with the Oriva Platform API today!

---

**Built with ❤️ by the Oriva Team**