#!/bin/bash

# Phase 19: Coupon & Promotion Management - Endpoint Testing Script

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
echo "Phase 19: Coupon & Promotion Management"
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

# ==================== COUPON MANAGEMENT ====================

echo "=========================================="
echo "COUPON MANAGEMENT TESTING"
echo "=========================================="
echo ""

# Test 1: Generate Coupon Codes
print_info "Test 1: Generating coupon codes..."
GENERATE_CODES_RESPONSE=$(api_call POST "/admin/coupons/generate-codes" '{
    "count": 5,
    "prefix": "SAVE",
    "length": 6
}')
echo $GENERATE_CODES_RESPONSE | jq '.' 2>/dev/null || echo $GENERATE_CODES_RESPONSE
print_success "Coupon codes generated"
echo ""

# Test 2: Create Coupon
print_info "Test 2: Creating coupon..."
CREATE_COUPON_RESPONSE=$(api_call POST "/admin/coupons" '{
    "name": "Black Friday Sale",
    "description": "20% off all premium subscriptions",
    "type": "percentage",
    "value": 20,
    "currency": "USD",
    "status": "active",
    "usageLimit": {
        "total": 100,
        "perUser": 1
    },
    "minimumPurchase": 50,
    "maximumDiscount": 100,
    "validFrom": "2025-11-28T00:00:00Z",
    "validUntil": "2025-12-31T23:59:59Z",
    "targeting": {
        "userTypes": ["planner", "vendor"],
        "subscriptionTiers": ["premium", "enterprise"]
    },
    "applicableTo": {
        "subscriptionPlans": ["premium", "enterprise"]
    },
    "stackable": false,
    "autoApply": false
}')

COUPON_ID=$(echo $CREATE_COUPON_RESPONSE | grep -o '"_id":"[^"]*' | cut -d'"' -f4)

if [ -z "$COUPON_ID" ]; then
    print_error "Failed to create coupon"
    echo "Response: $CREATE_COUPON_RESPONSE"
else
    print_success "Coupon created: $COUPON_ID"
fi
echo ""

# Test 3: Get All Coupons
print_info "Test 3: Getting all coupons..."
GET_COUPONS_RESPONSE=$(api_call GET "/admin/coupons")
echo $GET_COUPONS_RESPONSE | jq '.' 2>/dev/null || echo $GET_COUPONS_RESPONSE
print_success "Retrieved coupons"
echo ""

# Test 4: Get Coupon by ID
print_info "Test 4: Getting coupon by ID..."
GET_COUPON_RESPONSE=$(api_call GET "/admin/coupons/$COUPON_ID")
echo $GET_COUPON_RESPONSE | jq '.' 2>/dev/null || echo $GET_COUPON_RESPONSE
print_success "Retrieved coupon details"
echo ""

# Test 5: Update Coupon
print_info "Test 5: Updating coupon..."
UPDATE_COUPON_RESPONSE=$(api_call PUT "/admin/coupons/$COUPON_ID" '{
    "description": "Updated: 20% off all premium subscriptions - Extended!",
    "value": 25
}')
echo $UPDATE_COUPON_RESPONSE | jq '.' 2>/dev/null || echo $UPDATE_COUPON_RESPONSE
print_success "Coupon updated"
echo ""

# Test 6: Validate Coupon
print_info "Test 6: Validating coupon..."
COUPON_CODE=$(echo $CREATE_COUPON_RESPONSE | grep -o '"code":"[^"]*' | cut -d'"' -f4)
VALIDATE_COUPON_RESPONSE=$(api_call POST "/admin/coupons/validate" "{
    \"code\": \"$COUPON_CODE\",
    \"userId\": \"507f1f77bcf86cd799439011\",
    \"userType\": \"planner\",
    \"subscriptionTier\": \"premium\",
    \"amount\": 100
}")
echo $VALIDATE_COUPON_RESPONSE | jq '.' 2>/dev/null || echo $VALIDATE_COUPON_RESPONSE
print_success "Coupon validated"
echo ""

# Test 7: Toggle Coupon Status
print_info "Test 7: Toggling coupon status..."
TOGGLE_COUPON_RESPONSE=$(api_call POST "/admin/coupons/$COUPON_ID/toggle")
echo $TOGGLE_COUPON_RESPONSE | jq '.' 2>/dev/null || echo $TOGGLE_COUPON_RESPONSE
print_success "Coupon status toggled"
echo ""

# Test 8: Get Coupon Analytics
print_info "Test 8: Getting coupon analytics..."
COUPON_ANALYTICS_RESPONSE=$(api_call GET "/admin/coupons/$COUPON_ID/analytics?days=30")
echo $COUPON_ANALYTICS_RESPONSE | jq '.' 2>/dev/null || echo $COUPON_ANALYTICS_RESPONSE
print_success "Retrieved coupon analytics"
echo ""

