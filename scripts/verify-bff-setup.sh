#!/bin/bash
#
# BFF Setup Verification Script
#
# Purpose: Verify BFF proxy is configured correctly with canonical port 3002
# Usage: ./scripts/verify-bff-setup.sh
#

set -e

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "BFF Proxy Setup Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Test 1: Check root .env exists and has correct port
echo "Test 1: Root .env configuration"
if [ -f ".env" ]; then
    PORT_VALUE=$(grep "^PORT=" .env | cut -d'=' -f2)
    if [ "$PORT_VALUE" = "3002" ]; then
        echo -e "  ${GREEN}✅ ROOT .env exists with PORT=3002${NC}"
    else
        echo -e "  ${RED}❌ ROOT .env has wrong PORT=$PORT_VALUE (expected: 3002)${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "  ${RED}❌ ROOT .env missing${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Test 2: Check api/.env does NOT exist (should be deleted)
echo "Test 2: Conflicting api/.env check"
if [ -f "api/.env" ]; then
    echo -e "  ${RED}❌ api/.env exists (should be deleted - conflicts with root .env)${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "  ${GREEN}✅ api/.env does not exist (correct)${NC}"
fi
echo ""

# Test 3: Check api/index.ts has correct fallback port
echo "Test 3: api/index.ts fallback port"
if grep -q "|| 3002" api/index.ts; then
    echo -e "  ${GREEN}✅ api/index.ts has correct fallback (3002)${NC}"
else
    if grep -q "|| 3001" api/index.ts; then
        echo -e "  ${RED}❌ api/index.ts has wrong fallback (3001)${NC}"
        echo -e "     Fix: Change line ~4209 to: const PORT = Number(process.env.PORT) || 3002;"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "  ${YELLOW}⚠️  Could not verify api/index.ts fallback port${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
fi
echo ""

# Test 4: Check for hardcoded 3001 references in code
echo "Test 4: Hardcoded port 3001 references in code"
PORT_3001_REFS=$(grep -r "3001" --include="*.ts" --include="*.js" api/ 2>/dev/null | grep -v node_modules | wc -l || echo "0")
if [ "$PORT_3001_REFS" -eq 0 ]; then
    echo -e "  ${GREEN}✅ No hardcoded 3001 references in code${NC}"
else
    echo -e "  ${RED}❌ Found $PORT_3001_REFS hardcoded 3001 references${NC}"
    echo "     Run: grep -r \"3001\" --include=\"*.ts\" --include=\"*.js\" api/"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Test 5: Check BFF is running
echo "Test 5: BFF process check"
if lsof -i :3002 >/dev/null 2>&1; then
    PROCESS=$(lsof -i :3002 | grep LISTEN | awk '{print $1}')
    echo -e "  ${GREEN}✅ BFF is running on port 3002 (process: $PROCESS)${NC}"
else
    echo -e "  ${YELLOW}⚠️  BFF not running on port 3002${NC}"
    echo "     Start: npm run dev"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Test 6: Health check (if BFF is running)
echo "Test 6: BFF health check"
if curl -s -f http://localhost:3002/health >/dev/null 2>&1; then
    HEALTH_STATUS=$(curl -s http://localhost:3002/health | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    # Accept both "ok" and "healthy" as valid status
    if [ "$HEALTH_STATUS" = "ok" ] || [ "$HEALTH_STATUS" = "healthy" ]; then
        echo -e "  ${GREEN}✅ Health endpoint responding: status=$HEALTH_STATUS${NC}"
    else
        echo -e "  ${RED}❌ Health endpoint returned unexpected status: $HEALTH_STATUS${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "  ${YELLOW}⚠️  Health endpoint not accessible${NC}"
    echo "     BFF may not be running. Start: npm run dev"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Test 7: Check o-orig config (if exists)
echo "Test 7: o-orig configuration"
if [ -f "../o-orig/.env.local" ]; then
    O_ORIG_URL=$(grep "^EXPO_PUBLIC_API_URL=" ../o-orig/.env.local | cut -d'=' -f2)
    if echo "$O_ORIG_URL" | grep -q "3002"; then
        echo -e "  ${GREEN}✅ o-orig .env.local uses port 3002${NC}"
    else
        echo -e "  ${RED}❌ o-orig .env.local uses wrong port: $O_ORIG_URL${NC}"
        echo "     Fix: Update EXPO_PUBLIC_API_URL to http://127.0.0.1:3002"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "  ${YELLOW}⚠️  o-orig repository not found or .env.local missing${NC}"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Test 8: Check o-core config (if exists)
echo "Test 8: o-core configuration"
if [ -f "../o-core/.env.local" ]; then
    O_CORE_URL=$(grep "^EXPO_PUBLIC_API_BASE_URL=" ../o-core/.env.local | cut -d'=' -f2 || echo "not set")
    if echo "$O_CORE_URL" | grep -q "3002"; then
        echo -e "  ${GREEN}✅ o-core .env.local uses port 3002${NC}"
    elif echo "$O_CORE_URL" | grep -q "3001"; then
        echo -e "  ${RED}❌ o-core .env.local uses wrong port: $O_CORE_URL${NC}"
        echo "     Fix: Update EXPO_PUBLIC_API_BASE_URL to http://localhost:3002"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "  ${YELLOW}⚠️  o-core .env.local API_BASE_URL not set or doesn't specify port${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "  ${YELLOW}⚠️  o-core repository not found or .env.local missing${NC}"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Verification Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ ALL CHECKS PASSED${NC}"
    echo ""
    echo "BFF is correctly configured with canonical port 3002."
    echo ""
    echo "Next steps:"
    echo "  1. If not running: npm run dev"
    echo "  2. Test: curl http://localhost:3002/health"
    echo ""
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  WARNINGS FOUND: $WARNINGS${NC}"
    echo ""
    echo "Setup is mostly correct but has warnings (see above)."
    echo "These are usually non-critical (e.g., BFF not running yet)."
    echo ""
    exit 0
else
    echo -e "${RED}❌ ERRORS FOUND: $ERRORS${NC}"
    echo -e "${YELLOW}⚠️  WARNINGS: $WARNINGS${NC}"
    echo ""
    echo "BFF configuration has errors that must be fixed."
    echo "Review error messages above for specific fixes."
    echo ""
    echo "Documentation:"
    echo "  - Quick Start: ./BFF_QUICK_START.md"
    echo "  - Full Guide:  ./BFF_PROXY_GUIDE.md"
    echo "  - Architecture: ./BFF_ARCHITECTURE_AUDIT_AND_FIX.md"
    echo ""
    exit 1
fi
