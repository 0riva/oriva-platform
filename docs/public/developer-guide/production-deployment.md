# 🚀 Production Deployment Guide

> **Deploy your Oriva-integrated app to production with confidence**

This guide walks you through deploying your Oriva-integrated application to production, ensuring security, performance, and reliability.

---

## 📋 Pre-Deployment Checklist

Before deploying to production, ensure you have:

- ✅ **Live API Key**: Generated from Oriva Admin portal (format: `oriva_pk_live_...`)
- ✅ **Production Domain**: HTTPS-enabled domain or subdomain
- ✅ **CSP Headers**: Properly configured Content Security Policy
- ✅ **BFF Proxy**: Backend for Frontend proxy for API key security
- ✅ **Error Handling**: Comprehensive error handling and logging
- ✅ **Testing**: All API integrations tested in development
- ✅ **Rate Limiting**: Implemented to prevent abuse
- ✅ **HTTPS**: SSL/TLS certificate configured
- ✅ **Environment Variables**: Secrets properly managed
- ✅ **Monitoring**: Error tracking and performance monitoring setup

---

## 🏗️ Architecture Requirements

### 1. Backend for Frontend (BFF) Pattern

**❌ Never expose API keys in client-side code:**
```javascript
// ❌ WRONG - API key exposed in browser
const response = await fetch('https://api.oriva.io/api/v1/user/me', {
  headers: { 'Authorization': 'Bearer oriva_pk_live_...' }
});
```

**✅ Use a backend proxy:**
```javascript
// ✅ CORRECT - API key stays on server
const response = await fetch('https://your-app.com/api/oriva/user/me');
```

### 2. Security Headers

Configure these headers on your production domain:

```http
Content-Security-Policy: frame-ancestors https://oriva.io https://*.oriva.io
X-Frame-Options: ALLOW-FROM https://oriva.io
Access-Control-Allow-Origin: https://oriva.io
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

---

## 🔧 Deployment Platforms

### Vercel Deployment

**1. Install Vercel CLI:**
```bash
npm install -g vercel
vercel login
```

**2. Configure `vercel.json`:**
```json
{
  "env": {
    "ORIVA_API_KEY": "@oriva_api_key_live",
    "NODE_ENV": "production"
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "frame-ancestors https://oriva.io https://*.oriva.io"
        },
        {
          "key": "X-Frame-Options",
          "value": "ALLOW-FROM https://oriva.io"
        }
      ]
    }
  ]
}
```

**3. Add Environment Variables:**
```bash
# Add production API key
vercel env add ORIVA_API_KEY production
# Paste your live API key when prompted

# Deploy to production
vercel --prod
```

### Netlify Deployment

**1. Configure `netlify.toml`:**
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[headers]]
  for = "/*"
  [headers.values]
    Content-Security-Policy = "frame-ancestors https://oriva.io https://*.oriva.io"
    X-Frame-Options = "ALLOW-FROM https://oriva.io"
    X-Content-Type-Options = "nosniff"
```

**2. Add Environment Variables:**
- Go to Netlify Dashboard → Site Settings → Environment Variables
- Add `ORIVA_API_KEY` with your live API key
- Deploy via Git or CLI

### Custom Server (Node.js/Express)

**1. Use environment variables:**
```javascript
// server.js
require('dotenv').config();
const express = require('express');
const app = express();

// Security headers
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', 'frame-ancestors https://oriva.io https://*.oriva.io');
  res.setHeader('X-Frame-Options', 'ALLOW-FROM https://oriva.io');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

// BFF proxy endpoint
app.get('/api/oriva/user/me', async (req, res) => {
  const response = await fetch('https://api.oriva.io/api/v1/user/me', {
    headers: {
      'Authorization': `Bearer ${process.env.ORIVA_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  const data = await response.json();
  res.json(data);
});

app.listen(process.env.PORT || 3000);
```

**2. Deploy with PM2:**
```bash
npm install -g pm2

# Start app
pm2 start server.js --name oriva-app

# Configure environment
pm2 set pm2:env ORIVA_API_KEY=oriva_pk_live_...

# Save configuration
pm2 save
pm2 startup
```

---

## 🔐 Environment Variable Management

### Production Environment Variables

```bash
# Required
ORIVA_API_KEY=oriva_pk_live_xxx  # Your live API key
NODE_ENV=production

# Optional (recommended)
SENTRY_DSN=https://...            # Error tracking
LOG_LEVEL=info                    # Logging level
RATE_LIMIT_MAX=100                # Requests per window
RATE_LIMIT_WINDOW=900000          # 15 minutes in ms
```

### Secret Management Best Practices

1. **Never commit secrets:**
   ```gitignore
   .env
   .env.local
   .env.production
   ```

2. **Use platform secret management:**
   - Vercel: `vercel env add`
   - Netlify: Dashboard → Environment Variables
   - AWS: Secrets Manager or Parameter Store
   - GCP: Secret Manager
   - Azure: Key Vault

3. **Rotate keys regularly:**
   - Generate new live keys monthly
   - Update all production environments
   - Revoke old keys after verification

---

## 🧪 Pre-Production Testing

### Staging Environment

Deploy to staging first:

```bash
# Vercel staging deployment
vercel

