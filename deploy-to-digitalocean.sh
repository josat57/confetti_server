#!/bin/bash

###############################################################################
# DigitalOcean Deployment Script for Confetti Event Planning Platform
# This script automates the deployment process to DigitalOcean
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEPLOYMENT_TYPE=${1:-app-platform}  # app-platform, kubernetes, or droplet
REGISTRY_NAME="confetti-registry"
PROJECT_NAME="confetti-event-planner"

echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Confetti Platform - DigitalOcean Deployment             ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Deployment Type: ${DEPLOYMENT_TYPE}${NC}"
echo ""

# Function to print step
print_step() {
    echo -e "${BLUE}▶ $1${NC}"
}

# Function to print error
print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Function to print success
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Check prerequisites
print_step "Checking prerequisites..."

# Check if doctl is installed
if ! command -v doctl &> /dev/null; then
    print_error "DigitalOcean CLI (doctl) is not installed"
    echo "Install it from: https://docs.digitalocean.com/reference/doctl/how-to/install/"
    exit 1
fi

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed"
    echo "Install it from: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if authenticated with doctl
if ! doctl account get &> /dev/null; then
    print_error "Not authenticated with DigitalOcean CLI"
    echo "Run: doctl auth init"
    exit 1
fi

print_success "All prerequisites met"

# Security warning
print_warning "SECURITY WARNING: Before deploying to production:"
echo "  1. Review and address all issues in SECURITY_ANALYSIS_REPORT.md"
echo "  2. Generate new secrets for JWT, session, and API keys"
echo "  3. Update all environment variables with production values"
echo "  4. Configure SSL certificates"
echo ""
read -p "Have you addressed the security issues? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_error "Please address security issues before deploying to production"
    exit 1
fi

# Create or verify container registry
print_step "Setting up container registry..."
if ! doctl registry get $REGISTRY_NAME &> /dev/null; then
    print_step "Creating container registry: $REGISTRY_NAME"
    doctl registry create $REGISTRY_NAME
    print_success "Container registry created"
else
    print_success "Container registry already exists"
fi

# Login to registry
print_step "Logging into container registry..."
doctl registry login
print_success "Logged into container registry"

# Build and push images
print_step "Building and pushing container images..."

# Build Node.js API image
print_step "Building Node.js API image..."
docker build -t registry.digitalocean.com/$REGISTRY_NAME/confetti-node-api:latest .
print_success "Node.js API image built"

# Build Python API image
print_step "Building Python API image..."
docker build -t registry.digitalocean.com/$REGISTRY_NAME/confetti-python-api:latest -f src/python/Dockerfile src/python/
print_success "Python API image built"

# Push images
print_step "Pushing images to registry..."
docker push registry.digitalocean.com/$REGISTRY_NAME/confetti-node-api:latest
docker push registry.digitalocean.com/$REGISTRY_NAME/confetti-python-api:latest
print_success "Images pushed to registry"

