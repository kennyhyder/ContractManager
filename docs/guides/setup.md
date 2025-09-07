# Setup Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [Docker Setup](#docker-setup)
4. [Database Setup](#database-setup)
5. [Environment Configuration](#environment-configuration)
6. [Running the Application](#running-the-application)
7. [Common Issues](#common-issues)
8. [Next Steps](#next-steps)

## Prerequisites

### Required Software

- **Node.js** (v18.0.0 or higher)
  ```bash
  # Check version
  node --version
  
  # Install via nvm (recommended)
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
  nvm install 18
  nvm use 18

PostgreSQL (v15.0 or higher)
bash# macOS
brew install postgresql@15
brew services start postgresql@15

# Ubuntu/Debian
sudo apt update
sudo apt install postgresql-15 postgresql-contrib

# Windows
# Download installer from https://www.postgresql.org/download/windows/

Redis (v7.0 or higher)
bash# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt update
sudo apt install redis-server

# Windows
# Use WSL or Docker

Git
bash# Check version
git --version


Optional Software

Docker & Docker Compose (for containerized setup)
VS Code or your preferred IDE
Postman or similar API testing tool
pgAdmin or similar PostgreSQL GUI

Local Development Setup
1. Clone the Repository
bash# Clone the repository
git clone https://github.com/your-org/contract-management-system.git
cd contract-management-system

# Create your feature branch
git checkout -b feature/your-name

2. Install Dependencies
bash# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Return to root
cd ..
3. Setup Pre-commit Hooks
bash# Install husky
npm install -D husky
npx husky install

# Add pre-commit hook
npx husky add .husky/pre-commit "npm run lint && npm run test"
Docker Setup
Quick Start with Docker Compose
bash# Copy environment file
cp .env.example .env

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
Docker Compose Configuration
yaml# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: contract_management
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    build: ./backend
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/contract_management
      REDIS_URL: redis://redis:6379
    volumes:
      - ./backend:/app
      - /app/node_modules
    ports:
      - "8000:8000"
    depends_on:
      - postgres
      - redis

  frontend:
    build: ./frontend
    environment:
      VITE_API_URL: http://localhost:8000
    volumes:
      - ./frontend:/app
      - /app/node_modules
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  postgres_data:
Database Setup
1. Create Database
bash# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE contract_management;
CREATE DATABASE contract_management_test;

# Create user (optional)
CREATE USER app_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE contract_management TO app_user;

# Exit
\q
2. Run Migrations
bashcd backend

# Run migrations
npm run migrate

# Run seeders (development only)
npm run seed
3. Database Schema
sql-- Example migration file
-- migrations/001_initial_setup.sql

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create contracts table
CREATE TABLE contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_contracts_created_by ON contracts(created_by);
Environment Configuration
1. Backend Environment Variables
Create backend/.env:
bash# Application
NODE_ENV=development
PORT=8000
API_VERSION=v1

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/contract_management
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PREFIX=contract:

# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=your-refresh-token-secret
REFRESH_TOKEN_EXPIRES_IN=30d

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM="Contract Management <noreply@contractmgmt.com>"

# AWS (optional)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
S3_BUCKET=contract-management-dev

# Logging
LOG_LEVEL=debug
LOG_FORMAT=dev

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Rate Limiting
RATE_LIMIT_WINDOW=15m
RATE_LIMIT_MAX=100
2. Frontend Environment Variables
Create frontend/.env:
bash# API Configuration
VITE_API_URL=http://localhost:8000/api/v1
VITE_WS_URL=ws://localhost:8000

# Features
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_CHAT=true
VITE_ENABLE_MARKETPLACE=true

# Third-party services (optional)
VITE_GOOGLE_CLIENT_ID=your-google-client-id
VITE_STRIPE_PUBLIC_KEY=your-stripe-public-key
3. Environment Variable Validation
javascript// backend/config/env.js
const Joi = require('joi');

const envSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().default(8000),
  DATABASE_URL: Joi.string().required(),
  REDIS_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().min(32).required(),
  // ... other validations
}).unknown();

const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

module.exports = envVars;
Running the Application
Development Mode
bash# Terminal 1: Start backend
cd backend
npm run dev

# Terminal 2: Start frontend
cd frontend
npm run dev

# Terminal 3: Start worker (optional)
cd backend
npm run worker:dev
Using PM2 (Production-like)
bash# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start ecosystem.config.js

# View logs
pm2 logs

# Monitor
pm2 monit
PM2 Configuration
javascript// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'api',
      script: './backend/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 8000
      }
    },
    {
      name: 'worker',
      script: './backend/worker.js',
      instances: 2,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
Verify Installation
bash# Check backend health
curl http://localhost:8000/health

# Check API
curl http://localhost:8000/api/v1/status

# Open frontend
open http://localhost:3000
Common Issues
Port Already in Use
bash# Find process using port
lsof -i :8000

# Kill process
kill -9 <PID>

# Or change port in .env
PORT=8001
Database Connection Issues
bash# Check PostgreSQL is running
pg_isready

# Check connection
psql -U postgres -d contract_management -c "SELECT 1"

# Common fixes:
# 1. Check DATABASE_URL format
# 2. Ensure PostgreSQL is running
# 3. Check firewall/permissions
# 4. Verify credentials
Redis Connection Issues
bash# Check Redis is running
redis-cli ping

# Should return: PONG

# If not running:
# macOS: brew services start redis
# Linux: sudo systemctl start redis
Node Module Issues
bash# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm cache clean --force
npm install

# For specific module issues
npm rebuild
Migration Issues
bash# Reset database (CAUTION: Deletes all data)
npm run db:reset

# Run specific migration
npm run migrate:up -- --to 003_add_users.js

# Rollback migration
npm run migrate:down
Development Workflow
1. Start Development Environment
bash# Start all services
npm run dev:all

# Or manually:
# Terminal 1: npm run dev:backend
# Terminal 2: npm run dev:frontend
# Terminal 3: npm run dev:worker
2. Access Applications

Frontend: http://localhost:3000
Backend API: http://localhost:8000
API Documentation: http://localhost:8000/api-docs
pgAdmin: http://localhost:5050 (if using Docker)
Redis Commander: http://localhost:8081 (if configured)

3. Default Credentials
Admin User:
Email: admin@contractmgmt.com
Password: Admin123!

Test User:
Email: user@example.com
Password: User123!
4. Development Tools
bash# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Check code style
npm run lint

# Fix code style
npm run lint:fix

# Type checking
npm run type-check

# Build for production
npm run build
IDE Setup
VS Code Extensions
json{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "dsznajder.es7-react-js-snippets",
    "formulahendry.auto-rename-tag",
    "christian-kohler.npm-intellisense",
    "mikestead.dotenv",
    "ms-azuretools.vscode-docker",
    "eamodio.gitlens"
  ]
}
VS Code Settings
json{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ],
  "tailwindCSS.includeLanguages": {
    "javascript": "javascript",
    "javascriptreact": "javascript"
  }
}
Next Steps

Explore the Codebase

Review the project structure
Understand the architecture
Check out the API documentation


Run Tests
bashnpm test
npm run test:e2e

Try the Features

Create a contract
Upload attachments
Test real-time collaboration
Explore the template marketplace


Read Additional Guides

Development Guide
Testing Guide
Deployment Guide


Contribute

Check open issues
Create a feature branch
Make your changes
Submit a pull request



Troubleshooting Resources

FAQ
Common Errors
GitHub Issues
Discord Community

Support
If you encounter any issues:

Check the troubleshooting guide
Search existing GitHub issues
Ask in the Discord community
Create a new issue with:

Environment details
Steps to reproduce
Error messages
Expected vs actual behavior



Happy coding! 🚀