# Test staging URL
curl https://your-app-staging.vercel.app/api/health
```

### Testing Checklist

- [ ] **API Authentication**: Verify API key works
- [ ] **CSP Headers**: Test iframe loading in Oriva
- [ ] **Error Handling**: Test error scenarios
- [ ] **Rate Limiting**: Verify rate limits work
- [ ] **HTTPS**: Confirm SSL certificate valid
- [ ] **Performance**: Check response times < 200ms
- [ ] **Mobile**: Test on mobile devices
- [ ] **Cross-Browser**: Test in Chrome, Firefox, Safari
- [ ] **Security Scan**: Run security vulnerability scan

---

## 📊 Post-Deployment Verification

### 1. Health Check

Test your production endpoint:

```bash
curl https://your-app.com/api/health
# Expected: {"status":"ok","timestamp":"2025-10-01T..."}
```

### 2. API Integration Test

Verify Oriva API integration:

```bash
curl https://your-app.com/api/oriva/user/me \
  -H "Cookie: oriva_session=..."
# Expected: {"userId":"...", "email":"...", ...}
```

### 3. CSP Header Verification

Check security headers:

```bash
curl -I https://your-app.com
# Look for:
# Content-Security-Policy: frame-ancestors https://oriva.io...
# X-Frame-Options: ALLOW-FROM https://oriva.io
```

### 4. Iframe Loading Test

Test in Oriva platform:
1. Go to https://oriva.io/dashboard
2. Launch your app
3. Verify iframe loads without errors
4. Check browser console for CSP violations

---

## 🚨 Common Production Issues

### Issue: CORS Errors

**Symptom**: API calls fail with CORS errors

**Solution**:
```javascript
// Add CORS headers to BFF proxy
res.setHeader('Access-Control-Allow-Origin', 'https://oriva.io');
res.setHeader('Access-Control-Allow-Credentials', 'true');
```

### Issue: CSP Violations

**Symptom**: Iframe blocked by Content Security Policy

**Solution**:
```http
Content-Security-Policy: frame-ancestors https://oriva.io https://*.oriva.io
```

### Issue: API Key Invalid

**Symptom**: `401 Unauthorized` or `INVALID_API_KEY`

**Solution**:
1. Verify using live key (not test key)
2. Check environment variable name
3. Regenerate key in Oriva Admin portal

### Issue: Rate Limiting

**Symptom**: `429 Too Many Requests`

**Solution**:
1. Implement client-side rate limiting
2. Cache responses where appropriate
3. Use exponential backoff for retries

---

## 📈 Monitoring & Logging

### Error Tracking

**Sentry Integration:**
```javascript
const Sentry = require('@sentry/node');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: 'production',
  tracesSampleRate: 1.0,
});

// Track Oriva API errors
try {
  const response = await fetchOrivaAPI();
} catch (error) {
  Sentry.captureException(error, {
    tags: { source: 'oriva-api' }
  });
}
```

### Performance Monitoring

Track key metrics:
- API response times
- Error rates
- User session duration
- Iframe load time

### Logging Best Practices

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Log API calls
logger.info('Oriva API request', {
  endpoint: '/api/v1/user/me',
  duration: responseTime,
  status: response.status
});
```

---

## 🔄 Rollback Procedures

### Quick Rollback

**Vercel:**
```bash
# List recent deployments
vercel ls

# Rollback to previous deployment
vercel rollback [deployment-url]
```

**Git-based:**
```bash
# Revert to previous commit
git revert HEAD
git push origin main

# Or reset to specific commit
git reset --hard [commit-hash]
git push --force origin main
```

---

## 📚 Additional Resources

- **[Complete Integration Guide](../START_GUIDE.md)** - Full development guide
- **[API Reference](./api-reference-complete.md)** - Complete API documentation
- **[Security Best Practices](./authentication-patterns.md)** - Security patterns
- **[Troubleshooting Guide](./api-troubleshooting-guide.md)** - Common issues

---

## 🆘 Support

If you encounter issues during deployment:

1. **Documentation**: Check [troubleshooting guide](./api-troubleshooting-guide.md)
2. **Community**: Post in Oriva Developer Forums
3. **Support**: Email dev-support@oriva.io
4. **Status**: Check status.oriva.io for platform status

---

**Ready to deploy?** Follow this guide step-by-step and reach out if you need help!
