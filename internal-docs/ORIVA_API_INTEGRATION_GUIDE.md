# Oriva API Integration Guide for Third-Party Developers

**For developers building independent apps that integrate with the Oriva platform**

Last Updated: January 2025
Version: 2.0
Reference Implementation: Work Buddy (oo-work-buddy)

---

## 📋 **Overview**

This guide shows third-party developers how to integrate with the Oriva platform API using the **Backend-for-Frontend (BFF) pattern**. Your app remains independent with its own hosting and database, while securely connecting to Oriva's API endpoints.

### **What You'll Learn**
- Set up BFF proxy endpoints for secure API integration
- Implement proper authentication and CORS handling
- Configure environment variables for development and production
- Handle iframe embedding and cross-origin communication
- Follow Oriva's security and privacy standards

---

## 🎯 **Integration Architecture**

### **BFF Pattern Overview**
```
Third-Party App (Frontend) → Your API Proxy (BFF) → Oriva Platform API
```

**Why BFF Pattern?**
- **Security**: API keys stay on your server, never exposed to client
- **CORS Control**: Your proxy handles cross-origin requests
- **Rate Limiting**: Implement your own rate limiting and caching
- **Flexibility**: Transform responses to match your app's needs
- **Compliance**: Meet Oriva's integration security standards

### **Reference Implementation**
Work Buddy demonstrates the complete integration pattern:
- **Location**: `Documents/oo-work-buddy/`
- **Live Example**: `https://oo-work-buddy.vercel.app`
- **API Proxy**: `api/oriva/*.js` endpoints

---

## 🔧 **Step 1: Environment Configuration**

### **Required Environment Variables**

Create a `.env` file with Oriva platform credentials:

```bash
# Oriva Platform Integration
EXPO_PUBLIC_ORIVA_API_URL=https://api.oriva.io/api/v1
EXPO_PUBLIC_ORIVA_API_KEY=your_oriva_api_key_here
EXPO_PUBLIC_ORIVA_CLIENT_ID=your-app-identifier

# Development URLs
EXPO_PUBLIC_SITE_URL=http://localhost:8081
EXPO_PUBLIC_AUTH_REDIRECT_BASE=http://localhost:8081

# Production URLs
EXPO_PUBLIC_PROD_SITE_URL=https://your-app.vercel.app
EXPO_PUBLIC_PROD_AUTH_REDIRECT_BASE=https://apps.oriva.io

# App Configuration
EXPO_PUBLIC_APP_VARIANT=development
EXPO_PUBLIC_APP_SCHEME=your-app-scheme

# Your App's Database (if using Supabase)
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
```

### **Environment-Aware Configuration**

Implement automatic environment detection:

```typescript
// src/config/environment.ts
const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
const defaultApiUrl = isLocalhost ? 'http://localhost:3001/api' : 'https://api.oriva.io/api/v1';

const detectEnvironmentUrls = () => {
  if (isLocalhost) {
    return {
      siteUrl: process.env.EXPO_PUBLIC_SITE_URL || 'http://localhost:8081',
      authRedirectBase: process.env.EXPO_PUBLIC_AUTH_REDIRECT_BASE || 'http://localhost:8081'
    };
  } else {
    return {
      siteUrl: process.env.EXPO_PUBLIC_PROD_SITE_URL || 'https://your-app.vercel.app',
      authRedirectBase: process.env.EXPO_PUBLIC_PROD_AUTH_REDIRECT_BASE || 'https://apps.oriva.io'
    };
  }
};

export const ENV = {
  // Oriva Platform
  ORIVA_API_URL: process.env.EXPO_PUBLIC_ORIVA_API_URL || defaultApiUrl,
  ORIVA_API_KEY: process.env.EXPO_PUBLIC_ORIVA_API_KEY || '',
  ORIVA_CLIENT_ID: process.env.EXPO_PUBLIC_ORIVA_CLIENT_ID || 'your-app',

  // Environment-aware URLs
  SITE_URL: environmentUrls.siteUrl,
  AUTH_REDIRECT_BASE: environmentUrls.authRedirectBase,

  // Computed flags
  get isDevelopment() { return this.APP_VARIANT === 'development'; },
  get isProduction() { return this.APP_VARIANT === 'production'; }
};
```

---

## 🔌 **Step 2: API Proxy Endpoints (BFF)**

### **Available Oriva API Endpoints**

Based on the [official API documentation](API_OVERVIEW.md):

