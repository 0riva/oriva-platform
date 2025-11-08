# Development Scripts

## Dev User Management

### Create Dev User

Creates a test user for local development and testing:

```bash
node scripts/create-dev-user.js
```

**Created User:**

- Email: `dev@oriva.io`
- Password: `DevPassword123`
- User ID: Auto-generated UUID
- Email confirmed: Yes (auto-confirmed)

**Purpose:**

- Testing Work Buddy dev login feature
- Local development authentication flows
- BFF proxy endpoint testing

### Verify Dev User

Verifies the dev user can authenticate through all layers:

```bash
node scripts/verify-dev-user.js
```

**Tests Performed:**

1. User exists in Supabase admin API
2. Direct Supabase authentication with credentials
3. BFF proxy login endpoint (`/api/v1/auth/login`)

**Expected Output:**

- ✅ User found in auth.users table
- ✅ Authentication successful with Supabase
- ✅ BFF proxy authentication successful

## Usage

### First Time Setup

1. Start local Supabase instance (via o-core)
2. Start BFF proxy:
   ```bash
   cd /Users/cosmic/o-platform
   npm run dev
   ```
3. Create dev user:
   ```bash
   node scripts/create-dev-user.js
   ```

### Testing

After creating the dev user:

1. Verify authentication:

   ```bash
   node scripts/verify-dev-user.js
   ```

2. Test in Work Buddy app:
   - Navigate to http://localhost:8084
   - Click "DEV LOGIN" button
   - Should authenticate with dev@oriva.io credentials

### Re-creating User

If you need to reset the dev user password or recreate it:

```bash
node scripts/create-dev-user.js
```

The script will detect existing users and update the password if needed.

## Environment Requirements

Both scripts require these environment variables (from `.env`):

- `SUPABASE_URL` - Local Supabase URL (default: http://127.0.0.1:54341)
- `SUPABASE_SERVICE_ROLE_KEY` - Admin access key
- `SUPABASE_ANON_KEY` - Public access key (for verification)

## Troubleshooting

### User already exists

If the user already exists, the create script will update the password to `DevPassword123`.

### BFF proxy connection error

Make sure the BFF proxy is running on port 3001:

```bash
cd /Users/cosmic/o-platform
npm run dev
```

### Supabase connection error

Ensure local Supabase is running (managed by o-core):

```bash
cd /Users/cosmic/o-core
supabase status
```
