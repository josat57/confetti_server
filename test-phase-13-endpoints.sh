#!/bin/bash

echo "🧪 Testing Phase 13: Advanced Search & Filters Endpoints"
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
echo "🔍 Global Search"
test_endpoint "GET" "/search/global?q=test" "Perform Global Search"

echo ""
echo "🔎 Advanced Search"
test_endpoint "POST" "/search/advanced" "Perform Advanced Search"

echo ""
echo "💾 Saved Searches"
test_endpoint "GET" "/saved-searches" "List Saved Searches"
test_endpoint "GET" "/saved-searches/123" "Get Saved Search by ID"
test_endpoint "POST" "/saved-searches" "Create Saved Search"
test_endpoint "PUT" "/saved-searches/123" "Update Saved Search"
test_endpoint "POST" "/saved-searches/123/execute" "Execute Saved Search"
test_endpoint "DELETE" "/saved-searches/123" "Delete Saved Search"

echo ""
echo "📜 Search History"
test_endpoint "GET" "/search/history" "Get Search History"
test_endpoint "DELETE" "/search/history" "Clear Search History"
test_endpoint "GET" "/search/analytics" "Get Search Analytics"

echo ""
echo "======================================================"
echo "✅ Phase 13 Endpoint Registration Test Complete"
