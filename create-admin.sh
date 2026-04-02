#!/bin/bash

# Create Admin Account Script

BASE_URL="http://localhost:5000/api/v1"

echo "=========================================="
echo "Creating Admin Account"
echo "=========================================="
echo ""

# Admin credentials
ADMIN_EMAIL="power.admin@confetti.com"
ADMIN_PASSWORD="Ginger@123A"

echo "Creating admin with email: $ADMIN_EMAIL"
echo ""

# Create super admin
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$BASE_URL/admin/super-admin" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$ADMIN_EMAIL\",
    \"password\": \"$ADMIN_PASSWORD\",
    \"firstName\": \"Power\",
    \"lastName\": \"Admin\",
    \"role\": \"super_admin\",
    \"permissions\": [
      \"user_management\",
      \"vendor_management\",
      \"content_management\",
      \"moderation\",
      \"financial_oversight\",
      \"support_tickets\",
      \"analytics\",
      \"system_configuration\",
      \"audit_logs\",
      \"security_compliance\",
      \"communication_management\"
    ]
  }")

# Extract HTTP status
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

echo "Response:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""
echo "HTTP Status: $HTTP_STATUS"
echo ""

if [ "$HTTP_STATUS" = "201" ] || [ "$HTTP_STATUS" = "200" ]; then
  echo "✓ Admin created successfully!"
  echo ""
  echo "Admin Credentials:"
  echo "  Email: $ADMIN_EMAIL"
  echo "  Password: $ADMIN_PASSWORD"
  echo ""
  echo "You can now login at: POST $BASE_URL/admin/login"
else
  echo "✗ Failed to create admin"
  echo "Check if the server is running on port 5000"
fi

echo "=========================================="
