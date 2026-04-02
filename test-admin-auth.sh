#!/bin/bash

# Admin Authentication Test Script
# This script tests the admin authentication flow

BASE_URL="http://localhost:5000/api/v1"
ADMIN_EMAIL="admin@confetti.com"
ADMIN_PASSWORD="Admin123!"

echo "=========================================="
echo "Admin Authentication Test"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Create Super Admin (if not exists)
echo -e "${YELLOW}Step 1: Creating Super Admin...${NC}"
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/admin/super-admin" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$ADMIN_EMAIL\",
    \"password\": \"$ADMIN_PASSWORD\",
    \"firstName\": \"Super\",
    \"lastName\": \"Admin\",
    \"role\": \"super_admin\",
    \"permissions\": [
      \"user_management\",
      \"vendor_management\",
      \"content_management\",
      \"moderation\",
      \"financial_oversight\",
      \"support_tickets\",
      \"analytics\",
      \"system_configuration\",
      \"audit_logs\",
      \"security_compliance\",
      \"communication_management\"
    ]
  }")

echo "$CREATE_RESPONSE" | jq '.'
echo ""

# Step 2: Admin Login
echo -e "${YELLOW}Step 2: Admin Login...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/admin/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$ADMIN_EMAIL\",
    \"password\": \"$ADMIN_PASSWORD\"
  }")

echo "$LOGIN_RESPONSE" | jq '.'

# Extract token
ADMIN_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.token // empty')
REFRESH_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.refreshToken // empty')

if [ -z "$ADMIN_TOKEN" ]; then
  echo -e "${RED}❌ Failed to get admin token${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}✓ Admin Token: ${ADMIN_TOKEN:0:50}...${NC}"
echo -e "${GREEN}✓ Refresh Token: ${REFRESH_TOKEN:0:50}...${NC}"
echo ""

# Step 3: Verify Token
echo -e "${YELLOW}Step 3: Verifying Admin Token...${NC}"
VERIFY_RESPONSE=$(curl -s -X GET "$BASE_URL/admin/verify" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

echo "$VERIFY_RESPONSE" | jq '.'
echo ""

# Step 4: Access Dashboard Metrics
echo -e "${YELLOW}Step 4: Accessing Dashboard Metrics...${NC}"
METRICS_RESPONSE=$(curl -s -X GET "$BASE_URL/admin/dashboard/metrics" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

echo "$METRICS_RESPONSE" | jq '.'
echo ""

# Step 5: Get Users List
echo -e "${YELLOW}Step 5: Getting Users List...${NC}"
USERS_RESPONSE=$(curl -s -X GET "$BASE_URL/admin/users?page=1&limit=5" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

echo "$USERS_RESPONSE" | jq '.'
echo ""

# Step 6: Refresh Token
echo -e "${YELLOW}Step 6: Refreshing Admin Token...${NC}"
REFRESH_RESPONSE=$(curl -s -X POST "$BASE_URL/admin/refresh" \
  -H "Content-Type: application/json" \
  -d "{
    \"refreshToken\": \"$REFRESH_TOKEN\"
  }")

echo "$REFRESH_RESPONSE" | jq '.'

NEW_TOKEN=$(echo "$REFRESH_RESPONSE" | jq -r '.data.token // empty')

if [ -n "$NEW_TOKEN" ]; then
  echo ""
  echo -e "${GREEN}✓ New Token: ${NEW_TOKEN:0:50}...${NC}"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}✓ Admin Authentication Test Complete!${NC}"
echo "=========================================="
echo ""
echo "Admin Credentials:"
echo "  Email: $ADMIN_EMAIL"
echo "  Password: $ADMIN_PASSWORD"
echo ""
echo "Use this token for admin API calls:"
echo "  Authorization: Bearer $ADMIN_TOKEN"
echo ""
