# Testing Groups API - Quick Guide

## Prerequisites

1. **Supabase must be running** (o-core manages it):

   ```bash
   cd /Users/cosmic/o-core
   supabase status  # Should show API running on port 54341
   ```

2. **Get your API key**:
   - Check `.env` file for `API_KEY_PLATFORM` or create one in the database
   - Or use the test API key from test setup

## Method 1: Run Unit Tests

```bash
cd /Users/cosmic/o-platform
npm test -- tests/api/groups.test.js
```

## Method 2: Run E2E Tests

```bash
cd /Users/cosmic/o-platform
npm test -- tests/integration/groups.e2e.test.ts
```

## Method 3: Manual Testing with curl

### 1. Start the API server

```bash
cd /Users/cosmic/o-platform
npm run dev
# Server runs on port 3001 (or PORT from .env)
```

### 2. Test GET /api/v1/groups

```bash
# Replace YOUR_API_KEY with actual API key
curl -X GET http://localhost:3001/api/v1/groups \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" | jq
```

**Expected Response:**

```json
{
  "ok": true,
  "success": true,
  "data": [
    {
      "groupId": "uuid-here",
      "groupName": "Group Name",
      "memberCount": 5,
      "isActive": true,
      "role": "admin",
      "description": "Group description"
    }
  ]
}
```

### 3. Test GET /api/v1/groups/:groupId/members

```bash
# Replace GROUP_ID with actual group UUID
curl -X GET http://localhost:3001/api/v1/groups/GROUP_ID/members \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" | jq
```

**Expected Response:**

```json
{
  "ok": true,
  "success": true,
  "data": [
    {
      "memberId": "profile-uuid",
      "displayName": "Profile Name",
      "role": "member",
      "joinedAt": "2024-01-01T00:00:00Z",
      "avatar": null
    }
  ]
}
```

## Method 4: Test with Browser/Postman

1. **Start server**: `npm run dev`
2. **Base URL**: `http://localhost:3001`
3. **Endpoints**:
   - `GET /api/v1/groups`
   - `GET /api/v1/groups/:groupId/members`
4. **Headers**:
   - `Authorization: Bearer YOUR_API_KEY`
   - `Content-Type: application/json`

## What to Test

### ✅ Success Cases:

1. **User created groups** - Should appear with `role: "admin"`
2. **User's profiles joined groups** - Should appear with role from `profile_memberships`
3. **Deduplication** - If user created AND joined same group, should appear once (as admin)
4. **Access control** - Can access members if user created group OR profile is member
5. **Empty results** - Should return `[]` not errors

### ❌ Error Cases:

1. **No API key** - Should return 401
2. **Invalid UUID** - Should return 400 for group members endpoint
3. **Group not found** - Should return 404
4. **No access** - Should return 403 if user can't access group

## Troubleshooting

### Port conflicts:

- API runs on port 3001 (or PORT from .env)
- Supabase API runs on 54341 (o-core manages this)

### API key issues:

- Check `.env` for `API_KEY_PLATFORM`
- Verify key exists in `developer_api_keys` table
- Key should be associated with a user

### Database connection:

- Ensure Supabase is running: `cd o-core && supabase status`
- Check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`

### Common errors:

- **500 error**: Check server logs, verify database schema matches
- **401 error**: API key missing or invalid
- **403 error**: User doesn't have access (expected if not creator/member)
