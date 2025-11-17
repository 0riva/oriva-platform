# BFF Proxy Guide (o-platform)

## 🎯 Purpose

This repository provides the **Backend-For-Frontend (BFF) proxy** used by o-orig (Work Buddy app) for local development.

The BFF proxy:

- Runs on port **3002**
- Proxies requests to **production Supabase**
- Handles **development authentication** via DEV_USER_ID
- Filters profiles by `is_anonymous = false`

---

## 🚀 Starting the BFF Proxy

```bash
cd /Users/cosmic/o-platform
npm run dev
```

**Expected Output:**

```
🚀 Oriva Platform API
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Base URL: http://localhost:3002
❤️  Health Check: http://localhost:3002/health
🔧 API Test: http://localhost:3002/api/v1/test
👤 User API: http://localhost:3002/api/v1/user/me
🏪 Marketplace: http://localhost:3002/api/v1/marketplace/apps
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌟 Ready for development! Try: curl http://localhost:3002/health
```

**Verify it's working:**

```bash
# Health check
curl http://localhost:3002/health

# Profiles endpoint (returns real profiles from production)
curl http://localhost:3002/api/v1/profiles/available
```

---

## 🔐 Development Authentication

### DEV_USER_ID Configuration

The BFF uses `DEV_USER_ID` from `.env` to bypass API key authentication in development mode.

**Current Configuration:**

```bash
# /Users/cosmic/o-platform/.env
DEV_USER_ID=b5e9e6c9-e319-425a-b370-98bbd997bbf9
```

This corresponds to:

- **Email**: tools@gavrielshaw.com
- **Account ID**: b5e9e6c9-e319-425a-b370-98bbd997bbf9
- **Profiles**: 5 non-anonymous profiles

### How DEV_USER_ID Works

When a request hits `/api/v1/profiles/available` without an API key:

1. BFF checks if `DEV_USER_ID` is set in `.env`
2. If set, BFF uses that account_id to query profiles
3. BFF filters out anonymous profiles (`is_anonymous = false`)
4. Returns list of active, non-anonymous profiles

**Code Location**: `api/index.ts:1315-1382`

---

## 🗄️ Database Configuration

### Production Supabase (Current)

**Active Configuration:**

```bash
# /Users/cosmic/o-platform/.env
SUPABASE_URL=https://cbzgvlkizkdfjmbrosav.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Why Production?

Local Supabase database (OrivaLocalDB) had **zero profiles**, causing BFF to return empty arrays or fallback data.

Production Supabase has:

- Real user accounts (auth.users)
- Real profiles (public.profiles)
- Real data for testing

### Local Supabase (Commented Out)

```bash
# LOCAL DEVELOPMENT: Shared o-core instance at 54341 (commented out - using production)
# SUPABASE_URL=http://127.0.0.1:54341
# SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
# ...
```

To switch back to local:

1. Uncomment local config
2. Comment out production config
3. Seed local database with test profiles
4. Update DEV_USER_ID to local account
5. Restart BFF

---

## 📡 Key Endpoints

### `/api/v1/profiles/available`

**Purpose**: Returns list of active, non-anonymous profiles for the authenticated user

**Request:**

```bash
curl http://localhost:3002/api/v1/profiles/available \
  -H "Content-Type: application/json"
```

**Response (Success):**

```json
{
  "ok": true,
  "success": true,
  "data": [
    {
      "profileId": "a2f04a80-9cd0-4911-99ba-e7bd82af0e8a",
      "profileName": "Gavriel",
      "isActive": true,
      "avatar": null,
      "isDefault": false
    },
    ...
  ]
}
```

**Response (Empty - No Profiles):**

```json
{
  "ok": true,
  "success": true,
  "data": []
}
```

**Query Logic** (`api/index.ts:1320-1328`):

```typescript
const { data: profiles, error } = await supabase
  .from('profiles')
  .select(
    'id, username, display_name, bio, location, website_url, avatar_url, created_at, updated_at, account_id, is_active, is_default'
  )
  .eq('account_id', keyInfo.userId) // Uses DEV_USER_ID in dev mode
  .eq('is_active', true) // Only active profiles
  .eq('is_anonymous', false) // Excludes anonymous profiles
  .order('created_at', { ascending: true });
```

### `/health`

**Purpose**: Verify BFF is running

**Request:**

```bash
curl http://localhost:3002/health
```

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2025-11-17T05:20:00.000Z"
}
```

---

## 🐛 Troubleshooting

### BFF Returns Empty Array

**Symptom:**

```json
{ "ok": true, "success": true, "data": [] }
```

**Diagnosis:**

