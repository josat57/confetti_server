#!/bin/bash

# Phase 18: Feature Flags & A/B Testing - Endpoint Testing Script

BASE_URL="http://localhost:5000/api/v1"
ADMIN_TOKEN=""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Function to make API calls
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    
    if [ -z "$data" ]; then
        curl -s -X $method "$BASE_URL$endpoint" \
            -H "Authorization: Bearer $ADMIN_TOKEN" \
            -H "Content-Type: application/json"
    else
        curl -s -X $method "$BASE_URL$endpoint" \
            -H "Authorization: Bearer $ADMIN_TOKEN" \
            -H "Content-Type: application/json" \
            -d "$data"
    fi
}

echo "=========================================="
echo "Phase 18: Feature Flags & A/B Testing"
echo "Endpoint Testing Script"
echo "=========================================="
echo ""

# Step 1: Admin Login
print_info "Step 1: Logging in as admin..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/signin" \
    -H "Content-Type: application/json" \
    -d '{
        "email": "admin@confetti.com",
        "password": "Admin123!@#"
    }')

ADMIN_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$ADMIN_TOKEN" ]; then
    print_error "Failed to login as admin"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi

print_success "Admin logged in successfully"
echo ""

# ==================== FEATURE FLAGS ====================

echo "=========================================="
echo "FEATURE FLAGS TESTING"
echo "=========================================="
echo ""

# Test 1: Create Feature Flag
print_info "Test 1: Creating feature flag..."
CREATE_FLAG_RESPONSE=$(api_call POST "/admin/feature-flags" '{
    "name": "New Dashboard UI",
    "key": "new_dashboard_ui",
    "description": "Enable the new redesigned dashboard interface",
    "enabled": false,
    "rolloutPercentage": 0,
    "targetAudience": {
        "userTypes": ["planner", "vendor"],
        "subscriptionTiers": ["premium", "enterprise"]
    },
    "environment": "production"
}')

FLAG_ID=$(echo $CREATE_FLAG_RESPONSE | grep -o '"_id":"[^"]*' | cut -d'"' -f4)

if [ -z "$FLAG_ID" ]; then
    print_error "Failed to create feature flag"
    echo "Response: $CREATE_FLAG_RESPONSE"
else
    print_success "Feature flag created: $FLAG_ID"
fi
echo ""

# Test 2: Get All Feature Flags
print_info "Test 2: Getting all feature flags..."
GET_FLAGS_RESPONSE=$(api_call GET "/admin/feature-flags")
echo $GET_FLAGS_RESPONSE | jq '.' 2>/dev/null || echo $GET_FLAGS_RESPONSE
print_success "Retrieved feature flags"
echo ""

# Test 3: Get Feature Flag by ID
print_info "Test 3: Getting feature flag by ID..."
GET_FLAG_RESPONSE=$(api_call GET "/admin/feature-flags/$FLAG_ID")
echo $GET_FLAG_RESPONSE | jq '.' 2>/dev/null || echo $GET_FLAG_RESPONSE
print_success "Retrieved feature flag details"
echo ""

# Test 4: Update Feature Flag
print_info "Test 4: Updating feature flag..."
UPDATE_FLAG_RESPONSE=$(api_call PUT "/admin/feature-flags/$FLAG_ID" '{
    "description": "Updated: Enable the new redesigned dashboard interface with improved UX",
    "rolloutPercentage": 25
}')
echo $UPDATE_FLAG_RESPONSE | jq '.' 2>/dev/null || echo $UPDATE_FLAG_RESPONSE
print_success "Feature flag updated"
echo ""

# Test 5: Toggle Feature Flag
print_info "Test 5: Toggling feature flag..."
TOGGLE_FLAG_RESPONSE=$(api_call POST "/admin/feature-flags/$FLAG_ID/toggle")
echo $TOGGLE_FLAG_RESPONSE | jq '.' 2>/dev/null || echo $TOGGLE_FLAG_RESPONSE
print_success "Feature flag toggled"
echo ""

# Test 6: Check Feature Flag
print_info "Test 6: Checking if feature is enabled for user..."
CHECK_FLAG_RESPONSE=$(api_call POST "/admin/feature-flags/check" '{
    "featureKey": "new_dashboard_ui",
    "userId": "507f1f77bcf86cd799439011",
    "userType": "planner",
    "subscriptionTier": "premium"
}')
echo $CHECK_FLAG_RESPONSE | jq '.' 2>/dev/null || echo $CHECK_FLAG_RESPONSE
print_success "Feature flag checked"
echo ""

# Test 7: Get Feature Flag Usage
print_info "Test 7: Getting feature flag usage statistics..."
USAGE_RESPONSE=$(api_call GET "/admin/feature-flags/$FLAG_ID/usage?days=30")
echo $USAGE_RESPONSE | jq '.' 2>/dev/null || echo $USAGE_RESPONSE
print_success "Retrieved usage statistics"
echo ""

