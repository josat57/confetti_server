#!/bin/bash

echo "🧪 Testing Phase 16: Advanced Reporting Endpoints"
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
echo "📋 Report Templates"
test_endpoint "GET" "/report-templates" "List Report Templates"
test_endpoint "GET" "/report-templates/123" "Get Report Template by ID"
test_endpoint "POST" "/report-templates" "Create Report Template"
test_endpoint "PUT" "/report-templates/123" "Update Report Template"
test_endpoint "DELETE" "/report-templates/123" "Delete Report Template"

echo ""
echo "⏰ Scheduled Reports"
test_endpoint "GET" "/scheduled-reports" "List Scheduled Reports"
test_endpoint "GET" "/scheduled-reports/123" "Get Scheduled Report by ID"
test_endpoint "POST" "/scheduled-reports" "Create Scheduled Report"
test_endpoint "PUT" "/scheduled-reports/123" "Update Scheduled Report"
test_endpoint "POST" "/scheduled-reports/123/toggle" "Toggle Scheduled Report"
test_endpoint "DELETE" "/scheduled-reports/123" "Delete Scheduled Report"

echo ""
echo "📊 Generated Reports"
test_endpoint "GET" "/generated-reports" "List Generated Reports"
test_endpoint "GET" "/generated-reports/123" "Get Generated Report by ID"
test_endpoint "POST" "/generated-reports/generate" "Generate Report"
test_endpoint "GET" "/generated-reports/123/download" "Download Report"
test_endpoint "DELETE" "/generated-reports/123" "Delete Generated Report"

echo ""
echo "======================================================"
echo "✅ Phase 16 Endpoint Registration Test Complete"
