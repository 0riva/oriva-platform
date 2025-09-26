# App Integration Requirements

**Technical requirements for secure Oriva platform integration**

## Overview

This document outlines the security, performance, and compatibility requirements for applications integrating with the Oriva platform. Following these requirements ensures consistent user experience and maintains security standards.

## 🛡️ Security Requirements

### 1. Content Security Policy (CSP) - Recommended

Your app **MUST** include CSP directives to allow secure embedding:

```http
Content-Security-Policy: frame-ancestors 'self' https://oriva.io https://*.oriva.io https://app.oriva.io
```

**Why CSP is preferred:**
- More granular control than X-Frame-Options
- Allows specific trusted domains
- Modern browser standard
- Better security than allowing all frames

### 2. X-Frame-Options (Legacy Support)

If using X-Frame-Options instead of CSP:

```http
X-Frame-Options: SAMEORIGIN
```

**Important**: Don't use both CSP `frame-ancestors` and `X-Frame-Options` together. Choose one approach.

### 3. HTTPS Requirements

**Production (Required):**
- All production apps MUST use HTTPS
- SSL/TLS certificates must be valid
- No mixed content (HTTP resources on HTTPS pages)

**Development (Flexible):**
- HTTPS required for testing iframe integration
- HTTP allowed for localhost development only
- Use tools like [mkcert](https://github.com/FiloSottile/mkcert) for local HTTPS

## 📋 App Manifest Requirements

### Required Fields

```json
{
  "id": "unique-app-identifier",
  "name": "Your App Name",
  "version": "1.0.0",
  "description": "Brief app description (max 200 characters)",
  "execution_url": "https://your-app.example.com/oriva-entry",
  "icon_url": "https://your-app.example.com/icon.png",
  "permissions": ["read:profiles", "read:groups"],
  "developer": {
    "name": "Your Company",
    "email": "developer@yourcompany.com",
    "support_url": "https://yourcompany.com/support"
  },
  "display_config": {
    "theme": "light",
    "responsive": true,
    "min_width": 320,
    "min_height": 480,
    "iframe_options": {
      "allow_popups": false,
      "sandbox": "allow-scripts allow-same-origin"
    }
  }
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Unique identifier (alphanumeric, hyphens, underscores) |
| `name` | string | ✅ | Display name (max 50 characters) |
| `version` | string | ✅ | Semantic version (e.g., "1.0.0") |
| `description` | string | ✅ | App description (max 200 characters) |
| `execution_url` | string | ✅ | HTTPS URL where your app loads |
| `icon_url` | string | ✅ | HTTPS URL to app icon (PNG, 64x64px minimum) |
| `permissions` | array | ✅ | Required API permissions |
| `developer` | object | ✅ | Developer contact information |
| `display_config` | object | ❌ | UI configuration options |

### Available Permissions

| Permission | Description | Use Case |
|------------|-------------|----------|
| `read:profiles` | Access user profile information | User identification |
| `read:groups` | Access user group memberships | Access control |
| `read:marketplace` | Access marketplace app list | App discovery |
| `write:preferences` | Store user preferences | Settings persistence |

## 🎨 Display Configuration

### Theme Support

```json
{
  "display_config": {
    "theme": "auto",          // "light", "dark", or "auto"
    "responsive": true,       // Responsive design required
    "min_width": 320,        // Minimum width in pixels
    "min_height": 480,       // Minimum height in pixels
    "max_width": 1200,       // Optional maximum width
    "supports_mobile": true  // Mobile device support
  }
}
```

### iframe Configuration

```json
{
  "iframe_options": {
    "allow_popups": false,     // Allow popup windows
    "allow_downloads": false,  // Allow file downloads
    "sandbox": "allow-scripts allow-same-origin allow-forms",
    "referrer_policy": "strict-origin-when-cross-origin"
  }
}
```

## 🚀 Performance Requirements

### Load Time Standards

| Metric | Target | Maximum |
|--------|--------|---------|
| **First Contentful Paint** | < 1.5s | < 3s |
| **Largest Contentful Paint** | < 2.5s | < 4s |
| **Cumulative Layout Shift** | < 0.1 | < 0.25 |
| **First Input Delay** | < 100ms | < 300ms |

### Resource Limits

```json
{
  "performance_config": {
    "max_bundle_size": "2MB",     // JavaScript bundle size
    "max_image_size": "500KB",    // Individual image size
    "max_memory_usage": "50MB",   // Runtime memory usage
    "concurrent_requests": 10     // Maximum concurrent API calls
  }
}
```

### Optimization Requirements

**Required Optimizations:**
- ✅ Minified JavaScript and CSS
- ✅ Compressed images (WebP preferred)
- ✅ Lazy loading for non-critical resources
- ✅ Efficient API calls with caching
- ✅ Progressive loading for large datasets

## 🔒 Authentication Integration

### Secure Authentication Flow

```javascript
// Recommended: Use postMessage for iframe authentication
class OrivaAuth {
  async requestAuthentication() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Authentication timeout'));
      }, 15000);

      const handleMessage = (event) => {
        // Validate origin for security
        if (!this.isAllowedOrigin(event.origin)) {
          return;
        }

        if (event.data?.type === 'ORIVA_AUTH_TOKEN') {
          clearTimeout(timeout);
          window.removeEventListener('message', handleMessage);
          resolve(event.data.data);
        }
      };

      window.addEventListener('message', handleMessage);

      // Request auth from parent
      window.parent.postMessage({
        type: 'ORIVA_REQUEST_AUTH',
        appId: this.appId
      }, '*');
    });
  }

  isAllowedOrigin(origin) {
    const allowedOrigins = [
      'https://app.oriva.io',
      'https://oriva.io'
    ];
    return allowedOrigins.includes(origin);
  }
}
```

### API Integration

```javascript
// Use the authenticated tokens for API calls
class OrivaApiClient {
  constructor(authTokens) {
    this.tokens = authTokens;
    this.baseUrl = 'https://api.oriva.io/api/v1';
  }

