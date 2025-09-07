#!/bin/bash
# scripts/generate-docs.sh

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "📚 Generating Documentation"
echo "=========================="

# Function to print colored output
print_info() {
    echo -e "${BLUE}→ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Create documentation directories
print_info "Creating documentation directories..."
mkdir -p docs/api
mkdir -p docs/guides
mkdir -p docs/architecture
mkdir -p docs/sdk/typescript
mkdir -p docs/sdk/python

# Generate API documentation
print_info "Generating API documentation..."

# Generate OpenAPI spec
if command -v swagger-jsdoc &> /dev/null; then
    cd backend
    npx swagger-jsdoc -d ../docs/api/swagger-config.js -o ../docs/api/openapi.json
    cd ..
    print_success "OpenAPI specification generated"
else
    print_warning "swagger-jsdoc not found. Installing..."
    npm install -g swagger-jsdoc
fi

# Convert OpenAPI to HTML
if [ -f "docs/api/openapi.json" ]; then
    npx @redocly/openapi-cli build-docs docs/api/openapi.json -o docs/api/index.html
    print_success "API HTML documentation generated"
fi

# Generate JSDoc documentation
print_info "Generating JSDoc documentation..."
cd backend
npx jsdoc -c jsdoc.json -d ../docs/api/jsdoc
cd ..

# Generate TypeScript documentation
print_info "Generating TypeScript documentation..."
cd frontend
npx typedoc --out ../docs/frontend src
cd ..

# Generate database schema documentation
print_info "Generating database schema documentation..."
cat > docs/architecture/database-schema.md << EOF
# Database Schema

Generated on: $(date)

## Collections

### Users
\`\`\`javascript
{
  _id: ObjectId,
  email: String (unique),
  password: String (hashed),
  name: String,
  role: String (enum: ['user', 'manager', 'admin']),
  department: String,
  jobTitle: String,
  profilePicture: String,
  emailVerified: Boolean,
  twoFactorEnabled: Boolean,
  isActive: Boolean,
  lastLogin: Date,
  createdAt: Date,
  updatedAt: Date
}
\`\`\`

### Contracts
\`\`\`javascript
{
  _id: ObjectId,
  title: String,
  description: String,
  content: String,
  type: String,
  status: String,
  parties: Array,
  value: Number,
  currency: String,
  startDate: Date,
  endDate: Date,
  createdBy: ObjectId (ref: User),
  assignedTo: ObjectId (ref: User),
  template: ObjectId (ref: Template),
  versions: Array,
  attachments: Array,
  tags: Array,
  metadata: Object,
  createdAt: Date,
  updatedAt: Date
}
\`\`\`

### Templates
\`\`\`javascript
{
  _id: ObjectId,
  name: String,
  category: String,
  description: String,
  content: String,
  variables: Array,
  tags: Array,
  createdBy: ObjectId (ref: User),
  isPublic: Boolean,
  usageCount: Number,
  rating: Number,
  status: String,
  createdAt: Date,
  updatedAt: Date
}
\`\`\`
EOF

print_success "Database schema documentation generated"

# Generate SDK documentation
print_info "Generating SDK documentation..."

# TypeScript SDK README
cat > docs/sdk/typescript/README.md << EOF
# Contract Management TypeScript SDK

## Installation

\`\`\`bash
npm install @contract-management/sdk
\`\`\`

## Usage

\`\`\`typescript
import { ContractClient } from '@contract-management/sdk';

const client = new ContractClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.contract-management.com'
});

// List contracts
const contracts = await client.contracts.list();

// Create contract
const contract = await client.contracts.create({
  title: 'New Contract',
  content: 'Contract content...'
});
\`\`\`
EOF

# Python SDK README
cat > docs/sdk/python/README.md << EOF
# Contract Management Python SDK

## Installation

\`\`\`bash
pip install contract-management-sdk
\`\`\`

## Usage

\`\`\`python
from contract_management import ContractClient

client = ContractClient(
    api_key='your-api-key',
    base_url='https://api.contract-management.com'
)

# List contracts
contracts = client.contracts.list()

# Create contract
contract = client.contracts.create({
    'title': 'New Contract',
    'content': 'Contract content...'
})
\`\`\`
EOF

print_success "SDK documentation generated"

# Generate deployment guide
print_info "Generating deployment guide..."
cat > docs/guides/deployment.md << EOF
# Deployment Guide

## Prerequisites

- Node.js >= 18.0.0
- MongoDB >= 6.0
- Redis >= 7.0
- Nginx
- SSL Certificate

## Environment Setup

1. Clone the repository
2. Install dependencies
3. Configure environment variables
4. Run database migrations
5. Build frontend assets
6. Configure Nginx
7. Setup PM2 for process management
8. Configure monitoring

## Production Checklist

- [ ] Environment variables configured
- [ ] Database backups scheduled
- [ ] SSL certificates installed
- [ ] Monitoring setup
- [ ] Error tracking configured
- [ ] Rate limiting enabled
- [ ] Security headers configured
- [ ] CDN configured for static assets
EOF

print_success "Deployment guide generated"

# Generate README index
print_info "Generating documentation index..."
cat > docs/README.md << EOF
# Contract Management System Documentation

Welcome to the Contract Management System documentation!

## 📚 Documentation

- [API Documentation](./api/index.html)
- [Architecture Overview](./architecture/overview.md)
- [Database Schema](./architecture/database-schema.md)
- [Setup Guide](./guides/setup.md)
- [Deployment Guide](./guides/deployment.md)

## 🚀 Quick Links

- [TypeScript SDK](./sdk/typescript/README.md)
- [Python SDK](./sdk/python/README.md)
- [Postman Collection](./api/postman_collection.json)

## 📖 Guides

- [Getting Started](./guides/getting-started.md)
- [Development Guide](./guides/development.md)
- [Testing Guide](./guides/testing.md)
- [Troubleshooting](./guides/troubleshooting.md)

Generated on: $(date)
EOF

print_success "Documentation index generated"

# Generate a simple HTTP server script to view docs
cat > docs/serve.js << EOF
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'README.md'));
});

app.listen(PORT, () => {
  console.log(\`Documentation server running at http://localhost:\${PORT}\`);
});
EOF

# Summary
echo ""
echo "=========================="
print_success "Documentation generation completed!"
echo ""
echo "📁 Generated files:"
echo "  - API Documentation: docs/api/"
echo "  - Architecture Docs: docs/architecture/"
echo "  - SDK Documentation: docs/sdk/"
echo "  - Guides: docs/guides/"
echo ""
echo "To view the documentation locally:"
echo "  cd docs && node serve.js"
echo ""