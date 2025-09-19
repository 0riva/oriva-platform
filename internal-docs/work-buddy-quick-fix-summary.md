# Work Buddy Integration - Quick Fix Summary

## ✅ **Correct API Information**

### **Base URL**
```
https://api.oriva.io/api/v1
```

### **Profile Endpoint**
```
GET https://api.oriva.io/api/v1/profiles/available
```

### **Authentication**
```
Authorization: Bearer YOUR_API_KEY
```

### **Response Format**
```json
{
  "success": true,
  "data": [
    {
      "profileId": "profile_123",
      "profileName": "Work Profile",
      "isActive": true,
      "avatar": "https://example.com/avatar.jpg",
      "isDefault": false
    }
  ]
}
```

## 🔧 **What Changed**

1. **Anonymous profiles are now filtered out** - you'll get fewer profiles per user
2. **Avatar field IS included** - the endpoint returns `avatar` property
3. **API URLs are correct** - use `https://api.oriva.io/api/v1`

## 🚀 **Working Endpoints**

```bash
# Test connectivity
curl https://api.oriva.io/api/v1/health

# Test with your API key
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.oriva.io/api/v1/profiles/available
```

## 💡 **Quick Test**

```javascript
// This should work
const response = await fetch('https://api.oriva.io/api/v1/profiles/available', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
console.log(data); // Should show profiles with avatar field
```

## 🛠️ **Component Update**

Your ProfileSelector component expecting `avatar` should work fine - the API returns it.

## ❗ **If Still Getting "Endpoint not found"**

1. Check your API key is valid (starts with `oriva_pk_live_...`)
2. Verify you're using the exact URL: `https://api.oriva.io/api/v1/profiles/available`
3. Ensure Authorization header format: `Bearer YOUR_API_KEY`

The endpoints ARE deployed and working!