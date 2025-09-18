# 🔗 API Headers Guide for 3rd Party Developers

**Complete guide for integrating with Oriva Platform APIs**

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
User-Agent: work-buddy-app/2.1.3 (mobile)
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

### X-API-Key
Alternative authentication method (if configured):
```http
X-API-Key: your_alternative_api_key
```

---

## 🌐 CORS Policy & Allowed Headers

### Currently Allowed Headers
- `Content-Type`
- `Authorization`
- `X-Extension-ID`
- `X-Client-ID`
- `X-API-Key`
- `User-Agent`
- `X-User-ID`
- `X-Request-ID`

### Need Additional Headers?
1. Create a [GitHub issue](https://github.com/0riva/oriva-platform/issues/new) with the CORS header request template
2. Include your header name and specific use case
3. Our team will review and update the CORS policy

---

## 💻 Code Examples

### JavaScript/Fetch
```javascript
fetch('https://api.oriva.io/api/v1/profiles/available', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer oriva_pk_live_...',
    'Content-Type': 'application/json',
    'User-Agent': 'work-buddy-app/1.0.0 (web)',
    'X-Client-ID': 'work-buddy-app'
  }
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

headers = {
    'Authorization': 'Bearer oriva_pk_live_...',
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

## ✅ Pre-Launch Integration Checklist

### Headers & CORS
- [ ] Using standard `Authorization: Bearer` header
- [ ] Including `User-Agent` with app name/version
- [ ] Using `X-Client-ID` for request identification
- [ ] Test CORS in production environment
- [ ] No custom headers without Oriva approval

### Testing
- [ ] Test in Oriva iframe environment
- [ ] Verify API calls work without CORS errors
- [ ] Check browser console for any header-related issues
- [ ] Test with different network conditions

### Security
- [ ] Store API keys securely (never in client-side code)
- [ ] Use HTTPS for all API requests
- [ ] Implement proper error handling for auth failures

---

## 🔧 Troubleshooting Common Issues

### CORS Errors
If you see CORS errors in the browser console:

1. **Check your origin**: Make sure your app domain is registered in your Oriva app settings
2. **Verify headers**: Ensure you're only using allowed headers from the list above
3. **Test preflight**: OPTIONS requests should return proper CORS headers

### Authentication Errors
- Verify your API key is valid and has the `oriva_pk_live_` prefix
- Check that your API key has the necessary permissions
- Ensure the `Authorization` header format is exactly: `Bearer your_key`

### Need Help?
- Create a GitHub issue with your specific error
- Include browser console logs and request details
- Our team monitors CORS issues and will respond quickly

---

## 📈 API Rate Limits

- **Standard Rate Limit**: 1000 requests per 15 minutes per IP
- **Burst Protection**: Automatic rate limiting during high traffic
- **Headers Included**: Rate limit status in response headers

---

## 🔄 API Versioning

- **Current Version**: v1
- **Base URL**: `https://api.oriva.io/api/v1/`
- **Deprecation Policy**: 6-month notice for breaking changes

---

*Last Updated: January 2025*
*Questions? [Open an issue](https://github.com/0riva/oriva-platform/issues/new) or contact support*