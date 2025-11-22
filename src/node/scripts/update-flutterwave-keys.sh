#!/bin/bash

# Flutterwave Keys Update Script
# This script helps you update Flutterwave API keys in both .env and docker-compose.yml

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}Flutterwave API Keys Update${NC}"
echo -e "${BLUE}========================================${NC}\n"

echo -e "${YELLOW}⚠️  You need to get your API keys from Flutterwave Dashboard${NC}"
echo -e "${YELLOW}   https://dashboard.flutterwave.com → Settings → API Keys${NC}\n"

# Prompt for keys
echo -e "${GREEN}Enter your Flutterwave keys:${NC}\n"

read -p "Public Key (starts with FLWPUBK_TEST-): " PUBLIC_KEY
read -p "Secret Key (starts with FLWSECK_TEST-): " SECRET_KEY
read -p "Encryption Key (starts with FLWSECK_TEST): " ENCRYPTION_KEY

# Validate keys
if [[ ! $PUBLIC_KEY =~ ^FLWPUBK ]]; then
    echo -e "\n${RED}❌ Invalid Public Key format${NC}"
    echo -e "${YELLOW}Public Key should start with FLWPUBK_TEST- or FLWPUBK-${NC}"
    exit 1
fi

if [[ ! $SECRET_KEY =~ ^FLWSECK ]]; then
    echo -e "\n${RED}❌ Invalid Secret Key format${NC}"
    echo -e "${YELLOW}Secret Key should start with FLWSECK_TEST- or FLWSECK-${NC}"
    exit 1
fi

if [[ ! $ENCRYPTION_KEY =~ ^FLWSECK ]]; then
    echo -e "\n${RED}❌ Invalid Encryption Key format${NC}"
    echo -e "${YELLOW}Encryption Key should start with FLWSECK_TEST or FLWSECK${NC}"
    exit 1
fi

echo -e "\n${BLUE}Updating configuration files...${NC}\n"

# Update .env file
if [ -f ".env" ]; then
    echo -e "${GREEN}✓${NC} Updating .env file..."
    
    # Backup .env
    cp .env .env.backup
    
    # Update keys in .env
    sed -i.tmp "s|FLUTTERWAVE_PUBLIC_KEY=.*|FLUTTERWAVE_PUBLIC_KEY=$PUBLIC_KEY|g" .env
    sed -i.tmp "s|FLUTTERWAVE_SECRET_KEY=.*|FLUTTERWAVE_SECRET_KEY=$SECRET_KEY|g" .env
    sed -i.tmp "s|FLUTTERWAVE_ENCRYPTION_KEY=.*|FLUTTERWAVE_ENCRYPTION_KEY=$ENCRYPTION_KEY|g" .env
    rm .env.tmp
    
    echo -e "${GREEN}✓${NC} .env file updated"
else
    echo -e "${RED}❌ .env file not found${NC}"
fi

# Update docker-compose.yml
if [ -f "docker-compose.yml" ]; then
    echo -e "${GREEN}✓${NC} Updating docker-compose.yml..."
    
    # Backup docker-compose.yml
    cp docker-compose.yml docker-compose.yml.backup
    
    # Update keys in docker-compose.yml
    sed -i.tmp "s|FLUTTERWAVE_PUBLIC_KEY=.*|FLUTTERWAVE_PUBLIC_KEY=$PUBLIC_KEY|g" docker-compose.yml
    sed -i.tmp "s|FLUTTERWAVE_SECRET_KEY=.*|FLUTTERWAVE_SECRET_KEY=$SECRET_KEY|g" docker-compose.yml
    sed -i.tmp "s|FLUTTERWAVE_ENCRYPTION_KEY=.*|FLUTTERWAVE_ENCRYPTION_KEY=$ENCRYPTION_KEY|g" docker-compose.yml
    rm docker-compose.yml.tmp
    
    echo -e "${GREEN}✓${NC} docker-compose.yml updated"
else
    echo -e "${RED}❌ docker-compose.yml file not found${NC}"
fi

echo -e "\n${GREEN}✅ Configuration files updated successfully!${NC}\n"

echo -e "${BLUE}Next steps:${NC}"
echo -e "1. Restart Docker containers: ${YELLOW}docker-compose restart${NC}"
echo -e "2. Test your keys: ${YELLOW}node src/node/scripts/test-flutterwave-keys.js${NC}\n"

read -p "Do you want to restart Docker containers now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "\n${BLUE}Restarting Docker containers...${NC}\n"
    docker-compose restart
    echo -e "\n${GREEN}✅ Containers restarted!${NC}\n"
    
    echo -e "${BLUE}Testing your keys...${NC}\n"
    node src/node/scripts/test-flutterwave-keys.js
fi

echo -e "\n${GREEN}Done!${NC}\n"
