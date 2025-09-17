# 🔄 App Launcher Migration Guide

> **Migrate your existing app to Oriva's new multi-mode app launcher system**

This guide helps existing app developers migrate from the legacy iframe system to the new multi-mode app launcher with enhanced security and display options.

[![Migration](https://img.shields.io/badge/Migration-Legacy%20→%20v2.0-blue)]()
[![Breaking Changes](https://img.shields.io/badge/Breaking%20Changes-Yes-red)]()
[![Timeline](https://img.shields.io/badge/Timeline-Q4%202024-green)]()

---

## 🎯 What's Changing

### Legacy System (v1.0)
- ❌ Single iframe embedding mode
- ❌ Basic X-Frame-Options handling
- ❌ Limited security configuration
- ❌ Fixed 600x400px iframe constraints

### New System (v2.0)
- ✅ Multi-mode display (panel/fullscreen/overlay)
- ✅ Advanced security configuration
- ✅ Proxy service for X-Frame-Options bypass
- ✅ Responsive design support
- ✅ PostMessage API for communication

---

## 🚨 Breaking Changes

### 1. App Configuration Schema
**Before (v1.0):**
```javascript
{
  "name": "My App",
  "url": "https://myapp.com",
  "width": 600,
  "height": 400
}
```

**After (v2.0):**
```javascript
{
  "name": "My App",
  "url": "https://myapp.com",
  "display_config": {
    "preferred_mode": "panel",
    "supports_panel": true,
    "supports_fullscreen": true,
    "min_width": 400,
    "min_height": 300,
    "responsive": true
  },
  "iframe_options": {
    "allow_frame_ancestors": false,
    "custom_sandbox": ["allow-scripts", "allow-same-origin", "allow-forms"],
    "bypass_xframe_protection": false
  }
}
```

### 2. Launch URLs
**Before:**
```
https://oriva.io/apps/your-app-id
```

**After:**
```
https://oriva.io/app-launcher/your-app-id
https://oriva.io/app-launcher/your-app-id?mode=panel
https://oriva.io/app-launcher/your-app-id?mode=fullscreen
```

### 3. Security Headers
**New Requirements:**
- Content Security Policy compatibility
- X-Frame-Options handling via proxy service
- Enhanced iframe sandbox configuration

---

## 📋 Migration Checklist

### Phase 1: Assessment
- [ ] **Audit current app** for X-Frame-Options headers
- [ ] **Test app responsiveness** at different screen sizes
- [ ] **Review security headers** (CSP, CORS, etc.)
- [ ] **Identify optimal display mode** for your app type
- [ ] **Plan user experience** for multi-mode support

### Phase 2: Configuration Update
- [ ] **Update app configuration** with new schema
- [ ] **Configure display modes** (panel/fullscreen preferences)
- [ ] **Set security options** (sandbox, X-Frame-Options bypass)
- [ ] **Test configuration** in development environment

### Phase 3: Code Changes
- [ ] **Implement responsive design** for panel mode constraints
- [ ] **Add PostMessage communication** (optional but recommended)
- [ ] **Handle display mode detection** (if needed)
- [ ] **Update error handling** for new launcher environment

### Phase 4: Testing & Deployment
- [ ] **Test in panel mode** (400px+ width)
- [ ] **Test in fullscreen mode** (full screen)
- [ ] **Verify communication APIs** work correctly
- [ ] **Submit updated configuration** via Developer API
- [ ] **Monitor app performance** post-migration

---

## 🔧 Migration Scenarios

### Scenario 1: Simple Web App (No X-Frame-Options Issues)

**Current Status:**
```javascript
// Your app loads fine in iframes
// No X-Frame-Options: DENY/SAMEORIGIN headers
```

**Migration Steps:**
```javascript
// 1. Choose display mode based on app type
const config = {
  display_config: {
    preferred_mode: "panel",      // Good for forms, dashboards
    supports_panel: true,
    supports_fullscreen: false,   // Optional if not needed
    min_width: 400,
    min_height: 300,
    responsive: true
  },
  iframe_options: {
    bypass_xframe_protection: false  // No bypass needed
  }
};

// 2. Update via Developer API
await fetch('/api/v1/developer/apps/your-app-id', {
  method: 'PUT',
  headers: { 'Authorization': `Bearer ${apiKey}` },
  body: JSON.stringify(config)
});
```

### Scenario 2: App with X-Frame-Options Issues

**Current Status:**
```bash
# Your app has X-Frame-Options: SAMEORIGIN or DENY
curl -I https://yourapp.com | grep -i x-frame-options
# X-Frame-Options: SAMEORIGIN
```

**Migration Steps:**
```javascript
// 1. Enable X-Frame-Options bypass
const config = {
  display_config: {
    preferred_mode: "fullscreen",    // May work better for complex apps
    supports_panel: true,
    supports_fullscreen: true,
    min_width: 800,
    min_height: 600,
    responsive: true
  },
  iframe_options: {
    bypass_xframe_protection: true,  // Enable proxy service
    custom_sandbox: [
      "allow-scripts",
      "allow-same-origin",
      "allow-forms",
      "allow-popups",
      "allow-modals"
    ]
  }
};

// 2. Your app will be served via apps.oriva.io proxy
// 3. X-Frame-Options headers will be stripped automatically
```

### Scenario 3: Video/Media App

**Current Status:**
```javascript
// Video streaming or media-heavy application
// Needs full screen for optimal experience
```

**Migration Steps:**
```javascript
const config = {
  display_config: {
    preferred_mode: "fullscreen",    // Best for video content
    supports_panel: false,           // Disable panel for video apps
    supports_fullscreen: true,
    min_width: 800,
    min_height: 600,
    responsive: true
  },
  iframe_options: {
    custom_sandbox: [
      "allow-scripts",
      "allow-same-origin",
      "allow-forms",
      "allow-popups",
      "allow-modals",
      "allow-orientation-lock"        // Important for video
    ]
  }
};
```

### Scenario 4: Dashboard/Analytics App

**Current Status:**
```javascript
// Data visualization or dashboard application
// Works well in constrained spaces
```

**Migration Steps:**
```javascript
const config = {
  display_config: {
    preferred_mode: "panel",         // Perfect for dashboards
    supports_panel: true,
    supports_fullscreen: true,       // Option for detailed views
    min_width: 400,
    min_height: 300,
    responsive: true                 // Important for panel mode
  },
  iframe_options: {
    custom_sandbox: [
      "allow-scripts",
      "allow-same-origin",
      "allow-forms"                  // Minimal permissions for dashboards
    ]
  }
};
```

---

## 🎨 Responsive Design Updates

### Panel Mode Constraints
```css
/* Update your CSS for panel mode */
@media (max-width: 600px) {
  .app-container {
    /* Design for 400px+ width in panel mode */
    min-width: 400px;
    padding: 8px;
  }

  .navigation {
    /* Vertical navigation for narrow panels */
    flex-direction: column;
  }

  .content-grid {
    /* Single column for narrow spaces */
    grid-template-columns: 1fr;
  }
}
```

### Fullscreen Mode Optimization
```css
/* Optimize for fullscreen mode */
@media (min-width: 800px) {
  .app-container {
    /* Take advantage of full screen space */
    max-width: none;
    padding: 16px;
  }

  .content-grid {
    /* Multi-column layout for wide screens */
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  }
}
```

### JavaScript Display Mode Detection
```javascript
// Optional: Detect display mode and adapt behavior
function detectDisplayMode() {
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get('mode');

  if (mode === 'fullscreen') {
    // Enable fullscreen-specific features
    enableAdvancedFeatures();
    setLayoutMode('fullscreen');
  } else {
    // Default to panel-optimized layout
    setLayoutMode('panel');
  }
}

// Call on page load
detectDisplayMode();
```

---

## 🔒 Security Migration

### Content Security Policy Updates
```javascript
// Update your app's CSP to be compatible with Oriva
{
  "script-src": "'self' 'unsafe-inline' 'unsafe-eval' https://oriva.io",
  "style-src": "'self' 'unsafe-inline' https://oriva.io",
  "frame-ancestors": "'self' https://oriva.io https://*.oriva.io",
  "connect-src": "'self' https://api.oriva.io"
}
```

### PostMessage Communication (Optional)
```javascript
// Add communication with Oriva launcher
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://oriva.io') return;

  switch (event.data.type) {
    case 'ping':
      // Respond to health checks
      window.parent.postMessage({
        type: 'pong',
        timestamp: Date.now()
      }, 'https://oriva.io');
      break;
  }
});

// Send status updates to Oriva
function reportStatus(status) {
  window.parent.postMessage({
    type: 'status',
    status: status,
    timestamp: Date.now()
  }, 'https://oriva.io');
}
```

---

## ⚠️ Common Issues & Solutions

### Issue 1: App doesn't load after migration
```bash
# Debug: Check X-Frame-Options
curl -I https://yourapp.com | grep -i x-frame

# Solution: Enable bypass if present
{
  "iframe_options": {
    "bypass_xframe_protection": true
  }
}
```

### Issue 2: Layout breaks in panel mode
```css
/* Solution: Implement responsive design */
@media (max-width: 600px) {
  .layout {
    flex-direction: column;
    min-width: 400px;
  }
}
```

### Issue 3: CSP violations in console
```javascript
// Solution: Update your app's CSP headers
{
  "script-src": "'self' 'unsafe-inline'",
  "style-src": "'self' 'unsafe-inline'"
}
```

### Issue 4: Sandbox restrictions too strict
```javascript
// Solution: Add necessary sandbox permissions
{
  "iframe_options": {
    "custom_sandbox": [
      "allow-scripts",
      "allow-same-origin",
      "allow-forms",
      "allow-popups",      // If you need modals
      "allow-modals"       // If you need alerts
    ]
  }
}
```

---

## 📅 Migration Timeline

### Immediate (Available Now)
- ✅ New app launcher system is live
- ✅ Legacy system still supported
- ✅ Migration documentation available

### Q4 2024
- 🔄 Migration period for existing apps
- 📧 Email notifications to developers
- 🛠️ Migration tooling and assistance

### Q1 2025
- ⚠️ Legacy system deprecation warning
- 📢 Final migration reminders

### Q2 2025
- ❌ Legacy system sunset
- 🚀 Full migration to new system required

---

## 🆘 Migration Support

### Self-Service Resources
- **[App Launcher Integration Guide](./app-launcher-integration.md)**
- **[X-Frame-Options Guide](./x-frame-options.md)**
- **[API Documentation](../START_GUIDE.md)**

### Developer Support
- **Migration Consultation**: developers@oriva.io
- **Technical Support**: support@oriva.io
- **Community Forum**: https://community.oriva.io
- **Office Hours**: Fridays 2-4 PM PST

### Migration Tools
```bash
# Use our migration helper script
curl -s https://api.oriva.io/tools/migration-check.sh | bash

# Check your app compatibility
curl -X POST https://api.oriva.io/tools/app-check \
  -H "Authorization: Bearer $API_KEY" \
  -d '{"app_url": "https://yourapp.com"}'
```

---

## ✅ Post-Migration Verification

### Functionality Tests
- [ ] App loads correctly in panel mode
- [ ] App loads correctly in fullscreen mode
- [ ] All interactive features work
- [ ] Forms and user input function properly
- [ ] Navigation and routing work correctly

### Performance Tests
- [ ] Load time < 5 seconds
- [ ] Memory usage within limits
- [ ] No console errors or warnings
- [ ] Responsive design functions properly

### Security Tests
- [ ] No CSP violations in console
- [ ] Iframe sandbox restrictions appropriate
- [ ] PostMessage communication secure
- [ ] No security warnings or errors

---

*Last updated: September 2024 | App Launcher v2.0*