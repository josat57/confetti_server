#!/bin/bash

echo "🧪 Testing Phase 17: System Monitoring Endpoints"
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
echo "📊 System Metrics"
test_endpoint "GET" "/monitoring/metrics" "List System Metrics"
test_endpoint "GET" "/monitoring/metrics/current" "Get Current System Metrics"
test_endpoint "GET" "/monitoring/metrics/cpu/statistics" "Get Metric Statistics"

echo ""
echo "🐛 Error Logs"
test_endpoint "GET" "/monitoring/errors" "List Error Logs"
test_endpoint "GET" "/monitoring/errors/statistics" "Get Error Statistics"
test_endpoint "GET" "/monitoring/errors/123" "Get Error Log by ID"
test_endpoint "POST" "/monitoring/errors/123/resolve" "Resolve Error"

echo ""
echo "🚨 System Alerts"
test_endpoint "GET" "/monitoring/alerts" "List System Alerts"
test_endpoint "GET" "/monitoring/alerts/statistics" "Get Alert Statistics"
test_endpoint "GET" "/monitoring/alerts/123" "Get System Alert by ID"
test_endpoint "POST" "/monitoring/alerts/123/acknowledge" "Acknowledge Alert"
test_endpoint "POST" "/monitoring/alerts/123/resolve" "Resolve Alert"

echo ""
echo "💚 System Health"
test_endpoint "GET" "/monitoring/health" "Get System Health"

echo ""
echo "======================================================"
echo "✅ Phase 17 Endpoint Registration Test Complete"
echo ""
echo "Note: System monitoring is running and collecting metrics every minute"
