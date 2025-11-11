# Development Mode Setup

## Dev Mode Authentication

In development mode (`NODE_ENV=development`), the API can work without an API key for local testing.

### Setup

Add to your `.env` file:

```bash
DEV_USER_ID=your-test-user-uuid-here
```

### How It Works

1. **Development Only**: This feature ONLY works when `NODE_ENV=development`
2. **Production Safe**: In production (`NODE_ENV=production`), this code path is never executed
3. **Requires Env Var**: Set `DEV_USER_ID` to a valid user UUID from your local database

### Getting a Test User ID

```bash
# Query your local Supabase database
psql postgresql://postgres:postgres@127.0.0.1:54331/postgres -c "SELECT id, email FROM auth.users LIMIT 1;"
```

### Security Note

- ✅ **Safe for production**: Code only executes when `NODE_ENV=development`
- ✅ **No hardcoded IDs**: Uses environment variable
- ✅ **Graceful fallback**: If `DEV_USER_ID` not set, uses placeholder that returns empty results

### Alternative: Use Real API Key

Instead of dev mode, you can create a test API key in the `developer_api_keys` table and use it:

```bash
curl -H "Authorization: Bearer oriva_pk_test_your_key_here" http://localhost:3001/api/v1/groups
```