```bash
# Check what profiles exist for DEV_USER_ID
ACCOUNT_ID="b5e9e6c9-e319-425a-b370-98bbd997bbf9"
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl "https://cbzgvlkizkdfjmbrosav.supabase.co/rest/v1/profiles?select=id,username,display_name,is_active,is_anonymous&account_id=eq.${ACCOUNT_ID}" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}"
```

**Common Causes:**

1. All profiles are `is_anonymous: true` (BFF filters these out)
2. DEV_USER_ID points to wrong account
3. No profiles exist for that account

**Fix:**

- Update DEV_USER_ID to account with non-anonymous profiles
- OR set `is_anonymous = false` for test profiles

### BFF Not Responding (Port 3002)

**Symptom:**

```
curl: (7) Failed to connect to localhost port 3002: Connection refused
```

**Diagnosis:**

```bash
# Check if BFF is running
lsof -i :3002
```

**Fix:**

```bash
# Kill stale processes
lsof -ti :3002 | xargs kill -9

# Restart BFF
cd /Users/cosmic/o-platform
npm run dev
```

### BFF Returns Fallback Data

**Symptom:**

```json
{
  "ok": true,
  "success": true,
  "data": [
    {
      "profileId": "ext_fallback_profile",
      "profileName": "My Profile",
      ...
    }
  ],
  "message": "Using fallback data due to database error"
}
```

**Cause:** Database query failed (check BFF console logs for Supabase errors)

**Fix:**

1. Verify Supabase connection in `.env`
2. Check service role key is valid
3. Verify profiles table exists and has correct schema

---

## 🔧 Configuration Files

### `.env` (Critical)

```bash
# Supabase Configuration
SUPABASE_URL=https://cbzgvlkizkdfjmbrosav.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Development User ID (bypasses API key requirement)
DEV_USER_ID=b5e9e6c9-e319-425a-b370-98bbd997bbf9

# Server
NODE_ENV=development
PORT=3002
```

### `api/index.ts` (BFF Implementation)

**Key Sections:**

- **Line 1315-1382**: `/api/v1/profiles/available` endpoint
- **Line 1320-1328**: Supabase query with filters
- **Line 1332-1348**: Fallback data on error
- **Line 1362-1368**: Profile transformation to API format

---

## 📞 Integration with o-orig

o-orig depends on this BFF proxy for local development. The flow is:

1. **o-orig** starts Metro bundler on port 8084
2. **o-orig** calls `useDevLogin()` hook on app load
3. **useDevLogin** fetches: `http://localhost:3002/api/v1/profiles/available`
4. **BFF proxy** queries production Supabase with DEV_USER_ID
5. **BFF proxy** returns filtered profiles
6. **o-orig** displays profile selector with real profiles

**Critical Files in o-orig:**

- `src/config/apiConfig.ts` - Hardcoded BFF URL (port 3002)
- `src/hooks/useDevLogin.ts` - Dev auth logic
- `.env` - API base URL

---

## 📝 Maintenance

### Changing Dev Account

To switch to a different test account:

1. **Find available accounts:**

   ```bash
   curl "https://cbzgvlkizkdfjmbrosav.supabase.co/auth/v1/admin/users" \
     -H "apikey: YOUR_SERVICE_ROLE_KEY" \
     -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
     | jq '.users[] | {id, email}'
   ```

2. **Check profiles for account:**

   ```bash
   curl "https://cbzgvlkizkdfjmbrosav.supabase.co/rest/v1/profiles?select=id,username,display_name,is_anonymous&account_id=eq.ACCOUNT_ID" \
     -H "apikey: YOUR_SERVICE_ROLE_KEY" \
     -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
   ```

3. **Update `.env`:**

   ```bash
   DEV_USER_ID=<new-account-id>
   ```

4. **Restart BFF:**
   ```bash
   lsof -ti :3002 | xargs kill -9
   npm run dev
   ```

### Switching to Local Supabase

1. **Seed local database:**

   ```bash
   cd /Users/cosmic/o-core
   supabase db reset
   # Insert test profiles via SQL or Supabase Studio
   ```

2. **Update `.env`:**

   ```bash
   # Comment out production
   # SUPABASE_URL=https://cbzgvlkizkdfjmbrosav.supabase.co
   # ...

   # Uncomment local
   SUPABASE_URL=http://127.0.0.1:54341
   SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
   SUPABASE_SERVICE_ROLE_KEY=sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz

   DEV_USER_ID=<local-account-id>
   ```

3. **Restart BFF**

---

## 🔗 Related Documentation

- **o-orig Setup**: `/Users/cosmic/o-orig/DEVELOPMENT_SETUP.md`
- **BFF Proxy Code**: `api/index.ts`
- **Environment Config**: `.env`

---

**Last Updated**: 2025-11-17
**Working Configuration**: Production Supabase + tools@gavrielshaw.com (5 profiles)
