#!/bin/bash

# Test Vendor Dashboard Summary Endpoint
# This script tests the new comprehensive dashboard summary endpoint

echo "=== Testing Vendor Dashboard Summary Endpoint ==="
echo ""

# Check if JWT token is provided
if [ -z "$1" ]; then
  echo "❌ Error: JWT token required"
  echo ""
  echo "Usage: ./test-vendor-dashboard-summary.sh <JWT_TOKEN>"
  echo ""
  echo "Example:"
  echo "  ./test-vendor-dashboard-summary.sh eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  exit 1
fi

JWT_TOKEN=$1
BASE_URL="http://localhost:9600/api/v1"

echo "Testing with token: ${JWT_TOKEN:0:20}..."
echo ""

# Test 1: Get dashboard summary (default - last 30 days)
echo "1. Testing: GET /vendors/dashboard/summary (default period)"
echo "-----------------------------------------------------------"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X GET "${BASE_URL}/vendors/dashboard/summary" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

echo "Status Code: $HTTP_STATUS"
echo ""

if [ "$HTTP_STATUS" = "200" ]; then
  echo "✅ SUCCESS: Dashboard summary retrieved"
  echo ""
  echo "Summary Data:"
  echo "$BODY" | jq '.data.summary' 2>/dev/null || echo "$BODY"
  echo ""
  echo "Inquiries Breakdown:"
  echo "$BODY" | jq '.data.inquiries' 2>/dev/null
  echo ""
  echo "Revenue Summary:"
  echo "$BODY" | jq '.data.revenue | {total, bookings, averageValue}' 2>/dev/null
  echo ""
  echo "Recent Activity (first 3):"
  echo "$BODY" | jq '.data.recentActivity[:3]' 2>/dev/null
  echo ""
  echo "Alerts:"
  echo "$BODY" | jq '.data.alerts' 2>/dev/null
  echo ""
  echo "Performance Metrics:"
  echo "$BODY" | jq '.data.performance' 2>/dev/null
elif [ "$HTTP_STATUS" = "401" ]; then
  echo "❌ FAILED: Unauthorized - Check your JWT token"
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
elif [ "$HTTP_STATUS" = "404" ]; then
  echo "❌ FAILED: Vendor profile not found"
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
  echo "⚠️  Unexpected status code: $HTTP_STATUS"
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
fi
echo ""

# Test 2: Get dashboard summary with custom date range
echo "2. Testing: GET /vendors/dashboard/summary (custom date range)"
echo "----------------------------------------------------------------"
START_DATE="2024-01-01T00:00:00Z"
END_DATE="2024-12-31T23:59:59Z"

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X GET "${BASE_URL}/vendors/dashboard/summary?startDate=${START_DATE}&endDate=${END_DATE}" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

echo "Status Code: $HTTP_STATUS"
echo ""

if [ "$HTTP_STATUS" = "200" ]; then
  echo "✅ SUCCESS: Dashboard summary with date range retrieved"
  echo ""
  echo "Period:"
  echo "$BODY" | jq '.data.revenue.period' 2>/dev/null
  echo ""
  echo "Revenue for period:"
  echo "$BODY" | jq '.data.revenue | {total, bookings, averageValue}' 2>/dev/null
else
  echo "⚠️  Status code: $HTTP_STATUS"
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
fi
echo ""

# Test 3: Compare with individual endpoints
echo "3. Comparing with individual endpoints"
echo "---------------------------------------"

# Get profile stats
PROFILE_STATS=$(curl -s \
  -X GET "${BASE_URL}/vendors/profile/stats" \
  -H "Authorization: Bearer ${JWT_TOKEN}")

PROFILE_VIEWS=$(echo "$PROFILE_STATS" | jq -r '.data.stats.profileViews' 2>/dev/null)
AVG_RATING=$(echo "$PROFILE_STATS" | jq -r '.data.stats.averageRating' 2>/dev/null)

echo "Profile Stats Endpoint:"
echo "  Profile Views: $PROFILE_VIEWS"
echo "  Average Rating: $AVG_RATING"
echo ""

# Get dashboard summary
DASHBOARD_SUMMARY=$(curl -s \
  -X GET "${BASE_URL}/vendors/dashboard/summary" \
  -H "Authorization: Bearer ${JWT_TOKEN}")

SUMMARY_VIEWS=$(echo "$DASHBOARD_SUMMARY" | jq -r '.data.summary.profileViews' 2>/dev/null)
SUMMARY_RATING=$(echo "$DASHBOARD_SUMMARY" | jq -r '.data.summary.averageRating' 2>/dev/null)

echo "Dashboard Summary Endpoint:"
echo "  Profile Views: $SUMMARY_VIEWS"
echo "  Average Rating: $SUMMARY_RATING"
echo ""

if [ "$PROFILE_VIEWS" = "$SUMMARY_VIEWS" ] && [ "$AVG_RATING" = "$SUMMARY_RATING" ]; then
  echo "✅ Data consistency verified!"
else
  echo "⚠️  Data mismatch detected"
fi
echo ""

echo "=== Test Complete ==="
echo ""
echo "Summary:"
echo "--------"
echo "✅ New endpoint: GET /api/v1/vendors/dashboard/summary"
echo ""
echo "Features:"
echo "  • Profile views, rating, and reviews"
echo "  • Inquiry/lead statistics with conversion rate"
echo "  • Revenue breakdown and trends"
echo "  • Recent activity (leads + payments)"
echo "  • Actionable alerts and notifications"
echo "  • Performance metrics and profile completeness"
echo ""
echo "Query Parameters:"
echo "  • startDate - Filter from date (ISO format)"
echo "  • endDate - Filter to date (ISO format)"
echo "  • Default: Last 30 days if no dates provided"
