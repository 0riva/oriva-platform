# Testing Guide - Platform Events & Notifications System

## Authentication Setup

The API endpoints require a **Supabase Auth JWT token** from a logged-in user.

### Option 1: Get Token from Existing User (Quickest)

If you already have a user account:

1. **Go to Supabase Auth Dashboard**
   - https://supabase.com/dashboard/project/cbzgvlkizkdfjmbrosav/auth/users

2. **Find a test user** (or create one)

3. **Get their access token**:
   ```sql
   -- Run this in Supabase SQL Editor to generate a token
   SELECT
     id as user_id,
     email,
     raw_app_meta_data,
     raw_user_meta_data
   FROM auth.users
   LIMIT 1;
   ```

4. **Generate a JWT token** using Supabase dashboard:
   - Click on a user in Auth → Users
   - Copy their UUID
   - Use that UUID in testing

### Option 2: Create Test User and Get Token

**Step 1**: Create a test user via Supabase Auth API:

```bash
curl -X POST 'https://cbzgvlkizkdfjmbrosav.supabase.co/auth/v1/signup' \
  -H "apikey: YOUR_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpassword123"
  }'
```

**Your Supabase Anon Key** (from .env):
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiemd2bGtpemtkZmptYnJvc2F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNDEwMjAsImV4cCI6MjA3MzYxNzAyMH0.GAqII3HLS7OKoKOWZxhfXhKEd55G1XpMPrM-MOJEdeg
```

The response will include an `access_token` - that's your JWT!

**Step 2**: Use the access_token in your API requests

---

### Option 3: Use Service Role Key (Admin Testing Only)

⚠️ **For testing purposes only** - bypasses all auth checks

Your Service Role Key (from .env):
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiemd2bGtpemtkZmptYnJvc2F2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODA0MTAyMCwiZXhwIjoyMDczNjE3MDIwfQ.1fltuMIW9yQpsLBoeAeO3jw1uwBl2bL58VphLTBaAUs
```

**Note**: This bypasses authentication but may fail because the auth middleware expects a user in the `users` table.

---

## Quick Test Script

Save this as `test-event-api.sh`:

```bash
#!/bin/bash

# Configuration
SUPABASE_URL="https://cbzgvlkizkdfjmbrosav.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiemd2bGtpemtkZmptYnJvc2F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNDEwMjAsImV4cCI6MjA3MzYxNzAyMH0.GAqII3HLS7OKoKOWZxhfXhKEd55G1XpMPrM-MOJEdeg"

# Step 1: Create test user and get JWT token
echo "Creating test user..."
RESPONSE=$(curl -s -X POST "$SUPABASE_URL/auth/v1/signup" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-events@oriva.io",
    "password": "TestPassword123!"
  }')

echo "Response: $RESPONSE"

# Extract access_token (you'll need jq installed: brew install jq)
ACCESS_TOKEN=$(echo $RESPONSE | jq -r '.access_token')
USER_ID=$(echo $RESPONSE | jq -r '.user.id')

echo ""
echo "==================================="
echo "Access Token: $ACCESS_TOKEN"
echo "User ID: $USER_ID"
echo "==================================="
echo ""

# Step 2: Test event publishing
echo "Testing event publishing..."
curl -X POST "https://api.oriva.com/api/v1/apps/test-app/events" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"user_id\": \"$USER_ID\",
    \"event_category\": \"session\",
    \"event_type\": \"test_event\",
    \"entity_type\": \"test\",
    \"entity_id\": \"test-001\",
    \"event_data\": {\"message\": \"Hello from test script!\"}
  }" | jq '.'

echo ""
echo "==================================="
echo "Test complete!"
echo "==================================="
```

Run it:
```bash
chmod +x test-event-api.sh
./test-event-api.sh
```

---

## Manual Testing Steps

### 1. Create User and Get Token

```bash
# Create user (or use existing)
curl -X POST 'https://cbzgvlkizkdfjmbrosav.supabase.co/auth/v1/signup' \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiemd2bGtpemtkZmptYnJvc2F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNDEwMjAsImV4cCI6MjA3MzYxNzAyMH0.GAqII3HLS7OKoKOWZxhfXhKEd55G1XpMPrM-MOJEdeg" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-test@email.com",
    "password": "YourPassword123!"
  }'
```

**Copy the `access_token` from the response!**

### 2. Test Event Publishing

```bash
# Replace YOUR_ACCESS_TOKEN and YOUR_USER_ID with values from step 1
curl -X POST "https://api.oriva.com/api/v1/apps/test-app/events" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "YOUR_USER_ID",
    "event_category": "session",
    "event_type": "test_started",
    "entity_type": "test_session",
    "entity_id": "session-001",
    "event_data": {"duration": 25, "type": "focus"}
  }'
```

### 3. Test Notification Creation

```bash
curl -X POST "https://api.oriva.com/api/v1/apps/test-app/notifications" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "YOUR_USER_ID",
    "title": "Test Notification",
    "body": "This is a test notification",
    "priority": "normal",
    "category": "test"
  }'
```

### 4. Query User Notifications

```bash
curl "https://api.oriva.com/api/v1/users/YOUR_USER_ID/notifications?status=unread" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## Expected Responses

### Success (Event Published)
```json
{
  "event_id": "123e4567-e89b-12d3-a456-426614174000",
  "timestamp": "2025-09-30T22:45:00Z"
}
```

### Success (Notification Created)
```json
{
  "notification_id": "123e4567-e89b-12d3-a456-426614174001",
  "created_at": "2025-09-30T22:45:00Z"
}
```

### Error (Missing Auth)
```json
{
  "error": "Missing or invalid Authorization header",
  "code": "AUTH_MISSING"
}
```

### Error (Invalid Token)
```json
{
  "error": "Invalid or expired token",
  "code": "AUTH_INVALID"
}
```

### Error (User Not Found)
```json
{
  "error": "User profile not found",
  "code": "USER_NOT_FOUND"
}
```

---

## Troubleshooting

### "User profile not found" Error

The auth middleware looks for a user in the `users` table. If your test user doesn't exist there:

**Option A**: Create the user profile manually:
```sql
INSERT INTO users (id, oriva_user_id, email, subscription_tier)
VALUES (
  gen_random_uuid(),
  'YOUR_SUPABASE_AUTH_USER_ID',
  'test@example.com',
  'free'
);
```

**Option B**: Use an existing user from the `users` table:
```sql
SELECT id, email FROM users LIMIT 1;
```

### "App ID is required" Error

You need to provide a valid `app_id` in the URL. Check `hugo_apps` table:
```sql
SELECT app_id, display_name FROM hugo_apps LIMIT 5;
```

Use one of those app IDs in your URL.

---

## Alternative: Test with Postman

1. **Import OpenAPI spec**: `docs/events-notifications-api.yml`
2. **Set up environment variables**:
   - `base_url`: https://api.oriva.com/v1
   - `access_token`: (get from Supabase signup)
3. **Add auth header**: `Authorization: Bearer {{access_token}}`
4. **Run requests** from the collection

---

## Next Steps After Successful Test

1. ✅ Verify event appears in `platform_events` table
2. ✅ Verify notification appears in `platform_notifications` table
3. ✅ Test querying endpoints
4. ✅ Test updating notification state
5. ✅ Set up webhooks
6. ✅ Test WebSocket streaming
7. ✅ Deploy background workers

---

**Need help?** Check the troubleshooting section or run the diagnostic queries in the SQL editor.
