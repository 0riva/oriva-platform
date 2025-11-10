#!/bin/bash

# Password Reset Flow Testing Script
# This script tests the complete password reset flow locally
# Prerequisites: Supabase running, BFF running on port 3002

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BFF_URL="${BFF_URL:-http://localhost:3002}"
INBUCKET_URL="${INBUCKET_URL:-http://localhost:54344}"  # Mailpit port (Supabase uses Mailpit, not Inbucket)
TEST_EMAIL="testuser-$(date +%s)@example.com"
TEST_PASSWORD="TestPassword123"
NEW_PASSWORD="NewPassword456"

echo -e "${BLUE}=== Password Reset Auth Flow Test ===${NC}"
echo -e "BFF URL: ${BFF_URL}"
echo -e "Inbucket URL: ${INBUCKET_URL}"
echo -e "Test Email: ${TEST_EMAIL}"
echo ""

# Step 1: Create test account
echo -e "${YELLOW}Step 1: Creating test account...${NC}"
REGISTER_RESPONSE=$(curl -s -X POST "${BFF_URL}/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${TEST_EMAIL}\",
    \"password\": \"${TEST_PASSWORD}\",
    \"name\": \"Test User\"
  }")

USER_ID=$(echo "$REGISTER_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$USER_ID" ]; then
  echo -e "${RED}❌ Failed to create account${NC}"
  echo "Response: $REGISTER_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✓ Account created${NC}"
echo "  User ID: $USER_ID"
echo ""

# Step 2: Request password reset
echo -e "${YELLOW}Step 2: Requesting password reset...${NC}"
FORGOT_RESPONSE=$(curl -s -X POST "${BFF_URL}/api/v1/auth/forgot-password" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${TEST_EMAIL}\"
  }")

if echo "$FORGOT_RESPONSE" | grep -q "If an account exists"; then
  echo -e "${GREEN}✓ Password reset email requested${NC}"
else
  echo -e "${RED}❌ Failed to request password reset${NC}"
  echo "Response: $FORGOT_RESPONSE"
  exit 1
fi
echo ""

# Step 3: Wait and fetch email from Inbucket
echo -e "${YELLOW}Step 3: Checking email in Inbucket...${NC}"
sleep 2

# Get list of emails
EMAILS=$(curl -s "${INBUCKET_URL}/api/v1/mailbox/${TEST_EMAIL%@*}")

# Extract token from the email body
# Look for the reset-password URL and extract the token
RESET_TOKEN=$(echo "$EMAILS" | grep -o 'type=recovery[^&]*' | head -1 | cut -d'=' -f2)

if [ -z "$RESET_TOKEN" ]; then
  echo -e "${RED}❌ Could not find reset token in email${NC}"
  echo "Emails response: $EMAILS"
  echo ""
  echo -e "${YELLOW}Note: Check ${INBUCKET_URL} manually for the password reset email${NC}"
  echo -e "Look for an email from 'noreply@oriva.io' or similar"
  echo -e "Extract the 'token' parameter from the reset-password URL"
  exit 1
fi

echo -e "${GREEN}✓ Found reset token${NC}"
echo "  Token (truncated): ${RESET_TOKEN:0:20}..."
echo ""

# Step 4: Test password reset endpoint
echo -e "${YELLOW}Step 4: Testing password reset endpoint...${NC}"
RESET_RESPONSE=$(curl -s -X POST "${BFF_URL}/api/v1/auth/reset-password" \
  -H "Content-Type: application/json" \
  -d "{
    \"token\": \"${RESET_TOKEN}\",
    \"password\": \"${NEW_PASSWORD}\"
  }")

if echo "$RESET_RESPONSE" | grep -q "successfully"; then
  echo -e "${GREEN}✓ Password reset successful${NC}"
else
  echo -e "${RED}⚠ Password reset response unclear${NC}"
  echo "Response: $RESET_RESPONSE"
  echo ""
  echo -e "${YELLOW}Note: This may be normal if you're testing with an old token${NC}"
fi
echo ""

# Step 5: Verify new password works
echo -e "${YELLOW}Step 5: Verifying new password works...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "${BFF_URL}/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${TEST_EMAIL}\",
    \"password\": \"${NEW_PASSWORD}\"
  }")

if echo "$LOGIN_RESPONSE" | grep -q "access_token"; then
  echo -e "${GREEN}✓ Login with new password successful${NC}"
  ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
  echo "  Access token (truncated): ${ACCESS_TOKEN:0:20}..."
else
  echo -e "${RED}❌ Failed to login with new password${NC}"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi
echo ""

echo -e "${GREEN}=== All Tests Passed ===${NC}"
echo ""
echo "Summary:"
echo "  ✓ Account creation"
echo "  ✓ Password reset request"
echo "  ✓ Reset token extraction"
echo "  ✓ Password reset execution"
echo "  ✓ Login with new password"
echo ""