- **`/api/v1/user`** - Current user information
- **`/api/v1/profiles`** - User profiles (privacy-protected)
- **`/api/v1/groups`** - Group management (sanitized IDs)
- **`/api/v1/entries`** - Entry management (CRUD)
- **`/api/v1/templates`** - Template system
- **`/api/v1/storage`** - Plugin-specific data storage
- **`/api/v1/ui`** - UI interaction API

### **BFF Endpoint Template**

Create proxy endpoints in your `api/oriva/` directory:

```javascript
// api/oriva/user.js - Example BFF endpoint
export default async function handler(req, res) {
  // CORS Headers
  const allowedOrigins = [
    'https://your-app.vercel.app',
    'https://apps.oriva.io',
    'https://oriva.io',
    'http://localhost:8081',
    'http://localhost:3000'
  ];

  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Client-ID, User-Agent, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Method validation
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    // Rate limiting (implement your own logic)
    // Basic client validation
    const clientId = req.headers['x-client-id'] || 'your-app';

    // Server-side API call to Oriva
    const orivaApiKey = process.env.EXPO_PUBLIC_ORIVA_API_KEY;
    const orivaApiUrl = process.env.EXPO_PUBLIC_ORIVA_API_URL || 'https://api.oriva.io/api/v1';

    if (!orivaApiKey) {
      return res.status(500).json({
        success: false,
        error: 'Server configuration error'
      });
    }

    const orivaResponse = await fetch(`${orivaApiUrl}/user`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${orivaApiKey}`,
        'X-Client-ID': clientId,
        'Content-Type': 'application/json',
        'User-Agent': 'YourApp-BFF/1.0.0'
      }
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
      message: data.message || 'Request successful'
    });

  } catch (error) {
    console.error('API proxy error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
}
```

### **Required BFF Endpoints**

Create these core endpoints for basic integration:

- **`api/oriva/user.js`** - Current user data
- **`api/oriva/profiles.js`** - User profiles
- **`api/oriva/groups.js`** - Group data
- **`api/oriva/entries.js`** - Entry management
- **`api/oriva/health.js`** - Health check

---

## 🌐 **Step 3: Frontend API Service**

### **API Service Client**

```typescript
// src/services/orivaApi.ts
const ORIVA_API_BASE = 'https://your-app.vercel.app/api/oriva';

export interface OrivaApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

class OrivaApiService {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = ORIVA_API_BASE;
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<OrivaApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'X-Client-ID': 'your-app-id',
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        success: true,
        data: data.data || data,
        message: data.message || 'Request successful',
      };
    } catch (error) {
      return {
        success: false,
        data: null as T,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async getCurrentUser() {
    return this.makeRequest('/user');
  }

  async getUserProfiles() {
    return this.makeRequest('/profiles');
  }

  async getGroups() {
    return this.makeRequest('/groups');
  }

  async getEntries(params?: { page?: number; limit?: number }) {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const endpoint = `/entries${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.makeRequest(endpoint);
  }
}

export const orivaApi = new OrivaApiService();
```

---

## 🛡️ **Step 4: Security & CORS Configuration**

### **Iframe Embedding Support**

Configure your app for iframe embedding in the Oriva platform:

```json
// vercel.json or equivalent hosting config
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "SAMEORIGIN"
        },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; frame-ancestors 'self' https://oriva.io https://*.oriva.io https://apps.oriva.io http://localhost:*; connect-src 'self' https: wss: https://api.oriva.io;"
        }
      ]
    }
  ]
}
```

### **CORS Best Practices**

1. **Whitelist Specific Origins**: Never use `*` in production
2. **Include Credentials**: Set `Access-Control-Allow-Credentials: true`
3. **Proper Headers**: Include `Authorization` in allowed headers
4. **Method Restrictions**: Only allow necessary HTTP methods

---

## 🚀 **Step 5: Deployment**

### **Environment Variables in Production**

Set these on your hosting platform (Vercel, Netlify, etc.):

```bash
# Required for all environments
EXPO_PUBLIC_ORIVA_API_URL=https://api.oriva.io/api/v1
EXPO_PUBLIC_ORIVA_API_KEY=your_production_api_key
EXPO_PUBLIC_ORIVA_CLIENT_ID=your-app-identifier

# Production URLs
EXPO_PUBLIC_PROD_SITE_URL=https://your-app.vercel.app
EXPO_PUBLIC_PROD_AUTH_REDIRECT_BASE=https://apps.oriva.io
```

### **Deployment Checklist**

- [ ] Environment variables configured in hosting platform
- [ ] API proxy endpoints deployed and working
- [ ] CORS headers properly configured
- [ ] Iframe embedding headers set
- [ ] SSL certificate active (HTTPS required)
- [ ] API endpoints return proper error responses
- [ ] Rate limiting implemented

---

## ✅ **Step 6: Testing Your Integration**

### **Health Check Endpoint**

```javascript
// api/oriva/health.js
export default async function handler(req, res) {
  return res.status(200).json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'your-app-api-proxy',
      version: '1.0.0'
    },
    message: 'API Proxy is operational'
  });
}
```

### **Testing Checklist**

- [ ] Health endpoint returns 200: `GET /api/oriva/health`
- [ ] User endpoint works: `GET /api/oriva/user`
- [ ] CORS headers present in responses
- [ ] API key authentication working
- [ ] Error responses properly formatted
- [ ] Rate limiting functional (if implemented)

---

## 📊 **Rate Limiting & Best Practices**

### **Recommended Rate Limits**

Based on Oriva API limits:

| Endpoint Type | Limit | Window |
|---------------|-------|---------|
| **User Data** | 120 requests | Per 15 minutes |
| **Profiles/Groups** | 60 requests | Per 15 minutes |
| **Entries** | 300 requests | Per 15 minutes |

### **Implementation Example**

```javascript
// Simple in-memory rate limiting
const rateLimitStore = new Map();

function rateLimit(req, clientId, limit = 60, window = 60000) {
  const key = `${clientId || req.ip}`;
  const now = Date.now();
  const requests = rateLimitStore.get(key) || [];

  // Clean old requests
  const validRequests = requests.filter(time => now - time < window);

  if (validRequests.length >= limit) {
    return false;
  }

  validRequests.push(now);
  rateLimitStore.set(key, validRequests);
  return true;
}
```

---

## 🔒 **Security Standards**

### **API Key Security**
- **Never expose API keys** in frontend code
- **Use environment variables** on server-side only
- **Implement request signing** for additional security
- **Rotate keys regularly** per Oriva guidelines

### **User Privacy**
- **Sanitized IDs**: Oriva returns `ext_` prefixed IDs for privacy
- **Minimal Data**: Only request data your app actually needs
- **User Consent**: Implement proper authorization flows
- **Data Retention**: Follow Oriva's data retention policies

### **Cross-Origin Security**
- **HTTPS Only**: Never use HTTP in production
- **Origin Validation**: Whitelist specific domains only
- **Credential Security**: Proper credential handling in CORS

---

## 🛠️ **Troubleshooting Common Issues**

### **CORS Errors**
```
Access to fetch at 'https://api.oriva.io' has been blocked by CORS policy
```
**Solution**: Use BFF pattern, don't call Oriva API directly from frontend

### **404 on API Endpoints**
```
Failed to load resource: the server responded with a status of 404
```
**Solution**: Ensure endpoint names match Oriva API exactly (`/profiles` not `/users`)

### **Authentication Errors**
```
HTTP 401: Unauthorized
```
**Solution**: Verify API key is set correctly in server environment

### **Frame Blocking**
```
Refused to display in a frame because it set 'X-Frame-Options' to 'deny'
```
**Solution**: Set `X-Frame-Options: SAMEORIGIN` and proper CSP headers

---

## 🎯 **Next Steps**

1. **Review Reference Implementation**: Study Work Buddy's codebase
2. **Get API Credentials**: Contact Oriva for your API key and client ID
3. **Set Up Development Environment**: Configure local development
4. **Implement Core Endpoints**: Start with user, profiles, and groups
5. **Deploy and Test**: Deploy to staging and test integration
6. **Submit for Review**: Submit your app to Oriva marketplace

---

## 📚 **Additional Resources**

- **[API Overview](API_OVERVIEW.md)** - Complete API documentation
- **[Oriva Platform API](https://api.oriva.io)** - Production API base URL
- **[Work Buddy Reference](https://github.com/oriva/oo-work-buddy)** - Complete working example
- **[Marketplace Guidelines](marketplace-guidelines.md)** - App submission requirements

---

**Need Help?** Contact the Oriva developer support team or review the Work Buddy implementation for a complete working example.

**Last Updated**: January 2025 | **Version**: 2.0