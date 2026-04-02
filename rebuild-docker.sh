#!/bin/bash

echo "=========================================="
echo "Rebuilding Docker Containers"
echo "=========================================="
echo ""

echo "Step 1: Stopping containers..."
docker stop confetti-node-api confetti-python-api confetti-redis confetti-mongodb confetti-postgres 2>/dev/null || true

echo ""
echo "Step 2: Removing old containers..."
docker rm confetti-node-api confetti-python-api confetti-redis confetti-mongodb confetti-postgres 2>/dev/null || true

echo ""
echo "Step 3: Rebuilding Node API image..."
docker-compose build node-api

echo ""
echo "Step 4: Starting all containers..."
docker-compose up -d

echo ""
echo "Step 5: Waiting for services to be ready..."
sleep 10

echo ""
echo "Step 6: Checking container status..."
docker ps | grep confetti

echo ""
echo "Step 7: Checking Node API logs..."
docker logs --tail 30 confetti-node-api

echo ""
echo "=========================================="
echo "✓ Docker Rebuild Complete"
echo "=========================================="
echo ""
echo "Services running on:"
echo "  - Node API: http://localhost:9600"
echo "  - Python API: http://localhost:5600"
echo "  - MongoDB: localhost:27018"
echo "  - Redis: localhost:6379"
echo "  - PostgreSQL: localhost:5432"
echo ""
