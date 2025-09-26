# API Headers Reference Guide

**Complete header documentation for secure Oriva Platform integration**

## 📋 Quick Start Checklist

✅ Use `Authorization: Bearer` header with your API key
✅ Include `User-Agent` with your app name and version
✅ Add `X-Client-ID` for request identification
✅ Test in production environment for CORS compatibility

---

## 🔑 Required Headers

### Authorization (Required)
```http
Authorization: Bearer oriva_pk_live_your_api_key_here
```

**Security Note**: Never expose API keys in client-side code. Use environment variables and server-side proxy patterns.

### Content-Type (Required for POST/PUT)
```http
Content-Type: application/json
```

---

## 🎯 Recommended Headers

### User-Agent (Highly Recommended)
Helps with debugging and analytics:
```http
User-Agent: your-app-name/1.0.0 (web)
User-Agent: your-app-name/2.1.3 (mobile)
```

### X-Client-ID (Recommended)
Identifies your application for support:
```http
X-Client-ID: your-app-name
```

---

## ⚙️ Optional Headers

### X-User-ID
For user context in multi-user applications:
```http
X-User-ID: user_12345
```

### X-Request-ID
For request tracing and debugging:
```http
X-Request-ID: req_abc123def456
```

---

## 🌐 CORS Policy & Allowed Headers

### Currently Allowed Headers
- `Content-Type`
- `Authorization`
- `X-Extension-ID`
- `X-Client-ID`
- `User-Agent`
- `X-User-ID`
- `X-Request-ID`

### Need Additional Headers?
1. Create a GitHub issue with your header requirements
2. Include your header name and specific use case
3. Our team will review and update the CORS policy

---

## 💻 Code Examples

### JavaScript/Fetch (Secure Pattern)
```javascript
// Use environment variables or server-side proxy
const apiKey = process.env.ORIVA_API_KEY; // Server-side only

fetch('https://api.oriva.io/api/v1/profiles/available', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'User-Agent': 'your-app-name/1.0.0 (web)',
    'X-Client-ID': 'your-app-name'
  }
});
```

### Server-Side Proxy Pattern (Recommended)
```javascript
// Client-side: Call your own API
fetch('/api/oriva/profiles')

// Server-side: Proxy to Oriva with credentials
app.get('/api/oriva/profiles', async (req, res) => {
  const response = await fetch('https://api.oriva.io/api/v1/profiles/available', {
    headers: {
      'Authorization': `Bearer ${process.env.ORIVA_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  res.json(await response.json());
});
```

### cURL
```bash
curl -X GET "https://api.oriva.io/api/v1/profiles/available" \
  -H "Authorization: Bearer oriva_pk_live_..." \
  -H "Content-Type: application/json" \
  -H "User-Agent: your-app/1.0.0" \
  -H "X-Client-ID: your-app"
```

### Python/Requests
```python
import requests
import os

headers = {
    'Authorization': f'Bearer {os.getenv("ORIVA_API_KEY")}',
    'Content-Type': 'application/json',
    'User-Agent': 'your-app/1.0.0 (python)',
    'X-Client-ID': 'your-app'
}

response = requests.get(
    'https://api.oriva.io/api/v1/profiles/available',
    headers=headers
)
```

---

## ✅ Security Checklist

### Headers & Authentication
- [ ] Using secure `Authorization: Bearer` header
- [ ] API keys stored in environment variables (never in code)
- [ ] Using server-side proxy for sensitive operations
- [ ] Including `User-Agent` with app name/version
- [ ] Using `X-Client-ID` for request identification

### CORS & Security
- [ ] Test CORS in production environment
- [ ] No custom headers without Oriva approval
- [ ] All requests use HTTPS
- [ ] Proper error handling for auth failures

---

## 🔧 Troubleshooting Common Issues

### CORS Errors
If you see CORS errors in the browser console:

1. **Check your origin**: Make sure your app domain is registered
2. **Verify headers**: Use only allowed headers from the list above
3. **Test preflight**: OPTIONS requests should return proper CORS headers

### Authentication Errors (401 Unauthorized)

**Most Common Issue**: Missing or invalid API key

#### ✅ **Solutions:**

1. **Verify API Key Format**:
   ```javascript
   // ✅ Correct format
   const apiKey = 'oriva_pk_live_abcd1234...';

   // ❌ Wrong format
   const apiKey = 'pk_live_abcd1234...'; // Missing 'oriva_' prefix
   ```

2. **Test Your API Key**:
   ```bash
   curl -H "Authorization: Bearer oriva_pk_live_your_key_here" \
        https://api.oriva.io/api/v1/profiles/available
   ```

3. **Check Environment Variables**:
   ```javascript
   // Verify your key is loaded correctly
   console.log('API Key loaded:', process.env.ORIVA_API_KEY ? 'Yes' : 'No');
   ```

#### 🚨 **Still Getting 401?**
- Check API key permissions in your Oriva developer settings
- Verify key is active and not expired
- Contact support with your app name and key prefix (first 20 characters only)

---

## 📈 API Limits & Performance

### Rate Limits
- **Standard Rate Limit**: 1000 requests per 15 minutes per IP
- **Burst Protection**: Automatic rate limiting during high traffic
- **Headers Included**: Rate limit status in response headers

### Performance Best Practices
- Cache API responses when appropriate
- Use batch endpoints for multiple operations
- Implement retry logic with exponential backoff
- Monitor response times and error rates

---

## 🔄 API Versioning

- **Current Version**: v1
- **Base URL**: `https://api.oriva.io/api/v1/`
- **Deprecation Policy**: 6-month notice for breaking changes

---

**Security Note**: Always store API keys securely and never expose them in client-side code. Use server-side proxy patterns for sensitive operations.

*Last Updated: January 2025*