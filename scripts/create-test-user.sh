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

# Create user using Supabase auth admin API
echo "📝 Creating user: $TEST_EMAIL"

RESPONSE=$(curl -s -X POST "http://127.0.0.1:54321/auth/v1/admin/users" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\",
    \"email_confirm\": true,
    \"user_metadata\": {
      \"display_name\": \"Test User\",
      \"username\": \"testuser\"
    }
  }")

# Check if user was created
if echo "$RESPONSE" | grep -q "error"; then
  if echo "$RESPONSE" | grep -q "already exists"; then
    echo "⚠️  User already exists: $TEST_EMAIL"
    echo "   You can use it with password: $TEST_PASSWORD"
  else
    echo "❌ Error creating user:"
    echo "$RESPONSE" | jq '.'
    exit 1
  fi
else
  USER_ID=$(echo "$RESPONSE" | jq -r '.id')
  echo "✅ Test user created successfully!"
  echo ""
  echo "📧 Email:    $TEST_EMAIL"
  echo "🔑 Password: $TEST_PASSWORD"
  echo "🆔 User ID:  $USER_ID"
  echo ""
  echo "🎯 You can now use this account to test the app locally"
fi
