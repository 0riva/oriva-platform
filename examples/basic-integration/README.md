# Basic Oriva Platform Integration Example

This example demonstrates the fundamental patterns for integrating with the Oriva Platform API.

## What You'll Learn

- ✅ API key authentication
- ✅ Making API calls with proper headers
- ✅ Error handling and retries
- ✅ Working with paginated responses
- ✅ Best practices for production use

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Your API Key

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` and add your API key:

```bash
ORIVA_API_KEY=oriva_pk_test_your_actual_key_here
```

**Get your API key**: Visit the Oriva developer dashboard to generate your API key.

### 3. Run the Example

```bash
npm start
```

**Expected Output**:

```
🚀 Oriva Platform API Integration Examples

══════════════════════════════════════════════════
📝 Fetching current user...
✅ Success! User data: { id: 'ext_user_...', name: '...', email: '...' }

📂 Fetching available profiles...
✅ Found 2 profile(s)
  1. Work Profile (ext_profile_xyz)
  2. Personal Profile (ext_profile_abc)

🏪 Browsing marketplace apps...
✅ Found 5 app(s):
  1. Task Manager Pro - Advanced task management
     Category: productivity | Installs: 1250
  ...

✨ All examples completed successfully!
```

## Code Structure

### `index.js`

The main file contains reusable functions:

- **`callOrivaAPI(endpoint, options)`** - Base API client
- **`getCurrentUser()`** - Fetch authenticated user
- **`listProfiles()`** - List available profiles
- **`browseMarketplace(limit)`** - Browse marketplace apps
- **`getTrendingApps(limit)`** - Get trending apps

### Usage in Your Own Code

```javascript
const { callOrivaAPI } = require('./index');

async function myCustomFunction() {
  const response = await callOrivaAPI('/api/v1/user/me');
  console.log(response.data);
}
```

## Key Patterns Demonstrated

### 1. Authentication

```javascript
headers: {
  'Authorization': `Bearer ${ORIVA_API_KEY}`,
  'Content-Type': 'application/json',
  'User-Agent': 'Oriva-Example/1.0'
}
```

### 2. Error Handling

```javascript
if (!response.ok) {
  const error = await response.json().catch(() => ({}));
  throw new Error(error.error || `HTTP ${response.status}`);
}
```

### 3. Response Format

All successful responses follow this structure:

```json
{
  "ok": true,
  "success": true,
  "data": { ... },
  "meta": { ... }
}
```

## Next Steps

After running this example, explore:

1. **[Server-Side Proxy Example](../server-proxy/)** - Secure pattern for web apps
2. **[Developer App Example](../developer-app/)** - Create and manage marketplace apps
3. **[Advanced Patterns](../advanced/)** - Caching, retries, and rate limiting

## Troubleshooting

### "ORIVA_API_KEY not configured"

Make sure you've created a `.env` file and added your API key.

### "Invalid API key" Error

- Verify your API key is correct
- Check that it hasn't expired
- Ensure you're using the right environment (test vs live)

### Connection Errors

If running locally against `http://localhost:3001`:
- Make sure the dev server is running
- Set `ORIVA_BASE_URL=http://localhost:3001` in `.env`

## Documentation

- [API Endpoints Index](../../docs/public/developer-guide/api-endpoints-index.md)
- [Complete API Reference](../../docs/public/developer-guide/api-reference-complete.md)
- [Quick Start Guide](../../docs/public/developer-guide/quick-start.md)

## License

MIT