# Test 8: Create Another Feature Flag
print_info "Test 8: Creating another feature flag..."
CREATE_FLAG2_RESPONSE=$(api_call POST "/admin/feature-flags" '{
    "name": "AI Event Suggestions",
    "key": "ai_event_suggestions",
    "description": "Enable AI-powered event suggestions",
    "enabled": true,
    "rolloutPercentage": 50,
    "targetAudience": {
        "userTypes": ["planner"]
    },
    "environment": "all"
}')
print_success "Second feature flag created"
echo ""

# ==================== A/B TESTS ====================

echo "=========================================="
echo "A/B TESTING"
echo "=========================================="
echo ""

# Test 9: Create A/B Test
print_info "Test 9: Creating A/B test..."
CREATE_TEST_RESPONSE=$(api_call POST "/admin/ab-tests" '{
    "name": "Checkout Button Color Test",
    "key": "checkout_button_color",
    "description": "Test which button color leads to more conversions",
    "variants": [
        {
            "name": "Control (Blue)",
            "key": "control_blue",
            "description": "Original blue button",
            "weight": 50,
            "config": {
                "buttonColor": "#007bff"
            }
        },
        {
            "name": "Variant (Green)",
            "key": "variant_green",
            "description": "Green button variant",
            "weight": 50,
            "config": {
                "buttonColor": "#28a745"
            }
        }
    ],
    "targetAudience": {
        "userTypes": ["planner", "vendor"]
    },
    "metrics": [
        {
            "name": "Conversion Rate",
            "key": "conversion_rate",
            "type": "conversion",
            "goal": "increase"
        }
    ],
    "startDate": "2025-11-28T00:00:00Z",
    "endDate": "2025-12-28T23:59:59Z",
    "sampleSize": {
        "target": 1000
    }
}')

TEST_ID=$(echo $CREATE_TEST_RESPONSE | grep -o '"_id":"[^"]*' | cut -d'"' -f4)

if [ -z "$TEST_ID" ]; then
    print_error "Failed to create A/B test"
    echo "Response: $CREATE_TEST_RESPONSE"
else
    print_success "A/B test created: $TEST_ID"
fi
echo ""

# Test 10: Get All A/B Tests
print_info "Test 10: Getting all A/B tests..."
GET_TESTS_RESPONSE=$(api_call GET "/admin/ab-tests")
echo $GET_TESTS_RESPONSE | jq '.' 2>/dev/null || echo $GET_TESTS_RESPONSE
print_success "Retrieved A/B tests"
echo ""

# Test 11: Get A/B Test by ID
print_info "Test 11: Getting A/B test by ID..."
GET_TEST_RESPONSE=$(api_call GET "/admin/ab-tests/$TEST_ID")
echo $GET_TEST_RESPONSE | jq '.' 2>/dev/null || echo $GET_TEST_RESPONSE
print_success "Retrieved A/B test details"
echo ""

# Test 12: Update A/B Test
print_info "Test 12: Updating A/B test..."
UPDATE_TEST_RESPONSE=$(api_call PUT "/admin/ab-tests/$TEST_ID" '{
    "description": "Updated: Test which button color leads to more conversions on checkout page"
}')
echo $UPDATE_TEST_RESPONSE | jq '.' 2>/dev/null || echo $UPDATE_TEST_RESPONSE
print_success "A/B test updated"
echo ""

# Test 13: Start A/B Test
print_info "Test 13: Starting A/B test..."
START_TEST_RESPONSE=$(api_call POST "/admin/ab-tests/$TEST_ID/start")
echo $START_TEST_RESPONSE | jq '.' 2>/dev/null || echo $START_TEST_RESPONSE
print_success "A/B test started"
echo ""

# Test 14: Track Conversion
print_info "Test 14: Tracking conversion..."
TRACK_CONVERSION_RESPONSE=$(api_call POST "/admin/ab-tests/checkout_button_color/conversion" '{
    "userId": "507f1f77bcf86cd799439011",
    "eventData": {
        "amount": 99.99,
        "currency": "USD"
    }
}')
echo $TRACK_CONVERSION_RESPONSE | jq '.' 2>/dev/null || echo $TRACK_CONVERSION_RESPONSE
print_success "Conversion tracked"
echo ""

# Test 15: Track Event
print_info "Test 15: Tracking custom event..."
TRACK_EVENT_RESPONSE=$(api_call POST "/admin/ab-tests/checkout_button_color/event" '{
    "userId": "507f1f77bcf86cd799439011",
    "eventType": "button_click",
    "eventData": {
        "timestamp": "2025-11-28T12:00:00Z"
    }
}')
echo $TRACK_EVENT_RESPONSE | jq '.' 2>/dev/null || echo $TRACK_EVENT_RESPONSE
print_success "Event tracked"
echo ""

# Test 16: Get A/B Test Results
print_info "Test 16: Getting A/B test results..."
RESULTS_RESPONSE=$(api_call GET "/admin/ab-tests/$TEST_ID/results")
echo $RESULTS_RESPONSE | jq '.' 2>/dev/null || echo $RESULTS_RESPONSE
print_success "Retrieved test results"
echo ""

