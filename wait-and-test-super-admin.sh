#!/bin/bash

echo "=========================================="
echo "Waiting for Docker containers to be ready"
echo "=========================================="
echo ""

# Wait for containers to be up
echo "Waiting for services to start..."
sleep 30

# Check container status
echo ""
echo "Container Status:"
docker-compose ps

# Wait a bit more for services to initialize
echo ""
echo "Waiting for services to initialize..."
sleep 20

# Check logs for super admin initialization
echo ""
echo "=========================================="
echo "Checking Super Admin Initialization"
echo "=========================================="
echo ""
docker-compose logs node-api | grep -i "super admin" || echo "No super admin logs found yet"

# Test super admin login
echo ""
echo "=========================================="
echo "Testing Super Admin Login"
echo "=========================================="
echo ""

echo "Test 1: Login with default super admin credentials"
curl -X POST http://localhost:9600/api/v1/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "power.admin@confetti.com",
    "password": "Ginger@123A"
  }' | jq '.'

echo ""
echo ""
echo "=========================================="
echo "Test Complete!"
echo "=========================================="
echo ""
echo "To view live logs:"
echo "  docker-compose logs -f node-api"
echo ""
echo "To check super admin in database:"
echo "  docker exec -it confetti-mongodb mongosh confetti --eval \"db.users.findOne({'metadata.isSuperAdmin': true})\""
echo ""
