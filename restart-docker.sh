#!/bin/bash

echo "=========================================="
echo "Restarting Docker Containers"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Step 1: Stop containers
echo -e "${YELLOW}Step 1: Stopping containers...${NC}"
docker-compose down
echo -e "${GREEN}✓ Containers stopped${NC}"
echo ""

# Step 2: Remove old images (optional)
echo -e "${YELLOW}Step 2: Cleaning up...${NC}"
docker system prune -f
echo -e "${GREEN}✓ Cleanup complete${NC}"
echo ""

# Step 3: Rebuild and start containers
echo -e "${YELLOW}Step 3: Building and starting containers...${NC}"
docker-compose up --build -d
echo -e "${GREEN}✓ Containers started${NC}"
echo ""

# Step 4: Wait for services to be ready
echo -e "${YELLOW}Step 4: Waiting for services to be ready...${NC}"
sleep 10
echo -e "${GREEN}✓ Services should be ready${NC}"
echo ""

# Step 5: Show container status
echo -e "${YELLOW}Step 5: Container status:${NC}"
docker-compose ps
echo ""

# Step 6: Show logs
echo -e "${YELLOW}Step 6: Showing recent logs...${NC}"
echo ""
docker-compose logs --tail=50 node-api
echo ""

echo "=========================================="
echo -e "${GREEN}Docker restart complete!${NC}"
echo "=========================================="
echo ""
echo "To view live logs, run:"
echo "  docker-compose logs -f node-api"
echo ""
echo "To test super admin login:"
echo "  curl -X POST http://localhost:9600/api/v1/auth/signin \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"email\": \"power.admin@confetti.com\", \"password\": \"Ginger@123A\"}'"
echo ""