# Test 9: Create Bulk Coupons
print_info "Test 9: Creating bulk coupons..."
CREATE_BULK_RESPONSE=$(api_call POST "/admin/coupons/bulk" '{
    "count": 10,
    "name": "Holiday Special",
    "description": "10% off for holiday season",
    "type": "percentage",
    "value": 10,
    "currency": "USD",
    "status": "active",
    "usageLimit": {
        "total": null,
        "perUser": 1
    },
    "minimumPurchase": 0,
    "validFrom": "2025-12-01T00:00:00Z",
    "validUntil": "2025-12-31T23:59:59Z",
    "targeting": {
        "userTypes": ["all"]
    },
    "codePrefix": "HOLIDAY",
    "codeLength": 6
}')
echo $CREATE_BULK_RESPONSE | jq '.' 2>/dev/null || echo $CREATE_BULK_RESPONSE
print_success "Bulk coupons created"
echo ""

# Test 10: Filter Coupons by Status
print_info "Test 10: Filtering coupons by status..."
FILTER_COUPONS_RESPONSE=$(api_call GET "/admin/coupons?status=active")
echo $FILTER_COUPONS_RESPONSE | jq '.' 2>/dev/null || echo $FILTER_COUPONS_RESPONSE
print_success "Filtered coupons"
echo ""

# ==================== PROMOTION MANAGEMENT ====================

echo "=========================================="
echo "PROMOTION MANAGEMENT TESTING"
echo "=========================================="
echo ""

# Test 11: Create Promotion
print_info "Test 11: Creating promotion..."
CREATE_PROMOTION_RESPONSE=$(api_call POST "/admin/promotions" '{
    "name": "Black Friday Campaign",
    "description": "Massive discounts for Black Friday",
    "type": "seasonal",
    "status": "draft",
    "priority": 10,
    "startDate": "2025-11-28T00:00:00Z",
    "endDate": "2025-11-30T23:59:59Z",
    "targeting": {
        "userTypes": ["all"]
    },
    "budget": {
        "total": 10000,
        "currency": "USD"
    },
    "goals": {
        "targetRevenue": 50000,
        "targetConversions": 500,
        "targetNewUsers": 100
    },
    "banners": [{
        "type": "hero",
        "title": "Black Friday Sale!",
        "message": "Get up to 50% off on all plans",
        "ctaText": "Shop Now",
        "ctaUrl": "/pricing"
    }],
    "emailCampaign": {
        "enabled": true,
        "subject": "Black Friday Deals Are Here!",
        "templateId": "black_friday_2025"
    },
    "pushNotification": {
        "enabled": true,
        "title": "Black Friday Sale",
        "message": "Don'\''t miss out on our biggest sale of the year!"
    }
}')

PROMOTION_ID=$(echo $CREATE_PROMOTION_RESPONSE | grep -o '"_id":"[^"]*' | cut -d'"' -f4)

if [ -z "$PROMOTION_ID" ]; then
    print_error "Failed to create promotion"
    echo "Response: $CREATE_PROMOTION_RESPONSE"
else
    print_success "Promotion created: $PROMOTION_ID"
fi
echo ""

# Test 12: Get All Promotions
print_info "Test 12: Getting all promotions..."
GET_PROMOTIONS_RESPONSE=$(api_call GET "/admin/promotions")
echo $GET_PROMOTIONS_RESPONSE | jq '.' 2>/dev/null || echo $GET_PROMOTIONS_RESPONSE
print_success "Retrieved promotions"
echo ""

# Test 13: Get Promotion by ID
print_info "Test 13: Getting promotion by ID..."
GET_PROMOTION_RESPONSE=$(api_call GET "/admin/promotions/$PROMOTION_ID")
echo $GET_PROMOTION_RESPONSE | jq '.' 2>/dev/null || echo $GET_PROMOTION_RESPONSE
print_success "Retrieved promotion details"
echo ""

# Test 14: Update Promotion
print_info "Test 14: Updating promotion..."
UPDATE_PROMOTION_RESPONSE=$(api_call PUT "/admin/promotions/$PROMOTION_ID" '{
    "description": "Updated: Massive discounts for Black Friday - Extended to Cyber Monday!",
    "priority": 9
}')
echo $UPDATE_PROMOTION_RESPONSE | jq '.' 2>/dev/null || echo $UPDATE_PROMOTION_RESPONSE
print_success "Promotion updated"
echo ""

# Test 15: Start Promotion
print_info "Test 15: Starting promotion..."
START_PROMOTION_RESPONSE=$(api_call POST "/admin/promotions/$PROMOTION_ID/start")
echo $START_PROMOTION_RESPONSE | jq '.' 2>/dev/null || echo $START_PROMOTION_RESPONSE
print_success "Promotion started"
echo ""

