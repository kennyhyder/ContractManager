#!/bin/bash
# scripts/deploy.sh

# Deployment configuration
ENVIRONMENTS=("staging" "production")
CURRENT_DATE=$(date +%Y%m%d-%H%M%S)

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Functions
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}→ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Check if environment is provided
if [ -z "$1" ]; then
    echo "Usage: ./deploy.sh [staging|production]"
    exit 1
fi

ENVIRONMENT=$1

# Validate environment
if [[ ! " ${ENVIRONMENTS[@]} " =~ " ${ENVIRONMENT} " ]]; then
    print_error "Invalid environment: $ENVIRONMENT"
    echo "Valid environments: ${ENVIRONMENTS[*]}"
    exit 1
fi

# Load environment-specific configuration
case $ENVIRONMENT in
    staging)
        SERVER_HOST=${STAGING_HOST}
        SERVER_USER=${STAGING_USER}
        SERVER_PATH="/var/www/contract-management-staging"
        BRANCH="develop"
        PM2_APP_NAME="contract-management-staging"
        ;;
    production)
        SERVER_HOST=${PRODUCTION_HOST}
        SERVER_USER=${PRODUCTION_USER}
        SERVER_PATH="/var/www/contract-management"
        BRANCH="main"
        PM2_APP_NAME="contract-management"
        ;;
esac

echo "🚀 Deploying to $ENVIRONMENT"
echo "=================================="

# Pre-deployment checks
print_info "Running pre-deployment checks..."

# Check git status
if [[ -n $(git status -s) ]]; then
    print_error "Working directory is not clean. Please commit or stash changes."
    exit 1
fi

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
    print_error "Must be on $BRANCH branch. Currently on $CURRENT_BRANCH"
    exit 1
fi

# Pull latest changes
print_info "Pulling latest changes..."
git pull origin $BRANCH
if [ $? -ne 0 ]; then
    print_error "Failed to pull latest changes"
    exit 1
fi

# Run tests
print_info "Running tests..."
npm test
if [ $? -ne 0 ]; then
    print_error "Tests failed. Deployment aborted."
    exit 1
fi

print_success "Pre-deployment checks passed"

# Build assets
print_info "Building assets..."

# Backend build
cd backend
npm run build:$ENVIRONMENT
if [ $? -ne 0 ]; then
    print_error "Backend build failed"
    exit 1
fi
cd ..

# Frontend build
cd frontend
npm run build
if [ $? -ne 0 ]; then
    print_error "Frontend build failed"
    exit 1
fi
cd ..

print_success "Assets built successfully"

# Create deployment package
print_info "Creating deployment package..."
DEPLOY_DIR="deploy-$CURRENT_DATE"
mkdir -p $DEPLOY_DIR

# Copy backend files
cp -r backend/{dist,package.json,package-lock.json} $DEPLOY_DIR/backend/
cp -r backend/{config,models,routes,controllers,middleware,services,utils,websocket,jobs,migrations,seeders,locales,public,templates} $DEPLOY_DIR/backend/

# Copy frontend build
cp -r frontend/build $DEPLOY_DIR/frontend/

# Copy configuration files
cp -r {.env.$ENVIRONMENT,ecosystem.config.js,nginx.conf} $DEPLOY_DIR/ 2>/dev/null || true

# Create deployment archive
tar -czf $DEPLOY_DIR.tar.gz $DEPLOY_DIR
rm -rf $DEPLOY_DIR

print_success "Deployment package created"

# Deploy to server
print_info "Deploying to server..."

# Upload package
scp $DEPLOY_DIR.tar.gz $SERVER_USER@$SERVER_HOST:/tmp/
if [ $? -ne 0 ]; then
    print_error "Failed to upload deployment package"
    exit 1
fi

# Execute deployment on server
ssh $SERVER_USER@$SERVER_HOST << EOF
    set -e
    
    echo "Extracting deployment package..."
    cd /tmp
    tar -xzf $DEPLOY_DIR.tar.gz
    
    echo "Backing up current deployment..."
    if [ -d "$SERVER_PATH/current" ]; then
        cp -r $SERVER_PATH/current $SERVER_PATH/backup-$CURRENT_DATE
    fi
    
    echo "Creating new release..."
    RELEASE_PATH="$SERVER_PATH/releases/$CURRENT_DATE"
    mkdir -p \$RELEASE_PATH
    mv $DEPLOY_DIR/* \$RELEASE_PATH/
    
    echo "Installing dependencies..."
    cd \$RELEASE_PATH/backend
    npm ci --production
    
    echo "Running migrations..."
    NODE_ENV=$ENVIRONMENT npm run migrate
    
    echo "Updating symlink..."
    ln -sfn \$RELEASE_PATH $SERVER_PATH/current
    
    echo "Restarting application..."
    pm2 restart $PM2_APP_NAME
    
    echo "Cleaning up..."
    rm -rf /tmp/$DEPLOY_DIR*
    
    # Keep only last 5 releases
    cd $SERVER_PATH/releases
    ls -t | tail -n +6 | xargs rm -rf
    
    echo "Deployment completed!"
EOF

if [ $? -ne 0 ]; then
    print_error "Deployment failed"
    exit 1
fi

# Clean up local files
rm -f $DEPLOY_DIR.tar.gz

# Post-deployment checks
print_info "Running post-deployment checks..."

# Health check
sleep 10
HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" https://$SERVER_HOST/api/health)
if [ "$HEALTH_CHECK" = "200" ]; then
    print_success "Health check passed"
else
    print_error "Health check failed (HTTP $HEALTH_CHECK)"
    print_warning "You may need to rollback the deployment"
fi

# Send deployment notification
if [ "$ENVIRONMENT" = "production" ]; then
    # Send notification (implement your notification logic here)
    print_info "Sending deployment notification..."
fi

echo ""
echo "=================================="
print_success "Deployment to $ENVIRONMENT completed successfully!"
echo ""
echo "Deployment details:"
echo "- Environment: $ENVIRONMENT"
echo "- Branch: $BRANCH"
echo "- Timestamp: $CURRENT_DATE"
echo "- Server: $SERVER_HOST"
echo ""

# Show rollback command
echo "To rollback this deployment, run:"
echo "./deploy.sh rollback $ENVIRONMENT $CURRENT_DATE"