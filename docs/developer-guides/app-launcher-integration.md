# 🚀 App Launcher Integration Guide

> **Build apps that integrate seamlessly with Oriva's multi-mode app launcher system**

The Oriva App Launcher provides a flexible, multi-mode display system for 3rd party applications, offering panel, fullscreen, and overlay modes for optimal user experience.

[![App Launcher](https://img.shields.io/badge/App%20Launcher-v2.0-blue)]()
[![Display Modes](https://img.shields.io/badge/Display%20Modes-Panel%20%7C%20Fullscreen%20%7C%20Overlay-green)]()
[![Security](https://img.shields.io/badge/Security-CSP%20%7C%20X%2DFrame%2DOptions-red)]()

---

## 🎯 Overview

The Oriva App Launcher enables your application to be embedded within the Oriva platform with multiple display modes:

- **📱 Panel Mode**: Embedded within Oriva's layout with sidebar access
- **🖥️ Fullscreen Mode**: Full-screen takeover with floating controls
- **📋 Overlay Mode**: Modal overlay display (coming soon)

---

## 🏗️ Display Modes

### Panel Mode
Perfect for productivity tools and dashboard widgets.

```javascript
// App appears within Oriva's layout
{
  "display_config": {
    "preferred_mode": "panel",
    "supports_panel": true,
    "min_width": 400,
    "min_height": 300,
    "responsive": true
  }
}
```

**Characteristics:**
- ✅ Sidebar remains accessible
- ✅ Maintains Oriva navigation
- ✅ Ideal for: Dashboards, forms, data entry
- ⚠️ Limited screen real estate

### Fullscreen Mode
Perfect for immersive experiences and complex interfaces.

```javascript
// App takes over entire screen
{
  "display_config": {
    "preferred_mode": "fullscreen",
    "supports_fullscreen": true,
    "min_width": 800,
    "min_height": 600,
    "responsive": true
  }
}
```

**Characteristics:**
- ✅ Full screen real estate
- ✅ Floating controls for navigation
- ✅ Auto-hiding interface elements
- ✅ Ideal for: Video apps, games, complex tools

### Overlay Mode (Coming Soon)
Perfect for quick actions and notifications.

---

## 🔧 Configuration

### App Registration
Register your app with display configuration:

```javascript
// POST /api/v1/apps
{
  "name": "My Awesome App",
  "url": "https://myapp.example.com",
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

### Display Configuration Schema

| Property | Type | Description | Default |
|----------|------|-------------|---------|
| `preferred_mode` | `string` | Default display mode (`panel`, `fullscreen`, `overlay`) | `"panel"` |
| `supports_panel` | `boolean` | Whether app supports panel mode | `true` |
| `supports_fullscreen` | `boolean` | Whether app supports fullscreen mode | `true` |
| `min_width` | `number` | Minimum width in pixels | `400` |
| `min_height` | `number` | Minimum height in pixels | `300` |
| `responsive` | `boolean` | Whether app is responsive | `true` |

### Security Configuration Schema

| Property | Type | Description | Default |
|----------|------|-------------|---------|
| `allow_frame_ancestors` | `boolean` | Allow embedding in frames | `false` |
| `custom_sandbox` | `array` | Custom iframe sandbox attributes | `[]` |
| `bypass_xframe_protection` | `boolean` | Use proxy for X-Frame-Options bypass | `false` |

---

## 🛡️ Security Requirements

### Content Security Policy (CSP)
Your app must be compatible with Oriva's CSP. Common requirements:

```javascript
// Required CSP compatibility
{
  "script-src": "allow 'unsafe-inline' and 'unsafe-eval' if needed",
  "style-src": "allow 'unsafe-inline' for dynamic styles",
  "frame-ancestors": "allow 'self' https://oriva.io https://*.oriva.io"
}
```

### X-Frame-Options Handling
If your app has X-Frame-Options restrictions:

```javascript
// For apps with X-Frame-Options: SAMEORIGIN or DENY
{
  "iframe_options": {
    "bypass_xframe_protection": true
  }
}
```

**What this does:**
- Routes your app through `apps.oriva.io` proxy
- Strips X-Frame-Options headers
- Maintains app functionality while enabling embedding

### Sandbox Configuration
Configure iframe sandbox for security:

```javascript
// Common sandbox configurations
{
  "iframe_options": {
    "custom_sandbox": [
      "allow-scripts",       // JavaScript execution
      "allow-same-origin",   // Same-origin requests
      "allow-forms",         // Form submissions
      "allow-popups",        // Modal dialogs
      "allow-modals",        // Alert/confirm dialogs
      "allow-orientation-lock" // Screen orientation
    ]
  }
}
```

---

## 🌐 URL Parameters

Users can override display modes via URL parameters:

```bash
# Force panel mode
https://oriva.io/app-launcher/your-app-id?mode=panel

# Force fullscreen mode
https://oriva.io/app-launcher/your-app-id?mode=fullscreen

# Force overlay mode (coming soon)
https://oriva.io/app-launcher/your-app-id?mode=overlay
```

---

## 📡 Communication API

### PostMessage Communication
Your app can communicate with Oriva using the PostMessage API:

```javascript
// Send message to Oriva
window.parent.postMessage({
  type: 'ping',
  timestamp: Date.now()
}, 'https://oriva.io');

// Listen for responses
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://oriva.io') return;

  switch (event.data.type) {
    case 'pong':
      console.log('Health check response:', event.data);
      break;
    case 'permission-granted':
      console.log('Permission granted:', event.data.permission);
      break;
  }
});
```

### Available Message Types

| Type | Direction | Description |
|------|-----------|-------------|
| `ping` | App → Oriva | Health check |
| `pong` | Oriva → App | Health check response |
| `permission-request` | App → Oriva | Request permission |
| `permission-granted` | Oriva → App | Permission granted |
| `permission-denied` | Oriva → App | Permission denied |
| `resize` | App → Oriva | Request resize (desktop only) |
| `error` | App → Oriva | Report error |

---

## 🏃 Quick Start

### 1. **Test Your App Compatibility**

```bash
# Check if your app loads in an iframe
curl -I https://yourapp.com
# Look for X-Frame-Options header
```

### 2. **Configure Display Mode**

```javascript
// Choose optimal display mode for your app type
const displayConfig = {
  // Productivity app example
  preferred_mode: "panel",
  supports_panel: true,
  supports_fullscreen: false,

  // Immersive app example
  // preferred_mode: "fullscreen",
  // supports_panel: false,
  // supports_fullscreen: true,
};
```

### 3. **Handle Security Headers**

```javascript
// If you have X-Frame-Options, either:
// Option A: Remove the header from your app
// Option B: Use bypass proxy
{
  "iframe_options": {
    "bypass_xframe_protection": true
  }
}
```

### 4. **Test Integration**

```bash
# Test your app in different modes
https://oriva.io/app-launcher/your-app-id?mode=panel
https://oriva.io/app-launcher/your-app-id?mode=fullscreen
```

---

## 🧪 Testing Your Integration

### Mode Testing Checklist

**Panel Mode:**
- [ ] App loads correctly with limited width
- [ ] Responsive design adapts to panel constraints
- [ ] Navigation doesn't interfere with Oriva sidebar
- [ ] Minimum width/height requirements met

**Fullscreen Mode:**
- [ ] App loads correctly at full screen
- [ ] Floating controls don't interfere with app
- [ ] Auto-hiding interface works properly
- [ ] Exit controls are accessible

**Communication:**
- [ ] PostMessage API works correctly
- [ ] Health checks respond within 5 seconds
- [ ] Error handling reports issues properly

### Performance Requirements

| Metric | Panel Mode | Fullscreen Mode |
|--------|------------|-----------------|
| Load Time | < 3 seconds | < 5 seconds |
| Memory Usage | < 100MB | < 200MB |
| Network Requests | < 50/minute | < 100/minute |
| CPU Usage | < 30% average | < 50% average |

---

## 🚀 Best Practices

### Design Guidelines

**Panel Mode Apps:**
- Design for 400px minimum width
- Use vertical layouts for better space utilization
- Implement progressive disclosure for complex UI
- Prioritize essential features in limited space

**Fullscreen Mode Apps:**
- Design for immersive experience
- Minimize UI chrome and maximize content
- Handle auto-hiding controls gracefully
- Provide clear exit/minimize options

### Performance Optimization

```javascript
// Lazy load non-critical features
const lazyLoadFeature = async () => {
  if (displayMode === 'panel') {
    // Load lightweight version
    return import('./panel-optimized-feature');
  } else {
    // Load full-featured version
    return import('./full-feature');
  }
};

// Adaptive resource loading
const adaptiveResourceLoading = {
  panel: {
    images: 'optimized',
    animations: 'reduced',
    features: 'essential'
  },
  fullscreen: {
    images: 'high-quality',
    animations: 'full',
    features: 'complete'
  }
};
```

### Security Best Practices

1. **Validate all PostMessage communication**
2. **Implement proper CORS headers**
3. **Use HTTPS for all resources**
4. **Minimize requested permissions**
5. **Implement proper error boundaries**

---

## 🔍 Troubleshooting

### Common Issues

**App doesn't load:**
```bash
# Check X-Frame-Options
curl -I https://yourapp.com | grep -i x-frame-options

# Solution: Set bypass_xframe_protection: true
```

**CSP violations:**
```javascript
// Check browser console for CSP errors
// Update your app's CSP to be compatible with Oriva's requirements
```

**Communication not working:**
```javascript
// Verify PostMessage origin
window.addEventListener('message', (event) => {
  console.log('Origin:', event.origin); // Should be https://oriva.io
});
```

### Support Resources

- **Documentation**: [https://docs.oriva.io](https://docs.oriva.io)
- **API Reference**: [https://api.oriva.io/docs](https://api.oriva.io/docs)
- **Developer Forum**: [https://community.oriva.io](https://community.oriva.io)
- **Support Email**: developers@oriva.io

---

## 📚 Related Guides

- [X-Frame-Options Configuration](./x-frame-options.md)
- [API Authentication](../START_GUIDE.md#authentication)
- [Security Best Practices](../PRIVACY_GUIDE.md)
- [Performance Guidelines](../START_GUIDE.md#performance)

---

*Last updated: September 2024 | App Launcher v2.0*