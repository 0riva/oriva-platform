# 🚀 Developer Start Guide

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
- ✅ **Set up API authentication** for your app
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

3. **Get your API credentials:**
   - **API Key**: Your app's authentication token (format: `oriva_pk_live_...` or `oriva_pk_test_...`)
   - **Client ID & Secret**: For OAuth authentication (if needed)
   - Copy these credentials and add them to your `.env` file
   - **Note**: Make sure you're using the correct environment (live vs test)

4. **Configure OAuth settings** (if using OAuth):
   - Set redirect URIs for your application
   - Define required scopes and permissions
   - Test the OAuth flow in development

> **🔐 Security Note:** Keep your API key secure and never expose it in client-side code in production!

---

## 🔐 Step 2: Set Up Authentication

### 2.1 Environment Configuration

Create a `.env` file in your project root with your Oriva API credentials using the standard naming convention:

```bash
# Oriva Platform Configuration (Required)
EXPO_PUBLIC_ORIVA_API_URL=https://api.oriva.io/api/v1
EXPO_PUBLIC_ORIVA_API_KEY=your_oriva_api_key_here
EXPO_PUBLIC_ORIVA_CLIENT_ID=work-buddy-app
```

> **📝 Note**: Use the `EXPO_PUBLIC_` prefix for variables that need to be accessible in your client-side code. Variables without this prefix remain server-side only.

### 2.2 Hosting Environment Setup

When deploying your app, you'll need to configure these environment variables in your hosting platform:

#### **Option 1: Vercel (Recommended)**

1. **Connect your repository** to Vercel
2. **Go to Project Settings** → Environment Variables
3. **Add the following variables:**
   ```
   EXPO_PUBLIC_ORIVA_API_URL = https://api.oriva.io/api/v1
   EXPO_PUBLIC_ORIVA_API_KEY = your_oriva_api_key_here
   EXPO_PUBLIC_ORIVA_CLIENT_ID = work-buddy-app
   ```
4. **Set Environment** to "Production, Preview, and Development"
5. **Deploy** your changes

#### **Option 2: Netlify**

1. **Connect your repository** to Netlify
2. **Go to Site settings** → Environment variables
3. **Add the same variables** as listed above
4. **Deploy** your site

> **🔐 Security**: Never commit your `.env` file to version control. Always use your hosting platform's environment variable settings for production deployments.

### 2.3 Configure iframe Embedding (Required)

**🚨 Important**: For your app to work in the Oriva app launcher, you must allow iframe embedding from Oriva domains.

**Option 1: Allow Oriva domains (Recommended)**

**Vercel** (`vercel.json`):
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "frame-ancestors 'self' https://oriva.io https://*.oriva.io https://apps.oriva.io"
        }
      ]
    }
  ]
}
```

**Netlify** (`netlify.toml`):
```toml
[[headers]]
  for = "/*"
  [headers.values]
    Content-Security-Policy = "frame-ancestors 'self' https://oriva.io https://*.oriva.io https://apps.oriva.io"
