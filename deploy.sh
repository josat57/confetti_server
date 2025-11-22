#!/bin/bash

###############################################################################
# Deployment Script for Event Planner Platform
# This script handles deployment to production environment
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
BRANCH=${2:-main}

echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Event Planner Platform - Deployment Script              ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Environment: ${ENVIRONMENT}${NC}"
echo -e "${YELLOW}Branch: ${BRANCH}${NC}"
echo ""

# Function to print step
print_step() {
    echo -e "${GREEN}▶ $1${NC}"
}

# Function to print error
print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Function to print success
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Check if required commands exist
print_step "Checking prerequisites..."
command -v node >/dev/null 2>&1 || { print_error "Node.js is required but not installed."; exit 1; }
command -v npm >/dev/null 2>&1 || { print_error "npm is required but not installed."; exit 1; }
command -v git >/dev/null 2>&1 || { print_error "git is required but not installed."; exit 1; }
print_success "All prerequisites met"

# Pull latest code
print_step "Pulling latest code from ${BRANCH}..."
git fetch origin
git checkout ${BRANCH}
git pull origin ${BRANCH}
print_success "Code updated"

# Install dependencies
print_step "Installing dependencies..."
npm ci --production
print_success "Dependencies installed"

# Run database migrations (if any)
print_step "Running database migrations..."
# Add migration commands here if needed
print_success "Migrations completed"

# Build application (if needed)
print_step "Building application..."
# Add build commands here if needed
print_success "Build completed"

# Run tests
print_step "Running tests..."
npm run test:ci || { print_error "Tests failed"; exit 1; }
print_success "Tests passed"

# Create backup before deployment
print_step "Creating database backup..."
node src/node/scripts/backup-database.js create || { print_error "Backup failed"; exit 1; }
print_success "Backup created"

# Stop application
print_step "Stopping application..."
pm2 stop confetti-api || true
print_success "Application stopped"

# Start application
print_step "Starting application..."
pm2 start ecosystem.config.js --env ${ENVIRONMENT}
print_success "Application started"

# Wait for application to be ready
print_step "Waiting for application to be ready..."
sleep 5

# Health check
print_step "Running health check..."
HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/v1/health)
if [ "$HEALTH_CHECK" = "200" ]; then
    print_success "Health check passed"
else
    print_error "Health check failed (HTTP ${HEALTH_CHECK})"
    pm2 logs confetti-api --lines 50
    exit 1
fi

# Save PM2 configuration
print_step "Saving PM2 configuration..."
pm2 save
print_success "PM2 configuration saved"

# Display status
print_step "Deployment status:"
pm2 status

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Deployment Completed Successfully! 🎉                   ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Monitor logs: pm2 logs confetti-api"
echo "  2. Check metrics: pm2 monit"
echo "  3. View status: pm2 status"
echo ""
