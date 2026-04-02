#!/bin/bash

echo "🧪 Testing Phase 15: Real-time Updates Endpoints"
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
echo "🔌 Real-time Connection Management"
test_endpoint "GET" "/realtime/connected-admins" "Get Connected Admins"
test_endpoint "GET" "/realtime/connection-stats" "Get Connection Stats"
test_endpoint "GET" "/realtime/rooms/dashboard/members" "Get Room Members"
test_endpoint "GET" "/realtime/admins/123/status" "Check Admin Online Status"

echo ""
echo "📡 Real-time Broadcast"
test_endpoint "POST" "/realtime/broadcast/dashboard" "Broadcast Dashboard Update"
test_endpoint "POST" "/realtime/broadcast/notification/123" "Broadcast Notification to Admin"
test_endpoint "POST" "/realtime/broadcast/alert" "Broadcast System Alert"
test_endpoint "POST" "/realtime/broadcast/room/dashboard" "Broadcast to Room"

echo ""
echo "📊 Activity Feed"
test_endpoint "GET" "/realtime/activities" "Get Recent Activities"

echo ""
echo "======================================================"
echo "✅ Phase 15 Endpoint Registration Test Complete"
echo ""
echo "Note: WebSocket server is running on ws://localhost:9600/admin-socket"
