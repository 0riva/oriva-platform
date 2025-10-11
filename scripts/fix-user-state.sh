#!/bin/bash
#
# fix-user-state.sh
#
# PURPOSE: Fix users who exist in auth.users but not in public.users
# USAGE: ./scripts/fix-user-state.sh [user_id]
#
# CONTEXT: Database trigger 'on_auth_user_created' sometimes fails,
#          leaving users in auth.users without corresponding public.users record.
#          This causes foreign key constraint violations when creating responses.
#

set -e

DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔧 User State Recovery Script"
echo "=============================="
echo ""

# Check if user ID provided
if [ -z "$1" ]; then
  echo -e "${RED}❌ Error: User ID required${NC}"
  echo "Usage: ./scripts/fix-user-state.sh <user_id>"
  echo ""
  echo "To find orphaned users, run:"
  echo "  ./scripts/check-user-consistency.sh"
  exit 1
fi

USER_ID="$1"

# Validate UUID format
if ! [[ "$USER_ID" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]]; then
  echo -e "${RED}❌ Error: Invalid UUID format${NC}"
  exit 1
fi

echo "🔍 Analyzing user state for: $USER_ID"
echo ""

# Check if user exists in auth.users
AUTH_EXISTS=$(psql "$DATABASE_URL" -tAc \
  "SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = '$USER_ID');")

if [ "$AUTH_EXISTS" = "f" ]; then
  echo -e "${RED}❌ User not found in auth.users${NC}"
  echo "This user doesn't exist at all. Cannot recover."
  exit 1
fi

echo -e "${GREEN}✅ User exists in auth.users${NC}"

# Get user email from auth.users
USER_EMAIL=$(psql "$DATABASE_URL" -tAc \
  "SELECT email FROM auth.users WHERE id = '$USER_ID';")

echo "   Email: $USER_EMAIL"
echo ""

# Check if user exists in public.users
PUBLIC_EXISTS=$(psql "$DATABASE_URL" -tAc \
  "SELECT EXISTS(SELECT 1 FROM public.users WHERE id = '$USER_ID');")

if [ "$PUBLIC_EXISTS" = "t" ]; then
  echo -e "${GREEN}✅ User already exists in public.users${NC}"
  echo "No recovery needed. User state is consistent."
  exit 0
fi

echo -e "${YELLOW}⚠️  User missing from public.users${NC}"
echo "This is the bug - trigger 'on_auth_user_created' failed."
echo ""

# Extract username from email (before @ symbol)
USERNAME=$(echo "$USER_EMAIL" | cut -d'@' -f1)
DISPLAY_NAME=$(echo "$USERNAME" | sed 's/[^a-zA-Z0-9]/ /g' | sed 's/\b\(.\)/\u\1/g')

echo "🔧 Recovering user state..."
echo "   Username: $USERNAME"
echo "   Display Name: $DISPLAY_NAME"
echo ""

# Insert into public.users
psql "$DATABASE_URL" <<SQL
INSERT INTO public.users (
  id,
  email,
  display_name,
  username,
  created_at,
  updated_at,
  is_active
)
SELECT
  '$USER_ID',
  '$USER_EMAIL',
  '$DISPLAY_NAME',
  '$USERNAME',
  created_at,
  created_at,
  true
FROM auth.users
WHERE id = '$USER_ID'
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  updated_at = now();
SQL

echo -e "${GREEN}✅ User inserted into public.users${NC}"
echo ""

# Verify profile exists
PROFILE_EXISTS=$(psql "$DATABASE_URL" -tAc \
  "SELECT EXISTS(SELECT 1 FROM public.profiles WHERE account_id = '$USER_ID');")

if [ "$PROFILE_EXISTS" = "f" ]; then
  echo -e "${YELLOW}⚠️  No profile found - creating default profile...${NC}"

  psql "$DATABASE_URL" <<SQL
  INSERT INTO public.profiles (
    account_id,
    display_name,
    is_anonymous,
    is_active,
    created_at
  )
  VALUES (
    '$USER_ID',
    'Anon',
    false,
    true,
    now()
  )
  ON CONFLICT (account_id, is_anonymous) DO NOTHING;
SQL

  echo -e "${GREEN}✅ Profile created${NC}"
else
  echo -e "${GREEN}✅ Profile already exists${NC}"
fi

echo ""

# Verify notification preferences
NOTIF_PREFS_EXISTS=$(psql "$DATABASE_URL" -tAc \
  "SELECT EXISTS(SELECT 1 FROM public.notification_preferences WHERE user_id = '$USER_ID');")

if [ "$NOTIF_PREFS_EXISTS" = "f" ]; then
  echo -e "${YELLOW}⚠️  No notification preferences - creating defaults...${NC}"

  psql "$DATABASE_URL" <<SQL
  INSERT INTO public.notification_preferences (
    user_id,
    email_notifications,
    push_notifications,
    in_app_notifications
  )
  VALUES (
    '$USER_ID',
    true,
    true,
    true
  )
  ON CONFLICT (user_id) DO NOTHING;
SQL

  echo -e "${GREEN}✅ Notification preferences created${NC}"
else
  echo -e "${GREEN}✅ Notification preferences exist${NC}"
fi

echo ""
echo "=============================="
echo -e "${GREEN}✅ User state recovery complete!${NC}"
echo ""
echo "Summary for $USER_ID:"
echo "  - ✅ auth.users: Present"
echo "  - ✅ public.users: Present"
echo "  - ✅ profiles: Present"
echo "  - ✅ notification_preferences: Present"
echo ""
echo "User can now submit responses without foreign key errors."
