# Oriva App Integration Requirements

## Overview

This document outlines the technical requirements for developing applications that integrate with the Oriva platform. These requirements ensure security, performance, and a consistent user experience across all Oriva apps.

## Security Requirements

### 1. Content Security Policy (CSP)

Your app **MUST** include the following CSP directive to allow embedding in Oriva:

```http
Content-Security-Policy: frame-ancestors 'self' https://oriva.io https://*.oriva.io https://app.oriva.io
```

### 2. X-Frame-Options

If using X-Frame-Options (legacy), set one of:

```http
X-Frame-Options: ALLOWALL
```

OR remove X-Frame-Options entirely and use CSP `frame-ancestors` (recommended).

### 3. HTTPS Required

- All production apps MUST be served over HTTPS
- Development apps may use HTTP for localhost testing only

## App Manifest Requirements

### Required Fields

```json
{
  "id": "unique-app-identifier",
  "name": "Your App Name",
  "version": "1.0.0",
  "description": "Brief app description",
  "execution_url": "https://your-app.example.com/oriva-entry",
  "icon_url": "https://your-app.example.com/icon.png",
  "permissions": ["read:entries", "write:entries"],
  "developer": {
    "name": "Your Company",
    "email": "developer@yourcompany.com",
    "support_url": "https://yourcompany.com/support"
  },
  "display_config": {
    "preferred_mode": "fullscreen",
    "supports_panel": true,
    "supports_fullscreen": true,
    "min_width": 400,
    "min_height": 300,
    "responsive": true
  }
}
```

## Display Modes

### Fullscreen Mode
- **Recommended for productivity apps**
- Takes full browser viewport
- Floating navigation controls provided by Oriva
- Ideal for: Video apps, document editors, design tools

### Panel Mode
- **Recommended for utility apps**
- Embedded within Oriva interface
- Fixed header with app controls
- Ideal for: Calculators, simple tools, widgets

## App Entry Point

### URL Parameters

Your `execution_url` will receive these parameters:

```
https://your-app.com/oriva-entry?
  session_id=abc123&
  app_id=your-app-id&
  user_id=user-123&
  permissions=["read:entries"]&
  origin=oriva_web&
  timestamp=1640995200000
```

### Required Response

Your app must:
1. Validate the session parameters
2. Render appropriate UI for the Oriva context
3. Handle the specified permissions properly

## Communication API

### Oriva Bridge

Include the Oriva Bridge library for secure communication:

```html
<script src="https://cdn.oriva.io/bridge/v1/oriva-bridge.js"></script>
```

### Basic Setup

```javascript
// Initialize Oriva Bridge
const oriva = new OrivaBridge({
  appId: 'your-app-id',
  version: '1.0.0'
});

// Ready event
oriva.ready(() => {
  console.log('Connected to Oriva platform');
});

// Handle permission requests
oriva.requestPermission('read:profile').then(granted => {
  if (granted) {
    // Access user profile data
  }
});
```

## Hosting Options

### Option 1: Self-Hosted (Recommended)
- Host your app on your own infrastructure
- Must meet security requirements above
- Full control over app deployment

### Option 2: Oriva Hosted
- Deploy to Oriva's app hosting service
- Automatic CSP and security configuration
- Contact developer support for hosting access

## Performance Requirements

### Loading Performance
- Initial load: < 3 seconds
- First contentful paint: < 1.5 seconds
- Time to interactive: < 5 seconds

### Resource Limits
- Memory usage: < 100MB for panel mode, < 500MB for fullscreen
- Network requests: < 60 requests per minute
- Bundle size: < 10MB total

## Testing Your Integration

### Local Development
1. Set up your app with proper CSP headers
2. Test embedding in Oriva development environment
3. Verify all permissions work correctly

### Pre-Production Checklist
- [ ] CSP `frame-ancestors` includes Oriva domains
- [ ] App responds to Oriva URL parameters
- [ ] Oriva Bridge integration works
- [ ] Performance meets requirements
- [ ] All declared permissions are used

## Submission Process

1. **Prepare App**: Ensure all requirements are met
2. **Submit Manifest**: Upload app manifest via Oriva Developer Portal
3. **Security Review**: Oriva team reviews security implementation
4. **Performance Testing**: Automated testing of performance metrics
5. **Approval**: App appears in Oriva marketplace

## Support

- **Developer Portal**: https://developers.oriva.io
- **Documentation**: https://docs.oriva.io/apps
- **Support Email**: developer-support@oriva.io
- **Community**: https://community.oriva.io/developers

## Examples

### Minimal CSP Header Example
```nginx
# Nginx configuration
add_header Content-Security-Policy "frame-ancestors 'self' https://oriva.io https://*.oriva.io https://app.oriva.io; default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" always;
```

### Express.js Example
```javascript
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "frame-ancestors 'self' https://oriva.io https://*.oriva.io https://app.oriva.io"
  );
  next();
});
```

### React App Example
```javascript
// In your app's entry point
useEffect(() => {
  // Parse Oriva parameters
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('session_id');
  const appId = urlParams.get('app_id');
  const userId = urlParams.get('user_id');

  // Initialize Oriva integration
  if (sessionId && appId) {
    initializeOrivaIntegration({ sessionId, appId, userId });
  }
}, []);
```

---

*Last updated: 2025-01-17*
*Version: 1.0*