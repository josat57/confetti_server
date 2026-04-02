#!/bin/bash

echo "🧪 Testing Phase 10: System Configuration Endpoints"
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
echo "🔧 System Configuration"
test_endpoint "GET" "/system-config" "List System Configs"
test_endpoint "GET" "/system-config/test_key" "Get System Config by Key"
test_endpoint "POST" "/system-config" "Create System Config"
test_endpoint "PUT" "/system-config/test_key" "Update System Config"
test_endpoint "DELETE" "/system-config/test_key" "Delete System Config"

echo ""
echo "🚩 Feature Flags"
test_endpoint "GET" "/feature-flags" "List Feature Flags"
test_endpoint "GET" "/feature-flags/test_flag" "Get Feature Flag by Key"
test_endpoint "POST" "/feature-flags" "Create Feature Flag"
test_endpoint "PUT" "/feature-flags/test_flag" "Update Feature Flag"
test_endpoint "POST" "/feature-flags/test_flag/toggle" "Toggle Feature Flag"
test_endpoint "DELETE" "/feature-flags/test_flag" "Delete Feature Flag"

echo ""
echo "📧 Email Templates"
test_endpoint "GET" "/email-templates" "List Email Templates"
test_endpoint "GET" "/email-templates/test_template" "Get Email Template by Key"
test_endpoint "POST" "/email-templates" "Create Email Template"
test_endpoint "PUT" "/email-templates/test_template" "Update Email Template"
test_endpoint "POST" "/email-templates/test_template/preview" "Preview Email Template"
test_endpoint "DELETE" "/email-templates/test_template" "Delete Email Template"

echo ""
echo "💳 Subscription Plans"
test_endpoint "GET" "/subscription-plans" "List Subscription Plans"
test_endpoint "GET" "/subscription-plans/123" "Get Subscription Plan by ID"
test_endpoint "POST" "/subscription-plans" "Create Subscription Plan"
test_endpoint "PUT" "/subscription-plans/123" "Update Subscription Plan"
test_endpoint "DELETE" "/subscription-plans/123" "Delete Subscription Plan"

echo ""
echo "💰 Payment Gateway Configuration"
test_endpoint "GET" "/payment-gateways/flutterwave/config" "Get Payment Gateway Config"
test_endpoint "PUT" "/payment-gateways/flutterwave/config" "Update Payment Gateway Config"
test_endpoint "POST" "/payment-gateways/flutterwave/test" "Test Payment Gateway Connection"

echo ""
echo "🔒 Security Settings"
test_endpoint "GET" "/security-settings" "Get Security Settings"
test_endpoint "PUT" "/security-settings" "Update Security Setting"

echo ""
echo "======================================================"
echo "✅ Phase 10 Endpoint Registration Test Complete"
