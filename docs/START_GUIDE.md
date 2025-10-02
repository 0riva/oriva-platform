# 🚀 Developer Start Guide

> **Build apps that extend the Oriva social network platform**

Welcome to the Oriva Platform! This guide will help you build powerful integrations that extend Oriva's functionality for millions of users.

## 🧭 **Quick Navigation**

<details>
<summary><strong>🤖 Quick Reference for AI Agents</strong> (click to expand)</summary>

Jump directly to reference sections:
- **[API Endpoints Summary](#-api-endpoints)** - Complete endpoint reference with examples
- **[Environment Setup](#-step-2-set-up-authentication)** - Configuration patterns and examples
- **[Security Patterns](#-production-security-architecture)** - BFF proxy implementation examples
- **[Error Handling](#-common-issues)** - Troubleshooting patterns and solutions

</details>

<details open>
<summary><strong>👤 Step-by-Step Guide for Human Developers</strong> (recommended path)</summary>

Complete walkthrough from beginner to marketplace:
- **[Prerequisites & Setup](#-prerequisites)** - System requirements and account setup
- **[3-Level Learning Path](#-learning-path)** - Progressive complexity levels
- **[5-Step Integration Process](#-step-1-register-your-app)** - Complete guided walkthrough
- **[Testing & Publishing](#-step-5-publish-to-marketplace)** - Validation and marketplace submission
- **[Specialized Guides](#-developer-resources--specialized-guides)** - Deep-dive documentation links

</details>

[![API Version](https://img.shields.io/badge/API-v1.0-blue)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)]()
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)]()
[![License](https://img.shields.io/badge/License-MIT-green)]()

---

## 🎯 What You'll Build

By the end of this guide, you'll have:
- ✅ **Registered your app** with the Oriva platform
- ✅ **Set up API authentication** for your app
- ✅ **Configured app launcher integration** with proper CSP headers
- ✅ **Made your first API calls** to Oriva
- ✅ **Submitted your app** for admin review and marketplace approval

---

## 🎓 Learning Path

**Choose your complexity level based on your goals:**

### 🟢 **Level 1: Quick Validation (20 minutes)**
*"I want to test if this API works for my use case"*

**Choose your validation approach:**

**Option A: Fastest Path** (5 minutes)
- **[5-Minute API Test](./public/developer-guide/5-minute-api-test.md)** - Standalone test script
- Perfect for quick evaluation before committing to integration

**Option B: Integrated Learning** (20 minutes)
- Follow **Steps 1-2 below** for inline validation with learning
- Includes authentication setup and first API calls
- Better if you're ready to start building

**✅ Success Milestone**: You can see your Oriva user data and understand authentication

### 🟡 **Level 2: Production Setup (2 hours)**
*"I want to build a real app for users"*

1. **Complete Steps 1-3 below** (Register → Auth → API Integration)
2. **Add error handling and security patterns**
3. **Deploy to hosting platform**

**✅ Success Milestone**: Your app works reliably with real users

### 🔴 **Level 3: Marketplace Integration (4+ hours)**
*"I want to publish to the Oriva marketplace"*

1. **Complete all steps below** (Steps 1-5)
2. **Implement iframe embedding and CSP headers**
3. **Submit for marketplace approval**

**✅ Success Milestone**: Your app is live in the Oriva marketplace

**💡 Recommendation**: Start with Level 1 to validate your concept, then progress to higher levels as needed.

---

## 🗺️ Choose Your Integration Path

**Not sure which approach fits your project? Use this decision tree:**

### 🤔 **What are you building?**

```
📱 Simple Web App
├── Just need user data? → Level 1: Quick Validation
├── Building for real users? → Level 2: Production Setup
└── Want marketplace listing? → Level 3: Full Integration

🖼️ Embedded/Iframe App
├── Embedding in your own site? → Level 2 + Iframe Setup
├── Want Oriva marketplace? → Level 3: Full Integration
└── Just testing iframe concept? → Level 1 first

🏢 Enterprise Integration
├── Custom authentication? → Level 2 + Custom Auth Patterns
├── High-volume API usage? → Level 2 + BFF Proxy Patterns
└── Multi-tenant setup? → Level 3 + Enterprise Guide

🧪 Proof of Concept
├── Quick API evaluation? → Level 1: 5-Minute Test
├── Demonstrating to stakeholders? → Level 1: 15-Minute App
└── Competitive analysis? → Level 1 + API Reference
```

### 📋 **Integration Requirements Checklist**

**Check all that apply to determine your path:**

- [ ] **I need to show this works quickly** → Start with Level 1
- [ ] **Users will interact with this app** → Level 2 minimum
- [ ] **I want to sell/distribute through Oriva** → Level 3 required
- [ ] **This will be embedded in other sites** → iframe patterns needed
- [ ] **I need enterprise-grade security** → BFF proxy patterns required
- [ ] **High traffic expected (>1000 users)** → Production deployment required

### 🎯 **Recommended Paths by Developer Experience**

**New to APIs (Junior)**
→ Level 1: 5-Minute Test → 15-Minute App → Build features → Level 2 when ready

**Experienced Web Developer (Mid-level)**
→ Level 1 for validation → Level 2 for production → Level 3 for marketplace

**Senior/Enterprise Developer**
→ Quick Level 1 validation → Jump to Level 2 → Custom security patterns

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
   - **API Key**: Generate a live production key using the "Generate Live API Key" button (format: `oriva_pk_live_...`)
   - **Client ID & Secret**: For OAuth authentication (if needed)
   - Copy these credentials and add them to your `.env` file
   - **Important**: Use live keys for production apps - test keys are only for development

4. **Configure OAuth settings** (if using OAuth):
   - Set redirect URIs for your application
   - Define required scopes and permissions
   - Test the OAuth flow in development

> **🔐 Security Note:** Keep your API key secure and never expose it in client-side code in production!

### ✅ **Step 1 Success Checkpoint**

**Validate your setup before continuing:**

```bash
# Test your API key quickly
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.oriva.io/api/v1/user/me
```

**Expected Success Response:**
```json
{
  "id": "user_123...",
  "name": "Your Name",
  "email": "your@email.com"
}
```

**✅ If you see your user data**: Proceed to Step 2
**❌ If you get an error**: Check your API key format and regenerate if needed

---

## 🔐 Step 2: Set Up Authentication

### 2.1 Environment Configuration

Create a `.env` file in your project root with your Oriva API credentials using the standard naming convention:

```bash
# Oriva Platform Configuration (Required)
EXPO_PUBLIC_ORIVA_API_URL=https://api.oriva.io/api/v1
EXPO_PUBLIC_ORIVA_API_KEY=your_oriva_api_key_here
EXPO_PUBLIC_ORIVA_CLIENT_ID=your-app-name
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
   EXPO_PUBLIC_ORIVA_CLIENT_ID = your-app-name
   ```
4. **Set Environment** to "Production, Preview, and Development"
5. **Deploy** your changes

#### **Option 2: Netlify**

1. **Connect your repository** to Netlify
2. **Go to Site settings** → Environment variables
3. **Add the same variables** as listed above
4. **Deploy** your site

> **🔐 Security**: Never commit your `.env` file to version control. Always use your hosting platform's environment variable settings for production deployments.

### 2.3 Configure App Integration for Oriva Launcher (Required)

**🚨 Critical Requirement**: For your app to work in the Oriva marketplace, it must properly integrate with the Oriva app launcher system.

#### **Step 1: Allow iframe Embedding**

Your app **MUST** include the following Content Security Policy (CSP) directive:

```http
Content-Security-Policy: frame-ancestors 'self' https://oriva.io https://*.oriva.io https://app.oriva.io
```

**Implementation by Platform:**

**Vercel** (`vercel.json`):
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "frame-ancestors 'self' https://oriva.io https://*.oriva.io https://app.oriva.io; default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
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
    Content-Security-Policy = "frame-ancestors 'self' https://oriva.io https://*.oriva.io https://app.oriva.io; default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
```

**Express.js Server**:
```javascript
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "frame-ancestors 'self' https://oriva.io https://*.oriva.io https://app.oriva.io"
  );
  next();
});
```

#### **Step 2: Remove X-Frame-Options (If Present)**

If your app currently uses X-Frame-Options headers, you must either:

1. **Remove them entirely** (recommended), OR
2. **Change to `ALLOWALL`** (less secure)

```javascript
// Remove this line from your server configuration:
res.setHeader('X-Frame-Options', 'DENY'); // ❌ Remove this
res.setHeader('X-Frame-Options', 'SAMEORIGIN'); // ❌ Remove this

// CSP frame-ancestors is the modern replacement
```

#### **Step 3: Handle Oriva Integration Parameters**

Your app will receive these URL parameters when launched from Oriva:

```javascript
// Parse Oriva launch parameters
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('session_id');
const appId = urlParams.get('app_id');
const userId = urlParams.get('user_id');
const permissions = JSON.parse(urlParams.get('permissions') || '[]');
const origin = urlParams.get('origin'); // 'oriva_web' or 'oriva_mobile'

// Validate session and initialize your app for Oriva context
if (sessionId && appId) {
  initializeOrivaIntegration({ sessionId, appId, userId, permissions });
}
```

#### **Step 4: Test Your Integration**

1. **Deploy with CSP headers** configured
2. **Test iframe embedding** using this validator:
   ```javascript
   // Test if your app can be embedded
   const testFrame = document.createElement('iframe');
   testFrame.src = 'https://your-app.example.com';
   testFrame.style.display = 'none';
   document.body.appendChild(testFrame);

   testFrame.onload = () => console.log('✅ App can be embedded');
   testFrame.onerror = () => console.log('❌ CSP blocking iframe');
   ```

3. **Verify in Oriva launcher** by installing your app in development

> **📖 Complete Integration Guide**: See [App Integration Requirements](./public/developer-guide/app-integration-requirements.md) for comprehensive technical specifications.

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

1. **Generate a live key**: Click "Generate Live API Key" in your developer settings (not test keys)
2. **Check the format**: Production keys should start with `oriva_pk_live_...`
3. **Verify environment**: Make sure you're using the correct API URL:
   - All API keys use: `https://api.oriva.io`
4. **Check for typos**: Ensure the key is copied correctly without extra spaces
5. **Verify key is active**: Check your developer dashboard to ensure the key is not revoked

```bash
# Test your API key
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.oriva.io/api/v1/user/me
```

> **🛠️ Complete Troubleshooting**: For systematic debugging workflows and comprehensive issue resolution, see [API Troubleshooting Guide](./public/developer-guide/api-troubleshooting-guide.md)

### ✅ **Step 2 Success Checkpoint**

**Before continuing, validate your authentication setup:**

1. **Environment Check**: Your `.env` file has the correct API key
2. **Platform Check**: Your hosting platform (Vercel/Netlify) has environment variables set
3. **CSP Check**: Your app allows iframe embedding (if planning marketplace integration)

**Quick Validation Test:**
```javascript
// Test in browser console or Node.js
fetch('https://api.oriva.io/api/v1/user/me', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
}).then(r => r.json()).then(console.log);
```

**✅ Success Indicators:**
- Your API key returns user data (not 401/403 errors)
- Environment variables are properly configured
- CSP headers allow Oriva domains (if iframe app)

**💡 Level 1 Complete**: If you just want basic API access, you're done! Try building features with the API.

**📈 Ready for Level 2?**: Continue to Step 3 for full API integration patterns.

---

## 🔧 Developer Endpoints (Admin Only)

For generating and managing API keys, use these protected endpoints:

### Get Available Permissions
```bash
curl https://api.oriva.io/api/v1/dev/permissions
```

### Generate Live API Key (Recommended)
```bash
curl -X POST https://api.oriva.io/api/v1/dev/generate-live-key \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: YOUR_ADMIN_TOKEN" \
  -d '{"appName": "My App"}'
```

### Generate API Key with Custom Permissions
```bash
curl -X POST https://api.oriva.io/api/v1/dev/generate-live-key \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: YOUR_ADMIN_TOKEN" \
  -d '{
    "name": "My App",
    "permissions": ["user:read", "profiles:read", "entries:read"]
  }'
```

### Generate Test API Key (Development Only)
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

## 🔐 Production Security Architecture

### Backend-for-Frontend (BFF) Pattern ⚠️ **CRITICAL FOR PRODUCTION**

**Never expose API keys client-side.** Always implement a secure proxy pattern for production apps.

```
Client App → Your Backend Proxy → Oriva API
```

**Why BFF is Required:**
- **Security**: Oriva API keys remain server-side only
- **CORS**: Bypass browser cross-origin restrictions  
- **Rate Limiting**: Implement your own rate limiting
- **Error Handling**: Centralized error processing
- **Authentication**: Add your own auth layer

### Secure Proxy Implementation

Create API proxy endpoints that handle Oriva communication:

```javascript
// /api/oriva/profiles.js (Vercel/Netlify Functions)
export default async function handler(req, res) {
  // 1. CORS Configuration for iframe contexts
  const allowedOrigins = [
    'https://your-app.vercel.app',
    'https://apps.oriva.io',
    'https://oriva.io',
    'http://localhost:8081' // Development
  ];

  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Client-ID, User-Agent');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 2. Client Authentication & Rate Limiting
  const clientId = req.headers['x-client-id'];
  const allowedClients = ['your-app-name', 'oriva-platform'];

  if (!clientId || !allowedClients.includes(clientId)) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized - Valid X-Client-ID required'
    });
  }

  // 3. Server-side API Call (API key stays secure)
  const orivaApiKey = process.env.ORIVA_API_KEY;
  const orivaClientId = process.env.ORIVA_CLIENT_ID;

  try {
    const orivaResponse = await fetch('https://api.oriva.io/api/v1/profiles/available', {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${orivaApiKey}`,
        'X-Client-ID': orivaClientId,
        'Content-Type': 'application/json',
        'User-Agent': 'YourApp-BFF/1.0.0'
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
    });

    if (!orivaResponse.ok) {
      const errorText = await orivaResponse.text();
      return res.status(orivaResponse.status).json({
        success: false,
        error: `Oriva API error: ${orivaResponse.status}`,
        details: errorText
      });
    }

    const data = await orivaResponse.json();
    return res.status(200).json({
      success: true,
      data: data.data || data,
      message: data.message
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
}
```

### Client-side Service Pattern

```typescript
// services/orivaApi.ts
class OrivaApiService {
  private config: {
    proxyUrl: string;
    clientId: string;
  };

  constructor() {
    const isLocalhost = Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      window.location.hostname === 'localhost';

    // Always use absolute URL for production iframe contexts
    this.config = {
      proxyUrl: isLocalhost
        ? 'http://localhost:8090/api/oriva'
        : 'https://your-app.vercel.app/api/oriva',
      clientId: process.env.EXPO_PUBLIC_ORIVA_CLIENT_ID || 'your-app-name',
    };
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}) {
    const url = `${this.config.proxyUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Client-ID': this.config.clientId,
        'User-Agent': `${this.config.clientId}/1.0.0`,
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        data: null as T,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      data: data.data || data,
      message: data.message,
    };
  }

  async getUserProfiles() {
    return this.makeRequest('/profiles');
  }

  async createSession(sessionData: any) {
    return this.makeRequest('/sessions', {
      method: 'POST',
      body: JSON.stringify(sessionData),
    });
  }
}
```

### Production Data Source Pattern

```javascript
// config/dataSource.js - Production-ready with fallbacks
export const getProfiles = async () => {
  // Always attempt API first in production
  if (appVariant !== 'development' || !isLocalhost) {
    try {
      const profilesResponse = await orivaApi.getUserProfiles();

      if (profilesResponse.success) {
        console.log(`✅ Retrieved ${profilesResponse.data.length} profiles from Oriva API`);
        return profilesResponse.data;
      } else {
        console.error('❌ Oriva API failed:', profilesResponse.error);
        // Graceful fallback to demo data
        return mockProfiles;
      }
    } catch (error) {
      console.error('❌ API call failed:', error);
      return mockProfiles; // Fallback for reliability
    }
  } else {
    // Development mode with dummy data
    return mockProfiles;
  }
};
```

## 🌐 Advanced Iframe Integration

> **📖 Secure Iframe Integration**: For embedded apps requiring secure authentication, see [Secure Iframe Integration](./public/developer-guide/iframe-integration-secure.md) for production-ready patterns.

### Iframe Detection & Context Handling

```javascript
// Detect if running in iframe context
const isInIframe = typeof window !== 'undefined' && (() => {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true; // Cross-origin iframe
  }
})();

// URL resolution for iframe contexts
const getApiUrl = () => {
  const isLocalhost = typeof window !== 'undefined' &&
    window.location.hostname === 'localhost';

  // Always use absolute URLs when embedded to bypass deployment protection
  return isLocalhost
    ? 'http://localhost:8090/api/oriva'
    : 'https://your-production-domain.com/api/oriva';
};
```

### Enhanced CSP Headers for Production

```javascript
// Enhanced CSP for iframe embedding with Oriva
res.setHeader('Content-Security-Policy',
  `frame-ancestors 'self' https://oriva.io https://*.oriva.io https://app.oriva.io https://apps.oriva.io http://localhost:* https://localhost:*; ` +
  `script-src 'self' 'unsafe-inline' https://oriva.io; ` +
  `style-src 'self' 'unsafe-inline' https://oriva.io; ` +
  `connect-src 'self' https://api.oriva.io`
);
```

## 🚀 Production Deployment

### Vercel Configuration

```json
// vercel.json
{
  "functions": {
    "api/oriva/profiles.js": {
      "maxDuration": 10
    }
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "frame-ancestors 'self' https://oriva.io https://*.oriva.io https://app.oriva.io"
        }
      ]
    }
  ],
  "env": {
    "ORIVA_CLIENT_ID": "@oriva-client-id"
  }
}
```

### Environment Setup

```bash
# Production Environment Variables
# Set in Vercel dashboard (keep server-side only)
ORIVA_API_KEY=oriva_pk_live_xxxxxxxxxxxxx
ORIVA_CLIENT_ID=your-app-name

# Client-side (safe to expose)
EXPO_PUBLIC_ORIVA_CLIENT_ID=your-app-name
EXPO_PUBLIC_APP_VARIANT=production
```

## 📚 Developer Resources & Specialized Guides

**Before diving into integration, familiarize yourself with these specialized guides:**

### 🔗 **API Headers & CORS**
- **📖 [API Headers Reference](./public/developer-guide/api-headers-reference.md)** - Complete guide to required, recommended, and optional headers
- **🌐 CORS Support** - Automatic CORS approval for approved marketplace apps
- **🎯 Quick Reference** - Copy-paste examples for JavaScript, cURL, Python
- **🚨 Need Help?** - Use our [GitHub issue template](../.github/ISSUE_TEMPLATE/cors-header-request.md) for new header requests

### 🎮 **App Integration & Launcher**
- **📖 [App Integration Requirements](./public/developer-guide/app-integration-requirements.md)** - Complete technical specifications
- **🔧 [Iframe Configuration Guide](./public/developer-guide/iframe-configuration-guide.md)** - Secure iframe embedding setup
- **🔒 [Authentication Patterns](./public/developer-guide/authentication-patterns.md)** - Secure authentication implementation

### 🔧 **Technical Specifications**
- **📋 [Development Tools](./public/developer-guide/development-tools.md)** - Testing utilities and performance monitors
- **🔒 Content Security Policy** - CSP configuration for iframe embedding
- **📱 Responsive Design** - Mobile optimization requirements

### 💡 **Quick Links**
- **🐛 Report Issues**: [GitHub Issues](https://github.com/0riva/oriva-platform/issues)
- **🌐 Request CORS Headers**: [Use our template](../.github/ISSUE_TEMPLATE/cors-header-request.md)
- **💬 Community**: [GitHub Discussions](https://github.com/0riva/oriva-platform/discussions)

---

## 📚 Step 3: API Integration

### 3.1 Making API Calls

Use your preferred HTTP client to call the Oriva Platform API directly:

> **📖 Complete API Reference**: See [Complete API Reference](./public/developer-guide/api-reference-complete.md) for detailed endpoint documentation with security-first patterns and comprehensive examples.

> **📖 Complete Headers Guide**: See [API Headers Reference](./public/developer-guide/api-headers-reference.md) for comprehensive header documentation with security best practices.

```typescript
// Get current user information
const response = await fetch(`${process.env.EXPO_PUBLIC_ORIVA_API_URL}/user/me`, {
  headers: {
    'Authorization': `Bearer ${process.env.EXPO_PUBLIC_ORIVA_API_KEY}`,
    'Content-Type': 'application/json',
    'User-Agent': 'your-app-name/1.0.0 (web)',  // Recommended for debugging
    'X-Client-ID': 'your-app-name'              // Recommended for support
  }
});
const user = await response.json();

// Get user's installed apps
const appsResponse = await fetch(`${process.env.EXPO_PUBLIC_ORIVA_API_URL}/marketplace/installed`, {
  headers: {
    'Authorization': `Bearer ${process.env.EXPO_PUBLIC_ORIVA_API_KEY}`,
    'Content-Type': 'application/json'
  }
});
const installedApps = await appsResponse.json();

// Get available profiles
const profilesResponse = await fetch(`${process.env.EXPO_PUBLIC_ORIVA_API_URL}/profiles/available`, {
  headers: {
    'Authorization': `Bearer ${process.env.EXPO_PUBLIC_ORIVA_API_KEY}`,
    'Content-Type': 'application/json'
  }
});
const profiles = await profilesResponse.json();
```

### 3.2 CORS Support ✨

**Automatic CORS approval** for registered marketplace apps:

1. **Register your app** in Developer Settings
2. **Submit for marketplace approval** with your `execution_url`
3. **Once approved**, your domain automatically gets API access

**Supported Domains:**
- Core Oriva: `oriva.io`, `app.oriva.io`
- Approved marketplace apps
- `localhost` (development)

### 3.3 Error Handling

```typescript
async function makeApiCall(endpoint: string, options: RequestInit = {}) {
  try {
    const response = await fetch(`${process.env.EXPO_PUBLIC_ORIVA_API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${process.env.EXPO_PUBLIC_ORIVA_API_KEY}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorData.message || 'Unknown error'}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
}

// Usage examples
const user = await makeApiCall('/user/me');
const entries = await makeApiCall('/entries?limit=10');
```

### 3.3 React Integration

```typescript
import { useState, useEffect } from 'react';

function MyOrivaApp() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchUser() {
      try {
        const userData = await makeApiCall('/user/me');
        setUser(userData);
      } catch (err) {
        setError(err.message);
        console.error('Failed to fetch user:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h1>Welcome, {user?.displayName}!</h1>
      <p>Your Oriva integration is working!</p>
    </div>
  );
}
```

### 3.4 Available Scopes

| Scope | Description | Security Level |
|-------|-------------|----------------|
| `user:read` | Read user profile information | 🟡 Requires user consent |
| `profiles:read` | Read authorized user profiles | 🟡 User-controlled access |
| `profiles:write` | Switch between authorized profiles | 🟡 User-controlled access |
| `groups:read` | Read user group memberships | 🟡 User-controlled access |
| `groups:write` | Access group member information | 🟡 User-controlled access |
| `marketplace:read` | Browse public marketplace apps | 🟢 Public access |
| `storage:read` | Read app-specific data only | 🟢 Isolated to your app |
| `storage:write` | Write app-specific data only | 🟢 Isolated to your app |
| `ui:notifications` | Show notifications to user | 🟡 Requires permission |
| `ui:navigation` | Navigate within Oriva interface | 🟢 Standard integration |

**🔐 Security Notes:**
- No scope allows installing/uninstalling apps
- No scope allows seeing other installed apps
- Profile/group access requires explicit user authorization
- All data access is isolated per app

---

## 📚 Step 4: Test Your Integration

### 4.1 Get User Profile

```javascript
const profile = await fetch('https://api.oriva.io/api/v1/user/me', {
  headers: {
    'Authorization': `Bearer ${process.env.EXPO_PUBLIC_ORIVA_API_KEY}`
  }
}).then(r => r.json());

console.log('User:', profile.displayName);
```

### 4.2 List Installed Apps

```javascript
const apps = await fetch('https://api.oriva.io/api/v1/marketplace/installed', {
  headers: {
    'Authorization': `Bearer ${process.env.EXPO_PUBLIC_ORIVA_API_KEY}`
  }
}).then(r => r.json());

console.log('Installed apps:', apps.data);
```

### 4.3 Get Available Profiles

```javascript
const profiles = await fetch('https://api.oriva.io/api/v1/profiles/available', {
  headers: {
    'Authorization': `Bearer ${process.env.EXPO_PUBLIC_ORIVA_API_KEY}`,
    'Content-Type': 'application/json'
  }
}).then(r => r.json());

console.log('Available profiles:', profiles.data);
// Note: Anonymous profiles are automatically filtered out for privacy protection

// Example response:
// {
//   "success": true,
//   "data": [
//     {
//       "profileId": "profile_123",
//       "profileName": "Work Profile",
//       "isActive": true,
//       "avatar": "https://example.com/avatar.jpg",
//       "isDefault": false
//     }
//   ]
// }
```

---

## 🏪 Step 5: Publish to Marketplace

### 5.1 App Submission Process

**📝 Developer Flow:**
1. **Developer** creates app in Developer Settings
2. **Developer** submits app for marketplace approval
3. **Oriva Admin** reviews and approves/rejects app
4. **Approved apps** appear in marketplace
5. **Oriva Users** discover and install approved apps

### 5.2 Prepare Your App Submission

Before submitting, ensure your app meets all requirements:

#### **Technical Requirements:**
- ✅ **CSP headers configured** for iframe embedding
- ✅ **HTTPS enabled** for production deployment
- ✅ **Integration tested** with Oriva launcher
- ✅ **Performance optimized** (loads within 3 seconds)
- ✅ **Mobile responsive** design implemented

#### **Content Requirements:**
- ✅ **App description** - Clear explanation of functionality
- ✅ **Screenshots/videos** - Demonstrate key features
- ✅ **Use cases** - Show real-world applications
- ✅ **Privacy policy** - Data handling transparency
- ✅ **Support documentation** - User help resources

#### **Security Requirements:**
- ✅ **Minimal permissions** - Only request necessary scopes
- ✅ **Data isolation** - No access to other apps' data
- ✅ **User consent** - Clear permission explanations
- ✅ **Secure coding** - Follow security best practices

### 5.3 Submit for Admin Review

1. **Complete app registration** in Developer Settings
2. **Add all required information** (description, screenshots, etc.)
3. **Test integration thoroughly**
4. **Click "Submit for Review"**
5. **Wait for Oriva Admin approval** (typically 3-7 business days)

### 5.4 Admin Review Process

**🔍 Oriva Admin reviews for:**
- Security compliance and user safety
- Technical integration quality
- Content appropriateness and accuracy
- Performance and reliability standards
- Privacy and data protection compliance

### 5.5 App Goes Live

Once **Oriva Admin approves** your app:
- ✅ **Listed in marketplace** for user discovery
- ✅ **Users can install** your app from marketplace
- ✅ **App launches** in Oriva's full-screen launcher
- ✅ **Analytics available** in your developer dashboard

### 5.6 Security & Privacy Model

**🔐 Third-party apps have limited, secure access to protect Oriva users:**

#### What Third-Party Apps CAN Do:
- ✅ **Read user profile** (with user consent)
- ✅ **Access authorized profiles/groups** (user-controlled)
- ✅ **Store app-specific data** (isolated storage)
- ✅ **Display notifications** (with permission)
- ✅ **Navigate within Oriva** (user interface integration)

#### What Third-Party Apps CANNOT Do:
- ❌ **Install other apps** (user must install manually)
- ❌ **See other installed apps** (privacy protection)
- ❌ **Access unauthorized profiles** (explicit consent required)
- ❌ **Modify other apps' data** (strict isolation)
- ❌ **Bypass user permissions** (security enforcement)

#### App Installation Flow
Apps cannot programmatically install other apps. Instead, use secure user-controlled flows:

```javascript
// ✅ SECURE: Redirect to Oriva marketplace for user-controlled installation
function suggestApp(targetAppId) {
  const installUrl = `https://app.oriva.io/marketplace/app/${targetAppId}`;

  // Option 1: Open in new tab
  window.open(installUrl, '_blank');

  // Option 2: Navigate within iframe (if in Oriva launcher)
  if (window.parent !== window) {
    window.parent.postMessage({
      type: 'navigate',
      url: `/marketplace/app/${targetAppId}`
    }, 'https://app.oriva.io');
  }
}
```

---

## 🔗 API Endpoints

The Oriva Platform provides comprehensive APIs organized into five main categories:

### 🏪 **Marketplace API** (Read-Only)
```bash
GET    /api/v1/marketplace/apps              # Browse available apps (public)
GET    /api/v1/marketplace/apps/:appId       # Get app details (public)
GET    /api/v1/marketplace/trending          # Get trending apps (public)
GET    /api/v1/marketplace/featured          # Get featured apps (public)
GET    /api/v1/marketplace/categories        # Get app categories (public)
# Note: Third-party apps cannot see user's installed apps or install/uninstall apps
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

**The Oriva App Launcher** provides a professional, full-screen experience for apps with floating navigation controls. Configure your app's display modes and integration settings:

```javascript
// POST /api/v1/developer/apps
{
  "name": "My Awesome App",
  "execution_url": "https://myapp.example.com/oriva-entry",
  "display_config": {
    "preferred_mode": "fullscreen",     // fullscreen | panel | overlay
    "supports_panel": true,
    "supports_fullscreen": true,
    "min_width": 400,
    "min_height": 300,
    "responsive": true
  },
  "iframe_options": {
    "allow_frame_ancestors": true,      // ✅ Required for Oriva embedding
    "custom_sandbox": [
      "allow-scripts",
      "allow-same-origin",
      "allow-forms",
      "allow-popups",
      "allow-modals",
      "allow-top-navigation-by-user-activation"
    ],
    "bypass_xframe_protection": false   // Only use if CSP cannot be configured
  },
  "sandbox_config": {
    "allowStorage": true,
    "allowNetworking": true,
    "allowLocation": false,
    "maxMemoryMB": 500,
    "maxExecutionTime": 300000
  }
}
```

#### **Display Modes**

**🎯 Fullscreen Mode (Recommended)**
- **Full browser viewport** with floating navigation controls
- **Auto-hiding controls** after 3 seconds of inactivity
- **Touch-to-show** controls on mobile
- **Professional experience** for productivity apps
- **Best for**: Video apps, document editors, design tools, dashboards

**📱 Panel Mode**
- **Embedded within** Oriva's interface layout
- **Fixed header** with app controls provided by Oriva
- **400px minimum width** recommended
- **Best for**: Utilities, simple tools, widgets, calculators

**📋 Overlay Mode** *(Coming Soon)*
- **Modal overlay** display over Oriva interface
- **Best for**: Quick actions, notifications, simple forms

#### **App Launcher Features**

✅ **Full-Screen Experience** - Maximum app real estate
✅ **Floating Navigation** - Unobtrusive controls that auto-hide
✅ **Touch Controls** - Mobile-optimized interaction
✅ **Security Sandboxing** - Configurable permission system
✅ **Performance Monitoring** - Resource usage tracking
✅ **Error Handling** - Helpful integration error messages
✅ **Cross-Browser Support** - Works in Chrome, Firefox, Safari, Edge

#### **Integration Requirements Checklist**

Before submitting your app, ensure:

- [ ] **CSP configured** with `frame-ancestors` directive for Oriva domains
- [ ] **X-Frame-Options removed** or set to allow embedding
- [ ] **App handles** Oriva URL parameters (session_id, app_id, user_id)
- [ ] **HTTPS enabled** for production deployment
- [ ] **Performance tested** - loads within 3 seconds
- [ ] **Mobile responsive** design implemented
- [ ] **Error handling** for integration failures

> 📖 **[Complete App Integration Requirements](./public/developer-guide/app-integration-requirements.md)** - Full technical specifications and examples

### 🔒 **Privacy-First Profile API**
```bash
GET    /api/v1/profiles/available            # Get user's non-anonymous profiles
GET    /api/v1/profiles/active               # Get currently active profile
POST   /api/v1/profiles/:profileId/activate  # Switch to different profile
```

**🛡️ Privacy Protection**: Anonymous profiles are automatically filtered out to protect user privacy. Third-party apps only receive profiles that users have intentionally created.

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
//       "profileId": "profile_123",
//       "profileName": "Work Profile",
//       "isActive": true,
//       "avatar": "https://example.com/avatar.jpg",
//       "isDefault": false
//     },
//     {
//       "profileId": "profile_456",
//       "profileName": "Personal Profile",
//       "isActive": false,
//       "avatar": "https://example.com/avatar2.jpg",
//       "isDefault": true
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

**Production API Testing**:
- **API URL**: `https://api.oriva.io`
- **Use for**: Integration testing with your live API key

### Testing Your App

#### **Command Line Testing**

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

### 3. CORS Issues (Resolved for Marketplace Apps! ✅)

**Old Problem**: Browser blocked API requests with CORS errors
**New Solution**: **Automatic CORS approval** for registered marketplace apps!

**If you're still getting CORS errors:**

1. **Check app status**: Ensure your app is **approved** in the marketplace
2. **Verify execution_url**: Make sure your domain matches the registered `execution_url`
3. **Wait for cache**: New approvals take up to 5 minutes to propagate
4. **Development mode**: Use `localhost` for local development (automatically allowed)

**Legacy server-side proxy approach** (no longer needed for approved apps):
```javascript
// ❌ Old approach - not needed for approved marketplace apps
const response = await fetch('/api/proxy/oriva/user/me', {
  headers: { 'Authorization': `Bearer ${access_token}` }
});

// ✅ New approach - direct API calls work automatically
const response = await fetch('https://api.oriva.io/api/v1/user/me', {
  headers: { 'Authorization': `Bearer ${process.env.EXPO_PUBLIC_ORIVA_API_KEY}` }
});
```

### 4. Production-Specific Issues

#### **"No profiles available" Error**
**Cause**: Client-side credential detection failing in production
**Solution**: Remove client-side credential dependency, always attempt API calls in production

```javascript
// ❌ Wrong - checking credentials client-side
if (hasCredentials) {
  const profiles = await orivaApi.getUserProfiles();
}

// ✅ Right - always attempt API calls in production
const profilesResponse = await orivaApi.getUserProfiles();
if (profilesResponse.success) {
  return profilesResponse.data;
} else {
  // Graceful fallback to demo data
  return mockProfiles;
}
```

#### **Vercel Deployment Protection Issues**
**Cause**: Using deployment-specific URLs in iframe contexts
**Solution**: Always use main domain URL for production

```javascript
// ❌ Wrong - deployment-specific URL
const apiUrl = 'https://your-app-git-main-team.vercel.app/api/oriva';

// ✅ Right - use main domain
const apiUrl = 'https://your-app.vercel.app/api/oriva';
```

#### **API Key Exposure Risks**
**Cause**: Including API keys in client environment variables
**Solution**: Use BFF pattern, keep keys server-side only

```bash
# ❌ NEVER expose API keys client-side
EXPO_PUBLIC_ORIVA_API_KEY=oriva_pk_live_xxxxx  # ❌ DANGEROUS

# ✅ Keep server-side only
ORIVA_API_KEY=oriva_pk_live_xxxxx              # ✅ SECURE
EXPO_PUBLIC_ORIVA_CLIENT_ID=your-app-name      # ✅ Safe to expose
```

#### **Rate Limiting in Production**
**Cause**: Too many direct API calls or missing rate limiting
**Solution**: Implement proper rate limiting in your proxy

```javascript
const rateLimitStore = new Map();

function rateLimit(req, clientId, limit = 100, window = 60000) {
  const key = `${clientId || req.ip || 'unknown'}`;
  const now = Date.now();
  const windowStart = now - window;

  // Get current requests for this key
  const requests = rateLimitStore.get(key) || [];
  
  // Remove old requests outside the window
  const validRequests = requests.filter(time => time > windowStart);
  
  if (validRequests.length >= limit) {
    return false; // Rate limit exceeded
  }
  
  // Add current request
  validRequests.push(now);
  rateLimitStore.set(key, validRequests);
  
  return true; // Request allowed
}
```

### 4. Iframe Sandbox Errors

**Problem**: Console errors like "Error while parsing the 'sandbox' attribute: 'allow-orientation-lock', 'allow-presentation' are invalid"
**Solution**: This is a known issue that has been resolved in Oriva's app launcher system

```javascript
// ❌ Invalid sandbox attributes (fixed in Oriva)
<iframe sandbox="allow-orientation-lock allow-presentation ...">

// ✅ Valid sandbox attributes (now implemented)
<iframe sandbox="allow-scripts allow-same-origin allow-forms allow-popups ...">
```

**Note**: If you encounter these errors, they are on Oriva's side and have been resolved. Your CSP implementation is correct. The errors typically show:
- "Error while parsing the 'sandbox' attribute: ... are invalid"
- Your app URL being accessed correctly (e.g., `https://your-app.vercel.app`)
- CSP `frame-ancestors` directive working properly

**Action**: No action needed from developers - this was an Oriva platform issue that has been fixed.

### 5. Missing Build Script Error on Vercel

**Problem**: Vercel deployment fails with error `npm error Missing script: "vercel-build"`
**Cause**: Your vercel.json references a build script that doesn't exist in package.json

**Solution**: Add the missing build script to your package.json:

```json
{
  "scripts": {
    "vercel-build": "expo export -p web && node scripts/postexport-csp.js || echo 'CSP script not available, continuing...'"
  }
}
```

**Alternative**: Update your vercel.json to use an existing build script:
```json
{
  "buildCommand": "npm run build"
}
```

### 6. X-Frame-Options Blocking Iframe Embedding

**Problem**: Console shows "Refused to display in a frame because it set 'X-Frame-Options' to 'SAMEORIGIN'"
**Root Cause**: Your app has conflicting frame protection headers

**Solution**: Choose one approach:

**Option 1 (Recommended)**: Remove X-Frame-Options entirely, use CSP only
```json
// vercel.json - Remove X-Frame-Options from main pages
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        // ❌ Remove this line:
        // { "key": "X-Frame-Options", "value": "SAMEORIGIN" }

        // ✅ Keep CSP with frame-ancestors:
        {
          "key": "Content-Security-Policy",
          "value": "frame-ancestors 'self' https://oriva.io https://*.oriva.io https://app.oriva.io; ..."
        }
      ]
    }
  ]
}
```

**Option 2**: Use X-Frame-Options ALLOWALL (less secure)
```json
{
  "key": "X-Frame-Options",
  "value": "ALLOWALL"
}
```

## 🧪 Integration Testing

Before submitting your app, test these critical integration points:

### 1. Test Iframe Embedding
```javascript
// Create test iframe to verify embedding works
const testFrame = document.createElement('iframe');
testFrame.src = 'https://your-app.vercel.app';
testFrame.onload = () => console.log('✅ Embedding works');
testFrame.onerror = () => console.log('❌ Check CSP headers');
document.body.appendChild(testFrame);
```

### 2. Check CSP Headers
Use browser dev tools Network tab to verify headers are being sent correctly:
- Look for `Content-Security-Policy` header
- Verify `frame-ancestors` includes Oriva domains
- Confirm no conflicting `X-Frame-Options` headers

### 3. Validate Build Process
```bash
# Test your build locally
npm run build
# or
npm run vercel-build

# Verify no errors in build output
```

### 4. Production API Testing

```bash
# Test your proxy endpoint directly
curl -H "X-Client-ID: your-app-name" \
     "https://your-app.vercel.app/api/oriva/profiles"

# Test with different origins
curl -H "X-Client-ID: your-app-name" \
     -H "Origin: https://oriva.io" \
     "https://your-app.vercel.app/api/oriva/profiles"

# Verify rate limiting works
for i in {1..10}; do
  curl -H "X-Client-ID: test-client" \
       "https://your-app.vercel.app/api/oriva/profiles"
done
```

### 5. Production Validation Checklist

#### **Security & Authentication**
- [ ] API keys stored server-side only (never in client bundle)
- [ ] BFF proxy endpoints implement proper authentication
- [ ] Rate limiting configured and tested
- [ ] CORS origins restricted to approved domains only
- [ ] No sensitive data visible in browser network tab

#### **Integration & Performance**
- [ ] App loads in iframe without console errors
- [ ] CSP headers configured with `frame-ancestors` directive
- [ ] X-Frame-Options removed or set to allow embedding
- [ ] API calls succeed from iframe context
- [ ] App responds within 3 seconds in production
- [ ] Graceful fallback to demo data when API fails

#### **Production Deployment**
- [ ] Build process completes successfully
- [ ] HTTPS enabled for production deployment
- [ ] Environment variables set correctly on hosting platform
- [ ] Absolute URLs used for iframe contexts
- [ ] Mobile responsive design implemented
- [ ] Error monitoring and logging configured

#### **API Integration**
- [ ] Profiles load correctly from Oriva API
- [ ] Error handling works for API failures
- [ ] Data source pattern implemented with fallbacks
- [ ] No client-side credential dependencies

---

## 📚 Next Steps

### Learn More

- **📖 [Complete API Reference](./public/developer-guide/api-reference-complete.md)** - Complete API documentation with security-first patterns and comprehensive examples
- **🔗 [API Headers Reference](./public/developer-guide/api-headers-reference.md)** - Comprehensive header documentation and security best practices
- **🛠️ [API Troubleshooting Guide](./public/developer-guide/api-troubleshooting-guide.md)** - Systematic debugging workflow and common issue resolution
- **🎮 [App Integration Requirements](./public/developer-guide/app-integration-requirements.md)** - Technical integration specifications
- **🧪 [API Tester](api-tester.html)** - Interactive tool to test Oriva Platform APIs
- **🔧 [API Examples](https://github.com/0riva/oriva-platform/tree/main/examples)** - Integration examples (coming soon)
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
- ✅ **Integrated with the API** for seamless functionality
- ✅ **Published your app** to the marketplace

**Ready to build the next generation of development tools?** Start building with the Oriva Platform API today!

---

**Built with ❤️ by the Oriva Team**