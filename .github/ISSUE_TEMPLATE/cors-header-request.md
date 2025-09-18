---
name: 🌐 CORS Header Request
about: Request new header to be added to CORS allowlist
title: '[CORS] Request header: HEADER_NAME'
labels: 'cors, api, enhancement, developer-experience'
---

## 🔑 Header Information

**Header Name:** `X-Your-Header`

**Purpose:** Brief description of what this header does

**Category:**
- [ ] Authentication/Authorization
- [ ] Request tracking/debugging
- [ ] User context
- [ ] Performance/caching
- [ ] Security
- [ ] Other: ___________

---

## 💻 Use Case

**Why does your app need this header?**
- What functionality requires it?
- Is there an alternative approach?
- How many apps would benefit?

**Detailed explanation:**
<!-- Provide context about your specific use case -->

---

## 📋 App Information

**App Name:** Your App Name
**App Domain:** https://your-app.com
**Developer Contact:** your-email@example.com
**Estimated Users Affected:** Number of users

---

## 🧪 Example Request

```javascript
fetch('/api/v1/endpoint', {
  headers: {
    'Authorization': 'Bearer oriva_pk_live_...',
    'Content-Type': 'application/json',
    'X-Your-Header': 'example-value'  // <- New header
  }
});
```

**Expected behavior with this header:**
<!-- Describe what your app should do when this header is allowed -->

---

## 📊 Impact Level

**Priority:**
- [ ] **Critical** - App doesn't work without it
- [ ] **Important** - Significant functionality affected
- [ ] **Nice to have** - Minor enhancement

**Timeline:**
- [ ] Urgent (needed within 1 week)
- [ ] Standard (needed within 1 month)
- [ ] Future enhancement

---

## 🔍 Technical Details

**Header Type:**
- [ ] Standard HTTP header
- [ ] Custom header (X-*)
- [ ] Framework-specific header

**Header Value Type:**
- [ ] Static value
- [ ] Dynamic/user-specific
- [ ] Generated token/ID

**Security Considerations:**
- [ ] Contains sensitive data
- [ ] Public information only
- [ ] Needs validation

---

## ✅ Developer Checklist

- [ ] I've checked the [current allowed headers](https://github.com/0riva/oriva-platform/blob/main/docs/developer-guides/api-headers-guide.md)
- [ ] This header is not already supported
- [ ] I've provided a clear use case
- [ ] I've included example code
- [ ] I've considered security implications

---

## 📝 Additional Context

<!-- Add any other context, screenshots, or links that would help us understand your request -->

---

**For Oriva Team:**
- [ ] Review technical feasibility
- [ ] Assess security implications
- [ ] Update CORS policy
- [ ] Update documentation
- [ ] Notify other developers of change