  async request(endpoint, options = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.tokens.accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': `${this.appId}/1.0.0`,
        'X-Client-ID': this.appId,
        ...options.headers
      }
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    return response.json();
  }
}
```

## 🧪 Testing Requirements

### Integration Testing Checklist

**Authentication:**
- [ ] App requests authentication correctly
- [ ] Handles authentication timeout gracefully
- [ ] Validates message origins properly
- [ ] Stores tokens securely (memory only)

**API Integration:**
- [ ] All API calls include proper headers
- [ ] Error handling for failed requests
- [ ] Rate limiting compliance
- [ ] Response parsing and validation

**UI/UX:**
- [ ] Responsive design works on all screen sizes
- [ ] Theme switching (light/dark) functional
- [ ] Loading states provide user feedback
- [ ] Error states display helpful messages

**Performance:**
- [ ] Meets Core Web Vitals targets
- [ ] Bundle size within limits
- [ ] Memory usage optimized
- [ ] API calls cached appropriately

### Testing Tools

```bash
# Performance testing
npm install -g lighthouse
lighthouse https://your-app.example.com --chrome-flags="--headless"

# Bundle size analysis
npm install -g webpack-bundle-analyzer
webpack-bundle-analyzer dist/static/js/*.js

# API testing
curl -H "Authorization: Bearer test_token" \
     https://api.oriva.io/api/v1/profiles/available
```

## 🛠️ Development Tools

### Local Development Setup

```bash
# Install development dependencies
npm install --save-dev @oriva/dev-tools

# Start development server with HTTPS
npm run dev:https

# Test iframe embedding
npm run test:iframe

# Validate app manifest
npm run validate:manifest
```

### Configuration Files

**package.json scripts:**
```json
{
  "scripts": {
    "dev:https": "https-localhost 3000",
    "test:iframe": "node scripts/test-iframe.js",
    "validate:manifest": "node scripts/validate-manifest.js",
    "lighthouse": "lighthouse https://localhost:3000"
  }
}
```

## 📚 Best Practices

### Security Best Practices

1. **Origin Validation**: Always validate message origins in iframe communication
2. **Token Storage**: Use memory-only storage, never localStorage for sensitive data
3. **HTTPS Everywhere**: Use HTTPS for all production and testing environments
4. **Content Security Policy**: Implement strict CSP with specific allowed domains
5. **Input Validation**: Validate all user inputs and API responses

### Performance Best Practices

1. **Lazy Loading**: Load non-critical resources only when needed
2. **Bundle Optimization**: Split code and load only necessary modules
3. **Image Optimization**: Use modern formats (WebP) and appropriate sizes
4. **API Efficiency**: Cache responses and batch requests when possible
5. **Memory Management**: Clean up event listeners and unused objects

### User Experience Best Practices

1. **Loading States**: Show progress for all async operations
2. **Error Handling**: Provide clear, actionable error messages
3. **Responsive Design**: Support all device sizes and orientations
4. **Accessibility**: Follow WCAG 2.1 AA guidelines
5. **Theme Support**: Implement both light and dark themes

## 🚨 Common Issues & Solutions

### "Refused to display in a frame" Error

**Problem**: Restrictive frame policies
**Solution**: Configure CSP `frame-ancestors` or remove X-Frame-Options

### Authentication Not Working

**Problem**: Message origin validation or timeout
**Solution**: Check allowed origins and increase timeout duration

### API Calls Failing

**Problem**: Missing headers or invalid tokens
**Solution**: Verify all required headers and token validity

### Performance Issues

**Problem**: Large bundle sizes or slow loading
**Solution**: Implement code splitting and optimize resources

## 📞 Support & Resources

### Documentation Links
- [Authentication Patterns](./authentication-patterns.md)
- [API Headers Reference](./api-headers-reference.md)
- [Secure Iframe Integration](./iframe-integration-secure.md)
- [API Troubleshooting Guide](./api-troubleshooting-guide.md)

### Getting Help
- **GitHub Issues**: Technical support and bug reports
- **GitHub Discussions**: Questions and community support
- **Security Issues**: Email security@oriva.io

---

**Next Steps**: After implementing these requirements, test your app thoroughly using the provided checklists and tools. Review the [Security Warning](./SECURITY-WARNING.md) for additional security considerations.

*Last Updated: January 2025*