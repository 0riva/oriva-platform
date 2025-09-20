# API Troubleshooting Guide for Developers

**Purpose**: Systematic debugging workflow and common issue resolution for Oriva Platform API integration

## 🚨 **Quick Diagnostic Checklist**

Before investigating complex issues, verify these basics:

- [ ] API server is accessible
- [ ] Valid API key format (`oriva_pk_live_...`)
- [ ] Required headers included
- [ ] Endpoint URL is correct
- [ ] JSON request body is valid

## 🔍 **Problem Verification Framework**

### Essential Questions Before Debugging

When experiencing API issues, always ask:

1. **What specific behavior are you seeing?**
   - Empty responses? `{"success": true, "data": []}`
   - Error messages? HTTP status codes?
   - Timeouts or connection issues?

2. **What's the exact API response?**
   ```bash
   # Get full response details
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

## 🛠️ **Systematic Debugging Workflow**

### Step 1: Basic Connectivity
```bash
# Test API health
curl https://api.oriva.io/api/v1/health

# Expected response
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:00:00Z",
  "version": "1.0.0"
}
```

### Step 2: Authentication Testing
```bash
# Test your API key
curl -H "Authorization: Bearer YOUR_API_KEY" \
     "https://api.oriva.io/api/v1/user/me"

# Check for authentication errors
# 401 = Invalid API key
# 403 = Valid key but insufficient permissions
```

### Step 3: Permission Verification
```bash
# Check your API key permissions
curl -H "Authorization: Bearer YOUR_API_KEY" \
     "https://api.oriva.io/api/v1/user/me" | \
     jq '.data.apiKeyInfo.permissions'

# Should return array of permissions like:
# ["user:read", "profiles:read", "groups:read", ...]
```

### Step 4: Endpoint-Specific Testing
```bash
# Test specific problematic endpoint
curl -v -H "Authorization: Bearer YOUR_API_KEY" \
        -H "Content-Type: application/json" \
        "https://api.oriva.io/api/v1/PROBLEM_ENDPOINT"
```

## 🚫 **Common Issues & Solutions**

### Issue: Empty Data Arrays
**Symptoms**: `{"success": true, "data": []}`

**Possible Causes**:
1. **No data available**: User has no profiles/groups/apps
2. **Permission filtering**: Data exists but API key lacks permission
3. **Anonymous profile filtering**: Profiles are anonymous and excluded

**Solutions**:
```bash
# Check what permissions your key has
curl -H "Authorization: Bearer YOUR_API_KEY" \
     "https://api.oriva.io/api/v1/user/me" | \
     jq '.data.apiKeyInfo.permissions'

# For profiles endpoint specifically:
# - Requires "profiles:read" permission
# - Anonymous profiles are automatically excluded
# - Only returns profiles your extension has access to
```

### Issue: 401 Unauthorized
**Symptoms**: `{"success": false, "error": "Unauthorized"}`

**Possible Causes**:
1. **Invalid API key format**
2. **Expired or revoked API key**
3. **Missing Authorization header**

**Solutions**:
```bash
# Verify API key format (should start with oriva_pk_)
echo "YOUR_API_KEY" | grep "^oriva_pk_"

# Test with curl verbose mode
curl -v -H "Authorization: Bearer YOUR_API_KEY" \
        "https://api.oriva.io/api/v1/user/me"

# Check request headers are included
```

### Issue: 403 Forbidden
**Symptoms**: `{"success": false, "error": "Insufficient permissions"}`

**Possible Causes**:
1. **Missing required permission** for endpoint
2. **API key created before permission update**
3. **Trying to access data you don't own**

**Solutions**:
```bash
# Check current permissions
curl -H "Authorization: Bearer YOUR_API_KEY" \
     "https://api.oriva.io/api/v1/user/me" | \
     jq '.data.apiKeyInfo.permissions'

# Compare against required permissions:
# - /api/v1/profiles/* requires "profiles:read" or "profiles:write"
# - /api/v1/groups/* requires "groups:read" or "groups:write"
# - /api/v1/marketplace/* requires "marketplace:read"
```

### Issue: Missing Properties
**Symptoms**: Expected properties are undefined/missing

**Possible Causes**:
1. **API version differences**
2. **Permission-based property filtering**
3. **Optional properties are null**

**Solutions**:
```javascript
// Always validate properties before use
function safeAccess(obj, path, defaultValue) {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : defaultValue;
  }, obj);
}

// Usage
const profileName = safeAccess(profile, 'profileName', 'Unknown Profile');
const isActive = safeAccess(profile, 'isActive', false);
```

### Issue: Profile ID Format Errors
**Symptoms**: `{"success": false, "error": "Invalid profile ID format"}`

**Possible Causes**:
1. **Using internal profile IDs** instead of external IDs
2. **Incorrect ID format**

**Solutions**:
```javascript
// Correct external profile ID format
const validProfileId = "ext_1234567890abcdef"; // 16 hex chars after ext_

// Validate profile ID format
function isValidProfileId(id) {
  return /^ext_[a-f0-9]{16}$/.test(id);
}

// Always use IDs returned by the API
const response = await fetch('/api/v1/profiles/available');
const { data: profiles } = await response.json();
const profileId = profiles[0].profileId; // Use this exact ID
```

## 🔐 **Authentication Troubleshooting**

### API Key Validation Issues

**Problem**: API key appears valid but requests fail

**Debug Steps**:
```bash
# 1. Verify key format
echo "YOUR_API_KEY" | cut -c1-12
# Should output: oriva_pk_liv

# 2. Test key with user/me endpoint
curl -H "Authorization: Bearer YOUR_API_KEY" \
     "https://api.oriva.io/api/v1/user/me"

