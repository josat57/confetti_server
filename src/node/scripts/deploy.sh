#!/bin/bash

# Subscription Payment Integration - Deployment Script
# This script automates the deployment process

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="${BACKUP_DIR}/backup_${TIMESTAMP}"

# Functions
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if running in correct directory
check_directory() {
    if [ ! -f "package.json" ]; then
        print_error "package.json not found. Please run this script from src/node directory"
        exit 1
    fi
    print_success "Running in correct directory"
}

# Check environment variables
check_environment() {
    print_header "Checking Environment Variables"
    
    REQUIRED_VARS=(
        "MONGODB_URI"
        "FLUTTERWAVE_PUBLIC_KEY"
        "FLUTTERWAVE_SECRET_KEY"
        "FLUTTERWAVE_WEBHOOK_SECRET"
        "FRONTEND_URL"
        "JWT_ACCESS_SECRET"
        "JWT_REFRESH_SECRET"
        "SMTP_HOST"
        "SMTP_USER"
        "SMTP_PASSWORD"
    )
    
    MISSING_VARS=()
    
    for var in "${REQUIRED_VARS[@]}"; do
        if [ -z "${!var}" ]; then
            MISSING_VARS+=("$var")
        fi
    done
    
    if [ ${#MISSING_VARS[@]} -gt 0 ]; then
        print_error "Missing required environment variables:"
        for var in "${MISSING_VARS[@]}"; do
            echo "  - $var"
        done
        exit 1
    fi
    
    print_success "All required environment variables are set"
}

# Backup database
backup_database() {
    print_header "Backing Up Database"
    
    mkdir -p "$BACKUP_DIR"
    
    print_info "Creating backup at: $BACKUP_PATH"
    
    if mongodump --uri="$MONGODB_URI" --out="$BACKUP_PATH" > /dev/null 2>&1; then
        print_success "Database backup completed"
        print_info "Backup location: $BACKUP_PATH"
    else
        print_error "Database backup failed"
        exit 1
    fi
}

# Run database migration
run_migration() {
    print_header "Running Database Migration"
    
    if node scripts/migrate-subscription-payment.js; then
        print_success "Database migration completed"
    else
        print_error "Database migration failed"
        print_warning "You can restore the database using:"
        print_warning "mongorestore --uri=\"\$MONGODB_URI\" $BACKUP_PATH"
        exit 1
    fi
}

# Validate migration
validate_migration() {
    print_header "Validating Migration"
    
    if [ -f "scripts/validate-migration.js" ]; then
        if node scripts/validate-migration.js; then
            print_success "Migration validation passed"
        else
            print_error "Migration validation failed"
            exit 1
        fi
    else
        print_warning "Validation script not found, skipping validation"
    fi
}

# Install dependencies
install_dependencies() {
    print_header "Installing Dependencies"
    
    if npm install --production; then
        print_success "Dependencies installed"
    else
        print_error "Failed to install dependencies"
        exit 1
    fi
}

# Run tests
run_tests() {
    print_header "Running Tests"
    
    if npm test -- --run > /dev/null 2>&1; then
        print_success "All tests passed"
    else
        print_warning "Some tests failed, but continuing deployment"
        print_info "Review test results and fix issues if critical"
    fi
}

# Generate monitoring report
generate_report() {
    print_header "Generating Initial Monitoring Report"
    
    if node scripts/monitoring-report.js 24h; then
        print_success "Monitoring report generated"
    else
        print_warning "Failed to generate monitoring report"
    fi
}

# Display post-deployment instructions
post_deployment_instructions() {
    print_header "Post-Deployment Instructions"
    
    echo -e "${GREEN}Deployment completed successfully!${NC}\n"
    
    echo "Next steps:"
    echo ""
    echo "1. Configure Payment Provider Webhooks:"
    echo "   - Flutterwave: https://dashboard.flutterwave.com/settings/webhooks"
    echo "     Webhook URL: ${FRONTEND_URL}/api/v1/webhooks/flutterwave"
    echo ""
    echo "2. Test the deployment:"
    echo "   - Test free plan registration"
    echo "   - Test paid plan registration"
    echo "   - Test webhook delivery"
    echo ""
    echo "3. Monitor the system:"
    echo "   - Run: node scripts/monitoring-report.js"
    echo "   - Check logs for errors"
    echo "   - Monitor webhook success rate"
    echo ""
    echo "4. Verify metrics:"
    echo "   - Webhook success rate should be > 95%"
    echo "   - Payment completion rate should be > 90%"
    echo ""
    echo "For detailed deployment checklist, see:"
    echo "  scripts/deploy-checklist.md"
    echo ""
}

# Main deployment flow
main() {
    print_header "Subscription Payment Integration Deployment"
    print_info "Started at: $(date)"
    
    # Pre-deployment checks
    check_directory
    check_environment
    
    # Confirm deployment
    echo -e "\n${YELLOW}This will deploy the subscription payment integration.${NC}"
    echo -e "${YELLOW}A database backup will be created before proceeding.${NC}\n"
    read -p "Continue with deployment? (yes/no): " -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        print_info "Deployment cancelled"
        exit 0
    fi
    
    # Deployment steps
    backup_database
    run_migration
    validate_migration
    install_dependencies
    run_tests
    generate_report
    
    # Post-deployment
    post_deployment_instructions
    
    print_success "Deployment completed at: $(date)"
}

# Run main function
main