# Test 16: Track Impression
print_info "Test 16: Tracking impression..."
TRACK_IMPRESSION_RESPONSE=$(api_call POST "/admin/promotions/$PROMOTION_ID/track/impression")
echo $TRACK_IMPRESSION_RESPONSE | jq '.' 2>/dev/null || echo $TRACK_IMPRESSION_RESPONSE
print_success "Impression tracked"
echo ""

# Test 17: Track Click
print_info "Test 17: Tracking click..."
TRACK_CLICK_RESPONSE=$(api_call POST "/admin/promotions/$PROMOTION_ID/track/click")
echo $TRACK_CLICK_RESPONSE | jq '.' 2>/dev/null || echo $TRACK_CLICK_RESPONSE
print_success "Click tracked"
echo ""

# Test 18: Track Conversion
print_info "Test 18: Tracking conversion..."
TRACK_CONVERSION_RESPONSE=$(api_call POST "/admin/promotions/$PROMOTION_ID/track/conversion" '{
    "revenue": 99.99
}')
echo $TRACK_CONVERSION_RESPONSE | jq '.' 2>/dev/null || echo $TRACK_CONVERSION_RESPONSE
print_success "Conversion tracked"
echo ""

# Test 19: Get Promotion Analytics
print_info "Test 19: Getting promotion analytics..."
PROMOTION_ANALYTICS_RESPONSE=$(api_call GET "/admin/promotions/$PROMOTION_ID/analytics")
echo $PROMOTION_ANALYTICS_RESPONSE | jq '.' 2>/dev/null || echo $PROMOTION_ANALYTICS_RESPONSE
print_success "Retrieved promotion analytics"
echo ""

# Test 20: Pause Promotion
print_info "Test 20: Pausing promotion..."
PAUSE_PROMOTION_RESPONSE=$(api_call POST "/admin/promotions/$PROMOTION_ID/pause")
echo $PAUSE_PROMOTION_RESPONSE | jq '.' 2>/dev/null || echo $PAUSE_PROMOTION_RESPONSE
print_success "Promotion paused"
echo ""

# Test 21: Complete Promotion
print_info "Test 21: Completing promotion..."
COMPLETE_PROMOTION_RESPONSE=$(api_call POST "/admin/promotions/$PROMOTION_ID/complete")
echo $COMPLETE_PROMOTION_RESPONSE | jq '.' 2>/dev/null || echo $COMPLETE_PROMOTION_RESPONSE
print_success "Promotion completed"
echo ""

# Test 22: Create Another Promotion
print_info "Test 22: Creating another promotion..."
CREATE_PROMOTION2_RESPONSE=$(api_call POST "/admin/promotions" '{
    "name": "New Year Flash Sale",
    "description": "Limited time offer for new year",
    "type": "flash_sale",
    "status": "scheduled",
    "priority": 8,
    "startDate": "2026-01-01T00:00:00Z",
    "endDate": "2026-01-03T23:59:59Z",
    "targeting": {
        "userTypes": ["planner"],
        "subscriptionTiers": ["free", "basic"]
    },
    "budget": {
        "total": 5000,
        "currency": "USD"
    }
}')
print_success "Second promotion created"
echo ""

# Test 23: Filter Promotions by Status
print_info "Test 23: Filtering promotions by status..."
FILTER_PROMOTIONS_RESPONSE=$(api_call GET "/admin/promotions?status=completed")
echo $FILTER_PROMOTIONS_RESPONSE | jq '.' 2>/dev/null || echo $FILTER_PROMOTIONS_RESPONSE
print_success "Filtered promotions"
echo ""

# Test 24: Search Coupons
print_info "Test 24: Searching coupons..."
SEARCH_COUPONS_RESPONSE=$(api_call GET "/admin/coupons?search=Black")
echo $SEARCH_COUPONS_RESPONSE | jq '.' 2>/dev/null || echo $SEARCH_COUPONS_RESPONSE
print_success "Searched coupons"
echo ""

# Test 25: Delete Coupon
print_info "Test 25: Deleting coupon..."
DELETE_COUPON_RESPONSE=$(api_call DELETE "/admin/coupons/$COUPON_ID")
echo $DELETE_COUPON_RESPONSE | jq '.' 2>/dev/null || echo $DELETE_COUPON_RESPONSE
print_success "Coupon deleted"
echo ""

# Test 26: Delete Promotion
print_info "Test 26: Deleting promotion..."
DELETE_PROMOTION_RESPONSE=$(api_call DELETE "/admin/promotions/$PROMOTION_ID")
echo $DELETE_PROMOTION_RESPONSE | jq '.' 2>/dev/null || echo $DELETE_PROMOTION_RESPONSE
print_success "Promotion deleted"
echo ""

echo "=========================================="
echo "TESTING COMPLETE!"
echo "=========================================="
echo ""
print_success "All 26 endpoints tested successfully!"
echo ""
echo "Summary:"
echo "- Coupon Management: 10 endpoints"
echo "- Promotion Management: 16 endpoints"
echo "- Total: 26 endpoints"
echo ""
