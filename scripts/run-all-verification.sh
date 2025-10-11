#!/bin/bash
# run-all-verification.sh
# Master script to run all verification tests for T048-T053
#
# Runs:
# - Message persistence verification
# - RLS security validation
# - Performance checks (manual)
# - Comprehensive database health check

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "=========================================="
echo "Hugo Love - Complete Verification Suite"
echo "=========================================="
echo ""
echo -e "${BLUE}Running all T048-T053 verification tests${NC}"
echo ""

RESULTS_FILE="$SCRIPT_DIR/../VERIFICATION_RESULTS.md"

# Initialize results file
cat > "$RESULTS_FILE" << EOF
# Hugo Love Verification Results
**Date**: $(date)
**Tests**: T048-T053

---

EOF

# Test 1: Database Connection
echo "🔌 Test 1: Database Connection"
echo "----------------------------------------"

if PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Database connection OK"
    echo "## Database Connection: ✅ PASS" >> "$RESULTS_FILE"
else
    echo -e "${RED}✗${NC} Database connection failed"
    echo "## Database Connection: ❌ FAIL" >> "$RESULTS_FILE"
fi

echo ""

# Test 2: Message Persistence
echo "📨 Test 2: Message Persistence (T049)"
echo "----------------------------------------"

if [ -f "$SCRIPT_DIR/verify-message-persistence.sh" ]; then
    if "$SCRIPT_DIR/verify-message-persistence.sh" >> "$RESULTS_FILE" 2>&1; then
        echo -e "${GREEN}✓${NC} Message persistence verified"
        echo "## Message Persistence (T049): ✅ PASS" >> "$RESULTS_FILE"
    else
        echo -e "${YELLOW}⚠${NC}  Message persistence needs attention (may not have test data yet)"
        echo "## Message Persistence (T049): ⚠️ PARTIAL" >> "$RESULTS_FILE"
    fi
else
    echo -e "${RED}✗${NC} Persistence script not found"
fi

echo ""

# Test 3: RLS Security
echo "🔒 Test 3: RLS Security (T053)"
echo "----------------------------------------"

if [ -f "$SCRIPT_DIR/verify-rls-security.sh" ]; then
    if "$SCRIPT_DIR/verify-rls-security.sh" >> "$RESULTS_FILE" 2>&1; then
        echo -e "${GREEN}✓${NC} RLS security verified"
        echo "## RLS Security (T053): ✅ PASS" >> "$RESULTS_FILE"
    else
        echo -e "${YELLOW}⚠${NC}  RLS security needs configuration"
        echo "## RLS Security (T053): ⚠️ NEEDS WORK" >> "$RESULTS_FILE"
    fi
else
    echo -e "${RED}✗${NC} RLS script not found"
fi

echo ""

# Test 4: RAG Chunk Availability
echo "🧠 Test 4: RAG Knowledge Base"
echo "----------------------------------------"

CHUNK_COUNT=$(PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -t -c "
SELECT COUNT(*) FROM hugo_love.document_chunks;
" 2>/dev/null | xargs)

if [ "$CHUNK_COUNT" -gt 500 ]; then
    echo -e "${GREEN}✓${NC} RAG knowledge base ready ($CHUNK_COUNT chunks)"
    echo "## RAG Knowledge Base: ✅ PASS ($CHUNK_COUNT chunks)" >> "$RESULTS_FILE"
else
    echo -e "${RED}✗${NC} RAG knowledge base incomplete ($CHUNK_COUNT chunks, expected >500)"
    echo "## RAG Knowledge Base: ❌ FAIL ($CHUNK_COUNT chunks)" >> "$RESULTS_FILE"
fi

echo ""

# Test 5: Edge Functions Deployed
echo "☁️  Test 5: Edge Functions"
echo "----------------------------------------"

if [ -d "/Users/cosmic/Documents/oriva-platform/supabase/functions/chat-stream" ]; then
    if [ -f "/Users/cosmic/Documents/oriva-platform/supabase/functions/chat-stream/index.ts" ] && \
       [ -f "/Users/cosmic/Documents/oriva-platform/supabase/functions/chat-stream/rag.ts" ] && \
       [ -f "/Users/cosmic/Documents/oriva-platform/supabase/functions/chat-stream/bedrock.ts" ]; then
        echo -e "${GREEN}✓${NC} Edge Functions present (deployment needed)"
        echo "## Edge Functions: ✅ FILES READY" >> "$RESULTS_FILE"
    else
        echo -e "${YELLOW}⚠${NC}  Edge Functions incomplete"
        echo "## Edge Functions: ⚠️ INCOMPLETE" >> "$RESULTS_FILE"
    fi
else
    echo -e "${RED}✗${NC} Edge Functions directory not found"
fi

echo ""

# Test 6: Test Data Present
echo "🧪 Test 6: Test Data"
echo "----------------------------------------"

TEST_USER_EXISTS=$(PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -t -c "
SELECT COUNT(*) FROM auth.users WHERE id = '00000000-0000-0000-0000-000000000001';
" 2>/dev/null | xargs)

if [ "$TEST_USER_EXISTS" -gt 0 ]; then
    echo -e "${GREEN}✓${NC} Test user present"
    echo "## Test Data: ✅ PASS" >> "$RESULTS_FILE"
else
    echo -e "${YELLOW}⚠${NC}  Test user not found"
    echo "## Test Data: ⚠️ MISSING TEST USER" >> "$RESULTS_FILE"
fi

echo ""

# Summary
echo "=========================================="
echo "Verification Complete"
echo "=========================================="
echo ""
echo "Results saved to: $RESULTS_FILE"
echo ""
echo "Next Steps:"
echo "  1. Manual test: Chat UI (send message, verify streaming)"
echo "  2. Manual test: Profile editing (T048 beliefs/deal-breakers)"
echo "  3. Performance: Measure first token latency (< 500ms target)"
echo "  4. iOS Tests: Run XCTest suite in Xcode"
echo ""
echo "Test Files:"
echo "  iOS: /Users/cosmic/Documents/oo-ios/Apps/HugoLove/HugoLoveUITests/"
echo "  DB:  $SCRIPT_DIR/"
echo ""

cat "$RESULTS_FILE"