```

**Option 2: Use Oriva's Proxy Service**

If your app already has X-Frame-Options: DENY or SAMEORIGIN, configure your app registration to use the proxy:

```javascript
{
  "iframe_options": {
    "bypass_xframe_protection": true
  }
}
```

> **📖 Need help?** See our complete [X-Frame-Options Configuration Guide](./developer-guides/x-frame-options.md) for other hosting platforms and advanced configuration.

### 2.4 API Key Authentication

Oriva uses simple API key authentication for plugin operations. Include your API key in the Authorization header:

```javascript
const response = await fetch(process.env.EXPO_PUBLIC_ORIVA_API_URL + '/user/me', {
  headers: {
    'Authorization': `Bearer ${process.env.EXPO_PUBLIC_ORIVA_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
console.log('User:', data.name);
```

> **🔐 Security Note:** Never expose your API key in client-side code in production! Use environment variables and server-side proxies for sensitive operations.

### 2.4 Troubleshooting API Key Issues

If you're getting "Invalid API key" errors:

1. **Check the format**: API keys should start with `oriva_pk_live_` or `oriva_pk_test_`
2. **Verify environment**: Make sure you're using the correct API URL:
   - All API keys use: `https://api.oriva.io`
3. **Check for typos**: Ensure the key is copied correctly without extra spaces
4. **Verify key is active**: Check your developer dashboard to ensure the key is not revoked

```bash
# Test your API key
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.oriva.io/api/v1/user/me
```

---

## 🔧 Developer Endpoints (Admin Only)

For generating and managing API keys, use these protected endpoints:

### Generate API Key
```bash
curl -X POST https://api.oriva.io/api/v1/dev/generate-key \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: YOUR_ADMIN_TOKEN" \
  -d '{"appName": "My App", "type": "test"}'
```

### List API Keys
```bash
curl -H "X-Admin-Token: YOUR_ADMIN_TOKEN" \
  https://api.oriva.io/api/v1/dev/keys
```

### Revoke API Key
```bash
curl -X POST https://api.oriva.io/api/v1/dev/revoke-key \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: YOUR_ADMIN_TOKEN" \
  -d '{"apiKey": "oriva_pk_test_..."}'
```

> **🔐 Security Note:** These endpoints require an admin token (`X-Admin-Token` header) and are rate-limited to prevent abuse.

---

## 📚 Step 3: Install and Use the SDK

### 3.1 Install the SDK

```bash
npm install @oriva/plugin-sdk
```

### 3.2 Basic SDK Usage

```typescript
import { OrivaPluginSDK } from '@oriva/plugin-sdk';

const sdk = new OrivaPluginSDK({
  pluginId: process.env.EXPO_PUBLIC_ORIVA_CLIENT_ID,
  version: '1.0.0',
  userId: 'user-id',
  permissions: ['entries:read', 'entries:write'],
  apiKey: process.env.EXPO_PUBLIC_ORIVA_API_KEY,
  baseUrl: process.env.EXPO_PUBLIC_ORIVA_API_URL,
});

// Access user repositories
const repos = await sdk.repositories.list({
  visibility: 'all',
  sort: 'updated'
});

// Create issues
const issue = await sdk.issues.create({
  repositoryId: 'repo-123',
  title: 'Bug in authentication',
  description: 'Users cannot log in with OAuth',
  labels: ['bug', 'high-priority']
});

// Manage pull requests
const pr = await sdk.pullRequests.create({
  repositoryId: 'repo-123',
  title: 'Fix authentication bug',
  head: 'feature/fix-auth',
  base: 'main',
  body: 'This PR fixes the OAuth authentication issue'
});
```

### 3.3 React Integration

```typescript
import { useOrivaSDK } from '@oriva/plugin-sdk/react';

function MyOrivaApp() {
  const { sdk, user, loading } = useOrivaSDK();

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Welcome, {user.name}!</h1>
      <p>You have {user.public_repos} public repositories</p>
    </div>
  );
}
```

### 3.4 Available Scopes

| Scope | Description |
|-------|-------------|
| `read:public-repositories` | Access public repositories only |
| `read:issues` | Read issues and comments |
| `write:issues` | Create and update issues |
| `read:pull-requests` | Read pull requests |
| `write:pull-requests` | Create and update pull requests |
| `read:notifications` | Read user notifications |
| `write:notifications` | Mark notifications as read |
| `app:data:read` | Read app-specific data (tables you create) |
| `app:data:write` | Write app-specific data (tables you create) |

---

## 📚 Step 4: Make Your First API Calls

### 3.1 Get User Profile

```javascript
const profile = await fetch('https://api.oriva.io/api/v1/user/me', {
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

## 🏪 Step 4: Publish to Marketplace

### 4.1 Prepare Your App

Submit your app to the Oriva marketplace by completing these steps:

1. **Complete your app description**
   - Write a compelling description of what your app does
   - Highlight key features and benefits
   - Include use cases and target audience

2. **Add screenshots and demo videos**
   - Show your app in action
   - Demonstrate key workflows
   - Provide visual proof of functionality

3. **Set your pricing** (free or paid)
   - Choose between free or paid tiers
   - Define pricing structure if applicable
   - Consider freemium models

4. **Define required permissions**
   - Specify which API scopes your app needs
   - Justify permission requirements
   - Minimize permissions to what's necessary

### 4.2 Submit for Review

1. **Go to your app dashboard**
2. **Click "Submit for Review"**
3. **Wait for approval** (typically 1-3 business days)

### 4.3 Launch Your App

Once approved, your app will be:
- ✅ **Available in the marketplace**
- ✅ **Discoverable by users**
- ✅ **Ready for installations**
- ✅ **Launch to Oriva users worldwide**

### 4.4 Using the Marketplace Installation API

Your app can also interact with the marketplace to manage app installations:

#### Get User's Installed Apps
```javascript
const installedApps = await fetch('https://api.oriva.io/api/v1/marketplace/installed', {
  headers: {
    'Authorization': `Bearer ${apiKey}`
  }
}).then(r => r.json());

console.log('Installed apps:', installedApps.data);
```

#### Install an App
```javascript
const installation = await fetch('https://api.oriva.io/api/v1/marketplace/install/app-123', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    settings: {
      theme: 'dark',
      notifications: true
    }
  })
}).then(r => r.json());