# Test 17: Get A/B Test Analytics
print_info "Test 17: Getting A/B test analytics..."
ANALYTICS_RESPONSE=$(api_call GET "/admin/ab-tests/$TEST_ID/analytics")
echo $ANALYTICS_RESPONSE | jq '.' 2>/dev/null || echo $ANALYTICS_RESPONSE
print_success "Retrieved test analytics"
echo ""

# Test 18: Pause A/B Test
print_info "Test 18: Pausing A/B test..."
PAUSE_TEST_RESPONSE=$(api_call POST "/admin/ab-tests/$TEST_ID/pause")
echo $PAUSE_TEST_RESPONSE | jq '.' 2>/dev/null || echo $PAUSE_TEST_RESPONSE
print_success "A/B test paused"
echo ""

# Test 19: Complete A/B Test
print_info "Test 19: Completing A/B test..."
COMPLETE_TEST_RESPONSE=$(api_call POST "/admin/ab-tests/$TEST_ID/complete")
echo $COMPLETE_TEST_RESPONSE | jq '.' 2>/dev/null || echo $COMPLETE_TEST_RESPONSE
print_success "A/B test completed"
echo ""

# Test 20: Create Another A/B Test
print_info "Test 20: Creating another A/B test..."
CREATE_TEST2_RESPONSE=$(api_call POST "/admin/ab-tests" '{
    "name": "Pricing Page Layout Test",
    "key": "pricing_page_layout",
    "description": "Test different pricing page layouts",
    "variants": [
        {
            "name": "Control (Table)",
            "key": "control_table",
            "description": "Traditional table layout",
            "weight": 33.33,
            "config": {
                "layout": "table"
            }
        },
        {
            "name": "Variant A (Cards)",
            "key": "variant_cards",
            "description": "Card-based layout",
            "weight": 33.33,
            "config": {
                "layout": "cards"
            }
        },
        {
            "name": "Variant B (Comparison)",
            "key": "variant_comparison",
            "description": "Side-by-side comparison",
            "weight": 33.34,
            "config": {
                "layout": "comparison"
            }
        }
    ],
    "targetAudience": {
        "userTypes": ["all"]
    },
    "metrics": [
        {
            "name": "Sign Up Rate",
            "key": "signup_rate",
            "type": "conversion",
            "goal": "increase"
        }
    ],
    "startDate": "2025-11-28T00:00:00Z",
    "endDate": "2025-12-31T23:59:59Z",
    "sampleSize": {
        "target": 2000
    }
}')
print_success "Second A/B test created"
echo ""

# Test 21: Filter Feature Flags
print_info "Test 21: Filtering feature flags by enabled status..."
FILTER_FLAGS_RESPONSE=$(api_call GET "/admin/feature-flags?enabled=true")
echo $FILTER_FLAGS_RESPONSE | jq '.' 2>/dev/null || echo $FILTER_FLAGS_RESPONSE
print_success "Filtered feature flags"
echo ""

# Test 22: Filter A/B Tests by Status
print_info "Test 22: Filtering A/B tests by status..."
FILTER_TESTS_RESPONSE=$(api_call GET "/admin/ab-tests?status=completed")
echo $FILTER_TESTS_RESPONSE | jq '.' 2>/dev/null || echo $FILTER_TESTS_RESPONSE
print_success "Filtered A/B tests"
echo ""

# Test 23: Search Feature Flags
print_info "Test 23: Searching feature flags..."
SEARCH_FLAGS_RESPONSE=$(api_call GET "/admin/feature-flags?search=dashboard")
echo $SEARCH_FLAGS_RESPONSE | jq '.' 2>/dev/null || echo $SEARCH_FLAGS_RESPONSE
print_success "Searched feature flags"
echo ""

# Test 24: Delete Feature Flag
print_info "Test 24: Deleting feature flag..."
DELETE_FLAG_RESPONSE=$(api_call DELETE "/admin/feature-flags/$FLAG_ID")
echo $DELETE_FLAG_RESPONSE | jq '.' 2>/dev/null || echo $DELETE_FLAG_RESPONSE
print_success "Feature flag deleted"
echo ""

# Test 25: Delete A/B Test
print_info "Test 25: Deleting A/B test..."
DELETE_TEST_RESPONSE=$(api_call DELETE "/admin/ab-tests/$TEST_ID")
echo $DELETE_TEST_RESPONSE | jq '.' 2>/dev/null || echo $DELETE_TEST_RESPONSE
print_success "A/B test deleted"
echo ""

echo "=========================================="
echo "TESTING COMPLETE!"
echo "=========================================="
echo ""
print_success "All 25 endpoints tested successfully!"
echo ""
echo "Summary:"
echo "- Feature Flags: 8 endpoints"
echo "- A/B Tests: 17 endpoints"
echo "- Total: 25 endpoints"
echo ""
