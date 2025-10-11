#!/bin/bash
set -e

echo "🔧 Creating test user in local Supabase..."
echo ""

# Configuration
TEST_EMAIL="test@example.com"
TEST_PASSWORD="password123"

# Check if Supabase is running
if ! curl -s http://127.0.0.1:54321/rest/v1/ > /dev/null 2>&1; then
  echo "❌ Error: Supabase is not running"
  echo "   Run 'supabase start' first"
  exit 1
fi

# Clean up existing test user if present
echo "🗑️  Cleaning up existing test user..."
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres <<'SQL' 2>/dev/null || true
DELETE FROM auth.identities WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'test@example.com');
DELETE FROM public.notification_preferences WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'test@example.com');
DELETE FROM public.user_preferences WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'test@example.com');
DELETE FROM public.profiles WHERE account_id IN (SELECT id FROM auth.users WHERE email = 'test@example.com');
DELETE FROM auth.users WHERE email = 'test@example.com';
SQL

# Create user using Supabase signup API (triggers handle the rest)
echo "📝 Creating user: $TEST_EMAIL"

RESPONSE=$(curl -s -X POST 'http://127.0.0.1:54321/auth/v1/signup' \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\",
    \"options\": {
      \"data\": {
        \"username\": \"testuser\"
      }
    }
  }")

# Check if user was created
if echo "$RESPONSE" | grep -q "access_token"; then
  USER_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['user']['id'])" 2>/dev/null || echo "")

  if [ -n "$USER_ID" ]; then
    echo "✅ Test user created successfully!"
    echo ""
    echo "📧 Email:    $TEST_EMAIL"
    echo "🔑 Password: $TEST_PASSWORD"
    echo "🆔 User ID:  $USER_ID"
    echo ""
    echo "🎯 Database triggers created profile, preferences, and notification settings automatically"
  else
    echo "⚠️  User may have been created but couldn't extract ID"
  fi
elif echo "$RESPONSE" | grep -q "already registered"; then
  echo "⚠️  User already exists: $TEST_EMAIL"
  echo "   You can use it with password: $TEST_PASSWORD"
else
  echo "❌ Error creating user:"
  echo "$RESPONSE" | jq '.' || echo "$RESPONSE"
  exit 1
fi
