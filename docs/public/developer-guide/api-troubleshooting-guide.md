# API Troubleshooting Guide

**Systematic debugging workflow and common issue resolution for secure Oriva Platform integration**

## 🚨 Quick Diagnostic Checklist

Before investigating complex issues, verify these basics:

- [ ] API server is accessible
- [ ] Valid API key format (`oriva_pk_live_...`)
- [ ] Required headers included
- [ ] Endpoint URL is correct
- [ ] JSON request body is valid
- [ ] Using HTTPS for all requests

## 🔍 Problem Verification Framework

### Essential Questions Before Debugging

When experiencing API issues, always ask:

1. **What specific behavior are you seeing?**
   - Empty responses? `{"success": true, "data": []}`
   - Error messages? HTTP status codes?
   - Timeouts or connection issues?

2. **What's the exact API response?**
   ```bash
   # Get full response details (replace with your endpoint)
   curl -v -H "Authorization: Bearer YOUR_API_KEY" \
        "https://api.oriva.io/api/v1/profiles/available"
   ```

3. **What data do you expect vs. what you're getting?**
   - Compare expected response structure with actual
   - Check for missing properties or null values

4. **When did this start happening?**
   - After API key changes?
   - Recent permission updates?
   - Specific timing or patterns?

## 🛠️ Systematic Debugging Workflow

### Step 1: Basic Connectivity
```bash
# Test API health
curl https://api.oriva.io/api/v1/health

# Expected response
{
  "success": true,
  "status": "healthy",
  "timestamp": "2025-01-26T12:00:00Z"
}
```

### Step 2: Authentication Verification
```bash
# Test your API key
curl -H "Authorization: Bearer oriva_pk_live_your_key" \
     https://api.oriva.io/api/v1/profiles/available

# Check for 200 vs 401 status
```

### Step 3: Header Validation
```bash
# Complete header test
curl -v \
  -H "Authorization: Bearer oriva_pk_live_your_key" \
  -H "Content-Type: application/json" \
  -H "User-Agent: your-app/1.0.0" \
  -H "X-Client-ID: your-app" \
  https://api.oriva.io/api/v1/profiles/available
```

### Step 4: Environment Comparison
Test the same request in different environments:
- Development vs Production
- Different networks/IPs
- Browser vs command line
- Different API keys

## 🔧 Common Issues & Solutions

### Issue 1: Empty Response Data

**Symptom:**
```json
{
  "success": true,
  "data": []
}
```

**Debugging Steps:**
1. **Check API Key Permissions**: Your key might not have access to the requested resource
2. **Verify User Context**: Some endpoints require specific user permissions
3. **Test with Different Endpoints**: Try a simpler endpoint like `/api/v1/user/me`

**Solutions:**
```bash
# Test different permission levels
curl -H "Authorization: Bearer your_key" https://api.oriva.io/api/v1/user/me
curl -H "Authorization: Bearer your_key" https://api.oriva.io/api/v1/profiles/available
```

### Issue 2: CORS Errors

**Symptom:**
```
Access to fetch at 'https://api.oriva.io/...' from origin 'http://localhost:3000'
has been blocked by CORS policy
```

**Solutions:**
1. **Use Server-Side Proxy** (Recommended):
   ```javascript
   // Instead of direct browser calls
   fetch('/api/proxy/oriva/profiles') // Your server endpoint
   ```

2. **Verify Allowed Origins**: Check your app settings in Oriva developer console

