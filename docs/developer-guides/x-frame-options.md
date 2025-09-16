# X-Frame-Options Configuration Guide

When deploying apps to the Oriva marketplace, your application needs to be embeddable in iframes for the app launcher to work properly. This guide helps you configure the correct headers.

## 1. Understanding X-Frame-Options

| Option | Description | Use Case |
|--------|-------------|----------|
| `DENY` | Never allow iframe embedding (most restrictive) | Banking, admin panels, auth pages |
| `SAMEORIGIN` | Allow embedding only from same origin/domain | General web apps, dashboards |
| `ALLOWALL` | Allow embedding from any domain (least secure) | Public widgets, embeddable tools |

## 2. Platform-Specific Configuration

### Vercel

Create or update `vercel.json` in your project root:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "SAMEORIGIN"
        }
      ]
    }
  ]
}
```

### Netlify

Add to your `netlify.toml`:

```toml
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "SAMEORIGIN"
```

### Express.js/Node.js

```javascript
// Manual header setting
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

// Or using helmet middleware (recommended)
const helmet = require('helmet');
app.use(helmet({
  frameguard: { action: 'sameorigin' }
}));
```

### Apache (.htaccess)

```apache
Header always append X-Frame-Options SAMEORIGIN
```

### Nginx

```nginx
add_header X-Frame-Options SAMEORIGIN always;
```

### Next.js

Add to `next.config.js`:

```javascript
module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          }
        ]
      }
    ];
  }
};
```

## 3. When to Use Each Option

### Use SAMEORIGIN when:
- ✅ Building apps for the Oriva marketplace
- ✅ Creating dashboard widgets or embedded components
- ✅ Developing preview functionality
- ✅ Building embeddable tools

### Use DENY when:
- ❌ Banking/financial applications
- ❌ Admin panels with sensitive data
- ❌ Authentication pages
- ❌ High-security applications that should never be embedded

## 4. Modern Alternative: Content Security Policy (CSP)

CSP provides more flexible control than X-Frame-Options:

```javascript
// Allow same origin
res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");

// Allow specific domains (recommended for Oriva apps)
res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https://app.oriva.io");

// Allow multiple trusted domains
res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https://app.oriva.io https://oriva.io");
```

## 5. Testing Your Configuration

### Check Headers
```bash
# Test your deployment
curl -I https://your-app.vercel.app

# Look for this line in the response:
# X-Frame-Options: SAMEORIGIN
```

### Test in Browser
1. Open browser developer tools
2. Go to Network tab
3. Load your app
4. Check response headers for X-Frame-Options

### Test Iframe Embedding
```html
<!-- Test if your app can be embedded -->
<iframe src="https://your-app.vercel.app" width="800" height="600"></iframe>
```

## 6. Best Practices

### ✅ Do:
- Default to `SAMEORIGIN` for most web applications
- Test iframe embedding after configuration changes
- Consider CSP `frame-ancestors` as a modern alternative
- Document your security choices
- Review configuration regularly as requirements change

### ❌ Don't:
- Mix X-Frame-Options with CSP frame-ancestors (use one or the other)
- Use `ALLOWALL` unless absolutely necessary
- Forget to test in actual iframe scenarios
- Assume hosting platforms set this automatically

## 7. Common Issues & Solutions

### "Refused to display in a frame" Error
**Problem**: X-Frame-Options is set to DENY
**Solution**: Change to SAMEORIGIN or configure CSP with appropriate frame-ancestors

### App Loads Outside Oriva But Not Inside
**Problem**: Overly restrictive frame policies
**Solution**: Add `https://app.oriva.io` to your CSP frame-ancestors

### Headers Not Taking Effect
**Problem**: Caching or configuration not deployed
**Solution**: Clear cache, redeploy, and verify headers with curl

## 8. Oriva-Specific Recommendations

For apps deployed to the Oriva marketplace, we recommend:

```javascript
// Option 1: SAMEORIGIN (simplest)
"X-Frame-Options": "SAMEORIGIN"

// Option 2: CSP with Oriva domains (more secure)
"Content-Security-Policy": "frame-ancestors 'self' https://app.oriva.io https://oriva.io"
```

## Need Help?

If you're still having issues with iframe embedding:

1. Check our [troubleshooting guide](./troubleshooting.md)
2. Test your headers using the curl command above
3. Join our [developer community](https://discord.gg/oriva) for support
4. Contact us at [developers@oriva.io](mailto:developers@oriva.io)

---

**Next Steps**: Once your headers are configured, test your app in the [Oriva App Launcher](https://app.oriva.io) to ensure proper embedding.