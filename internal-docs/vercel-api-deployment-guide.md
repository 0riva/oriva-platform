# Vercel API Deployment Guide for Oriva Platform

## 🚀 Overview

This document outlines the complete process and requirements for successfully deploying the Oriva Platform API to Vercel, including all the issues encountered and their solutions.

## 📋 Prerequisites

### Required Environment Variables in Vercel

The following environment variables must be configured in the Vercel dashboard:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
SUPABASE_ANON_KEY=sb_publishable_...
ORIVA_ADMIN_TOKEN=your-admin-token
NODE_ENV=production
```

### Required Dependencies in `api/package.json`

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "@supabase/supabase-js": "^2.39.0",
    "dotenv": "^16.3.1",
    "express-rate-limit": "^7.1.5",
    "express-validator": "^7.0.1",
    "winston": "^3.11.0"
  }
}
```

## 🔧 Deployment Configuration

### Vercel Configuration (`vercel.json`)

```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/index.js",
      "use": "@vercel/node@3.1.0"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/index.js"
    },
    {
      "src": "/(.*)",
      "dest": "/api/index.js"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

### API Export Format

The API must export a Vercel-compatible handler:

```javascript
// Export for Vercel (serverless function format)
module.exports = (req, res) => {
  // Handle the request with Express app
  app(req, res);
};
```

## 🐛 Issues Encountered and Solutions

### 1. Missing Dependencies

**Problem**: API was failing with `FUNCTION_INVOCATION_FAILED` due to missing packages.

**Error**: `Cannot find module 'winston'`

**Solution**: Added all required dependencies to `api/package.json`:
- `winston` - for logging
- `express-rate-limit` - for rate limiting
- `express-validator` - for input validation

### 2. Routing Issues

**Problem**: All endpoints returning 404 "Endpoint not found" errors.

**Root Cause**: Premature catch-all route (`app.use('*', ...)`) was intercepting requests before they reached the marketplace endpoints.

**Solution**: Removed the first catch-all route that was placed before the marketplace endpoints definition.

### 3. Git Ignore Configuration

**Problem**: API code wasn't being committed to the repository.

**Root Cause**: `api/` directory was in `.gitignore`, preventing deployment.

**Solution**: Removed `api/` from `.gitignore` to allow API code to be committed and deployed.

### 4. Environment Variables

**Problem**: API was crashing during Supabase initialization.

**Root Cause**: Missing `SUPABASE_SERVICE_ROLE_KEY` in Vercel environment variables.

**Solution**: Configured all required environment variables in Vercel dashboard.

## 🚀 Deployment Process

### 1. Code Preparation

```bash
# Ensure all dependencies are in api/package.json
# Ensure API code is committed (not in .gitignore)
# Ensure proper export format for Vercel
```

### 2. Environment Variables Setup

1. Go to Vercel Dashboard → Project → Settings → Environment Variables
2. Add all required variables (see Prerequisites section)
3. Ensure they're set for Production environment

### 3. Deployment

```bash
# Commit and push changes
git add .
git commit -m "Deploy API with all fixes"
git push origin main

# Deploy to Vercel
npx vercel --prod
```

### 4. Verification

```bash
# Test health endpoint
curl https://api.oriva.io/api/v1/health

# Test marketplace endpoint (should return 401 for invalid key)
curl -H "Authorization: Bearer test_key" https://api.oriva.io/api/v1/marketplace/apps
```

## ✅ Success Indicators

### API is Working When:

1. **Health endpoint responds** with version and features
2. **Marketplace endpoints return 401** (not 404) for invalid API keys
3. **API key validation is working** (checking against Supabase)
4. **All endpoints are reachable** (no routing issues)

### Expected Responses:

```json
// Health endpoint
{
  "status": "healthy",
  "timestamp": "2025-09-12T03:57:59.461Z",
  "version": "1.0.3",
  "features": ["marketplace", "profiles", "groups", "privacy-first"]
}

// Marketplace endpoint (with invalid key)
{
  "success": false,
  "error": "Invalid API key"
}
```

## 🔍 Troubleshooting

### Common Issues:

1. **404 "Endpoint not found"** → Check routing configuration
2. **FUNCTION_INVOCATION_FAILED** → Check dependencies in `api/package.json`
3. **API crashes on startup** → Check environment variables in Vercel
4. **Old version deployed** → Force new deployment with `npx vercel --prod`

### Debugging Commands:

```bash
# Check deployment logs
npx vercel logs <deployment-url>

# Test local API
npm run dev
curl http://localhost:3001/api/v1/health

# Force new deployment
npx vercel --prod
```

## 📚 Key Learnings

1. **Vercel requires specific export format** for serverless functions
2. **All dependencies must be in `api/package.json`** (not root package.json)
3. **Environment variables are critical** for Supabase integration
4. **Route order matters** - catch-all routes can block other endpoints
5. **Git ignore configuration affects deployment** - API code must be committed

## 🎯 Final Status

The Oriva Platform API is now fully functional on Vercel with:

- ✅ **All marketplace endpoints working**
- ✅ **API key validation against Supabase**
- ✅ **External developer app submission capability**
- ✅ **Proper error handling and logging**
- ✅ **Production-ready security and rate limiting**

External developers can now successfully submit apps to the marketplace using the API endpoints.

---

**Last Updated**: September 12, 2025  
**Deployment Status**: ✅ Production Ready  
**API Version**: 1.0.3
