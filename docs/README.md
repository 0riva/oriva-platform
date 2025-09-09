# Oriva Platform API Documentation

This directory contains the API documentation for the Oriva Platform.

## Files

- **`index.html`** - Main documentation website with interactive API reference
- **`openapi.yml`** - OpenAPI 3.0 specification for the Oriva Platform API
- **`START_GUIDE.md`** - Developer start guide with step-by-step instructions
- **`api-tester.html`** - Interactive API testing tool for developers
- **`_config.yml`** - GitHub Pages configuration

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

- Secure API key handling via environment variables
- Server-side proxy examples (Node.js, Python)
- Interactive endpoint testing
- Response visualization

See the file for detailed setup instructions.
