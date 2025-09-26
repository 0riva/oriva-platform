# Oriva Platform API Documentation

This directory contains the API documentation for the Oriva Platform.

## Files

- **`index.html`** - Main documentation website with interactive API reference
- **`openapi.yml`** - OpenAPI 3.0 specification for the Oriva Platform API
- **`START_GUIDE.md`** - Developer start guide with step-by-step instructions
- **`api-tester.html`** - Interactive API testing tool for developers
- **`_config.yml`** - GitHub Pages configuration

## 🛡️ Third-Party Developer Documentation

**NEW**: Comprehensive, security-first integration guides for developers building on the Oriva Platform.

### 📚 **[Complete Developer Guide](./public/developer-guide/)**
- **Security-first patterns** - Production-ready authentication and API integration
- **Step-by-step guides** - From setup to deployment with secure defaults
- **Comprehensive API reference** - Complete endpoint documentation with best practices
- **Integration patterns** - Web apps, iframe embedding, and development workflows
- **Migration guidance** - Upgrade paths from legacy implementations

### 🚀 **Quick Access**
- **[15-Minute Quick Start](./public/developer-guide/quick-start.md)** - Fast, secure integration
- **[Security Guidelines](./public/developer-guide/SECURITY-WARNING.md)** - Critical security patterns
- **[Development Setup](./public/developer-guide/SECURE-localhost-development.md)** - Local environment configuration

## GitHub Pages Setup

This documentation is automatically deployed to GitHub Pages when changes are pushed to the main branch.

**Live Documentation**: https://0riva.github.io/oriva-platform/

## Local Development

To view the documentation locally:

1. **Simple HTTP Server**:
   ```bash
   cd docs
   python -m http.server 8000
   # Open http://localhost:8000
   ```

2. **Node.js HTTP Server**:
   ```bash
   cd docs
   npx http-server -p 8000
   # Open http://localhost:8000
   ```

## Updating Documentation

1. **Update OpenAPI spec**: Edit `openapi.yml`
2. **Update start guide**: Edit `START_GUIDE.md`
3. **Update main page**: Edit `index.html`
4. **Commit and push**: Changes auto-deploy to GitHub Pages

## API Tester

The `api-tester.html` file provides an interactive tool for developers to test Oriva Platform APIs. It includes:

### Features
- **Interactive endpoint testing** - Test all API endpoints with a single click
- **Real-time response viewing** - See JSON responses with syntax highlighting
- **Secure API key handling** - Server-side proxy with environment variables
- **Error handling** - Clear error messages and HTTP status codes
- **Rate limit friendly** - Built-in delays between requests
- **Professional UI** - Modern, responsive design with status badges
- **Setup validation** - Automatic detection of local server status

### How to Use (Secure Workflow)
1. **Set up local server**: Create and run the provided test server (Node.js or Python)
2. **Configure API key**: Set your API key in environment variables (`.env` file)
3. **Start proxy server**: Run the local test server to proxy requests securely
4. **Open the tester**: Navigate to `docs/api-tester.html` in your browser
5. **Test endpoints**: Click "🚀 Test All Endpoints" to test all available endpoints
6. **View results**: Expand response data to see detailed JSON responses
7. **Clear results**: Use "🗑️ Clear Results" to start fresh

### Security Features
- 🔐 **Server-side proxy** - API key never exposed in browser/client-side code
- 🔐 **Environment variables** - Uses proper `.env` file for API key storage
- 🔐 **Local-only** - No API key transmission to external servers
- 🔐 **CORS-enabled** - Secure cross-origin requests

### Available Endpoints
- **Health Check** - `/api/v1/health`
- **User Profile** - `/api/v1/user/me`
- **Entries** - `/api/v1/entries`
- **Templates** - `/api/v1/templates`
- **Storage** - `/api/v1/storage`
- **Admin Tools** - `/api/v1/dev/*` (requires admin token)

The tester automatically saves your API key for convenience and provides a much easier alternative to command-line testing.

See the file for detailed setup instructions.
