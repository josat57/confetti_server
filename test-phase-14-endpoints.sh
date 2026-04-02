#!/bin/bash

echo "🧪 Testing Phase 14: Bulk Operations Endpoints"
echo "======================================================"

BASE_URL="http://localhost:9600/api/v1/admin"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

test_endpoint() {
    local method=$1
    local endpoint=$2
    local description=$3
    
    echo -n "Testing: $description ... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" -X $method "$BASE_URL$endpoint")
    
    if [ $response -eq 401 ]; then
        echo -e "${GREEN}✓ EXISTS${NC} (HTTP $response - Auth required)"
    elif [ $response -eq 404 ]; then
        echo -e "${RED}✗ NOT FOUND${NC} (HTTP $response)"
    else
        echo -e "${GREEN}✓ EXISTS${NC} (HTTP $response)"
    fi
}

echo ""
echo "👥 Bulk User Operations"
test_endpoint "POST" "/bulk/users/update-status" "Bulk Update User Status"
test_endpoint "POST" "/bulk/users/delete" "Bulk Delete Users"
test_endpoint "POST" "/bulk/users/export" "Bulk Export Users"
test_endpoint "POST" "/bulk/users/assign-role" "Bulk Assign Role"

echo ""
echo "🏢 Bulk Vendor Operations"
test_endpoint "POST" "/bulk/vendors/approve" "Bulk Approve Vendors"
test_endpoint "POST" "/bulk/vendors/reject" "Bulk Reject Vendors"
test_endpoint "POST" "/bulk/vendors/suspend" "Bulk Suspend Vendors"
test_endpoint "POST" "/bulk/vendors/update-category" "Bulk Update Vendor Category"

echo ""
echo "🛡️ Bulk Content Moderation"
test_endpoint "POST" "/bulk/content/approve" "Bulk Approve Content"
test_endpoint "POST" "/bulk/content/remove" "Bulk Remove Content"
test_endpoint "POST" "/bulk/content/dismiss" "Bulk Dismiss Content"

echo ""
echo "📬 Bulk Notification Operations"
test_endpoint "POST" "/bulk/notifications/send" "Bulk Send Notifications"
test_endpoint "POST" "/bulk/notifications/delete" "Bulk Delete Notifications"

echo ""
echo "🎫 Bulk Ticket Operations"
test_endpoint "POST" "/bulk/tickets/assign" "Bulk Assign Tickets"
test_endpoint "POST" "/bulk/tickets/close" "Bulk Close Tickets"
test_endpoint "POST" "/bulk/tickets/update-priority" "Bulk Update Ticket Priority"

echo ""
echo "======================================================"
echo "✅ Phase 14 Endpoint Registration Test Complete"