3. **Check Headers**: Only use [allowed headers](./api-headers-reference.md#cors-policy--allowed-headers)

### Issue 3: Authentication Failures (401)

**Symptom:**
```json
{
  "error": "Unauthorized",
  "status": 401
}
```

**Debugging Steps:**
1. **Verify API Key Format**:
   ```javascript
   // ✅ Correct
   'oriva_pk_live_abc123...'
   'oriva_pk_test_abc123...'

   // ❌ Wrong
   'pk_live_abc123...'     // Missing 'oriva_' prefix
   'live_abc123...'        // Wrong format
   ```

2. **Check Environment Variables**:
   ```javascript
   console.log('Key loaded:', !!process.env.ORIVA_API_KEY);
   console.log('Key prefix:', process.env.ORIVA_API_KEY?.substring(0, 15));
   ```

3. **Test Key Directly**:
   ```bash
   # Replace with your actual key
   curl -H "Authorization: Bearer oriva_pk_live_your_actual_key" \
        https://api.oriva.io/api/v1/user/me
   ```

**Solutions:**
- Regenerate API key in Oriva developer settings
- Verify key permissions and scope
- Check for typos in environment variables

### Issue 4: Rate Limiting (429)

**Symptom:**
```json
{
  "error": "Too Many Requests",
  "status": 429,
  "retryAfter": 60
}
```

**Solutions:**
1. **Implement Exponential Backoff**:
   ```javascript
   async function apiCallWithRetry(url, options, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         const response = await fetch(url, options);
         if (response.status === 429) {
           const retryAfter = response.headers.get('Retry-After') || (2 ** i);
           await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
           continue;
         }
         return response;
       } catch (error) {
         if (i === maxRetries - 1) throw error;
       }
     }
   }
   ```

2. **Cache Responses**: Avoid repeated calls for the same data
3. **Batch Requests**: Use batch endpoints when available

### Issue 5: Timeout Errors

**Symptom:**
```
TypeError: Failed to fetch
// or
Request timeout
```

**Solutions:**
1. **Increase Timeout**:
   ```javascript
   const controller = new AbortController();
   const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s

   fetch(url, {
     signal: controller.signal,
     headers: { /* ... */ }
   })
   .finally(() => clearTimeout(timeoutId));
   ```

2. **Check Network Connectivity**
3. **Verify API Endpoint Status**

## 🔒 Security Troubleshooting

### Issue: API Key Exposure

**Prevention:**
```javascript
// ❌ NEVER do this
const apiKey = 'oriva_pk_live_abc123...'; // Hardcoded
localStorage.setItem('apiKey', key);       // Client storage

// ✅ ALWAYS do this
const apiKey = process.env.ORIVA_API_KEY;  // Environment variable
// Store keys server-side only
```

### Issue: Insecure Authentication Patterns

**Avoid:**
```javascript
// ❌ Tokens in URLs
window.location.href = `/?token=${authToken}`;

// ❌ Tokens in localStorage
localStorage.setItem('auth_token', token);
```

**Use Instead:**
```javascript
// ✅ HTTP-only cookies
res.cookie('auth_token', token, { httpOnly: true, secure: true });

// ✅ Server-side sessions
req.session.authToken = token;
```

## 📊 Monitoring & Logging

### Essential Logging
```javascript
// Log API calls (without sensitive data)
console.log('API Call:', {
  endpoint: url,
  method: options.method,
  timestamp: new Date().toISOString(),
  userAgent: navigator.userAgent,
  // Never log: API keys, tokens, passwords
});

// Log errors with context
console.error('API Error:', {
  status: response.status,
  endpoint: url,
  errorMessage: error.message,
  timestamp: new Date().toISOString()
});
```

### Performance Monitoring
```javascript
// Track API response times
const startTime = performance.now();
const response = await fetch(url, options);
const endTime = performance.now();

console.log(`API call took ${endTime - startTime} milliseconds`);
```

## 🛡️ Security Best Practices

### During Troubleshooting
- **Never log API keys or tokens**
- **Use development/test keys for debugging**
- **Rotate keys if exposed during debugging**
- **Test security in isolated environments**

### Production Troubleshooting
- **Use monitoring tools** (not console.log)
- **Implement structured logging**
- **Set up alerts for error rates**
- **Monitor rate limit usage**

## 📋 Debug Checklist Template

Copy this checklist for systematic troubleshooting:

```
## Debug Session: [Date/Time]

### Environment
- [ ] Development / Staging / Production
- [ ] Browser: _____
- [ ] Network: _____
- [ ] API Key Type: test / live

### Basic Tests
- [ ] API health check passes
- [ ] Authentication returns 200
- [ ] Required headers included
- [ ] CORS configuration correct

### Specific Issue
- [ ] Problem description: _____
- [ ] Expected behavior: _____
- [ ] Actual behavior: _____
- [ ] Error messages: _____

### Resolution
- [ ] Root cause identified: _____
- [ ] Solution applied: _____
- [ ] Testing completed: _____
- [ ] Documentation updated: _____
```

## 🆘 Getting Help

### Before Contacting Support
1. Complete the debug checklist above
2. Test with curl to isolate browser-specific issues
3. Try with a fresh API key
4. Document exact error messages and response codes

### What to Include in Support Requests
- Complete error messages and HTTP status codes
- Your app configuration (without API keys)
- Steps to reproduce the issue
- Expected vs actual behavior
- Browser and environment details

### Community Resources
- **GitHub Issues**: Report bugs and request features
- **GitHub Discussions**: Ask questions and share solutions
- **Documentation**: Check our complete API reference

---

**Security Reminder**: Never share API keys, tokens, or other credentials when troubleshooting. Use development keys and sanitize all debugging output.

*Last Updated: January 2025*