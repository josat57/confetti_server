#!/bin/bash

echo "=========================================="
echo "Restarting Node API Container"
echo "=========================================="
echo ""

# Restart the Node API container
echo "Stopping confetti-node-api container..."
docker stop confetti-node-api

echo ""
echo "Starting confetti-node-api container..."
docker start confetti-node-api

echo ""
echo "Waiting for container to be ready..."
sleep 5

echo ""
echo "Container status:"
docker ps | grep confetti-node-api

echo ""
echo "Checking logs (last 20 lines):"
docker logs --tail 20 confetti-node-api

echo ""
echo "=========================================="
echo "✓ Node API Container Restarted"
echo "=========================================="
echo ""
echo "Test the admin login:"
echo "curl -X POST http://localhost:9600/api/v1/admin/login \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"email\": \"power.admin@confetti.com\", \"password\": \"Ginger@123A\"}'"
echo ""
