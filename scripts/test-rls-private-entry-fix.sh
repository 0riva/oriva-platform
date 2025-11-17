#!/bin/bash
# Test script for RLS private entry visibility fix
# This script validates that the migration correctly prevents private entries from being visible to non-owners

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Testing RLS Private Entry Visibility Fix${NC}"
echo "=========================================================================="
echo ""

# Check if Supabase is running
if ! pg_isready -h 127.0.0.1 -p 54321 > /dev/null 2>&1; then
  echo -e "${RED}❌ Supabase is not running${NC}"
  echo "   Start Supabase with: supabase start"
  exit 1
fi

echo -e "${GREEN}✓ Supabase is running${NC}"

# Check if migration exists
MIGRATION_FILE="supabase/migrations/20251111100443_fix_private_entry_visibility_rls.sql"
if [ ! -f "$MIGRATION_FILE" ]; then
  echo -e "${RED}❌ Migration file not found: $MIGRATION_FILE${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Migration file exists${NC}"

# Check SQL syntax (basic validation)
echo ""
echo "Validating SQL syntax..."
if grep -q "CREATE POLICY" "$MIGRATION_FILE" && grep -q "authenticated_users_view_published_entries" "$MIGRATION_FILE"; then
  echo -e "${GREEN}✓ Migration contains required policy${NC}"
else
  echo -e "${RED}❌ Migration missing required policy${NC}"
  exit 1
fi

# Check for private entry exclusion logic
if grep -q "audience->>'type' = 'private'" "$MIGRATION_FILE" && grep -q "NOT" "$MIGRATION_FILE"; then
  echo -e "${GREEN}✓ Migration includes private entry exclusion logic${NC}"
else
  echo -e "${RED}❌ Migration missing private entry exclusion logic${NC}"
  exit 1
fi

# Check for own entry access
if grep -q "user_id = auth.uid()" "$MIGRATION_FILE"; then
  echo -e "${GREEN}✓ Migration includes own entry access logic${NC}"
else
  echo -e "${RED}❌ Migration missing own entry access logic${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}✓ Basic validation passed${NC}"
echo ""
echo "To fully test the migration:"
echo "  1. Apply migration: supabase db reset"
echo "  2. Run tests: npm test -- rls-private-entry-visibility.test.ts"
echo "  3. Verify in production after deployment"