# 3. Check key permissions and metadata
curl -H "Authorization: Bearer YOUR_API_KEY" \
     "https://api.oriva.io/api/v1/user/me" | \
     jq '.data.apiKeyInfo'
```

### Permission Migration Issues

**Problem**: Old API keys with limited permissions

**Solution**:
```bash
# Check if you have old permission format
curl -H "Authorization: Bearer YOUR_API_KEY" \
     "https://api.oriva.io/api/v1/user/me" | \
     jq '.data.apiKeyInfo.permissions'

# Old format: ["read:profile", "read:entries"]
# New format: ["user:read", "profiles:read", "entries:read", ...]

# If old format, create new API key for full access
```

## 📊 **Response Analysis Tools**

### Using jq for Response Analysis
```bash
# Get all property names from user profile
curl -s -H "Authorization: Bearer YOUR_API_KEY" \
     "https://api.oriva.io/api/v1/user/me" | \
     jq '.data | keys'

# Check for specific property existence
curl -s -H "Authorization: Bearer YOUR_API_KEY" \
     "https://api.oriva.io/api/v1/user/me" | \
     jq '.data.apiKeyInfo.permissions'

# Count available profiles
curl -s -H "Authorization: Bearer YOUR_API_KEY" \
     "https://api.oriva.io/api/v1/profiles/available" | \
     jq '.data | length'
```

### Browser DevTools Analysis
1. **Network Tab**: Monitor actual requests/responses
2. **Console**: Test with `fetch()` API
3. **Application Tab**: Check stored API keys

```javascript
// Test API in browser console
fetch('https://api.oriva.io/api/v1/user/me', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
})
.then(response => response.json())
.then(data => console.log('Response:', data))
.catch(error => console.error('Error:', error));
```

## 🚨 **Error Response Reference**

### Standard Error Formats
```json
// Authentication Error
{
  "success": false,
  "error": "Invalid API key",
  "details": {
    "code": "AUTH_INVALID_KEY",
    "timestamp": "2025-01-15T10:00:00Z"
  }
}

// Permission Error
{
  "success": false,
  "error": "Insufficient permissions",
  "details": {
    "required": ["profiles:read"],
    "provided": ["user:read"]
  }
}

// Validation Error
{
  "success": false,
  "error": "Invalid profile ID format",
  "details": {
    "field": "profileId",
    "expected": "ext_[a-f0-9]{16}",
    "received": "profile_123"
  }
}
```

### HTTP Status Code Reference
- **200 OK**: Request successful
- **400 Bad Request**: Invalid request format/parameters
- **401 Unauthorized**: Invalid or missing API key
- **403 Forbidden**: Valid API key but insufficient permissions
- **404 Not Found**: Endpoint or resource not found
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error

## 🛡️ **Security Best Practices**

### API Key Security
```javascript
// ✅ Good: Store API key securely
const apiKey = process.env.ORIVA_API_KEY;

// ❌ Bad: Hardcode API key
const apiKey = "oriva_pk_live_your_key_here";

// ✅ Good: Validate API key format
function isValidAPIKey(key) {
  return /^oriva_pk_(live|test)_[a-zA-Z0-9]{32,}$/.test(key);
}
```

### Request Validation
```javascript
// Always validate response before using
async function safeAPICall(endpoint) {
  try {
    const response = await fetch(`https://api.oriva.io${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${process.env.ORIVA_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(`API Error: ${data.error}`);
    }

    return data.data;
  } catch (error) {
    console.error(`API call failed for ${endpoint}:`, error);
    throw error;
  }
}
```

## 📈 **Performance Debugging**

### Rate Limit Monitoring
```javascript
// Monitor rate limit headers
async function monitoredAPICall(endpoint) {
  const response = await fetch(endpoint, { headers });

  console.log('Rate Limit Info:', {
    limit: response.headers.get('X-RateLimit-Limit'),
    remaining: response.headers.get('X-RateLimit-Remaining'),
    reset: response.headers.get('X-RateLimit-Reset')
  });

  return response.json();
}
```

### Response Time Analysis
```bash
# Measure API response times
time curl -H "Authorization: Bearer YOUR_API_KEY" \
          "https://api.oriva.io/api/v1/user/me"

# Expected response times:
# - User endpoints: < 200ms
# - Profile endpoints: < 300ms
# - Marketplace endpoints: < 500ms
```

## 🆘 **Getting Help**

### Before Contacting Support

1. **Collect diagnostic information**:
   ```bash
   # API key permissions
   curl -H "Authorization: Bearer YOUR_API_KEY" \
        "https://api.oriva.io/api/v1/user/me" | \
        jq '.data.apiKeyInfo'

   # Failing endpoint with verbose output
   curl -v -H "Authorization: Bearer YOUR_API_KEY" \
           "https://api.oriva.io/FAILING_ENDPOINT" 2>&1
   ```

2. **Document the issue**:
   - Expected behavior vs. actual behavior
   - Complete request/response examples
   - API key permissions (never share the actual key)
   - Timestamp when issue occurred

3. **Test with minimal example**:
   ```javascript
   // Provide minimal reproducible example
   const response = await fetch('https://api.oriva.io/api/v1/user/me', {
     headers: { 'Authorization': 'Bearer YOUR_API_KEY' }
   });
   console.log(await response.json());
   ```

### Support Channels
- **GitHub Issues**: [Report bugs](https://github.com/0riva/oriva-platform/issues)
- **GitHub Discussions**: [Ask questions](https://github.com/0riva/oriva-platform/discussions)
- **API Documentation**: [Reference guide](./api-reference-guide.md)

---

**Related Documentation**:
- [API Reference Guide](./api-reference-guide.md) - Complete endpoint reference
- [API Headers Guide](./api-headers-guide.md) - Header requirements and examples

**Last Updated**: January 2025