# Deploy based on selected method
case $DEPLOYMENT_TYPE in
    "app-platform")
        print_step "Deploying to DigitalOcean App Platform..."
        
        # Check if app spec file exists and update it
        if [ ! -f "digitalocean-app.yaml" ]; then
            print_error "digitalocean-app.yaml not found"
            exit 1
        fi
        
        # Update the app spec with registry name
        sed -i.bak "s/confetti-registry/$REGISTRY_NAME/g" digitalocean-app.yaml
        
        print_warning "Please update the following in digitalocean-app.yaml before proceeding:"
        echo "  1. Replace 'your-username/confetti-server' with your actual GitHub repo"
        echo "  2. Replace 'your-domain.com' with your actual domain"
        echo "  3. Update all secret values with production keys"
        echo ""
        read -p "Have you updated digitalocean-app.yaml? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_error "Please update digitalocean-app.yaml first"
            exit 1
        fi
        
        # Create or update app
        if doctl apps list | grep -q "$PROJECT_NAME"; then
            print_step "Updating existing app..."
            APP_ID=$(doctl apps list --format ID,Spec.Name --no-header | grep "$PROJECT_NAME" | awk '{print $1}')
            doctl apps update $APP_ID --spec digitalocean-app.yaml
        else
            print_step "Creating new app..."
            doctl apps create --spec digitalocean-app.yaml
        fi
        
        print_success "App Platform deployment initiated"
        print_step "Monitor deployment with: doctl apps list"
        ;;
        
    "kubernetes")
        print_step "Deploying to DigitalOcean Kubernetes..."
        
        # Check if kubectl is installed
        if ! command -v kubectl &> /dev/null; then
            print_error "kubectl is not installed"
            echo "Install it from: https://kubernetes.io/docs/tasks/tools/"
            exit 1
        fi
        
        print_warning "Please ensure you have:"
        echo "  1. Created a DOKS cluster"
        echo "  2. Updated kubeconfig: doctl kubernetes cluster kubeconfig save <cluster-name>"
        echo "  3. Updated k8s/secrets.yaml with production values"
        echo "  4. Updated k8s/ingress.yaml with your domain"
        echo ""
        read -p "Ready to deploy to Kubernetes? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_error "Please complete Kubernetes setup first"
            exit 1
        fi
        
        # Apply Kubernetes manifests
        print_step "Applying Kubernetes manifests..."
        kubectl apply -f k8s/namespace.yaml
        kubectl apply -f k8s/configmap.yaml
        kubectl apply -f k8s/secrets.yaml
        kubectl apply -f k8s/node-api-deployment.yaml
        kubectl apply -f k8s/python-api-deployment.yaml
        kubectl apply -f k8s/ingress.yaml
        
        print_success "Kubernetes deployment completed"
        print_step "Check status with: kubectl get pods -n confetti"
        ;;
        
    "droplet")
        print_step "Deploying to DigitalOcean Droplet..."
        
        print_warning "Please ensure you have:"
        echo "  1. Created a droplet with Docker pre-installed"
        echo "  2. Updated .env.production with production values"
        echo "  3. Configured your domain to point to the droplet IP"
        echo ""
        read -p "Ready to deploy to droplet? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_error "Please complete droplet setup first"
            exit 1
        fi
        
        print_step "Droplet deployment requires manual steps:"
        echo "  1. SSH to your droplet"
        echo "  2. Clone this repository"
        echo "  3. Copy .env.production to .env"
        echo "  4. Run: docker-compose -f docker-compose.prod.yml up -d"
        ;;
        
    *)
        print_error "Invalid deployment type: $DEPLOYMENT_TYPE"
        echo "Valid options: app-platform, kubernetes, droplet"
        exit 1
        ;;
esac

# Create managed databases (if not using App Platform)
if [ "$DEPLOYMENT_TYPE" != "app-platform" ]; then
    print_step "Setting up managed databases..."
    
    read -p "Create managed databases? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_step "Creating MongoDB cluster..."
        doctl databases create confetti-mongodb --engine mongodb --region nyc3 --size db-s-1vcpu-1gb --num-nodes 1 || true
        
        print_step "Creating PostgreSQL database..."
        doctl databases create confetti-postgres --engine pg --region nyc3 --size db-s-1vcpu-1gb --num-nodes 1 || true
        
        print_step "Creating Redis cache..."
        doctl databases create confetti-redis --engine redis --region nyc3 --size db-s-1vcpu-1gb --num-nodes 1 || true
        
        print_success "Database creation initiated"
        print_step "Get connection strings with: doctl databases connection <database-id>"
    fi
fi

# Final instructions
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Deployment Process Initiated! 🚀                       ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
case $DEPLOYMENT_TYPE in
    "app-platform")
        echo "  1. Monitor deployment: doctl apps list"
        echo "  2. Check logs: doctl apps logs <app-id>"
        echo "  3. Configure custom domain in DigitalOcean dashboard"
        echo "  4. Set up SSL certificate"
        ;;
    "kubernetes")
        echo "  1. Check pod status: kubectl get pods -n confetti"
        echo "  2. Check services: kubectl get svc -n confetti"
        echo "  3. Configure DNS for your domain"
        echo "  4. Install cert-manager for SSL"
        ;;
    "droplet")
        echo "  1. SSH to your droplet and complete manual deployment"
        echo "  2. Configure Nginx with SSL"
        echo "  3. Set up monitoring and backups"
        ;;
esac
echo ""
echo -e "${YELLOW}Important:${NC}"
echo "  • Monitor application logs for any issues"
echo "  • Set up monitoring and alerting"
echo "  • Configure backups for databases"
echo "  • Test all functionality after deployment"
echo ""
echo -e "${GREEN}Deployment script completed successfully!${NC}"