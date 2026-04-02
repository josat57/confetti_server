#!/bin/bash

# Test Vendor Profile Stats Endpoint
# This script tests the correct vendor dashboard stats endpoint

echo "=== Testing Vendor Profile Stats Endpoint ==="
echo ""

# Check if JWT token is provided
if [ -z "$1" ]; then
  echo "❌ Error: JWT token required"
  echo ""
  echo "Usage: ./test-vendor-stats.sh <JWT_TOKEN>"
  echo ""
  echo "Example:"
  echo "  ./test-vendor-stats.sh eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  exit 1
fi

JWT_TOKEN=$1
BASE_URL="http://localhost:9600/api/v1"

echo "Testing with token: ${JWT_TOKEN:0:20}..."
echo ""

# Test 1: Correct endpoint - /vendors/profile/stats
echo "1. Testing CORRECT endpoint: GET /vendors/profile/stats"
echo "---------------------------------------------------"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X GET "${BASE_URL}/vendors/profile/stats" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

echo "Status Code: $HTTP_STATUS"
echo "Response:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_STATUS" = "200" ]; then
  echo "✅ SUCCESS: Endpoint working correctly"
elif [ "$HTTP_STATUS" = "401" ]; then
  echo "❌ FAILED: Unauthorized - Check your JWT token"
elif [ "$HTTP_STATUS" = "404" ]; then
  echo "❌ FAILED: Vendor profile not found - User may not have a vendor profile"
else
  echo "⚠️  Unexpected status code: $HTTP_STATUS"
fi
echo ""

# Test 2: Incorrect endpoint - /vendors/dashboard/stats (should return 404)
echo "2. Testing INCORRECT endpoint: GET /vendors/dashboard/stats"
echo "---------------------------------------------------"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X GET "${BASE_URL}/vendors/dashboard/stats" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

echo "Status Code: $HTTP_STATUS"
echo "Response:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_STATUS" = "404" ]; then
  echo "✅ EXPECTED: Route not found (this endpoint doesn't exist)"
else
  echo "⚠️  Unexpected status code: $HTTP_STATUS"
fi
echo ""

# Test 3: Get vendor profile
echo "3. Testing: GET /vendors/profile"
echo "---------------------------------------------------"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X GET "${BASE_URL}/vendors/profile" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

echo "Status Code: $HTTP_STATUS"
echo "Response:"
echo "$BODY" | jq '.data.businessName, .data.category, .data.stats' 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_STATUS" = "200" ]; then
  echo "✅ SUCCESS: Profile retrieved"
elif [ "$HTTP_STATUS" = "404" ]; then
  echo "❌ FAILED: No vendor profile exists for this user"
else
  echo "⚠️  Unexpected status code: $HTTP_STATUS"
fi
echo ""

echo "=== Test Complete ==="
echo ""
echo "Summary:"
echo "--------"
echo "✅ Correct endpoint: GET /api/v1/vendors/profile/stats"
echo "❌ Wrong endpoint:   GET /api/v1/vendors/dashboard/stats (does not exist)"
echo ""
echo "See VENDOR_DASHBOARD_ENDPOINTS.md for complete API documentation"
