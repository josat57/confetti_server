#!/bin/bash

echo "🧪 Testing Phase 12: Audit & Compliance Endpoints"
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
echo "📋 Enhanced Audit Logs"
test_endpoint "GET" "/audit-logs/enhanced" "List Enhanced Audit Logs"
test_endpoint "GET" "/audit-logs/statistics" "Get Audit Statistics"
test_endpoint "GET" "/audit-logs/export" "Export Audit Logs"
test_endpoint "GET" "/audit-logs/123" "Get Audit Log by ID"

echo ""
echo "📊 Compliance Reports"
test_endpoint "GET" "/compliance-reports" "List Compliance Reports"
test_endpoint "GET" "/compliance-reports/123" "Get Compliance Report by ID"
test_endpoint "POST" "/compliance-reports/generate" "Generate Compliance Report"
test_endpoint "DELETE" "/compliance-reports/123" "Delete Compliance Report"

echo ""
echo "🗄️ Data Retention Policies"
test_endpoint "GET" "/data-retention-policies" "List Data Retention Policies"
test_endpoint "GET" "/data-retention-policies/123" "Get Policy by ID"
test_endpoint "POST" "/data-retention-policies" "Create Data Retention Policy"
test_endpoint "PUT" "/data-retention-policies/123" "Update Data Retention Policy"
test_endpoint "POST" "/data-retention-policies/123/apply" "Apply Data Retention Policy"
test_endpoint "DELETE" "/data-retention-policies/123" "Delete Data Retention Policy"

echo ""
echo "🔒 GDPR Requests"
test_endpoint "GET" "/gdpr-requests" "List GDPR Requests"
test_endpoint "GET" "/gdpr-requests/statistics" "Get GDPR Statistics"
test_endpoint "GET" "/gdpr-requests/123" "Get GDPR Request by ID"
test_endpoint "POST" "/gdpr-requests/123/assign" "Assign GDPR Request"
test_endpoint "POST" "/gdpr-requests/123/verify" "Verify GDPR Request"
test_endpoint "POST" "/gdpr-requests/123/process" "Process GDPR Request"
test_endpoint "POST" "/gdpr-requests/123/reject" "Reject GDPR Request"
test_endpoint "POST" "/gdpr-requests/123/notes" "Add GDPR Request Note"

echo ""
echo "======================================================"
echo "✅ Phase 12 Endpoint Registration Test Complete"
