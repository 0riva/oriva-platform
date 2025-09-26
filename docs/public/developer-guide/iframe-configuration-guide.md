# Iframe Configuration Guide

**Secure iframe embedding configuration for Oriva platform integration**

## Overview

This guide helps you configure your application to be securely embedded in iframes within the Oriva platform. Proper configuration ensures your app works reliably while maintaining security standards.

## 🛡️ Security Headers Configuration

### Modern Approach: Content Security Policy (Recommended)

CSP provides granular control over iframe embedding:

```http
Content-Security-Policy: frame-ancestors 'self' https://oriva.io https://*.oriva.io https://app.oriva.io
```

**Benefits of CSP:**
- Specific domain allowlist
- Modern browser standard
- More flexible than X-Frame-Options
- Supported by all major browsers

### Legacy Approach: X-Frame-Options

For legacy browser support or simpler configuration:

```http
X-Frame-Options: SAMEORIGIN
```

**Important**: Don't use both CSP `frame-ancestors` and `X-Frame-Options` together. Choose one approach.

## 🔧 Platform-Specific Implementation

### Vercel (Recommended Configuration)

Create or update `vercel.json`:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "frame-ancestors 'self' https://oriva.io https://*.oriva.io https://app.oriva.io"
        }
      ]
    }
  ]
}
```

### Netlify

Add to `netlify.toml`:

```toml
[[headers]]
  for = "/*"
  [headers.values]
    Content-Security-Policy = "frame-ancestors 'self' https://oriva.io https://*.oriva.io https://app.oriva.io"
```

### Next.js

Add to `next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://oriva.io https://*.oriva.io https://app.oriva.io"
          }
        ]
      }
    ];
  }
};

module.exports = nextConfig;
```

### React (Create React App)

For CRA, you'll need to configure headers at the hosting level (Vercel, Netlify) or eject and configure webpack.

### Express.js/Node.js

```javascript
const express = require('express');
const helmet = require('helmet');
const app = express();

// Option 1: Using helmet middleware (recommended)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      frameAncestors: ["'self'", "https://oriva.io", "https://*.oriva.io", "https://app.oriva.io"]
    }
  }
}));

// Option 2: Manual header setting
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "frame-ancestors 'self' https://oriva.io https://*.oriva.io https://app.oriva.io"
  );
  next();
});
```

### Apache (.htaccess)

```apache
# CSP approach (recommended)
Header always set Content-Security-Policy "frame-ancestors 'self' https://oriva.io https://*.oriva.io https://app.oriva.io"

# OR X-Frame-Options approach (legacy)
Header always set X-Frame-Options "SAMEORIGIN"
```

### Nginx

```nginx
# CSP approach (recommended)
add_header Content-Security-Policy "frame-ancestors 'self' https://oriva.io https://*.oriva.io https://app.oriva.io" always;

# OR X-Frame-Options approach (legacy)
add_header X-Frame-Options "SAMEORIGIN" always;
```

## 📋 Configuration Decision Matrix

| Option | Security Level | Browser Support | Oriva Compatibility | Recommended |
|--------|---------------|-----------------|---------------------|-------------|
| **CSP frame-ancestors** | High | Modern browsers | ✅ Full | ✅ **Yes** |
| **X-Frame-Options: SAMEORIGIN** | Medium | All browsers | ✅ Full | ⚠️ Legacy only |
| **No headers** | Low | N/A | ✅ Works | ❌ Not secure |
| **X-Frame-Options: DENY** | High | All browsers | ❌ Blocked | ❌ Incompatible |
| **X-Frame-Options: ALLOWALL** | Very Low | All browsers | ✅ Works | ❌ Security risk |

## 🧪 Testing Your Configuration

### 1. Check Response Headers

```bash
# Test your app's headers
curl -I https://your-app.example.com

# Look for one of these lines:
# Content-Security-Policy: frame-ancestors 'self' https://oriva.io...
# X-Frame-Options: SAMEORIGIN
```

### 2. Browser Developer Tools Test

1. Open your app in a browser
2. Open Developer Tools (F12)
3. Go to Network tab
4. Refresh the page
5. Click on the main document request
6. Check Response Headers for CSP or X-Frame-Options

### 3. Iframe Embedding Test

Create a test HTML file:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Iframe Embedding Test</title>
</head>
<body>
    <h1>Testing Iframe Embedding</h1>

    <!-- Test your app -->
    <iframe
        src="https://your-app.example.com"
        width="800"
        height="600"
        style="border: 1px solid #ccc;">
    </iframe>

    <script>
        // Listen for any iframe errors
        window.addEventListener('message', (event) => {
            console.log('Message from iframe:', event.data);
        });

        // Check for iframe load errors
        const iframe = document.querySelector('iframe');
        iframe.onload = () => console.log('Iframe loaded successfully');
        iframe.onerror = () => console.error('Iframe failed to load');
    </script>
</body>
</html>
```

### 4. Automated Testing

```javascript
// Jest test for CSP headers
describe('Security Headers', () => {
  test('should include proper CSP frame-ancestors', async () => {
    const response = await fetch('https://your-app.example.com');
    const csp = response.headers.get('content-security-policy');

    expect(csp).toContain('frame-ancestors');
    expect(csp).toContain('https://oriva.io');
    expect(csp).toContain('https://app.oriva.io');
  });
});
```

