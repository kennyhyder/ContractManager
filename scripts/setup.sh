#!/bin/bash
# scripts/setup.sh

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🚀 Contract Management System - Initial Setup"
echo "=========================================="

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Check Node.js version
echo ""
echo "Checking prerequisites..."
NODE_VERSION=$(node -v)
REQUIRED_NODE="18.0.0"

if [ "$(printf '%s\n' "$REQUIRED_NODE" "$NODE_VERSION" | sort -V | head -n1)" = "$REQUIRED_NODE" ]; then 
    print_success "Node.js version $NODE_VERSION meets requirements"
else
    print_error "Node.js version $NODE_VERSION is below required version $REQUIRED_NODE"
    exit 1
fi

# Check npm version
NPM_VERSION=$(npm -v)
print_success "npm version: $NPM_VERSION"

# Check for required tools
echo ""
echo "Checking required tools..."

# Check MongoDB
if command -v mongod &> /dev/null; then
    print_success "MongoDB is installed"
else
    print_error "MongoDB is not installed. Please install MongoDB first."
    exit 1
fi

# Check Redis
if command -v redis-server &> /dev/null; then
    print_success "Redis is installed"
else
    print_warning "Redis is not installed. Some features may not work."
fi

# Create environment files
echo ""
echo "Setting up environment files..."

# Backend .env
if [ ! -f backend/.env ]; then
    cp backend/.env.example backend/.env
    print_success "Created backend/.env file"
    print_warning "Please update backend/.env with your configuration"
else
    print_warning "backend/.env already exists"
fi

# Frontend .env
if [ ! -f frontend/.env ]; then
    cp frontend/.env.example frontend/.env
    print_success "Created frontend/.env file"
    print_warning "Please update frontend/.env with your configuration"
else
    print_warning "frontend/.env already exists"
fi

# Install dependencies
echo ""
echo "Installing dependencies..."

# Backend dependencies
echo "Installing backend dependencies..."
cd backend
npm install
if [ $? -eq 0 ]; then
    print_success "Backend dependencies installed"
else
    print_error "Failed to install backend dependencies"
    exit 1
fi
cd ..

# Frontend dependencies
echo "Installing frontend dependencies..."
cd frontend
npm install
if [ $? -eq 0 ]; then
    print_success "Frontend dependencies installed"
else
    print_error "Failed to install frontend dependencies"
    exit 1
fi
cd ..

# Create necessary directories
echo ""
echo "Creating necessary directories..."

# Backend directories
mkdir -p backend/uploads
mkdir -p backend/logs
mkdir -p backend/backups
mkdir -p backend/public/uploads

# Frontend directories
mkdir -p frontend/public/assets

print_success "Directories created"

# Database setup
echo ""
echo "Setting up database..."

cd backend

# Check if MongoDB is running
if pgrep -x "mongod" > /dev/null; then
    print_success "MongoDB is running"
else
    print_warning "MongoDB is not running. Please start MongoDB."
fi

# Run migrations
echo "Running database migrations..."
npm run migrate
if [ $? -eq 0 ]; then
    print_success "Database migrations completed"
else
    print_error "Database migrations failed"
fi

# Optional: Seed database
read -p "Do you want to seed the database with sample data? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npm run seed
    if [ $? -eq 0 ]; then
        print_success "Database seeded with sample data"
    else
        print_error "Database seeding failed"
    fi
fi

cd ..

# Generate API documentation
echo ""
echo "Generating API documentation..."
cd backend
npm run generate:api-docs
if [ $? -eq 0 ]; then
    print_success "API documentation generated"
else
    print_warning "API documentation generation failed"
fi
cd ..

# SSL certificates for development
echo ""
echo "Setting up SSL certificates for development..."
mkdir -p ssl
if [ ! -f ssl/localhost.key ]; then
    openssl req -x509 -newkey rsa:4096 -keyout ssl/localhost.key -out ssl/localhost.crt -days 365 -nodes -subj "/CN=localhost"
    print_success "SSL certificates generated"
else
    print_warning "SSL certificates already exist"
fi

# Git hooks
echo ""
echo "Setting up Git hooks..."
npx husky install
print_success "Git hooks installed"

# Summary
echo ""
echo "=========================================="
echo "✨ Setup completed!"
echo ""
echo "Next steps:"
echo "1. Update environment variables in backend/.env and frontend/.env"
echo "2. Start MongoDB: mongod"
echo "3. Start Redis: redis-server (optional)"
echo "4. Start backend: cd backend && npm run dev"
echo "5. Start frontend: cd frontend && npm start"
echo ""
echo "Default credentials (if seeded):"
echo "Admin: admin@example.com / Password123!"
echo "User: john.doe@example.com / Password123!"
echo ""
echo "Happy coding! 🎉"