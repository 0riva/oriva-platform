#!/bin/bash
set -e

echo "🔧 Creating test data for profile interactions in groups..."
echo ""

# Check if Supabase is running
if ! curl -s http://127.0.0.1:54321/rest/v1/ > /dev/null 2>&1; then
  echo "❌ Error: Supabase is not running"
  echo "   Run 'supabase start' first"
  exit 1
fi

# Configuration
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"

echo "📝 Step 1: Creating test users..."

# Create test user 1 (main user)
USER1_RESPONSE=$(curl -s -X POST 'http://127.0.0.1:54321/auth/v1/signup' \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user1@test.com",
    "password": "password123",
    "options": {
      "data": {
        "username": "user1"
      }
    }
  }')

USER1_ID=$(echo "$USER1_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['user']['id'])" 2>/dev/null || echo "")

if [ -z "$USER1_ID" ]; then
  # User might already exist, try to get ID
  USER1_ID=$(psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -t -c "SELECT id FROM auth.users WHERE email = 'user1@test.com';" | xargs)
fi

# Create test user 2 (responder)
USER2_RESPONSE=$(curl -s -X POST 'http://127.0.0.1:54321/auth/v1/signup' \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user2@test.com",
    "password": "password123",
    "options": {
      "data": {
        "username": "user2"
      }
    }
  }')

USER2_ID=$(echo "$USER2_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['user']['id'])" 2>/dev/null || echo "")

if [ -z "$USER2_ID" ]; then
  USER2_ID=$(psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -t -c "SELECT id FROM auth.users WHERE email = 'user2@test.com';" | xargs)
fi

# Create test user 3 (another responder)
USER3_RESPONSE=$(curl -s -X POST 'http://127.0.0.1:54321/auth/v1/signup' \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user3@test.com",
    "password": "password123",
    "options": {
      "data": {
        "username": "user3"
      }
    }
  }')

USER3_ID=$(echo "$USER3_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['user']['id'])" 2>/dev/null || echo "")

if [ -z "$USER3_ID" ]; then
  USER3_ID=$(psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -t -c "SELECT id FROM auth.users WHERE email = 'user3@test.com';" | xargs)
fi

echo "✅ Users created/found:"
echo "   User 1: $USER1_ID"
echo "   User 2: $USER2_ID"
echo "   User 3: $USER3_ID"
echo ""

echo "📝 Step 2: Getting profile IDs..."

# Get profile IDs
PROFILE1_ID=$(psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -t -c "SELECT id FROM profiles WHERE account_id = '$USER1_ID' LIMIT 1;" | xargs)
PROFILE2_ID=$(psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -t -c "SELECT id FROM profiles WHERE account_id = '$USER2_ID' LIMIT 1;" | xargs)
PROFILE3_ID=$(psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -t -c "SELECT id FROM profiles WHERE account_id = '$USER3_ID' LIMIT 1;" | xargs)

echo "   Profile 1: $PROFILE1_ID"
echo "   Profile 2: $PROFILE2_ID"
echo "   Profile 3: $PROFILE3_ID"
echo ""

echo "📝 Step 3: Updating profiles with avatar URLs..."

# Update profiles with test avatar URLs
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres <<SQL
UPDATE profiles SET 
  avatar_url = 'https://api.dicebear.com/7.x/avataaars/svg?seed=user1',
  display_name = 'Alice Test'
WHERE id = '$PROFILE1_ID';

UPDATE profiles SET 
  avatar_url = 'https://api.dicebear.com/7.x/avataaars/svg?seed=user2',
  display_name = 'Bob Test'
WHERE id = '$PROFILE2_ID';

UPDATE profiles SET 
  avatar_url = 'https://api.dicebear.com/7.x/avataaars/svg?seed=user3',
  display_name = 'Charlie Test'
WHERE id = '$PROFILE3_ID';
SQL

echo "✅ Profiles updated with avatars"
echo ""

echo "📝 Step 4: Creating a test group..."

# Create a test group
GROUP_ID=$(psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -t -c "
INSERT INTO groups (name, description, created_by, visibility)
VALUES ('Test Group', 'A test group for profile interactions', '$USER1_ID', 'public')
RETURNING id;
" | xargs)

echo "   Group ID: $GROUP_ID"
echo ""

echo "📝 Step 5: Adding users to the group..."

# Add all users to the group
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres <<SQL
INSERT INTO group_members (group_id, user_id, role)
VALUES 
  ('$GROUP_ID', '$USER1_ID', 'admin'),
  ('$GROUP_ID', '$USER2_ID', 'member'),
  ('$GROUP_ID', '$USER3_ID', 'member')
ON CONFLICT DO NOTHING;
SQL

echo "✅ Users added to group"
echo ""

echo "📝 Step 6: Creating an entry from User 1..."

# Create an entry from User 1 shared to the group
ENTRY_ID=$(psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -t -c "
INSERT INTO entries (user_id, profile_id, content, audience)
VALUES (
  '$USER1_ID',
  '$PROFILE1_ID',
  'Test entry for profile interactions',
  '{\"type\": \"group\", \"groups\": [\"$GROUP_ID\"]}'::jsonb
)
RETURNING id;
" | xargs)

echo "   Entry ID: $ENTRY_ID"
echo ""

echo "📝 Step 7: Creating responses from other users..."

# Create responses from User 2 and User 3
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres <<SQL
INSERT INTO responses (entry_id, profile_id, content)
VALUES 
  ('$ENTRY_ID', '$PROFILE2_ID', 'Response from Bob'),
  ('$ENTRY_ID', '$PROFILE3_ID', 'Response from Charlie');
SQL

echo "✅ Responses created"
echo ""

echo "🎉 Test data created successfully!"
echo ""
echo "📋 Summary:"
echo "   - 3 test users with avatars"
echo "   - 1 test group with all users as members"
echo "   - 1 entry from User 1 shared to the group"
echo "   - 2 responses from User 2 and User 3"
echo ""
echo "🔑 Login credentials:"
echo "   User 1 (main): user1@test.com / password123"
echo "   User 2: user2@test.com / password123"
echo "   User 3: user3@test.com / password123"
echo ""
echo "💡 Log in as User 1 to see the profile interactions in the Groups Panel"