## 🚨 Common Issues & Solutions

### Issue: "Refused to display in a frame because it set 'X-Frame-Options' to 'deny'"

**Problem**: X-Frame-Options is set to DENY
**Solution**:
1. Remove or change X-Frame-Options to SAMEORIGIN
2. OR implement CSP frame-ancestors instead

```javascript
// Fix: Change from DENY to SAMEORIGIN
res.setHeader('X-Frame-Options', 'SAMEORIGIN');

// Better: Use CSP instead
res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https://app.oriva.io");
```

### Issue: App loads outside Oriva but not inside

**Problem**: Frame policy doesn't include Oriva domains
**Solution**: Add Oriva domains to your frame-ancestors directive

```javascript
// Add all Oriva domains
res.setHeader(
  'Content-Security-Policy',
  "frame-ancestors 'self' https://oriva.io https://*.oriva.io https://app.oriva.io"
);
```

### Issue: Headers not taking effect

**Problem**: Configuration not deployed or cached
**Solutions**:
1. Clear browser cache and test in incognito mode
2. Verify deployment updated configuration files
3. Check if hosting platform requires additional setup
4. Test with curl to verify headers are set

### Issue: Mixed CSP and X-Frame-Options

**Problem**: Using both CSP frame-ancestors and X-Frame-Options
**Solution**: Choose one approach (CSP recommended)

```javascript
// Wrong: Using both
res.setHeader('X-Frame-Options', 'SAMEORIGIN');
res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");

// Right: Use only CSP
res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https://app.oriva.io");
```

## 🔒 Security Best Practices

### 1. Principle of Least Privilege

Only allow necessary domains:

```javascript
// Good: Specific domains
"frame-ancestors 'self' https://app.oriva.io"

// Bad: Too permissive
"frame-ancestors *"
```

### 2. Regular Security Reviews

- Review frame policies quarterly
- Update allowed domains as needed
- Remove unused domain permissions
- Test configuration after changes

### 3. Environment-Specific Configuration

```javascript
// Different configs for different environments
const cspConfig = {
  development: "frame-ancestors 'self' http://localhost:3000 https://dev.oriva.io",
  staging: "frame-ancestors 'self' https://staging.oriva.io",
  production: "frame-ancestors 'self' https://app.oriva.io https://oriva.io"
};

const csp = cspConfig[process.env.NODE_ENV] || cspConfig.production;
res.setHeader('Content-Security-Policy', csp);
```

### 4. Monitoring and Alerting

```javascript
// Log CSP violations
app.use('/csp-report', express.json(), (req, res) => {
  console.error('CSP Violation:', req.body);
  // Send to monitoring service
  res.status(200).send('OK');
});

// Add reporting to CSP
const csp = "frame-ancestors 'self' https://app.oriva.io; report-uri /csp-report";
res.setHeader('Content-Security-Policy', csp);
```

## 📊 Performance Considerations

### Impact on Load Time

Frame policies have minimal performance impact:
- CSP parsing: < 1ms
- Header transmission: < 100 bytes
- Browser processing: Negligible

### Optimization Tips

1. **Combine Headers**: Include frame policies with other security headers
2. **Cache Headers**: Set appropriate cache headers for static content
3. **Minimize Header Size**: Use concise domain specifications

```javascript
// Efficient header combination
app.use((req, res, next) => {
  res.set({
    'Content-Security-Policy': "frame-ancestors 'self' https://app.oriva.io",
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cache-Control': 'public, max-age=31536000'
  });
  next();
});
```

## 🛠️ Development Tools

### Header Validation Tools

```bash
# Online tools
# https://securityheaders.com/
# https://csp-evaluator.withgoogle.com/

# Command line tools
npm install -g header-checker
header-checker https://your-app.example.com

# Browser extensions
# CSP Evaluator (Chrome)
# Security Headers (Firefox)
```

### Local Testing Script

```javascript
// test-iframe.js
const puppeteer = require('puppeteer');

async function testIframeEmbedding() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // Create test page with iframe
  const testHTML = `
    <iframe src="https://your-app.example.com" width="800" height="600"></iframe>
  `;

  await page.setContent(testHTML);

  // Wait for iframe to load or fail
  try {
    await page.waitForSelector('iframe', { timeout: 10000 });
    console.log('✅ Iframe embedding test passed');
  } catch (error) {
    console.error('❌ Iframe embedding test failed:', error.message);
  }

  await browser.close();
}

testIframeEmbedding();
```

## 📚 Additional Resources

### Related Documentation
- [App Integration Requirements](./app-integration-requirements.md)
- [Secure Iframe Integration](./iframe-integration-secure.md)
- [Security Warning](./SECURITY-WARNING.md)
- [Authentication Patterns](./authentication-patterns.md)

### External Resources
- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [MDN: X-Frame-Options](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options)
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/)

---

**Next Steps**: After configuring your headers, test iframe embedding thoroughly and integrate with [Secure Iframe Authentication](./iframe-integration-secure.md) patterns.

*Last Updated: January 2025*