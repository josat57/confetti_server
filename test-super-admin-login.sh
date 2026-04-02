#!/bin/bash

# Test Super Admin Login

BASE_URL="http://localhost:5000/api/v1"

echo "=========================================="
echo "Testing Super Admin Login"
echo "=========================================="
echo ""

# Test 1: Login with default super admin
echo "Test 1: Login with default super admin email..."
curl -X POST "$BASE_URL/auth/signin" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "power.admin@confetti.com",
    "password": "Ginger@123A"
  }' | jq '.'

echo ""
echo ""

# Test 2: Login with custom admin email
echo "Test 2: Login with custom admin email..."
curl -X POST "$BASE_URL/auth/signin" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "power.admin@mail.com",
    "password": "Ginger@123A"
  }' | jq '.'

echo ""
echo ""

# Test 3: Login with another admin email
echo "Test 3: Login with another admin email..."
curl -X POST "$BASE_URL/auth/signin" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "myadmin@company.com",
    "password": "MyPassword123!"
  }' | jq '.'

echo ""
echo "=========================================="
echo "Tests Complete"
echo "=========================================="
