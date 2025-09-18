# 📖 Developer Guides

**Comprehensive documentation for 3rd party developers integrating with the Oriva Platform**

## 🚀 Quick Start

New to Oriva Platform? Start here:

1. **📋 [Start Guide](../START_GUIDE.md)** - Complete setup and integration tutorial
2. **📖 [API Reference Guide](./api-reference-guide.md)** - Detailed endpoint documentation with property lists
3. **🔗 [API Headers Guide](./api-headers-guide.md)** - Complete header documentation and troubleshooting

## 📚 Complete Guide Index

### Core Integration
- **📖 [API Reference Guide](./api-reference-guide.md)** - Complete API documentation with explicit property lists, response schemas, and discovery guidance
- **🔗 [API Headers Guide](./api-headers-guide.md)** - Required, recommended, and optional headers with examples
- **🎮 [App Integration Requirements](./app-integration-requirements.md)** - Technical specifications for app launcher integration

### Specialized Guides
- **🔧 [X-Frame-Options Guide](./x-frame-options.md)** - Iframe embedding configuration
- **🚀 [App Launcher Migration](./app-launcher-migration.md)** - Upgrading to the new launcher system
- **📋 [App Launcher Integration](./app-launcher-integration.md)** - Advanced launcher features and configuration

## 🔧 Development Tools

### Interactive API Explorer
```bash
# Run the interactive API property discovery tool
node docs/developer-guides/api-explorer.js
```

**Features:**
- Automatic property discovery for all endpoints
- TypeScript interface generation
- Response schema analysis
- Interactive endpoint testing
- Rate limit friendly exploration

### API Testing Tools
- **🧪 Interactive API Tester**: `docs/api-tester.html` - Visual interface for testing endpoints
- **🔍 Property Explorer**: `api-explorer.js` - Command-line tool for discovering response properties
- **📊 Response Analysis**: Built-in tools for understanding API structure

## 🎯 Quick Reference

### Essential Endpoints
```javascript
// User information
GET /api/v1/user/me

// Available profiles
GET /api/v1/profiles/available

// User groups
GET /api/v1/groups

// Marketplace apps
GET /api/v1/marketplace/apps

// Installed apps (requires auth validation)
GET /api/v1/marketplace/installed
```

### Response Format
All endpoints follow this consistent structure:
```json
{
  "success": true,
  "data": { /* endpoint-specific data */ },
  "meta": { /* optional metadata */ }
}
```

### Authentication
```javascript
const headers = {
  'Authorization': 'Bearer oriva_pk_live_your_key_here',
  'Content-Type': 'application/json',
  'User-Agent': 'your-app/1.0.0',
  'X-Client-ID': 'your-app'
};
```

## 🔍 Property Discovery Methods

### 1. API Reference Guide
- **Complete property lists** for all endpoints
- **Type information** and constraints
- **Example responses** with real data
- **Privacy protection** details

### 2. Interactive Explorer
- **Run `api-explorer.js`** for automatic discovery
- **TypeScript interface generation**
- **Real-time property analysis**
- **Schema documentation**

### 3. Browser Development
- **Network tab** in browser DevTools
- **Console testing** with fetch()
- **Response inspection** in real-time
- **Property validation** during development

### 4. Command Line Tools
- **curl + jq** for JSON property extraction
- **API testing** with detailed responses
- **Property filtering** and analysis
- **Batch endpoint exploration**

## 🛡️ Security & Privacy

### Privacy-First Features
- **ID Sanitization**: All IDs prefixed (`ext_`, `ext_member_`) and cannot be linked to internal data
- **User Authorization**: Explicit consent required for profile/group access
- **Cross-Profile Protection**: Apps cannot determine if profiles belong to same user
- **Minimal Data**: Only display names and essential information provided

### Security Best Practices
- **Never expose API keys** in client-side code in production
- **Use environment variables** for sensitive configuration
- **Implement proper error handling** for auth failures
- **Follow CSP guidelines** for iframe embedding

## 📊 Rate Limits

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| **Core API** | 1,000 requests | Per 15 minutes |
| **Marketplace** | 1,000 requests | Per hour |
| **Admin Endpoints** | 30 requests | Per minute |

## 🆘 Getting Help

### Documentation Issues
- **Missing properties?** Check the [API Reference Guide](./api-reference-guide.md)
- **Headers not working?** See [API Headers Guide](./api-headers-guide.md)
- **Integration problems?** Review [App Integration Requirements](./app-integration-requirements.md)

### Community Support
- **🐛 [GitHub Issues](https://github.com/0riva/oriva-platform/issues)** - Report bugs and request features
- **💬 [GitHub Discussions](https://github.com/0riva/oriva-platform/discussions)** - Ask questions and share solutions
- **🌐 [CORS Header Requests](../../.github/ISSUE_TEMPLATE/cors-header-request.md)** - Request new headers

### Development Resources
- **🧪 API Tester**: Interactive testing tool at `docs/api-tester.html`
- **🔍 Property Explorer**: Command-line discovery tool `api-explorer.js`
- **📖 Complete Examples**: See START_GUIDE.md for integration walkthroughs

## 🚀 What's New

### January 2025 Updates
- ✅ **Complete property lists** for all API endpoints
- ✅ **Interactive property discovery** tools
- ✅ **TypeScript interface generation**
- ✅ **Enhanced discovery guidance**
- ✅ **Comprehensive response schemas**
- ✅ **Best practices documentation**

### Coming Soon
- 🔧 **SDK libraries** for popular languages
- 📱 **Mobile integration guides**
- 🎯 **Advanced use case examples**
- 🔄 **Webhook documentation**

---

**Last Updated**: January 2025 | **API Version**: v1.0
**Questions?** [Open an issue](https://github.com/0riva/oriva-platform/issues/new) or join our [discussions](https://github.com/0riva/oriva-platform/discussions)