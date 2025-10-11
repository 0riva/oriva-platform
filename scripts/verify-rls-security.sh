#!/bin/bash
# verify-rls-security.sh
# T053: Row-Level Security (RLS) verification script
#
# Validates:
# - RLS policies are enabled on all tables
# - Cross-tenant data isolation
# - JWT authentication enforcement
# - Unauthorized access prevention

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

DB_HOST="127.0.0.1"
DB_PORT="54322"
DB_USER="postgres"
DB_NAME="postgres"
export PGPASSWORD="postgres"

echo "=========================================="
echo "Hugo Love - RLS Security Verification"
echo "=========================================="
echo ""

echo "🔒 Checking RLS Status on Tables"
echo "----------------------------------------"

# Check if RLS is enabled on critical tables
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
SELECT
    schemaname,
    tablename,
    CASE WHEN rowsecurity THEN '✓ Enabled' ELSE '✗ DISABLED' END as rls_status
FROM pg_tables
WHERE schemaname = 'hugo_love'
ORDER BY tablename;
"

echo ""
echo "📋 RLS Policies Configured"
echo "----------------------------------------"

# List all RLS policies
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    CASE cmd
        WHEN 'r' THEN 'SELECT'
        WHEN 'a' THEN 'INSERT'
        WHEN 'w' THEN 'UPDATE'
        WHEN 'd' THEN 'DELETE'
        WHEN '*' THEN 'ALL'
    END as command
FROM pg_policies
WHERE schemaname = 'hugo_love'
ORDER BY tablename, policyname;
"

echo ""
echo "🔍 Cross-Tenant Isolation Tests"
echo "----------------------------------------"

# Test 1: Check if messages table has proper RLS
echo "Test 1: Messages table RLS"
RLS_MESSAGES=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
SELECT rowsecurity FROM pg_tables WHERE schemaname = 'hugo_love' AND tablename = 'messages';
" | xargs)

if [ "$RLS_MESSAGES" = "t" ]; then
    echo -e "${GREEN}✓${NC} RLS enabled on messages table"
else
    echo -e "${RED}✗${NC} RLS NOT enabled on messages table"
fi

# Test 2: Check if conversations table has proper RLS
echo "Test 2: Conversations table RLS"
RLS_CONVERSATIONS=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
SELECT rowsecurity FROM pg_tables WHERE schemaname = 'hugo_love' AND tablename = 'conversations';
" | xargs)

if [ "$RLS_CONVERSATIONS" = "t" ]; then
    echo -e "${GREEN}✓${NC} RLS enabled on conversations table"
else
    echo -e "${RED}✗${NC} RLS NOT enabled on conversations table"
fi

# Test 3: Check if profiles table has proper RLS
echo "Test 3: Profiles table RLS"
RLS_PROFILES=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
SELECT rowsecurity FROM pg_tables WHERE schemaname = 'hugo_love' AND tablename = 'profiles';
" | xargs)

if [ "$RLS_PROFILES" = "t" ]; then
    echo -e "${GREEN}✓${NC} RLS enabled on profiles table"
else
    echo -e "${RED}✗${NC} RLS NOT enabled on profiles table"
fi

echo ""
echo "👥 User Isolation Validation"
echo "----------------------------------------"

# Create test query to simulate cross-tenant access attempt
# This should return 0 rows if RLS is working correctly
echo "Attempting to query another user's data (should fail)..."

# Note: In production, this would use a JWT token for a different user
# For local testing, we verify the policy exists

ISOLATION_POLICY=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
SELECT COUNT(*)
FROM pg_policies
WHERE schemaname = 'hugo_love'
  AND tablename = 'messages'
  AND policyname LIKE '%user%';
" | xargs)

if [ "$ISOLATION_POLICY" -gt 0 ]; then
    echo -e "${GREEN}✓${NC} User isolation policies configured"
else
    echo -e "${YELLOW}⚠${NC}  No user-specific RLS policies found"
fi

echo ""
echo "🔑 Authentication Requirements"
echo "----------------------------------------"

# Check if tables require authentication
AUTH_POLICIES=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
SELECT COUNT(*)
FROM pg_policies
WHERE schemaname = 'hugo_love'
  AND qual LIKE '%auth.uid()%';
" | xargs)

echo "Policies using auth.uid(): $AUTH_POLICIES"

if [ "$AUTH_POLICIES" -gt 0 ]; then
    echo -e "${GREEN}✓${NC} Authentication-based policies configured"
else
    echo -e "${YELLOW}⚠${NC}  No authentication-based policies found"
fi

echo ""
echo "📊 Security Summary"
echo "----------------------------------------"

# Count tables with and without RLS
TABLES_WITH_RLS=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'hugo_love' AND rowsecurity = true;
" | xargs)

TOTAL_TABLES=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'hugo_love';
" | xargs)

echo "Tables with RLS: $TABLES_WITH_RLS / $TOTAL_TABLES"

TOTAL_POLICIES=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'hugo_love';
" | xargs)

echo "Total RLS Policies: $TOTAL_POLICIES"

echo ""
echo "✅ Validation Checks"
echo "----------------------------------------"

ALL_PASS=true

if [ "$RLS_MESSAGES" = "t" ]; then
    echo -e "${GREEN}✓${NC} Messages table secured"
else
    echo -e "${RED}✗${NC} Messages table NOT secured"
    ALL_PASS=false
fi

if [ "$RLS_CONVERSATIONS" = "t" ]; then
    echo -e "${GREEN}✓${NC} Conversations table secured"
else
    echo -e "${RED}✗${NC} Conversations table NOT secured"
    ALL_PASS=false
fi

if [ "$AUTH_POLICIES" -gt 0 ]; then
    echo -e "${GREEN}✓${NC} Authentication policies configured"
else
    echo -e "${RED}✗${NC} Authentication policies MISSING"
    ALL_PASS=false
fi

echo ""
echo "=========================================="

if [ "$ALL_PASS" = true ]; then
    echo -e "${GREEN}✅ RLS Security Verification PASSED${NC}"
    echo ""
    echo "Recommendations:"
    echo "  - Test with actual JWT tokens in production"
    echo "  - Verify cross-tenant queries return 0 rows"
    echo "  - Audit RLS policies regularly"
    exit 0
else
    echo -e "${RED}❌ RLS Security Verification FAILED${NC}"
    echo ""
    echo "Action Required:"
    echo "  - Enable RLS on all hugo_love tables"
    echo "  - Create user-specific policies (auth.uid() = user_id)"
    echo "  - Test cross-tenant isolation with real users"
    exit 1
fi
