#!/bin/bash

echo "🧪 Testing Phase 11: Notification Management Endpoints"
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
echo "📬 Notifications"
test_endpoint "GET" "/notifications" "List Notifications"
test_endpoint "GET" "/notifications/statistics" "Get Notification Statistics"
test_endpoint "GET" "/notifications/123" "Get Notification by ID"
test_endpoint "POST" "/notifications/send" "Send Notification"
test_endpoint "POST" "/notifications/send-bulk" "Send Bulk Notification"
test_endpoint "POST" "/notifications/123/retry" "Retry Failed Notification"
test_endpoint "DELETE" "/notifications/123" "Delete Notification"

echo ""
echo "📝 Notification Templates"
test_endpoint "GET" "/notification-templates" "List Notification Templates"
test_endpoint "GET" "/notification-templates/test_template" "Get Template by Key"
test_endpoint "POST" "/notification-templates" "Create Notification Template"
test_endpoint "PUT" "/notification-templates/test_template" "Update Notification Template"
test_endpoint "POST" "/notification-templates/test_template/preview" "Preview Notification Template"
test_endpoint "DELETE" "/notification-templates/test_template" "Delete Notification Template"

echo ""
echo "⚙️ Notification Preferences"
test_endpoint "GET" "/users/123/notification-preferences" "Get User Preferences"
test_endpoint "PUT" "/users/123/notification-preferences" "Update User Preferences"

echo ""
echo "📱 Push Tokens"
test_endpoint "GET" "/push-tokens" "List Push Tokens"
test_endpoint "DELETE" "/push-tokens/123" "Delete Push Token"

echo ""
echo "======================================================"
echo "✅ Phase 11 Endpoint Registration Test Complete"
