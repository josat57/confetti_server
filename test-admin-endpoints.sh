#!/bin/bash

# Admin Dashboard Endpoints Test Script
# Tests that all new admin endpoints are properly registered

BASE_URL="http://localhost:9600/api/v1/admin"

echo "🧪 Testing Admin Dashboard Endpoints"
echo "======================================"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_endpoint() {
    local method=$1
    local endpoint=$2
    local description=$3
    
    echo -n "Testing: $description ... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" -X $method "$BASE_URL$endpoint" 2>&1)
    
    # 401 (Unauthorized) or 403 (Forbidden) means endpoint exists but requires auth
    # 404 means endpoint doesn't exist
    if [ "$response" = "401" ] || [ "$response" = "403" ]; then
        echo -e "${GREEN}✓ EXISTS${NC} (HTTP $response - Auth required)"
    elif [ "$response" = "404" ]; then
        echo -e "${RED}✗ NOT FOUND${NC} (HTTP 404)"
    else
        echo -e "${YELLOW}? UNKNOWN${NC} (HTTP $response)"
    fi
}

echo "📊 Phase 2: Dashboard Metrics"
test_endpoint "GET" "/dashboard/metrics" "Dashboard Metrics"
echo ""

echo "👥 Phase 3: User Management"
test_endpoint "GET" "/users" "List Users"
test_endpoint "GET" "/users/export" "Export Users"
test_endpoint "GET" "/users/123/activity" "User Activity Log"
test_endpoint "DELETE" "/users/123" "Delete User"
echo ""

echo "🏢 Phase 4: Vendor Verification"
test_endpoint "GET" "/vendors" "List Vendors"
test_endpoint "GET" "/vendors/export" "Export Vendors"
test_endpoint "GET" "/vendors/statistics" "Vendor Statistics"
test_endpoint "GET" "/vendors/verifications" "Verification Queue"
test_endpoint "POST" "/vendors/123/approve" "Approve Vendor"
test_endpoint "POST" "/vendors/123/reject" "Reject Vendor"
test_endpoint "GET" "/vendors/123/performance" "Vendor Performance"
echo ""

echo "🛡️ Phase 5: Content Moderation"
test_endpoint "GET" "/moderation/flagged" "Flagged Content"
test_endpoint "GET" "/moderation/statistics" "Moderation Statistics"
test_endpoint "POST" "/moderation/flagged/123/approve" "Approve Content"
test_endpoint "POST" "/moderation/flagged/123/remove" "Remove Content"
test_endpoint "POST" "/moderation/flagged/123/ban-user" "Ban User"
echo ""

echo "💳 Phase 6: Subscription & Billing"
test_endpoint "GET" "/subscriptions" "List Subscriptions"
test_endpoint "GET" "/subscriptions/statistics" "Subscription Statistics"
test_endpoint "POST" "/subscriptions/123/upgrade" "Upgrade Subscription"
test_endpoint "POST" "/subscriptions/123/cancel" "Cancel Subscription"
test_endpoint "POST" "/payments/123/refund" "Issue Refund"
test_endpoint "GET" "/payments/failed" "Failed Payments"
echo ""

echo "💰 Phase 7: Transaction Management"
test_endpoint "GET" "/transactions" "List Transactions"
test_endpoint "GET" "/transactions/analytics" "Payment Analytics"
test_endpoint "GET" "/transactions/trends" "Transaction Trends"
test_endpoint "POST" "/transactions/123/refund" "Refund Transaction"
test_endpoint "POST" "/transactions/123/dispute" "Mark Disputed"
echo ""

echo "🎫 Phase 8: Support Tickets"
test_endpoint "GET" "/tickets" "List Tickets"
test_endpoint "GET" "/tickets/statistics" "Ticket Statistics"
test_endpoint "POST" "/tickets/123/assign" "Assign Ticket"
test_endpoint "POST" "/tickets/123/respond" "Respond to Ticket"
test_endpoint "POST" "/tickets/123/escalate" "Escalate Ticket"
test_endpoint "GET" "/canned-responses" "Canned Responses"
echo ""

echo "📈 Phase 9: Analytics & Reporting"
test_endpoint "GET" "/analytics/users" "User Analytics"
test_endpoint "GET" "/analytics/events" "Event Analytics"
test_endpoint "GET" "/analytics/financial" "Financial Analytics"
test_endpoint "GET" "/analytics/engagement" "Engagement Analytics"
test_endpoint "POST" "/analytics/custom-report" "Custom Report"
echo ""

echo "======================================"
echo "✅ Endpoint Registration Test Complete"
echo ""