console.log('Installation result:', installation.data);
```

#### Uninstall an App
```javascript
const result = await fetch('https://api.oriva.io/api/v1/marketplace/uninstall/app-123', {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${apiKey}`
  }
}).then(r => r.json());

console.log('Uninstall result:', result.data);
```

---

## 🔗 API Endpoints

The Oriva Platform provides comprehensive APIs organized into five main categories:

### 🏪 **Marketplace API**
```bash
GET    /api/v1/marketplace/apps              # Browse available apps
GET    /api/v1/marketplace/apps/:appId       # Get app details
GET    /api/v1/marketplace/trending          # Get trending apps
GET    /api/v1/marketplace/featured          # Get featured apps
GET    /api/v1/marketplace/categories        # Get app categories
GET    /api/v1/marketplace/installed         # Get user's installed apps
POST   /api/v1/marketplace/install/:appId    # Install an app
DELETE /api/v1/marketplace/uninstall/:appId  # Uninstall an app
```

### 👨‍💻 **Developer API**
```bash
GET    /api/v1/developer/apps                # Your published apps
POST   /api/v1/developer/apps                # Create new app
PUT    /api/v1/developer/apps/:appId         # Update app
DELETE /api/v1/developer/apps/:appId         # Delete app (draft only)
POST   /api/v1/developer/apps/:appId/submit  # Submit for review
POST   /api/v1/developer/apps/:appId/resubmit # Resubmit after rejection
```

#### 🚀 **App Launcher Configuration**
When creating or updating apps, configure display modes and security settings:

```javascript
// POST /api/v1/developer/apps
{
  "name": "My Awesome App",
  "url": "https://myapp.example.com",
  "display_config": {
    "preferred_mode": "panel",        // panel | fullscreen | overlay
    "supports_panel": true,
    "supports_fullscreen": true,
    "min_width": 400,
    "min_height": 300,
    "responsive": true
  },
  "iframe_options": {
    "allow_frame_ancestors": false,
    "custom_sandbox": ["allow-scripts", "allow-same-origin", "allow-forms"],
    "bypass_xframe_protection": false  // Set true for X-Frame-Options bypass
  }
}
```

**Display Modes:**
- **Panel**: Embedded within Oriva's layout (400px+ width recommended)
- **Fullscreen**: Full-screen takeover with floating controls (800px+ recommended)
- **Overlay**: Modal overlay display (coming soon)

> 📖 **[Complete App Launcher Integration Guide](./developer-guides/app-launcher-integration.md)**

### 🔒 **Privacy-First Profile API**
```bash
GET    /api/v1/profiles/available            # Get authorized profiles
GET    /api/v1/profiles/active               # Get currently active profile
POST   /api/v1/profiles/:profileId/activate  # Switch to different profile
```

### 👥 **Privacy-First Group API**
```bash
GET    /api/v1/groups                        # Get authorized groups
GET    /api/v1/groups/:groupId/members       # Get group members (sanitized)
```

### 📚 **Core Platform API**
```bash
GET    /api/v1/user/me                       # User profile
GET    /api/v1/entries                       # User entries
GET    /api/v1/templates                     # Available templates
GET    /api/v1/storage                       # App storage
POST   /api/v1/ui/notifications              # Show notifications
```

---

## 🔧 Available Scopes

| Scope | Description | Use Case |
|-------|-------------|----------|
| `entries:read` | Read user entries | Content browsing |
| `entries:write` | Create and update entries | Content management |
| `entries:delete` | Delete entries | Content cleanup |
| `templates:read` | Read templates | Template browsing |
| `templates:write` | Create and update templates | Template management |
| `user:read` | Read user information | User profile access |
| `user:write` | Update user information | Profile management |
| `profiles:read` | Read authorized user profiles | Multi-profile access |
| `profiles:write` | Switch between authorized profiles | Profile switching |
| `groups:read` | Read user group memberships | Group access |
| `groups:write` | Access group member information | Group management |
| `ui:notifications` | Show notifications | User interface |
| `ui:modals` | Display modals | User interface |
| `ui:navigation` | Navigate between screens | User interface |
| `storage:read` | Read app-specific data | Data persistence |
| `storage:write` | Write app-specific data | Data storage |

---

## 📊 Rate Limits

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| **Core API** | 1,000 requests | Per 15 minutes |
| **Marketplace** | 1,000 requests | Per hour |
| **Admin Endpoints** | 30 requests | Per minute |
| **Webhooks** | 10,000 requests | Per hour |

---

## 🔒 Privacy-First Development

Oriva's API is built with **privacy by design** principles. Here's how to work with the privacy-first features:

### 🛡️ **Profile Management**

```javascript
// Get available profiles (only those user authorized for your app)
const profiles = await fetch('/api/v1/profiles/available', {
  headers: { 'Authorization': 'Bearer your-api-key' }
});

// Example response:
// {
//   "success": true,
//   "data": [
//     {
//       "profileId": "ext_1234567890abcdef",
//       "profileName": "Work Profile",
//       "isActive": true
//     },
//     {
//       "profileId": "ext_fedcba0987654321", 
//       "profileName": "Personal Profile",
//       "isActive": false
//     }
//   ]
// }

// Switch to a different profile
await fetch('/api/v1/profiles/ext_1234567890abcdef/activate', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer your-api-key' }
});
```

### 👥 **Group Management**

```javascript
// Get user's groups (only those user authorized for your app)
const groups = await fetch('/api/v1/groups', {
  headers: { 'Authorization': 'Bearer your-api-key' }
});

// Example response:
// {
//   "success": true,
//   "data": [
//     {
//       "groupId": "ext_9876543210fedcba",
//       "groupName": "Work Team Alpha",
//       "memberCount": 5,
//       "isActive": true
//     }
//   ]
// }

// Get group members (sanitized data only)
const members = await fetch('/api/v1/groups/ext_9876543210fedcba/members', {
  headers: { 'Authorization': 'Bearer your-api-key' }
});

// Example response:
// {
//   "success": true,
//   "data": [
//     {
//       "memberId": "ext_member_1234567890",
//       "displayName": "Alex Johnson",
//       "role": "admin",
//       "joinedAt": "2024-01-15T10:00:00Z"
//     }
//   ]
// }
```

### 🔐 **Privacy Protection Features**

- **ID Sanitization**: All IDs are prefixed (`ext_`, `ext_member_`) and cannot be linked to internal Oriva data
- **User Authorization**: Users explicitly choose which profiles/groups each app can access
- **Minimal Data**: Only display names and essential information, no personal details
- **Cross-Profile Protection**: Apps cannot determine if profiles belong to the same user
- **Audit Trail**: All access is logged for privacy compliance

---

## 🧪 Testing Your Integration

### Development Environment

You have two options for development and testing:

#### **Option 1: Local Development Server (Recommended)**
- **API URL**: `http://localhost:3001`
- **Setup**: Run the Oriva API locally for development
- **Benefits**: No rate limits, full control, isolated testing
- **Perfect for**: Development, testing, and debugging

**Setting up Local Development:**
```bash
# Clone the Oriva platform repository
git clone https://github.com/0riva/oriva-platform.git
cd oriva-platform

# Install dependencies
cd api && npm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Start the local API server
npm run dev
# Server will be available at http://localhost:3001
```

**Update your environment variables for local development:**
```bash
# .env file for local development
EXPO_PUBLIC_ORIVA_API_URL=http://localhost:3001/api/v1
EXPO_PUBLIC_ORIVA_API_KEY=your_oriva_api_key_here
EXPO_PUBLIC_ORIVA_CLIENT_ID=work-buddy-app
```

#### **Option 2: Production API**
- **API URL**: `https://api.oriva.io`
- **Use for**: Final integration testing with real data
- **Approach**: Use read-only operations and create test repositories

### Testing Your App

#### Option 1: Interactive API Tester (Recommended)

The easiest way to test your API integration is using our secure interactive API tester:

1. **Set up local server**: Follow the setup instructions in the API tester
2. **Configure API key**: Set your API key in environment variables (`.env` file)
3. **Start proxy server**: Run the local test server to proxy requests securely
4. **Open the API Tester**: Navigate to `docs/api-tester.html` in your browser
5. **Test endpoints**: Click "🚀 Test All Endpoints" to test all available endpoints
6. **View results**: See detailed responses, status codes, and error messages

**Benefits of the Secure API Tester:**
- ✅ **Secure** - API key never exposed in browser/client-side code
- ✅ **Visual interface** - Easy to use, no command line needed
- ✅ **Real-time testing** - See responses immediately
- ✅ **Error handling** - Clear error messages and status codes
- ✅ **Response viewing** - Expandable JSON responses
- ✅ **Environment-based** - Uses proper `.env` file for API key storage
- ✅ **Rate limit friendly** - Built-in delays between requests

**Security Features:**
- 🔐 **Server-side proxy** - API key stays on your machine
- 🔐 **Environment variables** - No hardcoded secrets
- 🔐 **Local-only** - No API key transmission to external servers

#### Option 2: Command Line Testing

```bash
# Test API connectivity
curl https://api.oriva.io/api/v1/health

# Test authentication
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.oriva.io/api/v1/user/me

# List entries
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.oriva.io/api/v1/entries
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
const response = await fetch('/api/proxy/oriva/user/me', {
  headers: { 'Authorization': `Bearer ${access_token}` }
});
```

---

## 📚 Next Steps

### Learn More

- **📖 [API Reference](https://github.com/0riva/oriva-platform/blob/main/docs/openapi.yml)** - Complete API documentation
- **🧪 [API Tester](api-tester.html)** - Interactive tool to test Oriva Platform APIs
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
- ✅ **Set up API authentication**
- ✅ **Made API calls** to the platform
- ✅ **Used the SDK** for easier development
- ✅ **Published your app** to the marketplace

**Ready to build the next generation of development tools?** Start building with the Oriva Platform API today!

---

**Built with ❤️ by the Oriva Team**