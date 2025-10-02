# Quick Start Guide for Oriva Platform Integration

**Time to First Success**: ~15 minutes

## Prerequisites Checklist

Before you begin, ensure you have:
- [ ] Node.js 18+ and npm installed
- [ ] Oriva developer account and API key from the developer dashboard
- [ ] Code editor (VS Code recommended)

## Step 1: Set Up Your Project

```bash
# Create a new project directory
mkdir my-oriva-integration
cd my-oriva-integration

# Initialize npm project
npm init -y

# Install required dependencies
npm install node-fetch dotenv
npm install -D typescript @types/node ts-node
```

## Step 2: Configure Environment Variables

Create a `.env` file in your project root:

```bash
# Required: Get your API key from the Oriva developer dashboard
ORIVA_API_KEY=oriva_pk_test_your_key_here

# API Base URL (use production URL when ready)
ORIVA_BASE_URL=https://api.oriva.io
```

**🔐 Security Note**: Never commit `.env` to version control. Add it to `.gitignore`.

## Step 3: Create Your First Integration

Create `index.js`:

```javascript
require('dotenv').config();
const fetch = require('node-fetch');

const ORIVA_BASE_URL = process.env.ORIVA_BASE_URL || 'https://api.oriva.io';
const ORIVA_API_KEY = process.env.ORIVA_API_KEY;

// Reusable API client
async function callOrivaAPI(endpoint, options = {}) {
  if (!ORIVA_API_KEY) {
    throw new Error('ORIVA_API_KEY not configured');
  }

  const url = `${ORIVA_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${ORIVA_API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// Example 1: Get current user
async function getCurrentUser() {
  try {
    const data = await callOrivaAPI('/api/v1/user/me');
    console.log('✅ Current User:', data.data);
    return data.data;
  } catch (error) {
    console.error('❌ Error fetching user:', error.message);
  }
}

// Example 2: List available profiles
async function listProfiles() {
  try {
    const data = await callOrivaAPI('/api/v1/profiles/available');
    console.log('✅ Available Profiles:', data.data.length);
    return data.data;
  } catch (error) {
    console.error('❌ Error fetching profiles:', error.message);
  }
}

// Example 3: Browse marketplace apps
async function browseMarketplace() {
  try {
    const data = await callOrivaAPI('/api/v1/marketplace/apps?limit=5');
    console.log('✅ Marketplace Apps:', data.data.length);
    data.data.forEach(app => {
      console.log(`  - ${app.name} (${app.category})`);
    });
    return data.data;
  } catch (error) {
    console.error('❌ Error fetching marketplace:', error.message);
  }
}

// Run all examples
async function main() {
  console.log('🚀 Testing Oriva Platform API Integration\n');

  await getCurrentUser();
  console.log();

  await listProfiles();
  console.log();

  await browseMarketplace();
  console.log();

  console.log('✨ Integration test complete!');
}

main();
```

## Step 4: Run Your Integration

```bash
# Run the integration
node index.js
```

**Expected Output**:
```
🚀 Testing Oriva Platform API Integration

✅ Current User: { id: 'ext_user_...', name: '...' }

✅ Available Profiles: 2

✅ Marketplace Apps: 5
  - Task Manager Pro (productivity)
  - Code Reviewer (development)
  - Analytics Dashboard (analytics)
  ...

✨ Integration test complete!
```

## TypeScript Version

For TypeScript projects, create `index.ts`:

```typescript
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

interface OrivaResponse<T> {
  ok: boolean;
  success: boolean;
  data: T;
  meta?: any;
}

class OrivaClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.ORIVA_BASE_URL || 'https://api.oriva.io';
    this.apiKey = process.env.ORIVA_API_KEY || '';

    if (!this.apiKey) {
      throw new Error('ORIVA_API_KEY environment variable required');
    }
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error((error as any).error || `HTTP ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  async getCurrentUser() {
    return this.request<OrivaResponse<any>>('/api/v1/user/me');
  }

  async listProfiles() {
    return this.request<OrivaResponse<any[]>>('/api/v1/profiles/available');
  }

  async browseMarketplace(limit = 10) {
    return this.request<OrivaResponse<any[]>>(`/api/v1/marketplace/apps?limit=${limit}`);
  }
}

// Usage
async function main() {
  const client = new OrivaClient();

  try {
    const user = await client.getCurrentUser();
    console.log('User:', user.data);

    const profiles = await client.listProfiles();
    console.log('Profiles:', profiles.data.length);

    const apps = await client.browseMarketplace(5);
    console.log('Apps:', apps.data.length);
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
```

Run with: `npx ts-node index.ts`

## What's Next?

### Essential Patterns for Building Integrations

**1. Server-Side Proxy Pattern** (Recommended for web apps):

```javascript
// server.js - Your backend API
const express = require('express');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();

// Proxy endpoint - keeps API key secure
app.get('/api/oriva-proxy/user/me', async (req, res) => {
  try {
    const response = await fetch('https://api.oriva.io/api/v1/user/me', {
      headers: {
        'Authorization': `Bearer ${process.env.ORIVA_API_KEY}`
      }
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000);
```

**2. Error Handling with Retry**:

```javascript
async function callOrivaWithRetry(endpoint, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await callOrivaAPI(endpoint);
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      // Exponential backoff
      await new Promise(resolve =>
        setTimeout(resolve, Math.pow(2, i) * 1000)
      );
    }
  }
}
```

**3. Response Caching**:

```javascript
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getCachedData(endpoint) {
  const cached = cache.get(endpoint);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const data = await callOrivaAPI(endpoint);
  cache.set(endpoint, { data, timestamp: Date.now() });
  return data;
}
```

### Next Steps

- **[API Endpoints Index](./api-endpoints-index.md)** - Complete endpoint reference
- **[API Reference](./api-reference-complete.md)** - Full API documentation
- **[Authentication Patterns](./authentication-patterns.md)** - Secure auth flows
- **[Error Handling Guide](./api-troubleshooting-guide.md)** - Debug common issues

## Common First-Time Issues

### "API Key Invalid" Error
- Verify your API key in the Oriva developer dashboard
- Ensure there are no extra spaces in your `.env.local` file
- Check that environment variables are being loaded correctly

### "CORS Error" in Browser
- Use the provided proxy configuration in development
- Ensure you're using `http://localhost:3000` (not `127.0.0.1`)
- Check that your client ID is registered for localhost development

### "Cannot Connect to Database"
- Verify your database credentials
- Ensure your database allows connections from your IP
- Check firewall and network settings

## Getting Help

- **Documentation**: [Complete Developer Guide](./README.md)
- **Community**: GitHub Issues and Discussions
- **Support**: GitHub Issues for technical support
- **Sample Apps**: Check out example implementations on GitHub

## Ready for Production?

When you're ready to deploy:

1. **Security Review**: Audit your authentication and data handling
2. **Environment Setup**: Configure production environment variables
3. **Performance Testing**: Test with expected user load
4. **Documentation**: Review [Security Warning](./SECURITY-WARNING.md) for final security checks

---

**Tip**: Keep this guide handy during development. Most integration issues can be resolved by reviewing these basic steps.