# Contract Management System API Documentation

## Overview

The Contract Management System API provides a comprehensive set of endpoints for managing contracts, templates, users, and related operations. This RESTful API is designed to be intuitive, secure, and scalable.

## Base URL

- Production: `https://api.contractmanagement.com/v1`
- Staging: `https://staging-api.contractmanagement.com/v1`
- Development: `http://localhost:8000/api/v1`

## Authentication

The API uses JWT (JSON Web Token) authentication. To authenticate:

1. Register a new account or login with existing credentials
2. Receive a JWT token and refresh token
3. Include the JWT token in the Authorization header for all subsequent requests:

Authorization: Bearer <your-jwt-token>

### Token Lifecycle

- Access tokens expire after 15 minutes
- Refresh tokens expire after 30 days
- Use the `/auth/refresh` endpoint to get a new access token

## Rate Limiting

To ensure fair usage and system stability, the following rate limits apply:

- Anonymous requests: 20 requests per hour
- Authenticated requests: 1000 requests per hour
- Premium users: 5000 requests per hour
- Bulk operations: 100 requests per hour

Rate limit headers are included in all responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Time when limit resets (Unix timestamp)

## Request/Response Format

### Request Headers
Content-Type: application/json
Authorization: Bearer <token>
Accept: application/json

### Response Format

All responses follow a consistent format:

#### Success Response
```json
{
  "success": true,
  "data": {
    // Response data
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00Z",
    "version": "1.0.0"
  }
}
Error Response
json{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "field": "email",
      "reason": "Invalid email format"
    }
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00Z",
    "request_id": "req_123456"
  }
}
Pagination
List endpoints support pagination with the following parameters:

page: Page number (default: 1)
limit: Items per page (default: 20, max: 100)
sortBy: Field to sort by
sortOrder: Sort direction (asc/desc)

Pagination metadata is included in responses:
json{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
Filtering
Most list endpoints support filtering via query parameters:

Exact match: ?status=active
Multiple values: ?status=active,pending
Date ranges: ?startDate=2024-01-01&endDate=2024-12-31
Text search: ?search=contract%20name

Error Codes
CodeDescription400Bad Request - Invalid request format401Unauthorized - Invalid or missing token403Forbidden - Insufficient permissions404Not Found - Resource doesn't exist409Conflict - Resource already exists422Unprocessable Entity - Validation failed429Too Many Requests - Rate limit exceeded500Internal Server Error503Service Unavailable
WebSocket Support
For real-time updates, connect to our WebSocket endpoint:

Production: wss://api.contractmanagement.com/ws
Development: ws://localhost:8000/ws

Connection
javascriptconst ws = new WebSocket('wss://api.contractmanagement.com/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'your-jwt-token'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
Events

contract.created
contract.updated
contract.deleted
comment.added
approval.requested
approval.completed

Webhooks
Configure webhooks to receive real-time notifications about events in your account.
Webhook Payload
json{
  "event": "contract.created",
  "data": {
    // Event data
  },
  "timestamp": "2024-01-01T00:00:00Z",
  "signature": "sha256=..."
}
Verifying Webhooks
Verify webhook signatures to ensure authenticity:
javascriptconst crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const hash = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return `sha256=${hash}` === signature;
}
API Endpoints
Authentication

POST /auth/register - Register new user
POST /auth/login - Login user
POST /auth/logout - Logout user
POST /auth/refresh - Refresh access token
POST /auth/2fa/enable - Enable 2FA
POST /auth/2fa/verify - Verify 2FA code
POST /auth/forgot-password - Request password reset
POST /auth/reset-password - Reset password

Contracts

GET /contracts - List contracts
POST /contracts - Create contract
GET /contracts/:id - Get contract
PUT /contracts/:id - Update contract
DELETE /contracts/:id - Delete contract
GET /contracts/:id/versions - Get version history
POST /contracts/:id/compare - Compare versions
GET /contracts/:id/comments - Get comments
POST /contracts/:id/comments - Add comment
POST /contracts/:id/approve - Approve contract
POST /contracts/:id/reject - Reject contract
POST /contracts/:id/sign - Sign contract
GET /contracts/:id/activity - Get activity log
POST /contracts/:id/export - Export contract

Templates

GET /templates - List templates
POST /templates - Create template
GET /templates/:id - Get template
PUT /templates/:id - Update template
DELETE /templates/:id - Delete template
POST /templates/:id/clone - Clone template
POST /templates/:id/publish - Publish to marketplace

Users

GET /users/me - Get current user
PUT /users/me - Update profile
DELETE /users/me - Delete account
GET /users - List users (admin only)
GET /users/:id - Get user (admin only)
PUT /users/:id - Update user (admin only)
DELETE /users/:id - Delete user (admin only)

Analytics

GET /analytics/dashboard - Dashboard stats
GET /analytics/contracts/:id - Contract analytics
GET /analytics/users/:id - User analytics
POST /analytics/report - Generate report

Marketplace

GET /marketplace/templates - Browse templates
GET /marketplace/templates/:id - Get template details
POST /marketplace/templates/:id/purchase - Purchase template
POST /marketplace/templates/:id/review - Review template

Code Examples
JavaScript/Node.js
javascriptconst axios = require('axios');

const api = axios.create({
  baseURL: 'https://api.contractmanagement.com/v1',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  }
});

// List contracts
const contracts = await api.get('/contracts', {
  params: {
    status: 'active',
    page: 1,
    limit: 20
  }
});

// Create contract
const newContract = await api.post('/contracts', {
  title: 'Service Agreement',
  type: 'service',
  parties: [
    {
      name: 'Acme Corp',
      type: 'company',
      role: 'client'
    }
  ],
  value: 50000,
  currency: 'USD'
});
Python
pythonimport requests

base_url = 'https://api.contractmanagement.com/v1'
headers = {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
}

# List contracts
response = requests.get(
    f'{base_url}/contracts',
    headers=headers,
    params={
        'status': 'active',
        'page': 1,
        'limit': 20
    }
)
contracts = response.json()

# Create contract
new_contract = requests.post(
    f'{base_url}/contracts',
    headers=headers,
    json={
        'title': 'Service Agreement',
        'type': 'service',
        'parties': [
            {
                'name': 'Acme Corp',
                'type': 'company',
                'role': 'client'
            }
        ],
        'value': 50000,
        'currency': 'USD'
    }
)
cURL
bash# List contracts
curl -X GET "https://api.contractmanagement.com/v1/contracts?status=active" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Create contract
curl -X POST "https://api.contractmanagement.com/v1/contracts" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Service Agreement",
    "type": "service",
    "parties": [{
      "name": "Acme Corp",
      "type": "company",
      "role": "client"
    }],
    "value": 50000,
    "currency": "USD"
  }'
SDKs
Official SDKs are available for:

JavaScript/TypeScript
Python
Go
Ruby

Postman Collection
Import our Postman collection to quickly test all API endpoints.
OpenAPI Specification
View the complete OpenAPI specification for detailed endpoint documentation.
Support

Email: api@contractmanagement.com
Documentation: https://docs.contractmanagement.com
Status Page: https://status.contractmanagement.com
GitHub: https://github.com/contractmgmt/api

Changelog
v1.0.0 (2024-01-01)

Initial API release
Contract management endpoints
Template system
User authentication
WebSocket support
Webhook system


## **docs/architecture/overview.md**

```markdown
# Contract Management System Architecture

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture Principles](#architecture-principles)
3. [High-Level Architecture](#high-level-architecture)
4. [Component Architecture](#component-architecture)
5. [Data Flow](#data-flow)
6. [Technology Stack](#technology-stack)
7. [Deployment Architecture](#deployment-architecture)
8. [Security Architecture](#security-architecture)
9. [Performance Considerations](#performance-considerations)
10. [Scalability Strategy](#scalability-strategy)

## System Overview

The Contract Management System is a modern, scalable web application designed to streamline contract creation, management, and collaboration. Built with a microservices-oriented architecture, it provides real-time collaboration, version control, and comprehensive workflow management.

### Key Features
- Real-time collaborative editing
- Version control and audit trails
- Template marketplace
- Approval workflows
- Digital signatures
- Analytics and reporting
- Multi-tenant support

## Architecture Principles

### 1. Separation of Concerns
- Clear boundaries between frontend, backend, and data layers
- Service-oriented architecture for business logic
- Independent, reusable components

### 2. Scalability First
- Horizontal scaling capabilities
- Stateless services
- Distributed caching
- Queue-based processing

### 3. Security by Design
- Defense in depth
- Zero-trust networking
- Encryption at rest and in transit
- Regular security audits

### 4. Developer Experience
- Clear documentation
- Consistent APIs
- Automated testing
- CI/CD pipelines

## High-Level Architecture
┌─────────────────────────────────────────────────────────────────┐
│                           Load Balancer                         │
│                         (AWS ALB / Nginx)                       │
└─────────────────────┬───────────────────┬─────────────────────┘
│                   │
┌────────────▼────────┐ ┌───────▼───────────┐
│   Web Application   │ │   API Gateway     │
│   (React + Redux)   │ │   (Express.js)    │
└────────────┬────────┘ └───────┬───────────┘
│                   │
└─────────┬─────────┘
│
┌───────────▼───────────┐
│   Application Layer   │
│  (Business Services)  │
└───────────┬───────────┘
│
┌───────────────────────┼───────────────────────┐
│                       │                       │
┌───────▼────────┐   ┌─────────▼──────────┐   ┌───────▼────────┐
│   PostgreSQL   │   │      Redis         │   │   Amazon S3    │
│   (Primary DB) │   │     (Cache)        │   │  (File Storage)│
└────────────────┘   └────────────────────┘   └────────────────┘

## Component Architecture

### Frontend Architecture
frontend/
├── components/          # React components
│   ├── common/         # Shared components
│   ├── contracts/      # Contract-related components
│   ├── templates/      # Template components
│   └── collaboration/  # Real-time features
├── hooks/              # Custom React hooks
├── services/           # API communication
├── store/              # Redux state management
└── utils/              # Utility functions

#### Key Frontend Components:
1. **ContractEditor**: Rich text editor with real-time collaboration
2. **TemplateBuilder**: Drag-and-drop template creator
3. **ApprovalFlow**: Visual workflow management
4. **AnalyticsDashboard**: Data visualization

### Backend Architecture
backend/
├── controllers/        # Request handlers
├── services/          # Business logic
├── models/            # Data models
├── middleware/        # Express middleware
├── routes/            # API routes
├── websocket/         # Real-time handlers
├── jobs/              # Background tasks
└── utils/             # Utilities

#### Service Layer Pattern:
```javascript
Controller → Service → Repository → Database
    ↓           ↓          ↓
Validation   Business    Data
  Logic       Logic     Access
Database Architecture
Primary Database (PostgreSQL)

Users: Authentication and profiles
Contracts: Contract documents and metadata
Templates: Reusable contract templates
Activities: Audit logs and history
Approvals: Workflow states

Cache Layer (Redis)

Session storage
Temporary data
Real-time collaboration state
Rate limiting counters

File Storage (S3)

Contract attachments
User uploads
Generated PDFs
Backup archives

Data Flow
1. Contract Creation Flow
User Input → Validation → Service Layer → Database
    ↓                         ↓              ↓
Template    →  Business   →  Version    →  Store
Selection      Rules         Control       Contract
2. Real-time Collaboration
User A                     WebSocket Server              User B
  │                              │                         │
  ├──Edit Operation─────────────>│                         │
  │                              ├──Broadcast──────────────>
  │                              │                         │
  │<─────Operational Transform───┤<────Conflict Resolution─┤
3. Approval Workflow
Initiator → Contract → Approval Queue → Approvers
    │          │            │              │
    └──────────┴────────────┴──────────────┘
                    Email/Push
                  Notifications
Technology Stack
Frontend

Framework: React 18.x
State Management: Redux Toolkit
Styling: Tailwind CSS
Build Tool: Vite
Testing: Jest + React Testing Library

Backend

Runtime: Node.js 18.x
Framework: Express.js
Database: PostgreSQL 15
Cache: Redis 7
Queue: Bull (Redis-based)
WebSocket: Socket.io

Infrastructure

Container: Docker
Orchestration: Kubernetes
CI/CD: GitHub Actions
Monitoring: Prometheus + Grafana
Logging: ELK Stack

External Services

Email: SendGrid
Storage: AWS S3
CDN: CloudFlare
Authentication: Auth0 (optional)
Payments: Stripe

Deployment Architecture

Production Environment
┌─────────────────────────────────────────────────────────────┐
│                        CloudFlare CDN                       │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                     AWS Load Balancer                       │
│                    (Multi-AZ, Auto-scaling)                 │
└─────────────────────────────┬───────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼──────────┐  ┌──────▼──────────┐  ┌──────▼──────────┐
│   Web Servers    │  │   API Servers   │  │ WebSocket       │
│   (Nginx)        │  │   (Node.js)     │  │ Servers         │
│   Auto-scaling   │  │   Auto-scaling  │  │ (Socket.io)     │
└──────────────────┘  └─────────────────┘  └─────────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                    Internal Load Balancer                   │
└─────────────────────────────┬───────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼──────────┐  ┌──────▼──────────┐  ┌──────▼──────────┐
│   PostgreSQL     │  │     Redis       │  │   Background    │
│   Primary        │  │    Cluster      │  │   Workers       │
│   (RDS Multi-AZ) │  │  (ElastiCache)  │  │   (Bull Queue)  │
└──────────────────┘  └─────────────────┘  └─────────────────┘
        │
┌───────▼──────────┐
│   PostgreSQL     │
│   Read Replicas  │
└──────────────────┘
Container Architecture
yamlversion: '3.8'
services:
  frontend:
    image: contractmgmt/frontend:latest
    replicas: 3
    environment:
      - NODE_ENV=production
      - API_URL=${API_URL}
    
  backend:
    image: contractmgmt/backend:latest
    replicas: 5
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    
  websocket:
    image: contractmgmt/websocket:latest
    replicas: 3
    environment:
      - REDIS_URL=${REDIS_URL}
    
  worker:
    image: contractmgmt/worker:latest
    replicas: 2
    environment:
      - REDIS_URL=${REDIS_URL}
      - DATABASE_URL=${DATABASE_URL}
Kubernetes Deployment
yamlapiVersion: apps/v1
kind: Deployment
metadata:
  name: contract-api
spec:
  replicas: 5
  selector:
    matchLabels:
      app: contract-api
  template:
    metadata:
      labels:
        app: contract-api
    spec:
      containers:
      - name: api
        image: contractmgmt/backend:latest
        ports:
        - containerPort: 8000
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
Security Architecture
Authentication & Authorization
┌────────────────┐     ┌──────────────────┐     ┌────────────────┐
│     Client     │────▶│   API Gateway    │────▶│   Auth Service │
└────────────────┘     └──────────────────┘     └────────────────┘
        │                       │                         │
        │                       ▼                         ▼
        │              ┌──────────────────┐      ┌────────────────┐
        └─────────────▶│   JWT Validation │      │   User Store   │
                       └──────────────────┘      └────────────────┘
Security Layers

Network Security

WAF (Web Application Firewall)
DDoS Protection
SSL/TLS everywhere
VPC with private subnets


Application Security

JWT authentication
Role-based access control (RBAC)
Input validation
SQL injection prevention
XSS protection
CSRF tokens


Data Security

Encryption at rest (AES-256)
Encryption in transit (TLS 1.3)
Field-level encryption for sensitive data
Regular security audits


Infrastructure Security

Container scanning
Dependency scanning
Secret management (AWS Secrets Manager)
Audit logging



Security Best Practices
javascript// Example: Secure API endpoint
router.post('/contracts',
  authenticate,              // JWT validation
  authorize('create'),       // Permission check
  validateInput(schema),     // Input validation
  rateLimiter,              // Rate limiting
  async (req, res) => {
    // Secure implementation
  }
);
Performance Considerations
Optimization Strategies

Database Optimization
sql-- Indexed columns for fast queries
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_contracts_user_date ON contracts(user_id, created_at);

-- Materialized views for analytics
CREATE MATERIALIZED VIEW contract_stats AS
SELECT 
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as total_contracts,
  SUM(value) as total_value
FROM contracts
GROUP BY date;

Caching Strategy
javascript// Multi-level caching
const getCachedData = async (key) => {
  // L1: Memory cache
  if (memoryCache.has(key)) {
    return memoryCache.get(key);
  }
  
  // L2: Redis cache
  const redisData = await redis.get(key);
  if (redisData) {
    memoryCache.set(key, redisData);
    return redisData;
  }
  
  // L3: Database
  const dbData = await database.query(key);
  await redis.setex(key, 3600, dbData);
  memoryCache.set(key, dbData);
  return dbData;
};

API Response Optimization

Pagination for large datasets
Field selection (GraphQL-like)
Response compression (gzip)
HTTP/2 multiplexing


Frontend Performance

Code splitting
Lazy loading
Service workers
Image optimization
Bundle size optimization



Performance Metrics
MetricTargetCurrentAPI Response Time< 200ms150msPage Load Time< 2s1.8sTime to Interactive< 3s2.5sDatabase Query Time< 50ms35msCache Hit Rate> 80%85%
Scalability Strategy
Horizontal Scaling

Stateless Services

No server-side sessions
JWT for authentication
Shared state in Redis


Database Scaling

Read replicas for queries
Connection pooling
Query optimization
Sharding ready architecture


Microservices Architecture
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   Contract  │  │   Template  │  │  Analytics  │
│   Service   │  │   Service   │  │   Service   │
└─────────────┘  └─────────────┘  └─────────────┘
       │                │                │
       └────────────────┼────────────────┘
                        │
                 ┌──────▼──────┐
                 │  Message Bus │
                 │   (RabbitMQ) │
                 └─────────────┘


Vertical Scaling

Resource Optimization

Efficient algorithms
Memory management
Connection pooling
Query optimization


Infrastructure Scaling

Auto-scaling groups
Load balancer configuration
CDN utilization
Edge computing



Scaling Triggers
yamlscaling_rules:
  cpu_threshold: 70%
  memory_threshold: 80%
  request_rate: 1000/min
  response_time: 500ms
  queue_depth: 100
Monitoring and Observability
Monitoring Stack
Application → Metrics → Prometheus → Grafana
    │           │                       │
    │           └── Alerts → PagerDuty  │
    │                                   │
    └── Logs → ELK Stack ───────────────┘
Key Metrics

Application Metrics

Request rate
Error rate
Response time
Active users


Infrastructure Metrics

CPU usage
Memory usage
Disk I/O
Network traffic


Business Metrics

Contracts created
User engagement
Template usage
Revenue metrics



Alerting Rules
yamlalerts:
  - name: High Error Rate
    condition: error_rate > 5%
    duration: 5m
    severity: critical
    
  - name: Slow Response Time
    condition: p95_response_time > 1s
    duration: 10m
    severity: warning
    
  - name: Database Connection Pool
    condition: available_connections < 10
    duration: 5m
    severity: critical
Disaster Recovery
Backup Strategy

Database Backups

Automated daily backups
Point-in-time recovery
Cross-region replication
30-day retention


File Storage Backups

S3 versioning enabled
Cross-region replication
Lifecycle policies


Configuration Backups

Infrastructure as Code
Version controlled
Encrypted secrets



Recovery Procedures
bash# RTO: 1 hour, RPO: 15 minutes

# 1. Database Recovery
pg_restore -h $NEW_HOST -U $USER -d contracts backup.dump

# 2. Redis Recovery
redis-cli --rdb /backup/dump.rdb

# 3. Application Deployment
kubectl apply -f k8s/disaster-recovery/

# 4. DNS Failover
./scripts/dns-failover.sh production disaster-recovery
Future Considerations
Planned Improvements

GraphQL API

More efficient data fetching
Real-time subscriptions
Better mobile support


Event Sourcing

Complete audit trail
Time travel debugging
CQRS implementation


AI/ML Integration

Contract analysis
Risk assessment
Auto-suggestions


Blockchain Integration

Smart contracts
Immutable audit trail
Decentralized signatures



Technology Upgrades

Migration to HTTP/3
WebAssembly for performance
Edge computing deployment
Serverless functions

Conclusion
The Contract Management System architecture is designed to be scalable, secure, and maintainable. By following microservices principles, implementing proper caching strategies, and maintaining a strong focus on security, the system can handle enterprise-scale deployments while remaining agile enough for rapid feature development.
For specific implementation details, refer to the individual component documentation and code repositories.

## **docs/architecture/database-schema.md**

```markdown
# Database Schema Documentation

## Overview

The Contract Management System uses PostgreSQL as its primary database, designed for scalability, performance, and data integrity. This document outlines the complete database schema, relationships, and design decisions.

## Database Design Principles

1. **Normalization**: Tables are normalized to 3NF to minimize redundancy
2. **Referential Integrity**: Foreign key constraints ensure data consistency
3. **Audit Trail**: All major entities include created/updated timestamps
4. **Soft Deletes**: Critical data uses soft delete pattern for recovery
5. **Indexing**: Strategic indexes for query performance
6. **Partitioning**: Large tables partitioned by date for performance

## Entity Relationship Diagram

```mermaid
erDiagram
    User ||--o{ Contract : creates
    User ||--o{ Comment : writes
    User ||--o{ Activity : performs
    User ||--o{ Approval : approves
    
    Contract ||--o{ ContractParty : has
    Contract ||--o{ ContractVersion : has_versions
    Contract ||--o{ Comment : has_comments
    Contract ||--o{ Attachment : has_attachments
    Contract ||--o{ Activity : tracks
    Contract ||--o{ Approval : requires
    
    Template ||--o{ Contract : generates
    Template ||--o{ TemplateVariable : contains
    
    Party ||--o{ ContractParty : participates_in
    
    Approval ||--o{ ApprovalStep : has_steps
    
    User {
        uuid id PK
        string email UK
        string password_hash
        string first_name
        string last_name
        string role
        string avatar_url
        string company
        string department
        boolean is_active
        boolean two_factor_enabled
        string two_factor_secret
        timestamp last_login
        timestamp created_at
        timestamp updated_at
    }
    
    Contract {
        uuid id PK
        string title
        text description
        string type
        string status
        decimal value
        string currency
        date start_date
        date end_date
        text content
        json metadata
        integer version
        boolean is_template
        uuid created_by FK
        uuid template_id FK
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }
    
    Party {
        uuid id PK
        string name
        string type
        string email
        string phone
        text address
        string tax_id
        timestamp created_at
        timestamp updated_at
    }
    
    ContractParty {
        uuid id PK
        uuid contract_id FK
        uuid party_id FK
        string role
        string signature_status
        timestamp signed_at
        string signature_ip
        timestamp created_at
    }
Table Schemas
Users Table
sqlCREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    avatar_url VARCHAR(500),
    company VARCHAR(255),
    department VARCHAR(100),
    phone VARCHAR(50),
    timezone VARCHAR(50) DEFAULT 'UTC',
    language VARCHAR(10) DEFAULT 'en',
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    two_factor_enabled BOOLEAN DEFAULT false,
    two_factor_secret VARCHAR(255),
    last_login TIMESTAMP,
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT users_role_check CHECK (role IN ('user', 'manager', 'admin', 'super_admin'))
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_company ON users(company);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = true;
Contracts Table
sqlCREATE TABLE contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    value DECIMAL(15,2),
    currency CHAR(3) DEFAULT 'USD',
    start_date DATE,
    end_date DATE,
    content TEXT,
    content_html TEXT,
    metadata JSONB DEFAULT '{}',
    tags TEXT[],
    version INTEGER DEFAULT 1,
    is_template BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT false,
    created_by UUID NOT NULL REFERENCES users(id),
    template_id UUID REFERENCES templates(id),
    parent_contract_id UUID REFERENCES contracts(id),
    approval_workflow_id UUID REFERENCES approval_workflows(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    CONSTRAINT contracts_type_check CHECK (
        type IN ('employment', 'service', 'nda', 'sales', 'lease', 'partnership', 'other')
    ),
    CONSTRAINT contracts_status_check CHECK (
        status IN ('draft', 'pending_review', 'approved', 'active', 'expired', 'terminated', 'cancelled')
    )
);

CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_contracts_type ON contracts(type);
CREATE INDEX idx_contracts_created_by ON contracts(created_by);
CREATE INDEX idx_contracts_dates ON contracts(start_date, end_date);
CREATE INDEX idx_contracts_value ON contracts(value) WHERE value IS NOT NULL;
CREATE INDEX idx_contracts_tags ON contracts USING GIN(tags);
CREATE INDEX idx_contracts_metadata ON contracts USING GIN(metadata);
CREATE INDEX idx_contracts_deleted ON contracts(deleted_at) WHERE deleted_at IS NULL;

-- Partitioning by year for large deployments
CREATE TABLE contracts_2024 PARTITION OF contracts
    FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
Contract Versions Table
sqlCREATE TABLE contract_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    title VARCHAR(500),
    content TEXT,
    content_html TEXT,
    metadata JSONB,
    changes JSONB,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(contract_id, version_number)
);

CREATE INDEX idx_contract_versions_contract ON contract_versions(contract_id);
CREATE INDEX idx_contract_versions_created ON contract_versions(created_at);
Parties Table
sqlCREATE TABLE parties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    postal_code VARCHAR(20),
    tax_id VARCHAR(50),
    company_registration VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT parties_type_check CHECK (type IN ('individual', 'company', 'organization'))
);

CREATE INDEX idx_parties_name ON parties(name);
CREATE INDEX idx_parties_email ON parties(email);
CREATE INDEX idx_parties_type ON parties(type);
Contract Parties Table (Junction)
sqlCREATE TABLE contract_parties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    party_id UUID NOT NULL REFERENCES parties(id),
    role VARCHAR(50) NOT NULL,
    signature_status VARCHAR(50) DEFAULT 'pending',
    signature_method VARCHAR(50),
    signed_at TIMESTAMP,
    signature_ip INET,
    signature_data JSONB,
    order_index INTEGER DEFAULT 0,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT contract_parties_role_check CHECK (
        role IN ('client', 'vendor', 'employee', 'contractor', 'landlord', 'tenant', 'partner', 'other')
    ),
    CONSTRAINT contract_parties_signature_check CHECK (
        signature_status IN ('pending', 'signed', 'declined', 'expired')
    ),
    UNIQUE(contract_id, party_id, role)
);

CREATE INDEX idx_contract_parties_contract ON contract_parties(contract_id);
CREATE INDEX idx_contract_parties_party ON contract_parties(party_id);
CREATE INDEX idx_contract_parties_status ON contract_parties(signature_status);
Templates Table
sqlCREATE TABLE templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    content_html TEXT,
    variables JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    tags TEXT[],
    is_public BOOLEAN DEFAULT false,
    is_featured BOOLEAN DEFAULT false,
    price DECIMAL(10,2) DEFAULT 0,
    currency CHAR(3) DEFAULT 'USD',
    usage_count INTEGER DEFAULT 0,
    rating DECIMAL(3,2),
    rating_count INTEGER DEFAULT 0,
    created_by UUID NOT NULL REFERENCES users(id),
    organization_id UUID REFERENCES organizations(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT templates_category_check CHECK (
        category IN ('employment', 'service', 'nda', 'sales', 'lease', 'legal', 'other')
    )
);

CREATE INDEX idx_templates_category ON templates(category);
CREATE INDEX idx_templates_public ON templates(is_public);
CREATE INDEX idx_templates_featured ON templates(is_featured) WHERE is_featured = true;
CREATE INDEX idx_templates_tags ON templates USING GIN(tags);
CREATE INDEX idx_templates_rating ON templates(rating) WHERE rating IS NOT NULL;
Comments Table
sqlCREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    position JSONB,
    is_resolved BOOLEAN DEFAULT false,
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP,
    mentions UUID[],
    attachments JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_comments_contract ON comments(contract_id);
CREATE INDEX idx_comments_user ON comments(user_id);
CREATE INDEX idx_comments_parent ON comments(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_comments_resolved ON comments(is_resolved);
CREATE INDEX idx_comments_created ON comments(created_at);
Activities Table (Audit Log)
sqlCREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(100) NOT NULL,
    description TEXT,
    user_id UUID NOT NULL REFERENCES users(id),
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    changes JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT activities_entity_type_check CHECK (
        entity_type IN ('contract', 'template', 'user', 'party', 'approval', 'comment')
    )
);

CREATE INDEX idx_activities_entity ON activities(entity_type, entity_id);
CREATE INDEX idx_activities_user ON activities(user_id);
CREATE INDEX idx_activities_action ON activities(action);
CREATE INDEX idx_activities_created ON activities(created_at);

-- Partitioning by month for high-volume audit logs
CREATE TABLE activities_2024_01 PARTITION OF activities
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
Approvals Table
sqlCREATE TABLE approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    workflow_id UUID NOT NULL REFERENCES approval_workflows(id),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    current_step INTEGER DEFAULT 1,
    total_steps INTEGER NOT NULL,
    due_date TIMESTAMP,
    completed_at TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT approvals_status_check CHECK (
        status IN ('pending', 'in_progress', 'approved', 'rejected', 'cancelled', 'expired')
    )
);

CREATE INDEX idx_approvals_contract ON approvals(contract_id);
CREATE INDEX idx_approvals_status ON approvals(status);
CREATE INDEX idx_approvals_due_date ON approvals(due_date) WHERE status = 'pending';
Approval Steps Table
sqlCREATE TABLE approval_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    approval_id UUID NOT NULL REFERENCES approvals(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    approver_id UUID NOT NULL REFERENCES users(id),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    decision VARCHAR(50),
    comments TEXT,
    decided_at TIMESTAMP,
    reminder_sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT approval_steps_status_check CHECK (
        status IN ('pending', 'reviewing', 'approved', 'rejected', 'skipped')
    ),
    CONSTRAINT approval_steps_decision_check CHECK (
        decision IN ('approve', 'reject', 'delegate', NULL)
    ),
    UNIQUE(approval_id, step_number)
);

CREATE INDEX idx_approval_steps_approval ON approval_steps(approval_id);
CREATE INDEX idx_approval_steps_approver ON approval_steps(approver_id);
CREATE INDEX idx_approval_steps_status ON approval_steps(status);
Attachments Table
sqlCREATE TABLE attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255),
    content_type VARCHAR(100),
    size_bytes BIGINT,
    storage_path VARCHAR(500) NOT NULL,
    storage_provider VARCHAR(50) DEFAULT 's3',
    checksum VARCHAR(64),
    metadata JSONB DEFAULT '{}',
    uploaded_by UUID NOT NULL REFERENCES users(id),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    CONSTRAINT attachments_parent_check CHECK (
        (contract_id IS NOT NULL AND comment_id IS NULL) OR
        (contract_id IS NULL AND comment_id IS NOT NULL)
    )
);

CREATE INDEX idx_attachments_contract ON attachments(contract_id) WHERE contract_id IS NOT NULL;
CREATE INDEX idx_attachments_comment ON attachments(comment_id) WHERE comment_id IS NOT NULL;
CREATE INDEX idx_attachments_uploaded_by ON attachments(uploaded_by);
Notifications Table
sqlCREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    entity_type VARCHAR(50),
    entity_id UUID,
    action_url VARCHAR(500),
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    is_archived BOOLEAN DEFAULT false,
    archived_at TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created ON notifications(created_at);
CREATE INDEX idx_notifications_expires ON notifications(expires_at) WHERE expires_at IS NOT NULL;
Email Logs Table
sqlCREATE TABLE email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    to_email VARCHAR(255) NOT NULL,
    from_email VARCHAR(255) NOT NULL,
    subject VARCHAR(500),
    template_name VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    provider VARCHAR(50),
    provider_message_id VARCHAR(255),
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    sent_at TIMESTAMP,
    opened_at TIMESTAMP,
    clicked_at TIMESTAMP,
    bounced_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_email_logs_to ON email_logs(to_email);
CREATE INDEX idx_email_logs_status ON email_logs(status);
CREATE INDEX idx_email_logs_created ON email_logs(created_at);
Views and Materialized Views
Contract Summary View
sqlCREATE VIEW contract_summary AS
SELECT 
    c.id,
    c.title,
    c.type,
    c.status,
    c.value,
    c.currency,
    c.start_date,
    c.end_date,
    u.first_name || ' ' || u.last_name AS created_by_name,
    u.email AS created_by_email,
    COUNT(DISTINCT cp.party_id) AS party_count,
    COUNT(DISTINCT com.id) AS comment_count,
    COUNT(DISTINCT a.id) AS attachment_count,
    MAX(act.created_at) AS last_activity,
    c.created_at,
    c.updated_at
FROM contracts c
LEFT JOIN users u ON c.created_by = u.id
LEFT JOIN contract_parties cp ON c.id = cp.contract_id
LEFT JOIN comments com ON c.id = com.contract_id AND com.deleted_at IS NULL
LEFT JOIN attachments a ON c.id = a.contract_id AND a.deleted_at IS NULL
LEFT JOIN activities act ON c.id = act.entity_id AND act.entity_type = 'contract'
WHERE c.deleted_at IS NULL
GROUP BY c.id, u.id;
User Activity Stats
sqlCREATE MATERIALIZED VIEW user_activity_stats AS
SELECT 
    u.id AS user_id,
    COUNT(DISTINCT c.id) AS contracts_created,
    COUNT(DISTINCT com.id) AS comments_made,
    COUNT(DISTINCT a.id) AS approvals_given,
    COUNT(DISTINCT act.id) AS total_activities,
    MAX(act.created_at) AS last_activity,
    DATE_TRUNC('day', u.created_at) AS user_created_date
FROM users u
LEFT JOIN contracts c ON u.id = c.created_by
LEFT JOIN comments com ON u.id = com.user_id
LEFT JOIN approval_steps a ON u.id = a.approver_id AND a.status = 'approved'
LEFT JOIN activities act ON u.id = act.user_id
GROUP BY u.id;

CREATE INDEX idx_user_activity_stats_user ON user_activity_stats(user_id);
Database Functions and Triggers
Update Timestamp Trigger
sqlCREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON contracts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Repeat for other tables...
Contract Version Trigger
sqlCREATE OR REPLACE FUNCTION create_contract_version()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.content IS DISTINCT FROM NEW.content OR 
       OLD.title IS DISTINCT FROM NEW.title THEN
        INSERT INTO contract_versions (
            contract_id,
            version_number,
            title,
            content,
            content_html,
            metadata,
            changes,
            created_by
        ) VALUES (
            NEW.id,
            NEW.version,
            OLD.title,
            OLD.content,
            OLD.content_html,
            OLD.metadata,
            jsonb_build_object(
                'title', jsonb_build_object('old', OLD.title, 'new', NEW.title),
                'content_changed', OLD.content IS DISTINCT FROM NEW.content
            ),
            NEW.updated_by
        );
        
        NEW.version = NEW.version + 1;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contract_versioning BEFORE UPDATE ON contracts
    FOR EACH ROW EXECUTE FUNCTION create_contract_version();
Activity Logging Function
sqlCREATE OR REPLACE FUNCTION log_activity(
    p_entity_type VARCHAR,
    p_entity_id UUID,
    p_action VARCHAR,
    p_user_id UUID,
    p_description TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    activity_id UUID;
BEGIN
    INSERT INTO activities (
        entity_type,
        entity_id,
        action,
        user_id,
        description,
        metadata
    ) VALUES (
        p_entity_type,
        p_entity_id,
        p_action,
        p_user_id,
        p_description,
        p_metadata
    ) RETURNING id INTO activity_id;
    
    RETURN activity_id;
END;
$$ LANGUAGE plpgsql;
Performance Optimization
Query Optimization Examples
sql-- Optimized contract search with full-text search
CREATE INDEX idx_contracts_search ON contracts 
    USING GIN(to_tsvector('english', title || ' ' || COALESCE(description, '')));

-- Search query
SELECT * FROM contracts
WHERE to_tsvector('english', title || ' ' || COALESCE(description, '')) 
    @@ plainto_tsquery('english', 'software agreement')
    AND status = 'active'
    AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 20;

-- Optimized dashboard query
WITH contract_stats AS (
    SELECT 
        status,
        COUNT(*) as count,
        SUM(value) as total_value
    FROM contracts
    WHERE created_by = $1
        AND deleted_at IS NULL
        AND created_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY status
)
SELECT 
    status,
    count,
    total_value,
    ROUND(100.0 * count / SUM(count) OVER (), 2) as percentage
FROM contract_stats;
Maintenance Scripts
sql-- Vacuum and analyze tables
VACUUM ANALYZE contracts;
VACUUM ANALYZE activities;
VACUUM ANALYZE users;

-- Rebuild indexes
REINDEX TABLE contracts;
REINDEX TABLE activities;

-- Update table statistics
ANALYZE contracts;
ANALYZE activities;

-- Clean up old activities (keep 1 year)
DELETE FROM activities 
WHERE created_at < CURRENT_DATE - INTERVAL '1 year';

-- Archive old contracts
INSERT INTO contracts_archive 
SELECT * FROM contracts 
WHERE status IN ('completed', 'terminated', 'cancelled') 
    AND updated_at < CURRENT_DATE - INTERVAL '2 years';

DELETE FROM contracts 
WHERE id IN (SELECT id FROM contracts_archive);
Migration Strategy
Initial Setup
sql-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create custom types
CREATE TYPE user_role AS ENUM ('user', 'manager', 'admin', 'super_admin');
CREATE TYPE contract_status AS ENUM ('draft', 'pending_review', 'approved', 'active', 'expired', 'terminated', 'cancelled');
CREATE TYPE contract_type AS ENUM ('employment', 'service', 'nda', 'sales', 'lease', 'partnership', 'other');
Migration Files
bash# Migration structure
migrations/
├── 001_create_users_table.sql
├── 002_create_contracts_table.sql
├── 003_create_parties_tables.sql
├── 004_create_templates_table.sql
├── 005_create_comments_table.sql
├── 006_create_activities_table.sql
├── 007_create_approvals_tables.sql
├── 008_create_attachments_table.sql
├── 009_create_notifications_table.sql
├── 010_create_views.sql
├── 011_create_functions.sql
├── 012_create_triggers.sql
└── 013_seed_data.sql
Backup and Recovery
Backup Strategy
bash#!/bin/bash
# Daily backup script

BACKUP_DIR="/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATABASE="contract_management"

# Full backup
pg_dump -h localhost -U postgres -d $DATABASE -F c -b -v -f "$BACKUP_DIR/full_backup_$TIMESTAMP.dump"

# Schema only backup
pg_dump -h localhost -U postgres -d $DATABASE -s -f "$BACKUP_DIR/schema_backup_$TIMESTAMP.sql"

# Data only backup
pg_dump -h localhost -U postgres -d $DATABASE -a -f "$BACKUP_DIR/data_backup_$TIMESTAMP.sql"

# Compress older backups
find $BACKUP_DIR -name "*.dump" -mtime +7 -exec gzip {} \;

# Remove backups older than 30 days
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete
Recovery Procedures
bash# Restore from backup
pg_restore -h localhost -U postgres -d contract_management -v backup.dump

# Point-in-time recovery
pg_basebackup -h localhost -U postgres -D /recovery -Fp -Xs -P

# Restore specific tables
pg_restore -h localhost -U postgres -d contract_management -t contracts -v backup.dump
Security Considerations

Row Level Security
sqlALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY contracts_owner_policy ON contracts
    FOR ALL
    TO application_user
    USING (created_by = current_user_id());

Encryption

Sensitive fields encrypted at application level
TDE (Transparent Data Encryption) for data at rest
SSL/TLS for data in transit


Access Control

Separate read/write database users
Minimal privileges principle
Regular permission audits



Monitoring Queries
sql-- Active connections
SELECT pid, usename, application_name, client_addr, state
FROM pg_stat_activity
WHERE state != 'idle';

-- Slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE mean_exec_time > 1000
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan;
Future Considerations

Sharding Strategy

Shard by organization_id for multi-tenant scaling
Geographic sharding for global deployment


Read Replicas

Async replication for read-heavy workloads
Load balancing between replicas


Data Archival

Move old data to cold storage
Implement data retention policies


Performance Enhancements

Implement query result caching
Consider columnar storage for analytics




Now let me continue with the remaining documentation files:

## **docs/architecture/security.md**

```markdown
# Security Architecture Documentation

## Table of Contents
1. [Security Overview](#security-overview)
2. [Authentication & Authorization](#authentication--authorization)
3. [Data Security](#data-security)
4. [Network Security](#network-security)
5. [Application Security](#application-security)
6. [Infrastructure Security](#infrastructure-security)
7. [Compliance & Standards](#compliance--standards)
8. [Security Operations](#security-operations)
9. [Incident Response](#incident-response)
10. [Security Checklist](#security-checklist)

## Security Overview

The Contract Management System implements defense-in-depth security architecture with multiple layers of protection. Security is built into every component from the ground up, following industry best practices and compliance requirements.

### Security Principles

1. **Zero Trust Architecture**: Never trust, always verify
2. **Least Privilege**: Minimal access rights for users and services
3. **Defense in Depth**: Multiple security layers
4. **Secure by Default**: Security enabled out of the box
5. **Continuous Monitoring**: Real-time threat detection

## Authentication & Authorization

### Authentication Flow
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│  API Gateway │────▶│Auth Service │────▶│   Database  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
│                    │                     │                    │
│  1. Login Request  │  2. Validate       │  3. Check          │
│  (email/password)  │     Request        │     Credentials    │
│                    │                     │                    │
│◀───────────────────┼─────────────────────┤                    │
│  4. JWT Token +    │  5. Generate       │                    │
│     Refresh Token  │     Tokens         │                    │

### JWT Implementation

```javascript
// JWT Token Structure
{
  "header": {
    "alg": "RS256",
    "typ": "JWT",
    "kid": "2024-01-key"
  },
  "payload": {
    "sub": "user-uuid",
    "email": "user@example.com",
    "role": "manager",
    "permissions": ["contracts.read", "contracts.write"],
    "iat": 1704067200,
    "exp": 1704070800,
    "iss": "https://api.contractmgmt.com",
    "aud": "contractmgmt-api"
  }
}
Token Security Configuration
javascript// backend/config/auth.js
module.exports = {
  jwt: {
    algorithm: 'RS256',
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '30d',
    issuer: process.env.JWT_ISSUER,
    audience: process.env.JWT_AUDIENCE,
    publicKey: fs.readFileSync('./keys/public.pem'),
    privateKey: fs.readFileSync('./keys/private.pem'),
  },
  session: {
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true,
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
      sameSite: 'strict'
    }
  }
};
Two-Factor Authentication (2FA)
javascript// 2FA Implementation
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

class TwoFactorService {
  generateSecret(user) {
    const secret = speakeasy.generateSecret({
      name: `ContractMgmt (${user.email})`,
      issuer: 'Contract Management System',
      length: 32
    });
    
    return {
      secret: secret.base32,
      qrCode: await QRCode.toDataURL(secret.otpauth_url)
    };
  }
  
  verifyToken(secret, token) {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2 // Allow 2 time steps for clock drift
    });
  }
}
Role-Based Access Control (RBAC)
javascript// Permission Matrix
const permissions = {
  user: [
    'contracts.read.own',
    'contracts.create',
    'templates.read',
    'comments.create'
  ],
  manager: [
    ...permissions.user,
    'contracts.read.department',
    'contracts.approve',
    'users.read.department',
    'analytics.read.department'
  ],
  admin: [
    ...permissions.manager,
    'contracts.read.all',
    'contracts.delete',
    'users.manage',
    'templates.manage',
    'settings.manage'
  ],
  super_admin: ['*'] // All permissions
};

// Middleware Implementation
const authorize = (requiredPermission) => {
  return async (req, res, next) => {
    const userPermissions = permissions[req.user.role] || [];
    
    if (userPermissions.includes('*') || 
        userPermissions.includes(requiredPermission)) {
      return next();
    }
    
    // Check dynamic permissions
    if (await checkDynamicPermission(req.user, requiredPermission, req.params)) {
      return next();
    }
    
    res.status(403).json({ error: 'Insufficient permissions' });
  };
};
Data Security
Encryption at Rest
javascript// Field-level encryption for sensitive data
const crypto = require('crypto');

class EncryptionService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  }
  
  encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }
  
  decrypt(encryptedData) {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(encryptedData.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}

// Usage in models
const encryptionService = new EncryptionService();

// Encrypt sensitive fields before saving
contractSchema.pre('save', function(next) {
  if (this.isModified('ssn')) {
    this.ssn = encryptionService.encrypt(this.ssn);
  }
  next();
});
Database Security
sql-- Row-level security policies
CREATE POLICY user_contracts ON contracts
  FOR ALL
  USING (
    created_by = current_user_id() OR
    EXISTS (
      SELECT 1 FROM contract_parties
      WHERE contract_id = contracts.id
      AND party_id IN (
        SELECT party_id FROM user_parties
        WHERE user_id = current_user_id()
      )
    )
  );

-- Encryption for sensitive columns
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Encrypt SSN field
UPDATE parties 
SET ssn_encrypted = pgp_sym_encrypt(ssn, current_setting('app.encryption_key'))
WHERE ssn IS NOT NULL;

-- Create secure view
CREATE VIEW parties_secure AS
SELECT 
  id,
  name,
  pgp_sym_decrypt(ssn_encrypted, current_setting('app.encryption_key')) as ssn
FROM parties;
Data Loss Prevention (DLP)
javascript// DLP Rules
const dlpRules = {
  patterns: {
    ssn: /\b\d{3}-\d{2}-\d{4}\b/,
    creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
    phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/
  },
  
  scan(content) {
    const findings = [];
    
    for (const [type, pattern] of Object.entries(this.patterns)) {
      const matches = content.match(pattern);
      if (matches) {
        findings.push({
          type,
          count: matches.length,
          severity: this.getSeverity(type)
        });
      }
    }
    
    return findings;
  },
  
  getSeverity(type) {
    const severities = {
      ssn: 'critical',
      creditCard: 'critical',
      email: 'medium',
      phone: 'low'
    };
    return severities[type] || 'low';
  }
};

// Apply DLP scanning
contractRouter.post('/contracts', async (req, res) => {
  const dlpFindings = dlpRules.scan(req.body.content);
  
  if (dlpFindings.some(f => f.severity === 'critical')) {
    await logSecurityEvent('DLP_VIOLATION', {
      user: req.user.id,
      findings: dlpFindings
    });
    
    return res.status(400).json({
      error: 'Content contains sensitive information that must be removed'
    });
  }
  
  // Continue with normal processing
});
Network Security
API Gateway Security
nginx# nginx.conf security configurations
server {
    listen 443 ssl http2;
    server_name api.contractmgmt.com;
    
    # SSL Configuration
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';" always;
    
    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;
    
    # DDoS Protection
    client_body_buffer_size 1K;
    client_header_buffer_size 1k;
    client_max_body_size 10M;
    large_client_header_buffers 2 1k;
    
    # Proxy Settings
    location /api {
        proxy_pass http://backend:8000;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Security headers for API
        proxy_hide_header X-Powered-By;
        proxy_hide_header Server;
    }
}
Web Application Firewall (WAF) Rules
javascript// WAF Middleware
const wafRules = {
  // SQL Injection patterns
  sqlInjection: [
    /(\b(union|select|insert|update|delete|drop|create)\b.*\b(from|into|where|table)\b)/i,
    /(--|\/\*|\*\/|xp_|sp_|0x)/i,
    /(\bor\b\s*\d+\s*=\s*\d+)/i,
    /(\band\b\s*\d+\s*=\s*\d+)/i
  ],
  
  // XSS patterns
  xss: [
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi
  ],
  
  // Path traversal
  pathTraversal: [
    /\.\.\//g,
    /\.\.\/g,
    /%2e%2e%2f/gi
  ],
  
  // Command injection
  commandInjection: [
    /[;&|`]\s*(?:ls|cat|grep|find|wget|curl|nc|bash|sh|cmd|powershell)/i
  ]
};

const wafMiddleware = (req, res, next) => {
  const input = JSON.stringify(req.body) + req.url + JSON.stringify(req.query);
  
  for (const [attack, patterns] of Object.entries(wafRules)) {
    for (const pattern of patterns) {
      if (pattern.test(input)) {
        logSecurityEvent('WAF_BLOCK', {
          attack,
          pattern: pattern.toString(),
          ip: req.ip,
          url: req.url
        });
        
        return res.status(403).json({
          error: 'Request blocked by security rules'
        });
      }
    }
  }
  
  next();
};
DDoS Protection
javascript// Advanced rate limiting with Redis
const Redis = require('ioredis');
const redis = new Redis();

const rateLimiter = {
  async checkLimit(key, limit, window) {
    const current = await redis.incr(key);
    
    if (current === 1) {
      await redis.expire(key, window);
    }
    
    return current <= limit;
  },
  
  middleware(options = {}) {
    const {
      windowMs = 60000,
      max = 100,
      keyGenerator = (req) => req.ip
    } = options;
    
    return async (req, res, next) => {
      const key = `rate_limit:${keyGenerator(req)}`;
      const allowed = await this.checkLimit(key, max, windowMs / 1000);
      
      if (!allowed) {
        // Log potential DDoS
        await logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          ip: req.ip,
          path: req.path,
          method: req.method
        });
        
        return res.status(429).json({
          error: 'Too many requests'
        });
      }
      
      next();
    };
  }
};

// Apply different limits for different endpoints
app.use('/api/auth/login', rateLimiter.middleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5 // 5 attempts per window
}));

app.use('/api', rateLimiter.middleware({
  windowMs: 60 * 1000, // 1 minute
  max: 100 // 100 requests per minute
}));
Application Security
Input Validation
javascriptconst { body, query, param, validationResult } = require('express-validator');

// Validation schemas
const contractValidation = {
  create: [
    body('title')
      .trim()
      .isLength({ min: 3, max: 200 })
      .withMessage('Title must be between 3 and 200 characters')
      .matches(/^[a-zA-Z0-9\s\-.,]+$/)
      .withMessage('Title contains invalid characters'),
    
    body('type')
      .isIn(['employment', 'service', 'nda', 'sales', 'lease', 'other'])
      .withMessage('Invalid contract type'),
    
    body('value')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Value must be a positive number')
      .customSanitizer(value => parseFloat(value).toFixed(2)),
    
    body('parties')
      .isArray({ min: 2 })
      .withMessage('Contract must have at least 2 parties'),
    
    body('parties.*.email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Invalid email address'),
    
    body('content')
      .customSanitizer(value => sanitizeHtml(value, {
        allowedTags: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'ul', 'ol', 'li'],
        allowedAttributes: {}
      }))
  ],
  
  update: [
    param('id').isUUID().withMessage('Invalid contract ID'),
    ...contractValidation.create.map(validation => validation.optional())
  ]
};

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  
  next();
};
CSRF Protection
javascriptconst csrf = require('csurf');

// CSRF middleware configuration
const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  }
});

// Apply CSRF protection to state-changing operations
app.use('/api/contracts', csrfProtection);
app.use('/api/users', csrfProtection);

// Provide CSRF token to frontend
app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});
Content Security Policy
javascriptconst helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss://api.contractmgmt.com"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: []
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
Secure Session Management
javascriptconst session = require('express-session');
const RedisStore = require('connect-redis')(session);

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24, // 24 hours
    sameSite: 'strict'
  },
  name: 'sessionId' // Don't use default name
}));

// Session fixation protection
app.use((req, res, next) => {
  if (req.session && req.session.regenerate && req.body.password) {
    req.session.regenerate((err) => {
      if (err) next(err);
      else next();
    });
  } else {
    next();
  }
});
Infrastructure Security
Container Security
dockerfile# Secure Dockerfile
FROM node:18-alpine AS builder

# Run as non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy application files
COPY --chown=nodejs:nodejs . .

# Switch to non-root user
USER nodejs

# Security scanning
FROM aquasec/trivy AS security
COPY --from=builder /app /app
RUN trivy fs --exit-code 1 --no-progress /app

# Final stage
FROM node:18-alpine
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

WORKDIR /app

# Copy from builder
COPY --from=builder --chown=nodejs:nodejs /app .

# Use dumb-init to handle signals
ENTRYPOINT ["dumb-init", "--"]

USER nodejs

EXPOSE 8000

CMD ["node", "server.js"]
Kubernetes Security
yamlapiVersion: v1
kind: Pod
metadata:
  name: contract-api
  annotations:
    container.apparmor.security.beta.kubernetes.io/app: runtime/default
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1001
    fsGroup: 1001
    seccompProfile:
      type: RuntimeDefault
  
  containers:
  - name: app
    image: contractmgmt/api:latest
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop:
        - ALL
        add:
        - NET_BIND_SERVICE
    
    resources:
      limits:
        memory: "512Mi"
        cpu: "500m"
      requests:
        memory: "256Mi"
        cpu: "250m"
    
    volumeMounts:
    - name: tmp
      mountPath: /tmp
    - name: cacheRetryKContinueEdityaml     mountPath: /app/.cache
   
   livenessProbe:
     httpGet:
       path: /health
       port: 8000
     initialDelaySeconds: 30
     periodSeconds: 10
   
   readinessProbe:
     httpGet:
       path: /ready
       port: 8000
     initialDelaySeconds: 5
     periodSeconds: 5
 
 volumes:
 - name: tmp
   emptyDir: {}
 - name: cache
   emptyDir: {}

---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
 name: contract-api-network-policy
spec:
 podSelector:
   matchLabels:
     app: contract-api
 policyTypes:
 - Ingress
 - Egress
 ingress:
 - from:
   - podSelector:
       matchLabels:
         app: nginx-ingress
   ports:
   - protocol: TCP
     port: 8000
 egress:
 - to:
   - podSelector:
       matchLabels:
         app: postgres
   ports:
   - protocol: TCP
     port: 5432
 - to:
   - podSelector:
       matchLabels:
         app: redis
   ports:
   - protocol: TCP
     port: 6379
Secrets Management
javascript// AWS Secrets Manager integration
const AWS = require('aws-sdk');
const secretsManager = new AWS.SecretsManager();

class SecretsService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 300000; // 5 minutes
  }
  
  async getSecret(secretName) {
    // Check cache
    const cached = this.cache.get(secretName);
    if (cached && cached.expiry > Date.now()) {
      return cached.value;
    }
    
    try {
      const data = await secretsManager.getSecretValue({
        SecretId: secretName
      }).promise();
      
      const secret = JSON.parse(data.SecretString);
      
      // Cache the secret
      this.cache.set(secretName, {
        value: secret,
        expiry: Date.now() + this.cacheTimeout
      });
      
      return secret;
    } catch (error) {
      console.error(`Failed to retrieve secret ${secretName}:`, error);
      throw new Error('Secret retrieval failed');
    }
  }
  
  async rotateSecret(secretName) {
    const versionId = await secretsManager.rotateSecret({
      SecretId: secretName,
      RotationRules: {
        AutomaticallyAfterDays: 30
      }
    }).promise();
    
    // Clear cache
    this.cache.delete(secretName);
    
    return versionId;
  }
}

// Usage
const secrets = new SecretsService();
const dbConfig = await secrets.getSecret('prod/database/credentials');
Compliance & Standards
GDPR Compliance
javascript// GDPR compliance features
class GDPRService {
  // Right to access
  async exportUserData(userId) {
    const userData = await db.transaction(async (trx) => {
      const user = await trx('users').where({ id: userId }).first();
      const contracts = await trx('contracts').where({ created_by: userId });
      const comments = await trx('comments').where({ user_id: userId });
      const activities = await trx('activities').where({ user_id: userId });
      
      return {
        user: this.sanitizeUserData(user),
        contracts: contracts.map(c => this.sanitizeContract(c)),
        comments,
        activities
      };
    });
    
    return userData;
  }
  
  // Right to erasure
  async deleteUserData(userId) {
    await db.transaction(async (trx) => {
      // Anonymize rather than delete for data integrity
      await trx('users')
        .where({ id: userId })
        .update({
          email: `deleted_${userId}@example.com`,
          first_name: 'Deleted',
          last_name: 'User',
          phone: null,
          avatar_url: null,
          is_active: false,
          deleted_at: new Date()
        });
      
      // Anonymize contracts
      await trx('contracts')
        .where({ created_by: userId })
        .update({
          metadata: db.raw("metadata - 'personal_info'")
        });
      
      // Delete comments content
      await trx('comments')
        .where({ user_id: userId })
        .update({
          content: '[Deleted]',
          deleted_at: new Date()
        });
    });
    
    await this.logDataDeletion(userId);
  }
  
  // Consent management
  async updateConsent(userId, consents) {
    await db('user_consents').insert({
      user_id: userId,
      marketing: consents.marketing || false,
      analytics: consents.analytics || false,
      third_party: consents.thirdParty || false,
      updated_at: new Date()
    }).onConflict('user_id').merge();
  }
}
SOC 2 Compliance
javascript// Audit logging for SOC 2
class AuditLogger {
  async log(event) {
    const auditEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      event_type: event.type,
      user_id: event.userId,
      ip_address: event.ip,
      user_agent: event.userAgent,
      resource_type: event.resourceType,
      resource_id: event.resourceId,
      action: event.action,
      result: event.result,
      metadata: event.metadata || {}
    };
    
    // Store in database
    await db('audit_logs').insert(auditEntry);
    
    // Send to SIEM
    await this.sendToSIEM(auditEntry);
    
    // Archive if needed
    if (this.shouldArchive(event.type)) {
      await this.archiveAuditLog(auditEntry);
    }
  }
  
  async sendToSIEM(entry) {
    // Send to Splunk/ELK/etc
    await siemClient.send({
      index: 'audit-logs',
      body: entry
    });
  }
}

// Usage in controllers
app.post('/api/contracts/:id', async (req, res) => {
  const startTime = Date.now();
  let result = 'success';
  
  try {
    const contract = await contractService.update(req.params.id, req.body);
    res.json(contract);
  } catch (error) {
    result = 'failure';
    throw error;
  } finally {
    await auditLogger.log({
      type: 'RESOURCE_MODIFICATION',
      userId: req.user.id,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      resourceType: 'contract',
      resourceId: req.params.id,
      action: 'update',
      result,
      metadata: {
        duration: Date.now() - startTime,
        changes: req.body
      }
    });
  }
});
PCI DSS Compliance (if handling payments)
javascript// PCI DSS compliant payment handling
class PaymentSecurityService {
  // Never store card details - use tokenization
  async tokenizeCard(cardDetails) {
    // Send to PCI-compliant payment processor
    const token = await paymentProcessor.tokenize({
      number: cardDetails.number,
      exp_month: cardDetails.expMonth,
      exp_year: cardDetails.expYear,
      cvc: cardDetails.cvc
    });
    
    return token;
  }
  
  // Secure payment processing
  async processPayment(userId, amount, token) {
    // Log attempt (without sensitive data)
    await this.logPaymentAttempt(userId, amount);
    
    try {
      const result = await paymentProcessor.charge({
        amount,
        currency: 'usd',
        source: token,
        description: 'Contract Management Subscription'
      });
      
      // Store only necessary information
      await db('payments').insert({
        user_id: userId,
        amount,
        currency: 'usd',
        status: 'completed',
        processor_id: result.id,
        last_four: result.source.last4,
        created_at: new Date()
      });
      
      return { success: true, id: result.id };
    } catch (error) {
      await this.logPaymentFailure(userId, error);
      throw new Error('Payment processing failed');
    }
  }
}
Security Operations
Security Monitoring
javascript// Real-time security monitoring
class SecurityMonitor {
  constructor() {
    this.thresholds = {
      failedLogins: 5,
      passwordResets: 3,
      apiErrors: 100,
      slowQueries: 50
    };
  }
  
  async checkSecurityMetrics() {
    const metrics = await this.collectMetrics();
    
    for (const [metric, value] of Object.entries(metrics)) {
      if (value > this.thresholds[metric]) {
        await this.triggerAlert(metric, value);
      }
    }
  }
  
  async collectMetrics() {
    const now = new Date();
    const fifteenMinutesAgo = new Date(now - 15 * 60 * 1000);
    
    const [failedLogins, passwordResets, apiErrors, slowQueries] = await Promise.all([
      db('audit_logs')
        .where('event_type', 'LOGIN_FAILED')
        .where('timestamp', '>', fifteenMinutesAgo)
        .count('id as count'),
      
      db('audit_logs')
        .where('event_type', 'PASSWORD_RESET')
        .where('timestamp', '>', fifteenMinutesAgo)
        .count('id as count'),
      
      db('error_logs')
        .where('timestamp', '>', fifteenMinutesAgo)
        .count('id as count'),
      
      db('query_logs')
        .where('duration', '>', 1000)
        .where('timestamp', '>', fifteenMinutesAgo)
        .count('id as count')
    ]);
    
    return {
      failedLogins: failedLogins[0].count,
      passwordResets: passwordResets[0].count,
      apiErrors: apiErrors[0].count,
      slowQueries: slowQueries[0].count
    };
  }
  
  async triggerAlert(metric, value) {
    const alert = {
      type: 'SECURITY_THRESHOLD_EXCEEDED',
      metric,
      value,
      threshold: this.thresholds[metric],
      timestamp: new Date()
    };
    
    // Send to monitoring service
    await monitoringService.alert(alert);
    
    // Send to security team
    await emailService.send({
      to: process.env.SECURITY_TEAM_EMAIL,
      subject: `Security Alert: ${metric} threshold exceeded`,
      template: 'security-alert',
      data: alert
    });
    
    // Log for audit
    await db('security_alerts').insert(alert);
  }
}

// Run monitoring every minute
setInterval(() => {
  securityMonitor.checkSecurityMetrics();
}, 60000);
Vulnerability Scanning
bash#!/bin/bash
# security-scan.sh

echo "Running security scans..."

# Dependency scanning
echo "Checking npm dependencies..."
npm audit --production
AUDIT_EXIT=$?

# OWASP dependency check
echo "Running OWASP dependency check..."
dependency-check --project "Contract Management" --scan ./package.json

# Static code analysis
echo "Running static code analysis..."
eslint . --ext .js,.jsx --config .eslintrc.security.js

# Secret scanning
echo "Scanning for secrets..."
trufflehog --regex --entropy=True .

# Container scanning
echo "Scanning Docker images..."
trivy image contractmgmt/api:latest

# Security headers check
echo "Checking security headers..."
curl -I https://api.contractmgmt.com | grep -E "(Strict-Transport-Security|X-Frame-Options|X-Content-Type-Options|Content-Security-Policy)"

if [ $AUDIT_EXIT -ne 0 ]; then
  echo "Security vulnerabilities found!"
  exit 1
fi

echo "Security scans completed successfully"
Incident Response
Incident Response Plan
markdown## Security Incident Response Procedures

### 1. Detection & Analysis (0-15 minutes)
- [ ] Identify the type of incident
- [ ] Assess severity (Critical/High/Medium/Low)
- [ ] Document initial findings
- [ ] Notify incident response team

### 2. Containment (15-30 minutes)
- [ ] Isolate affected systems
- [ ] Preserve evidence
- [ ] Implement temporary fixes
- [ ] Enable enhanced monitoring

### 3. Eradication (30-60 minutes)
- [ ] Identify root cause
- [ ] Remove threat
- [ ] Patch vulnerabilities
- [ ] Update security rules

### 4. Recovery (1-4 hours)
- [ ] Restore systems from clean backups
- [ ] Verify system integrity
- [ ] Monitor for recurrence
- [ ] Gradually restore access

### 5. Post-Incident (Within 48 hours)
- [ ] Complete incident report
- [ ] Conduct lessons learned
- [ ] Update security procedures
- [ ] Implement preventive measures
Automated Incident Response
javascriptclass IncidentResponse {
  async handleSecurityIncident(incident) {
    const response = {
      id: uuidv4(),
      type: incident.type,
      severity: this.calculateSeverity(incident),
      startTime: new Date(),
      actions: []
    };
    
    // Immediate containment
    if (response.severity === 'CRITICAL') {
      await this.executeContainment(incident, response);
    }
    
    // Gather evidence
    await this.collectEvidence(incident, response);
    
    // Notify stakeholders
    await this.notifyStakeholders(incident, response);
    
    // Execute response playbook
    await this.executePlaybook(incident, response);
    
    // Log incident
    await db('security_incidents').insert(response);
    
    return response;
  }
  
  async executeContainment(incident, response) {
    switch (incident.type) {
      case 'BRUTE_FORCE_ATTACK':
        // Block IP addresses
        await this.blockIPs(incident.sourceIPs);
        response.actions.push('Blocked source IPs');
        
        // Force password reset
        await this.forcePasswordReset(incident.targetUsers);
        response.actions.push('Forced password reset for affected users');
        break;
        
      case 'DATA_BREACH':
        // Revoke all tokens
        await this.revokeAllTokens();
        response.actions.push('Revoked all active tokens');
        
        // Enable read-only mode
        await this.enableReadOnlyMode();
        response.actions.push('Enabled read-only mode');
        break;
        
      case 'MALWARE_DETECTED':
        // Isolate affected containers
        await this.isolateContainers(incident.affectedServices);
        response.actions.push('Isolated affected containers');
        break;
    }
  }
  
  async collectEvidence(incident, response) {
    const evidence = {
      logs: await this.collectLogs(incident.timeRange),
      metrics: await this.collectMetrics(incident.timeRange),
      snapshots: await this.createSystemSnapshots(),
      networkCapture: await this.captureNetworkTraffic()
    };
    
    // Store evidence securely
    await this.storeEvidence(response.id, evidence);
    response.actions.push('Collected and stored evidence');
  }
}
Security Checklist
Development Security Checklist

 Authentication

 Strong password requirements enforced
 Password hashing with bcrypt (min 10 rounds)
 JWT tokens properly signed and validated
 Refresh token rotation implemented
 Session timeout configured
 2FA available for all users


 Authorization

 RBAC properly implemented
 Permission checks on all endpoints
 Resource-level access control
 No authorization bypass vulnerabilities


 Data Protection

 Sensitive data encrypted at rest
 TLS 1.2+ for data in transit
 PII properly masked in logs
 Secure key management
 Data retention policies implemented


 Input Validation

 All inputs validated and sanitized
 SQL injection prevention
 XSS protection
 File upload restrictions
 Request size limits


 API Security

 Rate limiting implemented
 CORS properly configured
 API versioning
 Request/response validation
 Error messages don't leak information


 Infrastructure

 Containers run as non-root
 Security scanning in CI/CD
 Secrets managed securely
 Network policies configured
 Regular security updates



Production Security Checklist

 Monitoring

 Security event logging
 Anomaly detection
 Real-time alerts
 Audit trail complete
 Log retention configured


 Incident Response

 Response plan documented
 Team roles defined
 Communication channels ready
 Backup restoration tested
 Evidence collection procedures


 Compliance

 GDPR compliance verified
 SOC 2 controls in place
 Data residency requirements met
 Privacy policy updated
 Security assessments scheduled


 Operational Security

 Access reviews conducted
 Vulnerability scans scheduled
 Penetration tests planned
 Security training completed
 Disaster recovery tested



Security Training
Security Best Practices for Developers
javascript// DO: Parameterized queries
const user = await db('users')
  .where('email', email)
  .where('active', true)
  .first();

// DON'T: String concatenation
// const user = await db.raw(`SELECT * FROM users WHERE email = '${email}'`);

// DO: Validate and sanitize input
const cleanInput = validator.escape(userInput);

// DON'T: Trust user input
// const data = req.body.userInput;

// DO: Use security headers
app.use(helmet());

// DON'T: Expose sensitive information
// res.json({ error: error.stack });

// DO: Hash passwords properly
const hashedPassword = await bcrypt.hash(password, 12);

// DON'T: Store plain text passwords
// const user = { password: req.body.password };

// DO: Use HTTPS everywhere
app.use(enforceHTTPS());

// DON'T: Allow HTTP in production
// app.listen(80);
Conclusion
Security is an ongoing process that requires constant vigilance and updates. This security architecture provides a strong foundation, but must be regularly reviewed and updated as threats evolve. Regular security assessments, penetration testing, and staying current with security best practices are essential for maintaining a secure system.

## **docs/architecture/deployment.md**

```markdown
# Deployment Architecture Guide

## Table of Contents
1. [Deployment Overview](#deployment-overview)
2. [Environment Setup](#environment-setup)
3. [Container Strategy](#container-strategy)
4. [Kubernetes Deployment](#kubernetes-deployment)
5. [CI/CD Pipeline](#cicd-pipeline)
6. [Infrastructure as Code](#infrastructure-as-code)
7. [Monitoring & Logging](#monitoring--logging)
8. [Scaling Strategy](#scaling-strategy)
9. [Disaster Recovery](#disaster-recovery)
10. [Deployment Checklist](#deployment-checklist)

## Deployment Overview

The Contract Management System uses a cloud-native deployment architecture designed for high availability, scalability, and zero-downtime deployments.

### Architecture Overview
┌─────────────────────────────────────────────────────────────────┐
│                         CloudFlare CDN                          │
└─────────────────────────────┬───────────────────────────────────┘
│
┌─────────────────────────────▼───────────────────────────────────┐
│                    AWS Application Load Balancer                │
│                         (Multi-AZ)                              │
└─────────────────────────────┬───────────────────────────────────┘
│
┌─────────────────────────────▼───────────────────────────────────┐
│                    Kubernetes Cluster (EKS)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │   Frontend   │  │     API     │  │  WebSocket  │           │
│  │    Pods      │  │    Pods     │  │    Pods     │           │
│  └─────────────┘  └─────────────┘  └─────────────┘           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │   Worker     │  │   Redis     │  │  Monitoring │           │
│  │    Pods      │  │   Cluster   │  │    Stack    │           │
│  └─────────────┘  └─────────────┘  └─────────────┘           │
└─────────────────────────────────────────────────────────────────┘
│
┌─────────────────────┼─────────────────────┐
│                     │                     │
┌───────▼──────────┐  ┌──────▼──────────┐  ┌──────▼──────────┐
│   RDS PostgreSQL │  │  ElastiCache    │  │    S3 Bucket    │
│   (Multi-AZ)     │  │    (Redis)      │  │  (File Storage) │
└──────────────────┘  └─────────────────┘  └─────────────────┘

## Environment Setup

### Environment Configuration

```bash
# environments/production.env
NODE_ENV=production
API_URL=https://api.contractmanagement.com
DATABASE_URL=postgresql://user:pass@rds-endpoint:5432/contracts
REDIS_URL=redis://elasticache-endpoint:6379
S3_BUCKET=contract-management-prod
CDN_URL=https://cdn.contractmanagement.com
LOG_LEVEL=info
Environment-Specific Configurations
javascript// config/environments.js
const environments = {
  development: {
    api: {
      port: 8000,
      corsOrigins: ['http://localhost:3000']
    },
    database: {
      host: 'localhost',
      pool: { min: 2, max: 10 }
    },
    redis: {
      host: 'localhost',
      port: 6379
    }
  },
  
  staging: {
    api: {
      port: 8000,
      corsOrigins: ['https://staging.contractmanagement.com']
    },
    database: {
      host: process.env.DATABASE_HOST,
      pool: { min: 5, max: 20 }
    },
    redis: {
      host: process.env.REDIS_HOST,
      cluster: true
    }
  },
  
  production: {
    api: {
      port: 8000,
      corsOrigins: ['https://app.contractmanagement.com']
    },
    database: {
      host: process.env.DATABASE_HOST,
      pool: { min: 10, max: 50 },
      ssl: { rejectUnauthorized: false }
    },
    redis: {
      host: process.env.REDIS_HOST,
      cluster: true,
      password: process.env.REDIS_PASSWORD
    }
  }
};

module.exports = environments[process.env.NODE_ENV || 'development'];
Container Strategy
Docker Configuration
Backend Dockerfile
dockerfile# backend/Dockerfile
FROM node:18-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Dependencies stage
FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production

# Build stage
FROM base AS builder
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runner stage
FROM base AS runner
ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --chown=nodejs:nodejs package*.json ./

USER nodejs
EXPOSE 8000

CMD ["node", "dist/server.js"]
Frontend Dockerfile
dockerfile# frontend/Dockerfile
FROM node:18-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Dependencies stage
FROM base AS deps
COPY package*.json ./
RUN npm ci

# Builder stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG API_URL
ENV VITE_API_URL=$API_URL

RUN npm run build

# Runner stage
FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
Docker Compose (Development)
yaml# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: contracts
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: secret
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U admin"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://admin:secret@postgres:5432/contracts
      REDIS_URL: redis://redis:6379
    volumes:
      - ./backend:/app
      - /app/node_modules
    ports:
      - "8000:8000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: npm run dev

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        API_URL: http://localhost:8000
    volumes:
      - ./frontend:/app
      - /app/node_modules
    ports:
      - "3000:3000"
    depends_on:
      - backend
    command: npm run dev

  worker:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://admin:secret@postgres:5432/contracts
      REDIS_URL: redis://redis:6379
    volumes:
      - ./backend:/app
      - /app/node_modules
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: npm run worker

volumes:
  postgres_data:
  redis_data:
Kubernetes Deployment
Namespace and ConfigMap
yaml# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: contract-management
  labels:
    name: contract-management

---
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: contract-management
data:
  NODE_ENV: "production"
  API_PORT: "8000"
  LOG_LEVEL: "info"
  REDIS_CLUSTER_ENABLED: "true"
Secrets Management
yaml# k8s/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: contract-management
type: Opaque
stringData:
  DATABASE_URL: "postgresql://user:pass@rds.amazonaws.com:5432/contracts"
  REDIS_PASSWORD: "your-redis-password"
  JWT_SECRET: "your-jwt-secret"
  ENCRYPTION_KEY: "your-encryption-key"
API Deployment
yaml# k8s/deployments/api.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: contract-management
  labels:
    app: api
    version: v1
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
        version: v1
    spec:
      serviceAccountName: api-service-account
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
      
      containers:
      - name: api
        image: contractmgmt/api:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 8000
          name: http
        
        envFrom:
        - configMapRef:
            name: app-config
        - secretRef:
            name: app-secrets
        
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        
        readinessProbe:
          httpGet:
            path: /ready
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        
        lifecycle:
          preStop:
            exec:
              command: ["/bin/sh", "-c", "sleep 15"]
        
        volumeMounts:
        - name: app-logs
          mountPath: /app/logs
        - name: temp
          mountPath: /tmp
      
      volumes:
      - name: app-logs
        emptyDir: {}
      - name: temp
        emptyDir: {}
      
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - api
              topologyKey: kubernetes.io/hostname
Frontend Deployment
yaml# k8s/deployments/frontend.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: contract-management
spec:
  replicas: 2
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
      - name: frontend
        image: contractmgmt/frontend:latest
        ports:
        - containerPort: 80
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
        livenessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 10
          periodSeconds: 10
Services
yaml# k8s/services/api-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: api-service
  namespace: contract-management
  labels:
    app: api
spec:
  type: ClusterIP
  ports:
  - port: 8000
    targetPort: 8000
    protocol: TCP
    name: http
  selector:
    app: api

---
# k8s/services/frontend-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: frontend-service
  namespace: contract-management
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: 80
    protocol: TCP
  selector:
    app: frontend
Ingress Configuration
yaml# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
  namespace: contract-management
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
spec:
  tls:
  - hosts:
    - app.contractmanagement.com
    - api.contractmanagement.com
    secretName: app-tls
  rules:
  - host: app.contractmanagement.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend-service
            port:
              number: 80
  - host: api.contractmanagement.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api-service
            port:
              number: 8000
Horizontal Pod Autoscaler
yaml# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-hpa
  namespace: contract-management
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
      - type: Pods
        value: 4
        periodSeconds: 15
      selectPolicy: Max
CI/CD Pipeline
GitHub Actions Workflow
yaml# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  AWS_REGION: us-east-1
  ECR_REPOSITORY: contractmgmt
  EKS_CLUSTER_NAME: contract-mgmt-cluster

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: |
        npm ci --prefix backend
        npm ci --prefix frontend
    
    - name: Run tests
      run: |
        npm run test --prefix backend
        npm run test --prefix frontend
    
    - name: Run security scan
      run: |
        npm audit --prefix backend
        npm audit --prefix frontend

  build:
    needs: test
    runs-on: ubuntu-latest
    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v2
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: ${{ env.AWS_REGION }}
    
    - name: Login to Amazon ECR
      id: login-ecr
      uses: aws-actions/amazon-ecr-login@v1
    
    - name: Build and push backend image
      env:
        ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
        IMAGE_TAG: ${{ github.sha }}
      run: |
        docker build -t $ECR_REGISTRY/$ECR_REPOSITORY/api:$IMAGE_TAG ./backend
        docker push $ECR_REGISTRY/$ECR_REPOSITORY/api:$IMAGE_TAG
        docker tag $ECR_REGISTRY/$ECR_REPOSITORY/api:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY/api:latest
        docker push $ECR_REGISTRY/$ECR_REPOSITORY/api:latest
    
    - name: Build and push frontend image
      env:
        ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
        IMAGE_TAG: ${{ github.sha }}
      run: |
        docker build -t $ECR_REGISTRY/$ECR_REPOSITORY/frontend:$IMAGE_TAG ./frontend
        docker push $ECR_REGISTRY/$ECR_REPOSITORY/frontend:$IMAGE_TAG
        docker tag $ECR_REGISTRY/$ECR_REPOSITORY/frontend:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY/frontend:latest
        docker push $ECR_REGISTRY/$ECR_REPOSITORY/frontend:latest

  deploy:
    needs: build
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v2
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: ${{ env.AWS_REGION }}
    
    - name: Update kubeconfig
      run: |
        aws eks update-kubeconfig --name ${{ env.EKS_CLUSTER_NAME }} --region ${{ env.AWS_REGION }}
    
    - name: Deploy to Kubernetes
      env:
        IMAGE_TAG: ${{ github.sha }}
      run: |
        kubectl set image deployment/api api=contractmgmt/api:$IMAGE_TAG -n contract-management
        kubectl set image deployment/frontend frontend=contractmgmt/frontend:$IMAGE_TAG -n contract-management
        kubectl rollout status deployment/api -n contract-management
        kubectl rollout status deployment/frontend -n contract-management
    
    - name: Run smoke tests
      run: |
        ./scripts/smoke-tests.sh
    
    - name: Notify deployment
      if: always()
      uses: 8398a7/action-slack@v3
      with:
        status: ${{ job.status }}
        text: 'Deployment to production ${{ job.status }}'
        webhook_url: ${{ secrets.SLACK_WEBHOOK }}
Deployment Script
bash#!/bin/bash
# scripts/deploy.sh

set -e

ENVIRONMENT=$1
VERSION=$2

if [ -z "$ENVIRONMENT" ] || [ -z "$VERSION" ]; then
    echo "Usage: ./deploy.sh <environment> <version>"
    exit 1
fi

echo "Deploying version $VERSION to $ENVIRONMENT..."

# Load environment configuration
source ./environments/$ENVIRONMENT.env

# Update Kubernetes deployments
kubectl set image deployment/api api=$ECR_REGISTRY/api:$VERSION -n $NAMESPACE
kubectl set image deployment/frontend frontend=$ECR_REGISTRY/frontend:$VERSION -n $NAMESPACE
kubectl set image deployment/worker worker=$ECR_REGISTRY/worker:$VERSION -n $NAMESPACE

# Wait for rollout to complete
kubectl rollout status deployment/api -n $NAMESPACE
kubectl rollout status deployment/frontend -n $NAMESPACE
kubectl rollout status deployment/worker -n $NAMESPACE

# Run database migrations
kubectl exec -it $(kubectl get pod -l app=api -n $NAMESPACE -o jsonpath="{.items[0].metadata.name}") \
    -n $NAMESPACE -- npm run migrate

# Clear caches
kubectl exec -it $(kubectl get pod -l app=api -n $NAMESPACE -o jsonpath="{.items[0].metadata.name}") \
    -n $NAMESPACE -- npm run cache:clear

# Update CDN
./scripts/update-cdn.sh $ENVIRONMENT

# Run health checks
./scripts/health-check.sh $ENVIRONMENT

echo "Deployment completed successfully!"
Infrastructure as Code
Terraform Configuration
hcl# terraform/main.tf
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
  }
  
  backend "s3" {
    bucket = "contract-mgmt-terraform-state"
    key    = "production/terraform.tfstate"
    region = "us-east-1"
    encrypt = true
    dynamodb_table = "terraform-state-lock"
  }
}

# VPC Configuration
module "vpc" {
  source = "./modules/vpc"
  
  cidr_block = "10.0.0.0/16"
  availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
  
  enable_nat_gateway = true
  enable_vpn_gateway = true
  
  tags = {
    Environment = "production"
    Project     = "contract-management"
  }
}

# EKS Cluster
module "eks" {
  source = "./modules/eks"
  
  cluster_name    = "contract-mgmt-cluster"
  cluster_version = "1.28"
  
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets
  
  node_groups = {
    general = {
      desired_capacity = 3
      min_capacity     = 3
      max_capacity     = 10
      
      instance_types = ["t3.medium"]
      
      k8s_labels = {
        Environment = "production"
        NodeGroup   = "general"
      }
    }
    
    spot = {
      desired_capacity = 2
      min_capacity     = 0
      max_capacity     = 5
      
      instance_types = ["t3.medium", "t3a.medium"]
      capacity_type  = "SPOT"
      
      k8s_labels = {
        Environment = "production"
        NodeGroup   = "spot"
      }
      
      taints = [
        {
          key    = "spot"
          value  = "true"
          effect = "NO_SCHEDULE"
        }
      ]
    }
  }
}

# RDS Database
module "rds" {
  source = "./modules/rds"
  
  identifier = "contract-mgmt-db"
  
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = "db.r6g.large"
  
  allocated_storage     = 100
  max_allocated_storage = 1000
  storage_encrypted     = true
  
  database_name = "contracts"
  username      = "admin"
  
  vpc_id             = module.vpc.vpc_id
  subnet_ids         = module.vpc.private_subnets
  security_group_ids = [module.eks.worker_security_group_id]
  
  backup_retention_period = 30
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"
  
  enabled_cloudwatch_logs_exports = ["postgresql"]
  
  tags = {
    Environment = "production"
  }
}

# ElastiCache Redis
module "redis" {
  source = "./modules/elasticache"
  
  cluster_id = "contract-mgmt-redis"
  
  engine               = "redis"
  node_type           = "cache.r6g.large"
  num_cache_nodes     = 3
  parameter_group_name = "default.redis7.cluster.on"
  
  vpc_id             = module.vpc.vpc_id
  subnet_ids         = module.vpc.private_subnets
  security_group_ids = [module.eks.worker_security_group_id]
  
  snapshot_retention_limit = 7
  snapshot_window         = "03:00-05:00"
  
  tags = {
    Environment = "production"
  }
}

# S3 Buckets
resource "aws_s3_bucket" "uploads" {
  bucket = "contract-mgmt-uploads-prod"
  
  tags = {
    Environment = "production"
  }
}

resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_encryption" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# CloudFront CDN
module "cdn" {
  source = "./modules/cloudfront"
  
  origin_domain_name = module.alb.dns_name
  s3_bucket_domain   = aws_s3_bucket.uploads.bucket_regional_domain_name
  
  aliases = ["app.contractmanagement.com", "cdn.contractmanagement.com"]
  
  price_class = "PriceClass_100"
  
  geo_restriction = {
    restriction_type = "none"
  }
  
  tags = {
    Environment = "production"
  }
}
Helm Charts
yaml# helm/contract-management/values.yaml
global:
  environment: production
  domain: contractmanagement.com
  
api:
  replicaCount: 3
  image:
    repository: contractmgmt/api
    tag: latest
    pullPolicy: Always
  
  service:
    type: ClusterIP
    port: 8000
  
  ingress:
    enabled: true
    annotations:
      kubernetes.io/ingress.class: nginx
      cert-manager.io/cluster-issuer: letsencrypt-prod
    hosts:
      - host: api.contractmanagement.com
        paths:
          - path: /
            pathType: Prefix
    tls:
      - secretName: api-tls
        hosts:
          - api.contractmanagement.com
  
  resources:
    requests:
      memory: "256Mi"
      cpu: "250m"
    limits:
      memory: "512Mi"
      cpu: "500m"
  
  autoscaling:
    enabled: true
    minReplicas: 3
    maxReplicas: 10
    targetCPUUtilizationPercentage: 70
    targetMemoryUtilizationPercentage: 80
  
  env:
    - name: NODE_ENV
      value: production
    - name: DATABASE_URL
      valueFrom:
        secretKeyRef:
          name: app-secrets
          key: DATABASE_URL

frontend:
  replicaCount: 2
  image:
    repository: contractmgmt/frontend
    tag: latest
    pullPolicy: Always
  
  service:
    type: ClusterIP
    port: 80
  
  ingress:
    enabled: true
    annotations:
      kubernetes.io/ingress.class: nginx
      cert-manager.io/cluster-issuer: letsencrypt-prod
    hosts:
      - host: app.contractmanagement.com
        paths:
          - path: /
            pathType: Prefix
    tls:
      - secretName: frontend-tls
        hosts:
          - app.contractmanagement.com

redis:
  enabled: true
  architecture: replication
  auth:
    enabled: true
    password: changeme
  master:
    persistence:
      enabled: true
      size: 8Gi
  replica:
    replicaCount: 2
    persistence:
      enabled: true
      size: 8Gi

postgresql:
  enabled: false  # Using RDS

monitoring:
  enabled: true
  prometheus:
    enabled: true
  grafana:
    enabled: true
    adminPassword: changeme
Monitoring & Logging
Prometheus Configuration
yaml# k8s/monitoring/prometheus-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: monitoring
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
      evaluation_interval: 15s
    
    scrape_configs:
    - job_name: 'kubernetes-apiservers'
      kubernetes_sd_configs:
      - role: endpoints
      scheme: https
      tls_config:
        ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
      bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
      relabel_configs:
      - source_labels: [__meta_kubernetes_namespace, __meta_kubernetes_service_name, __meta_kubernetes_endpoint_port_name]
        action: keep
        regex: default;kubernetes;https
    
    - job_name: 'contract-management-api'
      kubernetes_sd_configs:
      - role: pod
        namespaces:
          names:
          - contract-management
      relabel_configs:
      - source_labels: [__meta_kubernetes_pod_label_app]
        action: keep
        regex: api
      - source_labels: [__meta_kubernetes_pod_name]
        target_label: pod
      - source_labels: [__meta_kubernetes_namespace]
        target_label: namespace
Grafana Dashboards
json{
  "dashboard": {
    "title": "Contract Management System",
    "panels": [
      {
        "title": "API Request Rate",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{job=\"contract-management-api\"}[5m])) by (method, status)"
          }
        ]
      },
      {
        "title": "Response Time",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job=\"contract-management-api\"}[5m])) by (le, method))"
          }
        ]
      },
      {
        "title": "Active Contracts",
        "targets": [
          {
            "expr": "contracts_active_total"
          }
        ]
      },
      {
        "title": "Database Connections",
        "targets": [
          {
            "expr": "pg_stat_database_numbackends{datname=\"contracts\"}"
          }
        ]
      }
    ]
  }
}
Logging Configuration
yaml# k8s/logging/fluentd-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fluentd-config
  namespace: logging
data:
  fluent.conf: |
    <source>
      @type tail
      path /var/log/containers/*.log
      pos_file /var/log/fluentd-containers.log.pos
      tag kubernetes.*
      read_from_head true
      <parse>
        @type json
        time_format %Y-%m-%dT%H:%M:%S.%NZ
      </parse>
    </source>
    
    <filter kubernetes.**>
      @type kubernetes_metadata
      @id filter_kube_metadata
      kubernetes_url "#{ENV['KUBERNETES_URL']}"
      verify_ssl "#{ENV['KUBERNETES_VERIFY_SSL']}"
    </filter>
    
    <filter kubernetes.var.log.containers.**.log>
      @type parser
      key_name log
      reserve_data true
      remove_key_name_field true
      <parse>
        @type json
      </parse>
    </filter>
    
    <match **>
      @type elasticsearch
      @id out_es
      @log_level info
      include_tag_key true
      host "#{ENV['ELASTICSEARCH_HOST']}"
      port "#{ENV['ELASTICSEARCH_PORT']}"
      scheme "#{ENV['ELASTICSEARCH_SCHEME']}"
      ssl_verify "#{ENV['ELASTICSEARCH_SSL_VERIFY']}"
      user "#{ENV['ELASTICSEARCH_USER']}"
      password "#{ENV['ELASTICSEARCH_PASSWORD']}"
      logstash_format true
      logstash_prefix kubernetes
      reconnect_on_error true
      reload_on_failure true
      reload_connections false
      request_timeout 120s
      <buffer>
        @type file
        path /var/log/fluentd-buffers/kubernetes.system.buffer
        flush_mode interval
        retry_type exponential_backoff
        flush_thread_count 2
        flush_interval 5s
        retry_forever
        retry_max_interval 30
        chunk_limit_size 2M
        queue_limit_length 8
        overflow_action block
      </buffer>
    </match>
Scaling Strategy
Auto-scaling Configuration
yaml# k8s/autoscaling/cluster-autoscaler.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cluster-autoscaler
  namespace: kube-system
spec:
  template:
    spec:
      containers:
      - image: k8s.gcr.io/autoscaling/cluster-autoscaler:v1.28.0
        name: cluster-autoscaler
        command:
        - ./cluster-autoscaler
        - --v=4
        - --stderrthreshold=info
        - --cloud-provider=aws
        - --skip-nodes-with-local-storage=false
        - --expander=least-waste
        - --node-group-auto-discovery=asg:tag=k8s.io/cluster-autoscaler/enabled,k8s.io/cluster-autoscaler/contract-mgmt-cluster
        - --balance-similar-node-groups
        - --skip-nodes-with-system-pods=false
Performance Tuning
javascript// backend/config/performance.js
module.exports = {
  // Connection pooling
  database: {
    pool: {
      min: process.env.DB_POOL_MIN || 10,
      max: process.env.DB_POOL_MAX || 50,
      idle: 10000,
      acquire: 30000,
      evict: 60000
    }
  },
  
  // Redis connection
  redis: {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    maxLoadingRetryTime: 10000,
    reconnectOnError: (err) => {
      const targetError = 'READONLY';
      if (err.message.includes(targetError)) {
        return true;
      }
      return false;
    }
  },
  
  // Request handling
  server: {
    keepAliveTimeout: 65000,
    headersTimeout: 66000,
    maxHeaderSize: 16384,
    timeout: 120000
  },
  
  // Clustering
  cluster: {
    workers: process.env.CLUSTER_WORKERS || 'auto',
    restartDelay: 1000,
    maxRestarts: 10
  }
};
Disaster Recovery
Backup Strategy
bash#!/bin/bash
# scripts/backup.sh

set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/$TIMESTAMP"

echo "Starting backup at $TIMESTAMP"

# Database backup
echo "Backing up database..."
pg_dump $DATABASE_URL | gzip > $BACKUP_DIR/database.sql.gz

# Redis backup
echo "Backing up Redis..."
redis-cli --rdb $BACKUP_DIR/redis.rdb

# S3 sync
echo "Backing up S3..."
aws s3 sync s3://$S3_BUCKET s3://$S3_BACKUP_BUCKET/backups/$TIMESTAMP/

# Kubernetes configs
echo "Backing up Kubernetes configurations..."
kubectl get all --all-namespaces -o yaml > $BACKUP_DIR/k8s-resources.yaml

# Upload to backup location
aws s3 sync $BACKUP_DIR s3://$S3_BACKUP_BUCKET/backups/$TIMESTAMP/

# Verify backup
./scripts/verify-backup.sh $TIMESTAMP

echo "Backup completed successfully"
Recovery Procedures
bash#!/bin/bash
# scripts/restore.sh

set -e

BACKUP_TIMESTAMP=$1

if [ -z "$BACKUP_TIMESTAMP" ]; then
    echo "Usage: ./restore.sh <backup_timestamp>"
    exit 1
fi

echo "Starting restore from backup $BACKUP_TIMESTAMP"

# Download backup
aws s3 sync s3://$S3_BACKUP_BUCKET/backups/$BACKUP_TIMESTAMP/ /tmp/restore/

# Restore database
echo "Restoring database..."
gunzip -c /tmp/restore/database.sql.gz | psql $DATABASE_URL

# Restore Redis
echo "Restoring Redis..."
redis-cli --pipe < /tmp/restore/redis.rdb

# Restore S3
echo "Restoring S3 files..."
aws s3 sync /tmp/restore/s3/ s3://$S3_BUCKET/

# Update Kubernetes
echo "Updating Kubernetes resources..."
kubectl apply -f /tmp/restore/k8s-resources.yaml

echo "Restore completed successfully"
Deployment Checklist
Pre-Deployment

 Code Review

 All PRs reviewed and approved
 No critical issues in code analysis
 Security scan passed


 Testing

 All unit tests passing
 Integration tests passing
 E2E tests passing
 Performance benchmarks met


 Documentation

 API documentation updated
 Deployment notes prepared
 Runbook updated



Deployment

 Infrastructure

 Database migrations tested
 Infrastructure changes applied
 Secrets updated
 Monitoring configured


 Application

 Images built and pushed
 Kubernetes manifests updated
 Environment variables verified
 Feature flags configured


 Verification

 Health checks passing
 Smoke tests completed
 Metrics flowing
 Logs accessible



Post-Deployment

 Monitoring

 Error rates normal
 Performance metrics stable
 No unusual patterns
 Alerts configured


 Communication

 Team notified
 Release notes published
 Customer communication sent
 Documentation updated


 Cleanup

 Old resources removed
 Temporary files cleaned
 Previous versions archived
 Costs optimized



Rollback Procedures
bash#!/bin/bash
# scripts/rollback.sh

PREVIOUS_VERSION=$1

echo "Rolling back to version $PREVIOUS_VERSION"

# Rollback Kubernetes deployments
kubectl rollout undo deployment/api -n contract-management
kubectl rollout undo deployment/frontend -n contract-management
kubectl rollout undo deployment/worker -n contract-management

# Wait for rollback
kubectl rollout status deployment/api -n contract-management
kubectl rollout status deployment/frontend -n contract-management

# Restore database if needed
if [ "$ROLLBACK_DATABASE" = "true" ]; then
    ./scripts/restore-db.sh $PREVIOUS_VERSION
fi

# Clear caches
kubectl exec -it $(kubectl get pod -l app=api -n contract-management -o jsonpath="{.items[0].metadata.name}") \
    -n contract-management -- npm run cache:clear

# Verify rollback
./scripts/health-check.sh

echo "Rollback completed"
Conclusion
This deployment architecture provides a robust, scalable, and maintainable infrastructure for the Contract Management System. Regular reviews and updates of these procedures ensure smooth deployments and quick recovery from any issues.

Now let me continue with the remaining documentation files:

## **docs/guides/setup.md**

```markdown
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

## **docs/guides/development.md**

```markdown
# Development Guide

## Table of Contents
1. [Development Philosophy](#development-philosophy)
2. [Code Structure](#code-structure)
3. [Development Workflow](#development-workflow)
4. [Coding Standards](#coding-standards)
5. [API Development](#api-development)
6. [Frontend Development](#frontend-development)
7. [Database Development](#database-development)
8. [Testing Strategy](#testing-strategy)
9. [Performance Guidelines](#performance-guidelines)
10. [Security Guidelines](#security-guidelines)

## Development Philosophy

### Core Principles

1. **Clean Code**: Write code that is easy to read, understand, and maintain
2. **DRY (Don't Repeat Yourself)**: Avoid duplication, extract common functionality
3. **SOLID Principles**: Follow object-oriented design principles
4. **Test-Driven Development**: Write tests first, then implementation
5. **Continuous Refactoring**: Improve code quality incrementally

### Architecture Patterns

- **Backend**: Service-oriented architecture with clear separation of concerns
- **Frontend**: Component-based architecture with hooks and context
- **Database**: Repository pattern with migrations and seeders
- **API**: RESTful design with consistent naming and responses

## Code Structure

### Backend Structure
backend/
├── server.js          # Application entry point
├── app.js            # Express app configuration
├── config/           # Configuration files
│   ├── index.js     # Main config
│   └── database.js  # Database config
├── controllers/      # Request handlers
│   └── contractController.js
├── services/         # Business logic
│   └── ContractService.js
├── models/          # Data models
│   └── Contract.js
├── middleware/      # Express middleware
│   ├── auth.js
│   └── validation.js
├── routes/          # API routes
│   └── contracts.js
├── utils/           # Utility functions
│   └── helpers.js
└── tests/           # Test files
└── contracts.test.js

### Frontend Structure
frontend/
├── src/
│   ├── components/      # React components
│   │   ├── common/     # Shared components
│   │   └── contracts/  # Feature components
│   ├── hooks/          # Custom hooks
│   │   └── useContracts.js
│   ├── services/       # API services
│   │   └── api.js
│   ├── store/          # State management
│   │   └── contractSlice.js
│   ├── utils/          # Utilities
│   │   └── constants.js
│   └── App.js          # Root component
└── tests/              # Test files

## Development Workflow

### 1. Feature Development

```bash
# Create feature branch
git checkout -b feature/contract-templates

# Make changes
# ... code ...

# Run tests
npm test

# Commit changes
git add .
git commit -m "feat: add contract template functionality"

# Push branch
git push origin feature/contract-templates

# Create pull request
2. Git Workflow
bash# Commit message format
<type>(<scope>): <subject>

# Types:
# feat: New feature
# fix: Bug fix
# docs: Documentation
# style: Code style
# refactor: Code refactoring
# test: Testing
# chore: Maintenance

# Examples:
git commit -m "feat(contracts): add bulk export functionality"
git commit -m "fix(auth): resolve token expiration issue"
git commit -m "docs(api): update contract endpoint documentation"
3. Code Review Process

Self Review: Review your own code first
Automated Checks: Ensure CI/CD passes
Peer Review: Request review from team members
Address Feedback: Make requested changes
Merge: Squash and merge when approved

Coding Standards
JavaScript/TypeScript Standards
javascript// Use meaningful variable names
// ❌ Bad
const d = new Date();
const u = users.filter(x => x.a);

// ✅ Good
const currentDate = new Date();
const activeUsers = users.filter(user => user.isActive);

// Use async/await over promises
// ❌ Bad
function getUser(id) {
  return User.findById(id)
    .then(user => {
      return processUser(user);
    })
    .catch(error => {
      console.error(error);
    });
}

// ✅ Good
async function getUser(id) {
  try {
    const user = await User.findById(id);
    return await processUser(user);
  } catch (error) {
    console.error(error);
    throw error;
  }
}

// Use destructuring
// ❌ Bad
const name = user.name;
const email = user.email;

// ✅ Good
const { name, email } = user;

// Use template literals
// ❌ Bad
const message = 'Hello ' + name + ', welcome to ' + appName;

// ✅ Good
const message = `Hello ${name}, welcome to ${appName}`;
React Standards
jsx// Use functional components with hooks
// ❌ Bad
class ContractList extends React.Component {
  constructor(props) {
    super(props);
    this.state = { contracts: [] };
  }
  
  componentDidMount() {
    this.loadContracts();
  }
  
  render() {
    return <div>{/* ... */}</div>;
  }
}

// ✅ Good
const ContractList = () => {
  const [contracts, setContracts] = useState([]);
  
  useEffect(() => {
    loadContracts();
  }, []);
  
  return <div>{/* ... */}</div>;
};

// Use proper prop types
import PropTypes from 'prop-types';

ContractList.propTypes = {
  userId: PropTypes.string.isRequired,
  onSelect: PropTypes.func.isRequired,
  filters: PropTypes.shape({
    status: PropTypes.string,
    type: PropTypes.string
  })
};

// Extract complex logic to custom hooks
const useContracts = (userId) => {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchContracts = async () => {
      try {
        setLoading(true);
        const data = await contractService.getByUser(userId);
        setContracts(data);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchContracts();
  }, [userId]);
  
  return { contracts, loading, error };
};
CSS/Styling Standards
css/* Use CSS Modules or styled-components */
/* Use semantic class names */
/* Follow BEM naming convention */

/* ❌ Bad */
.btn-1 {
  background: red;
}

.x {
  margin: 10px;
}

/* ✅ Good */
.contract-list__button {
  background-color: var(--color-primary);
}

.contract-list__item--active {
  margin: var(--spacing-md);
}

/* Use CSS variables for consistency */
:root {
  --color-primary: #007bff;
  --color-secondary: #6c757d;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --border-radius: 4px;
}
API Development
RESTful Design
javascript// Route naming conventions
// GET /api/v1/contracts         - List all contracts
// GET /api/v1/contracts/:id     - Get specific contract
// POST /api/v1/contracts        - Create contract
// PUT /api/v1/contracts/:id     - Update contract
// DELETE /api/v1/contracts/:id  - Delete contract

// Nested resources
// GET /api/v1/contracts/:id/comments      - Get contract comments
// POST /api/v1/contracts/:id/comments     - Add comment
// GET /api/v1/contracts/:id/versions      - Get versions
// POST /api/v1/contracts/:id/approve      - Approve contract
Controller Pattern
javascript// controllers/contractController.js
class ContractController {
  constructor(contractService) {
    this.contractService = contractService;
  }
  
  async list(req, res, next) {
    try {
      const { page = 1, limit = 20, ...filters } = req.query;
      
      const contracts = await this.contractService.list({
        userId: req.user.id,
        page: parseInt(page),
        limit: parseInt(limit),
        filters
      });
      
      res.json({
        success: true,
        data: contracts,
        meta: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: contracts.total
        }
      });
    } catch (error) {
      next(error);
    }
  }
  
  async create(req, res, next) {
    try {
      const contract = await this.contractService.create({
        ...req.body,
        createdBy: req.user.id
      });
      
      res.status(201).json({
        success: true,
        data: contract
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ContractController;
Service Layer
javascript// services/ContractService.js
class ContractService {
  constructor({ contractRepository, eventEmitter, validator }) {
    this.contractRepository = contractRepository;
    this.eventEmitter = eventEmitter;
    this.validator = validator;
  }
  
  async create(data) {
    // Validate input
    const validated = await this.validator.validate(data, 'contract.create');
    
    // Business logic
    const contract = await this.contractRepository.create({
      ...validated,
      status: 'draft',
      version: 1
    });
    
    // Emit events
    this.eventEmitter.emit('contract.created', contract);
    
    return contract;
  }
  
  async approve(contractId, userId) {
    const contract = await this.contractRepository.findById(contractId);
    
    if (!contract) {
      throw new NotFoundError('Contract not found');
    }
    
    if (contract.status !== 'pending_approval') {
      throw new ValidationError('Contract must be pending approval');
    }
    
    // Check permissions
    if (!this.canApprove(contract, userId)) {
      throw new ForbiddenError('User cannot approve this contract');
    }
    
    // Update status
    const updated = await this.contractRepository.update(contractId, {
      status: 'approved',
      approvedBy: userId,
      approvedAt: new Date()
    });
    
    // Emit event
    this.eventEmitter.emit('contract.approved', updated);
    
    return updated;
  }
}

module.exports = ContractService;
Error Handling
javascript// middleware/errorHandler.js
const errorHandler = (err, req, res, next) => {
  // Log error
  logger.error({
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id
  });
  
  // Determine status code
  const statusCode = err.statusCode || 500;
  
  // Send response
  res.status(statusCode).json({
    success: false,
    error: {
      message: err.message,
      code: err.code || 'INTERNAL_ERROR',
      ...(process.env.NODE_ENV === 'development' && {
        stack: err.stack
      })
    }
  });
};

// Custom error classes
class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

class NotFoundError extends AppError {
  constructor(message) {
    super(message, 404, 'NOT_FOUND');
  }
}

class ForbiddenError extends AppError {
  constructor(message) {
    super(message, 403, 'FORBIDDEN');
  }
}
Frontend Development
Component Structure
jsx// components/contracts/ContractForm.jsx
import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useForm } from 'react-hook-form';
import { useDispatch } from 'react-redux';
import { createContract } from '../../store/contractSlice';
import { Button, Input, Select } from '../common';

const ContractForm = ({ onSubmit, initialData = {} }) => {
  const dispatch = useDispatch();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm({
    defaultValues: initialData
  });
  
  const handleFormSubmit = useCallback(async (data) => {
    try {
      setIsSubmitting(true);
      await dispatch(createContract(data)).unwrap();
      reset();
      onSubmit?.(data);
    } catch (error) {
      console.error('Failed to create contract:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [dispatch, onSubmit, reset]);
  
  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="contract-form">
      <Input
        label="Contract Title"
        {...register('title', {
          required: 'Title is required',
          minLength: {
            value: 3,
            message: 'Title must be at least 3 characters'
          }
        })}
        error={errors.title?.message}
      />
      
      <Select
        label="Contract Type"
        {...register('type', { required: 'Type is required' })}
        error={errors.type?.message}
        options={[
          { value: 'service', label: 'Service Agreement' },
          { value: 'nda', label: 'Non-Disclosure Agreement' },
          { value: 'employment', label: 'Employment Contract' }
        ]}
      />
      
      <Button
        type="submit"
        disabled={isSubmitting}
        loading={isSubmitting}
      >
        Create Contract
      </Button>
    </form>
  );
};

ContractForm.propTypes = {
  onSubmit: PropTypes.func,
  initialData: PropTypes.object
};

export default ContractForm;
State Management
javascript// store/contractSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import contractService from '../services/contractService';

// Async thunks
export const fetchContracts = createAsyncThunk(
  'contracts/fetchContracts',
  async ({ page, filters }) => {
    const response = await contractService.list({ page, ...filters });
    return response.data;
  }
);

export const createContract = createAsyncThunk(
  'contracts/createContract',
  async (contractData) => {
    const response = await contractService.create(contractData);
    return response.data;
  }
);

// Slice
const contractSlice = createSlice({
  name: 'contracts',
  initialState: {
    items: [],
    selectedContract: null,
    loading: false,
    error: null,
    pagination: {
      page: 1,
      limit: 20,
      total: 0
    }
  },
  reducers: {
    selectContract: (state, action) => {
      state.selectedContract = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch contracts
      .addCase(fetchContracts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchContracts.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.contracts;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchContracts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      // Create contract
      .addCase(createContract.fulfilled, (state, action) => {
        state.items.unshift(action.payload);
      });
  }
});

export const { selectContract, clearError } = contractSlice.actions;
export default contractSlice.reducer;
Custom Hooks
javascript// hooks/useWebSocket.js
import { useEffect, useRef, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import io from 'socket.io-client';

export const useWebSocket = (url, options = {}) => {
  const socket = useRef(null);
  const dispatch = useDispatch();
  
  useEffect(() => {
    socket.current = io(url, {
      transports: ['websocket'],
      ...options
    });
    
    socket.current.on('connect', () => {
      console.log('WebSocket connected');
    });
    
    socket.current.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });
    
    socket.current.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
    
    return () => {
      socket.current?.disconnect();
    };
  }, [url]);
  
  const emit = useCallback((event, data) => {
    socket.current?.emit(event, data);
  }, []);
  
  const on = useCallback((event, handler) => {
    socket.current?.on(event, handler);
    
    return () => {
      socket.current?.off(event, handler);
    };
  }, []);
  
  return { socket: socket.current, emit, on };
};

// Usage
const ContractEditor = ({ contractId }) => {
  const { emit, on } = useWebSocket('/contracts');
  
  useEffect(() => {
    const unsubscribe = on('contract:updated', (data) => {
      if (data.contractId === contractId) {
        // Update local state
      }
    });
    
    return unsubscribe;
  }, [contractId, on]);
  
  const handleEdit = (changes) => {
    emit('contract:edit', { contractId, changes });
  };
  
  return <div>{/* Editor UI */}</div>;
};
Database Development
Migration Pattern
javascript// migrations/20240101_create_contracts_table.js
exports.up = async (knex) => {
  await knex.schema.createTable('contracts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('title', 500).notNullable();
    table.text('description');
    table.enum('type', ['service', 'nda', 'employment', 'sales', 'other']).notNullable();
    table.enum('status', ['draft', 'pending_review', 'approved', 'active', 'expired']).defaultTo('draft');
    table.decimal('value', 15, 2);
    table.string('currency', 3).defaultTo('USD');
    table.date('start_date');
    table.date('end_date');
    table.uuid('created_by').notNullable().references('id').inTable('users');
    table.timestamps(true, true);
    
    // Indexes
    table.index(['status', 'created_by']);
    table.index('created_at');
  });
  
  // Add trigger for updated_at
  await knex.raw(`
    CREATE TRIGGER update_contracts_updated_at
    BEFORE UPDATE ON contracts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `);
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('contracts');
};
Repository Pattern
javascript// repositories/ContractRepository.js
class ContractRepository {
  constructor(db) {
    this.db = db;
  }
  
  async findById(id) {
    const contract = await this.db('contracts')
      .where({ id })
      .first();
    
    if (!contract) return null;
    
    // Load relationships
    const [parties, attachments] = await Promise.all([
      this.db('contract_parties').where({ contract_id: id }),
      this.db('attachments').where({ contract_id: id })
    ]);
    
    return {
      ...contract,
      parties,
      attachments
    };
  }
  
  async list({ userId, page = 1, limit = 20, filters = {} }) {
    const query = this.db('contracts')
      .where({ created_by: userId });
    
    // Apply filters
    if (filters.status) {
      query.where({ status: filters.status });
    }
    
    if (filters.type) {
      query.where({ type: filters.type });
    }
    
    if (filters.search) {
      query.where((builder) => {
        builder
          .where('title', 'ilike', `%${filters.search}%`)
          .orWhere('description', 'ilike', `%${filters.search}%`);
      });
    }
    
    // Get total count
    const [{ count }] = await query.clone().count('* as count');
    
    // Get paginated results
    const contracts = await query
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset((page - 1) * limit);
    
    return {
      contracts,
      total: parseInt(count),
      page,
      limit,
      pages: Math.ceil(count / limit)
    };
  }
  
  async create(data) {
    return this.db.transaction(async (trx) => {
      const { parties, ...contractData } = data;
      
      // Insert contract
      const [contract] = await trx('contracts')
        .insert(contractData)
        .returning('*');
      
      // Insert parties if provided
      if (parties && parties.length > 0) {
        const partyData = parties.map(party => ({
          contract_id: contract.id,
          ...party
        }));
        
        await trx('contract_parties').insert(partyData);
      }
      
      // Create initial version
      await trx('contract_versions').insert({
        contract_id: contract.id,
        version_number: 1,
        content: contractData.content,
        created_by: contractData.created_by
      });
      
      return contract;
    });
  }
  
  async update(id, data) {
    return this.db.transaction(async (trx) => {
      const [updated] = await trx('contracts')
        .where({ id })
        .update({
          ...data,
          updated_at: new Date()
        })
        .returning('*');
      
      // Create version if content changed
      if (data.content) {
        const lastVersion = await trx('contract_versions')
          .where({ contract_id: id })
          .orderBy('version_number', 'desc')
          .first();
        
        await trx('contract_versions').insert({
          contract_id: id,
          version_number: (lastVersion?.version_number || 0) + 1,
          content: data.content,
          created_by: data.updated_by
        });
      }
      
      return updated;
    });
  }
}

module.exports = ContractRepository;
Testing Strategy
Unit Testing
javascript// tests/unit/services/ContractService.test.js
const ContractService = require('../../../services/ContractService');
const { ValidationError, NotFoundError } = require('../../../utils/errors');

describe('ContractService', () => {
  let contractService;
  let mockRepository;
  let mockEventEmitter;
  let mockValidator;
  
  beforeEach(() => {
    mockRepository = {
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    };
    
    mockEventEmitter = {
      emit: jest.fn()
    };
    
    mockValidator = {
      validate: jest.fn()
    };
    
    contractService = new ContractService({
      contractRepository: mockRepository,
      eventEmitter: mockEventEmitter,
      validator: mockValidator
    });
  });
  
  describe('create', () => {
    it('should create a contract successfully', async () => {
      const inputData = {
        title: 'Test Contract',
        type: 'service',
        createdBy: 'user-123'
      };
      
      const validatedData = { ...inputData };
      const createdContract = { id: 'contract-123', ...validatedData, status: 'draft' };
      
      mockValidator.validate.mockResolvedValue(validatedData);
      mockRepository.create.mockResolvedValue(createdContract);
      
      const result = await contractService.create(inputData);
      
      expect(mockValidator.validate).toHaveBeenCalledWith(inputData, 'contract.create');
      expect(mockRepository.create).toHaveBeenCalledWith({
        ...validatedData,
        status: 'draft',
        version: 1
      });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('contract.created', createdContract);
      expect(result).toEqual(createdContract);
    });
    
    it('should throw validation error for invalid data', async () => {
      const invalidData = { title: '' };
      
      mockValidator.validate.mockRejectedValue(new ValidationError('Title is required'));
      
      await expect(contractService.create(invalidData)).rejects.toThrow(ValidationError);
      expect(mockRepository.create).not.toHaveBeenCalled();
      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });
  });
  
  describe('approve', () => {
    it('should approve a contract in pending status', async () => {
      const contractId = 'contract-123';
      const userId = 'user-123';
      const contract = {
        id: contractId,
        status: 'pending_approval',
        approvers: [userId]
      };
      
      mockRepository.findById.mockResolvedValue(contract);
      mockRepository.update.mockResolvedValue({
        ...contract,
        status: 'approved',
        approvedBy: userId,
        approvedAt: expect.any(Date)
      });
      
      const result = await contractService.approve(contractId, userId);
      
      expect(result.status).toBe('approved');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('contract.approved', expect.any(Object));
    });
    
    it('should throw error if contract not found', async () => {
      mockRepository.findById.mockResolvedValue(null);
      
      await expect(contractService.approve('invalid-id', 'user-123'))
        .rejects.toThrow(NotFoundError);
    });
  });
});
Integration Testing
javascript// tests/integration/contracts.test.js
const request = require('supertest');
const app = require('../../app');
const { setupDatabase, teardownDatabase, createUser, createContract } = require('../helpers');

describe('Contract API', () => {
  let authToken;
  let userId;
  
  beforeAll(async () => {
    await setupDatabase();
  });
  
  afterAll(async () => {
    await teardownDatabase();
  });
  
  beforeEach(async () => {
    const user = await createUser({
      email: 'test@example.com',
      password: 'Test123!'
    });
    
    userId = user.id;
    
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'test@example.com',
        password: 'Test123!'
      });
    
    authToken = loginResponse.body.token;
  });
  
  describe('POST /api/v1/contracts', () => {
    it('should create a new contract', async () => {
      const contractData = {
        title: 'Service Agreement',
        type: 'service',
        description: 'Test service agreement',
        value: 5000,
        currency: 'USD'
      };
      
      const response = await request(app)
        .post('/api/v1/contracts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(contractData)
        .expect(201);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        title: contractData.title,
        type: contractData.type,
        status: 'draft',
        created_by: userId
      });
    });
    
    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/v1/contracts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
  
  describe('GET /api/v1/contracts', () => {
    beforeEach(async () => {
      // Create test contracts
      await Promise.all([
        createContract({ title: 'Contract 1', created_by: userId, status: 'draft' }),
        createContract({ title: 'Contract 2', created_by: userId, status: 'active' }),
        createContract({ title: 'Contract 3', created_by: userId, status: 'active' })
      ]);
    });
    
    it('should list user contracts', async () => {
      const response = await request(app)
        .get('/api/v1/contracts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.contracts).toHaveLength(3);
      expect(response.body.meta.total).toBe(3);
    });
    
    it('should filter contracts by status', async () => {
      const response = await request(app)
        .get('/api/v1/contracts?status=active')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body.data.contracts).toHaveLength(2);
      expect(response.body.data.contracts.every(c => c.status === 'active')).toBe(true);
    });
    
    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/v1/contracts?page=1&limit=2')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body.data.contracts).toHaveLength(2);
      expect(response.body.meta).toMatchObject({
        page: 1,
        limit: 2,
        total: 3,
        pages: 2
      });
    });
  });
});
E2E Testing
javascript// tests/e2e/contract-workflow.test.js
const { chromium } = require('playwright');

describe('Contract Workflow E2E', () => {
  let browser;
  let page;
  
  beforeAll(async () => {
    browser = await chromium.launch();
  });
  
  afterAll(async () => {
    await browser.close();
  });
  
  beforeEach(async () => {
    page = await browser.newPage();
    await page.goto('http://localhost:3000');
  });
  
  afterEach(async () => {
    await page.close();
  });
  
  it('should complete contract creation workflow', async () => {
    // Login
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'Test123!');
    await page.click('[data-testid="login-button"]');
    
    // Wait for redirect
    await page.waitForURL('**/dashboard');
    
    // Navigate to contracts
    await page.click('[data-testid="nav-contracts"]');
    await page.click('[data-testid="create-contract-button"]');
    
    // Fill contract form
    await page.fill('[data-testid="contract-title"]', 'E2E Test Contract');
    await page.selectOption('[data-testid="contract-type"]', 'service');
    await page.fill('[data-testid="contract-value"]', '10000');
    
    // Add party
    await page.click('[data-testid="add-party-button"]');
    await page.fill('[data-testid="party-name-0"]', 'Test Client');
    await page.fill('[data-testid="party-email-0"]', 'client@example.com');
    
    // Submit
    await page.click('[data-testid="submit-contract-button"]');
    
    // Verify success
    await page.waitForSelector('[data-testid="success-message"]');
    const successText = await page.textContent('[data-testid="success-message"]');
    expect(successText).toContain('Contract created successfully');
    
    // Verify in list
    await page.click('[data-testid="nav-contracts"]');
    const contractTitle = await page.textContent('[data-testid="contract-list"] >> text=E2E Test Contract');
    expect(contractTitle).toBeTruthy();
  });
});
Performance Guidelines
Backend Performance
javascript// Use database connection pooling
const pool = new Pool({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Implement caching
const Redis = require('ioredis');
const redis = new Redis();

const cacheMiddleware = (duration = 60) => {
  return async (req, res, next) => {
    const key = `cache:${req.originalUrl}`;
    
    try {
      const cached = await redis.get(key);
      if (cached) {
        return res.json(JSON.parse(cached));
      }
    } catch (error) {
      console.error('Cache error:', error);
    }
    
    res.sendResponse = res.json;
    res.json = async (body) => {
      await redis.setex(key, duration, JSON.stringify(body));
      res.sendResponse(body);
    };
    
    next();
  };
};

// Use pagination
const paginate = (query, page = 1, limit = 20) => {
  const offset = (page - 1) * limit;
  return query.limit(limit).offset(offset);
};

// Optimize queries
// ❌ Bad - N+1 query
const contracts = await db('contracts').select('*');
for (const contract of contracts) {
  contract.parties = await db('parties').where({ contract_id: contract.id });
}

// ✅ Good - Single query with join
const contracts = await db('contracts')
  .leftJoin('contract_parties', 'contracts.id', 'contract_parties.contract_id')
  .leftJoin('parties', 'contract_parties.party_id', 'parties.id')
  .select('contracts.*', db.raw('array_agg(parties.*) as parties'))
  .groupBy('contracts.id');
Frontend Performance
javascript// Use React.memo for expensive components
const ExpensiveComponent = React.memo(({ data }) => {
  return <ComplexVisualization data={data} />;
}, (prevProps, nextProps) => {
  return prevProps.data.id === nextProps.data.id;
});

// Use useMemo for expensive calculations
const ContractStats = ({ contracts }) => {
  const stats = useMemo(() => {
    return contracts.reduce((acc, contract) => {
      acc.total += 1;
      acc.totalValue += contract.value || 0;
      acc.byStatus[contract.status] = (acc.byStatus[contract.status] || 0) + 1;
      return acc;
    }, { total: 0, totalValue: 0, byStatus: {} });
  }, [contracts]);
  
  return <StatsDisplay stats={stats} />;
};

// Lazy load components
const ContractEditor = lazy(() => import('./ContractEditor'));

const ContractPage = () => {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ContractEditor />
    </Suspense>
  );
};

// Debounce expensive operations
const SearchInput = ({ onSearch }) => {
  const [query, setQuery] = useState('');
  
  const debouncedSearch = useMemo(
    () => debounce(onSearch, 300),
    [onSearch]
  );
  
  useEffect(() => {
    debouncedSearch(query);
  }, [query, debouncedSearch]);
  
  return (
    <input
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder="Search contracts..."
    />
  );
};

// Virtual scrolling for large lists
import { FixedSizeList } from 'react-window';

const ContractList = ({ contracts }) => {
  const Row = ({ index, style }) => (
    <div style={style}>
      <ContractItem contract={contracts[index]} />
    </div>
  );
  
  return (
    <FixedSizeList
      height={600}
      itemCount={contracts.length}
      itemSize={80}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
};
Security Guidelines
Input Validation
javascript// Always validate and sanitize input
const { body, validationResult } = require('express-validator');
const DOMPurify = require('isomorphic-dompurify');

const validateContract = [
  body('title')
    .trim()
    .isLength({ min: 3, max: 200 })
    .escape(),
  body('content')
    .customSanitizer(value => DOMPurify.sanitize(value)),
  body('value')
    .optional()
    .isFloat({ min: 0 })
    .toFloat(),
  body('email')
    .isEmail()
    .normalizeEmail(),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];
Authentication & Authorization
javascript// Implement proper authentication
const authenticateToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(payload.userId);
    
    if (!req.user || !req.user.isActive) {
      return res.status(401).json({ error: 'Invalid user' });
    }
    
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Implement authorization
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// Check resource ownership
const checkOwnership = (model) => {
  return async (req, res, next) => {
    try {
      const resource = await model.findById(req.params.id);
      
      if (!resource) {
        return res.status(404).json({ error: 'Resource not found' });
      }
      
      if (resource.created_by !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      req.resource = resource;
      next();
    } catch (error) {
      next(error);
    }
  };
};
Security Headers
javascript// Use helmet for security headers
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Add custom security headers
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
Best Practices Summary

Code Quality

Write clean, readable code
Follow consistent naming conventions
Document complex logic
Keep functions small and focused


Testing

Write tests before code (TDD)
Aim for >80% code coverage
Test edge cases
Use meaningful test descriptions


Performance

Profile before optimizing
Use caching strategically
Optimize database queries
Implement pagination


Security

Never trust user input
Use parameterized queries
Implement proper authentication
Keep dependencies updated


Collaboration

Write meaningful commit messages
Review code thoroughly
Document APIs clearly
Share knowledge with team



Remember: Good code is written for humans to read, not just for computers to execute.

## **docs/guides/testing.md**

```markdown
# Testing Guide

## Table of Contents
1. [Testing Overview](#testing-overview)
2. [Testing Setup](#testing-setup)
3. [Unit Testing](#unit-testing)
4. [Integration Testing](#integration-testing)
5. [End-to-End Testing](#end-to-end-testing)
6. [Performance Testing](#performance-testing)
7. [Security Testing](#security-testing)
8. [Test Data Management](#test-data-management)
9. [Continuous Integration](#continuous-integration)
10. [Best Practices](#best-practices)

## Testing Overview

Our testing strategy follows the testing pyramid approach:
     /\
    /  \    E2E Tests (10%)
   /----\   
  /      \  Integration Tests (30%)
 /--------\
/          \ Unit Tests (60%)
/____________\

### Testing Stack

- **Unit Tests**: Jest, React Testing Library
- **Integration Tests**: Supertest, Jest
- **E2E Tests**: Playwright, Cypress
- **Performance Tests**: k6, Artillery
- **Security Tests**: OWASP ZAP, npm audit

### Coverage Goals

- Overall: >80%
- Critical paths: >95%
- New code: 100%

## Testing Setup

### Install Dependencies

```bash
# Backend testing
cd backend
npm install --save-dev jest @types/jest supertest @faker-js/faker

# Frontend testing
cd frontend
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event

# E2E testing
npm install --save-dev playwright @playwright/test
Jest Configuration
javascript// jest.config.js
module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/index.js',
    '!src/config/*.js',
    '!**/node_modules/**',
    '!**/vendor/**'
  ],
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)'
  ],
  transform: {
    '^.+\\.jsx?$': 'babel-jest'
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 10000
};
Test Setup File
javascript// tests/setup.js
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

beforeAll(async () => {
  // Setup in-memory database
  mongoServer = await MongoMemoryServer.create();
  process.env.DATABASE_URL = mongoServer.getUri();
  
  // Setup test environment
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret';
});

afterAll(async () => {
  // Cleanup
  await mongoServer.stop();
});

// Global test utilities
global.createTestUser = async (overrides = {}) => {
  const defaultUser = {
    email: 'test@example.com',
    password: 'Test123!',
    firstName: 'Test',
    lastName: 'User',
    role: 'user'
  };
  
  return User.create({ ...defaultUser, ...overrides });
};

// Mock external services
jest.mock('../src/services/EmailService', () => ({
  sendEmail: jest.fn().mockResolvedValue({ messageId: 'test-123' })
}));
Unit Testing
Testing Services
javascript// tests/unit/services/ContractService.test.js
const ContractService = require('../../../src/services/ContractService');
const ContractRepository = require('../../../src/repositories/ContractRepository');
const EventEmitter = require('events');

jest.mock('../../../src/repositories/ContractRepository');

describe('ContractService', () => {
  let contractService;
  let mockRepository;
  let mockEventEmitter;
  
  beforeEach(() => {
    mockRepository = new ContractRepository();
    mockEventEmitter = new EventEmitter();
    
    contractService = new ContractService({
      contractRepository: mockRepository,
      eventEmitter: mockEventEmitter
    });
    
    jest.clearAllMocks();
  });
  
  describe('createContract', () => {
    it('should create a contract with default values', async () => {
      // Arrange
      const contractData = {
        title: 'Test Contract',
        type: 'service',
        createdBy: 'user-123'
      };
      
      const expectedContract = {
        id: 'contract-123',
        ...contractData,
        status: 'draft',
        version: 1,
        createdAt: expect.any(Date)
      };
      
      mockRepository.create.mockResolvedValue(expectedContract);
      
      // Act
      const result = await contractService.createContract(contractData);
      
      // Assert
      expect(mockRepository.create).toHaveBeenCalledWith({
        ...contractData,
        status: 'draft',
        version: 1
      });
      expect(result).toEqual(expectedContract);
    });
    
    it('should emit contract.created event', async () => {
      // Arrange
      const contractData = { title: 'Test', type: 'service', createdBy: 'user-123' };
      const createdContract = { id: 'contract-123', ...contractData };
      
      mockRepository.create.mockResolvedValue(createdContract);
      
      const eventSpy = jest.fn();
      mockEventEmitter.on('contract.created', eventSpy);
      
      // Act
      await contractService.createContract(contractData);
      
      // Assert
      expect(eventSpy).toHaveBeenCalledWith(createdContract);
    });
    
    it('should validate required fields', async () => {
      // Arrange
      const invalidData = { title: '' };
      
      // Act & Assert
      await expect(contractService.createContract(invalidData))
        .rejects.toThrow('Title is required');
      
      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });
  
  describe('approveContract', () => {
    it('should approve contract when user has permission', async () => {
      // Arrange
      const contractId = 'contract-123';
      const userId = 'user-123';
      const contract = {
        id: contractId,
        status: 'pending_approval',
        approvers: [userId]
      };
      
      mockRepository.findById.mockResolvedValue(contract);
      mockRepository.update.mockResolvedValue({
        ...contract,
        status: 'approved',
        approvedBy: userId,
        approvedAt: expect.any(Date)
      });
      
      // Act
      const result = await contractService.approveContract(contractId, userId);
      
      // Assert
      expect(result.status).toBe('approved');
      expect(result.approvedBy).toBe(userId);
      expect(mockRepository.update).toHaveBeenCalledWith(
        contractId,
        expect.objectContaining({
          status: 'approved',
          approvedBy: userId
        })
      );
    });
    
    it('should throw error when contract is not pending approval', async () => {
      // Arrange
      const contract = {
        id: 'contract-123',
        status: 'draft'
      };
      
      mockRepository.findById.mockResolvedValue(contract);
      
      // Act & Assert
      await expect(contractService.approveContract('contract-123', 'user-123'))
        .rejects.toThrow('Contract must be in pending_approval status');
    });
  });
});
Testing React Components
javascript// tests/unit/components/ContractForm.test.jsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ContractForm from '../../../src/components/contracts/ContractForm';
import contractReducer from '../../../src/store/contractSlice';

javascript// Test utilities
const renderWithRedux = (component, { initialState = {}, store = null } = {}) => {
 const testStore = store || configureStore({
   reducer: { contracts: contractReducer },
   preloadedState: initialState
 });
 
 return {
   ...render(<Provider store={testStore}>{component}</Provider>),
   store: testStore
 };
};

describe('ContractForm', () => {
 let user;
 
 beforeEach(() => {
   user = userEvent.setup();
 });
 
 it('should render all form fields', () => {
   renderWithRedux(<ContractForm />);
   
   expect(screen.getByLabelText(/contract title/i)).toBeInTheDocument();
   expect(screen.getByLabelText(/contract type/i)).toBeInTheDocument();
   expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
   expect(screen.getByLabelText(/value/i)).toBeInTheDocument();
   expect(screen.getByRole('button', { name: /create contract/i })).toBeInTheDocument();
 });
 
 it('should validate required fields', async () => {
   const onSubmit = jest.fn();
   renderWithRedux(<ContractForm onSubmit={onSubmit} />);
   
   // Try to submit empty form
   await user.click(screen.getByRole('button', { name: /create contract/i }));
   
   // Check validation messages
   expect(await screen.findByText(/title is required/i)).toBeInTheDocument();
   expect(await screen.findByText(/type is required/i)).toBeInTheDocument();
   expect(onSubmit).not.toHaveBeenCalled();
 });
 
 it('should submit valid form data', async () => {
   const onSubmit = jest.fn();
   renderWithRedux(<ContractForm onSubmit={onSubmit} />);
   
   // Fill form
   await user.type(screen.getByLabelText(/contract title/i), 'Test Contract');
   await user.selectOptions(screen.getByLabelText(/contract type/i), 'service');
   await user.type(screen.getByLabelText(/description/i), 'Test description');
   await user.type(screen.getByLabelText(/value/i), '5000');
   
   // Submit
   await user.click(screen.getByRole('button', { name: /create contract/i }));
   
   // Verify submission
   await waitFor(() => {
     expect(onSubmit).toHaveBeenCalledWith({
       title: 'Test Contract',
       type: 'service',
       description: 'Test description',
       value: 5000
     });
   });
 });
 
 it('should handle submission errors', async () => {
   const error = new Error('Network error');
   const mockCreateContract = jest.fn().mockRejectedValue(error);
   
   // Mock the action
   jest.mock('../../../src/store/contractSlice', () => ({
     ...jest.requireActual('../../../src/store/contractSlice'),
     createContract: mockCreateContract
   }));
   
   renderWithRedux(<ContractForm />);
   
   // Fill and submit
   await user.type(screen.getByLabelText(/contract title/i), 'Test Contract');
   await user.selectOptions(screen.getByLabelText(/contract type/i), 'service');
   await user.click(screen.getByRole('button', { name: /create contract/i }));
   
   // Check error message
   expect(await screen.findByText(/failed to create contract/i)).toBeInTheDocument();
 });
 
 it('should disable form during submission', async () => {
   renderWithRedux(<ContractForm />);
   
   // Fill required fields
   await user.type(screen.getByLabelText(/contract title/i), 'Test Contract');
   await user.selectOptions(screen.getByLabelText(/contract type/i), 'service');
   
   // Submit
   const submitButton = screen.getByRole('button', { name: /create contract/i });
   await user.click(submitButton);
   
   // Check button is disabled
   expect(submitButton).toBeDisabled();
   expect(submitButton).toHaveTextContent(/creating/i);
 });
});
Testing Custom Hooks
javascript// tests/unit/hooks/useContracts.test.js
import { renderHook, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import useContracts from '../../../src/hooks/useContracts';
import contractReducer from '../../../src/store/contractSlice';
import * as contractService from '../../../src/services/contractService';

jest.mock('../../../src/services/contractService');

describe('useContracts', () => {
  let store;
  
  beforeEach(() => {
    store = configureStore({
      reducer: { contracts: contractReducer }
    });
    
    jest.clearAllMocks();
  });
  
  const wrapper = ({ children }) => (
    <Provider store={store}>{children}</Provider>
  );
  
  it('should fetch contracts on mount', async () => {
    const mockContracts = [
      { id: '1', title: 'Contract 1' },
      { id: '2', title: 'Contract 2' }
    ];
    
    contractService.fetchContracts.mockResolvedValue({
      data: { contracts: mockContracts, total: 2 }
    });
    
    const { result } = renderHook(() => useContracts(), { wrapper });
    
    // Initial state
    expect(result.current.loading).toBe(true);
    expect(result.current.contracts).toEqual([]);
    
    // Wait for fetch to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    
    // Updated state
    expect(result.current.loading).toBe(false);
    expect(result.current.contracts).toEqual(mockContracts);
  });
  
  it('should handle errors', async () => {
    const error = new Error('Network error');
    contractService.fetchContracts.mockRejectedValue(error);
    
    const { result } = renderHook(() => useContracts(), { wrapper });
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(error.message);
    expect(result.current.contracts).toEqual([]);
  });
  
  it('should provide create contract function', async () => {
    const newContract = { id: '3', title: 'New Contract' };
    contractService.createContract.mockResolvedValue({ data: newContract });
    
    const { result } = renderHook(() => useContracts(), { wrapper });
    
    await act(async () => {
      await result.current.createContract({ title: 'New Contract' });
    });
    
    expect(contractService.createContract).toHaveBeenCalledWith({ title: 'New Contract' });
  });
});
Integration Testing
API Integration Tests
javascript// tests/integration/api/contracts.test.js
const request = require('supertest');
const app = require('../../../src/app');
const db = require('../../../src/db');
const { generateToken } = require('../../../src/utils/auth');

describe('Contract API Integration', () => {
  let authToken;
  let testUser;
  
  beforeAll(async () => {
    // Run migrations
    await db.migrate.latest();
  });
  
  afterAll(async () => {
    // Cleanup
    await db.destroy();
  });
  
  beforeEach(async () => {
    // Clear data
    await db('contracts').delete();
    await db('users').delete();
    
    // Create test user
    testUser = await db('users').insert({
      email: 'test@example.com',
      password_hash: 'hashed_password',
      first_name: 'Test',
      last_name: 'User',
      role: 'user'
    }).returning('*').then(rows => rows[0]);
    
    // Generate auth token
    authToken = generateToken(testUser.id);
  });
  
  describe('GET /api/v1/contracts', () => {
    it('should return user contracts', async () => {
      // Create test contracts
      await db('contracts').insert([
        {
          title: 'Contract 1',
          type: 'service',
          status: 'active',
          created_by: testUser.id
        },
        {
          title: 'Contract 2',
          type: 'nda',
          status: 'draft',
          created_by: testUser.id
        }
      ]);
      
      const response = await request(app)
        .get('/api/v1/contracts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body).toMatchObject({
        success: true,
        data: {
          contracts: expect.arrayContaining([
            expect.objectContaining({ title: 'Contract 1' }),
            expect.objectContaining({ title: 'Contract 2' })
          ]),
          total: 2
        }
      });
    });
    
    it('should filter contracts by status', async () => {
      await db('contracts').insert([
        {
          title: 'Active Contract',
          type: 'service',
          status: 'active',
          created_by: testUser.id
        },
        {
          title: 'Draft Contract',
          type: 'service',
          status: 'draft',
          created_by: testUser.id
        }
      ]);
      
      const response = await request(app)
        .get('/api/v1/contracts?status=active')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body.data.contracts).toHaveLength(1);
      expect(response.body.data.contracts[0].status).toBe('active');
    });
    
    it('should require authentication', async () => {
      await request(app)
        .get('/api/v1/contracts')
        .expect(401);
    });
  });
  
  describe('POST /api/v1/contracts', () => {
    it('should create a new contract', async () => {
      const contractData = {
        title: 'New Service Agreement',
        type: 'service',
        description: 'Test description',
        value: 10000,
        currency: 'USD',
        parties: [
          {
            name: 'Client Corp',
            type: 'company',
            role: 'client'
          }
        ]
      };
      
      const response = await request(app)
        .post('/api/v1/contracts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(contractData)
        .expect(201);
      
      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          title: contractData.title,
          type: contractData.type,
          status: 'draft',
          created_by: testUser.id
        })
      });
      
      // Verify in database
      const contract = await db('contracts')
        .where({ id: response.body.data.id })
        .first();
      
      expect(contract).toBeTruthy();
      expect(contract.title).toBe(contractData.title);
    });
    
    it('should validate input data', async () => {
      const invalidData = {
        title: '', // Empty title
        type: 'invalid_type'
      };
      
      const response = await request(app)
        .post('/api/v1/contracts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);
      
      expect(response.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR'
        })
      });
    });
  });
  
  describe('PUT /api/v1/contracts/:id', () => {
    it('should update own contract', async () => {
      const [contract] = await db('contracts')
        .insert({
          title: 'Original Title',
          type: 'service',
          status: 'draft',
          created_by: testUser.id
        })
        .returning('*');
      
      const updates = {
        title: 'Updated Title',
        description: 'New description'
      };
      
      const response = await request(app)
        .put(`/api/v1/contracts/${contract.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(200);
      
      expect(response.body.data.title).toBe(updates.title);
      expect(response.body.data.description).toBe(updates.description);
    });
    
    it('should not update others contracts', async () => {
      const [otherUser] = await db('users')
        .insert({
          email: 'other@example.com',
          password_hash: 'hash',
          first_name: 'Other',
          last_name: 'User'
        })
        .returning('*');
      
      const [contract] = await db('contracts')
        .insert({
          title: 'Other User Contract',
          type: 'service',
          status: 'draft',
          created_by: otherUser.id
        })
        .returning('*');
      
      await request(app)
        .put(`/api/v1/contracts/${contract.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Hacked!' })
        .expect(403);
    });
  });
});
Database Integration Tests
javascript// tests/integration/repositories/ContractRepository.test.js
const ContractRepository = require('../../../src/repositories/ContractRepository');
const db = require('../../../src/db');

describe('ContractRepository Integration', () => {
  let repository;
  let testUser;
  
  beforeAll(async () => {
    await db.migrate.latest();
    repository = new ContractRepository(db);
  });
  
  afterAll(async () => {
    await db.destroy();
  });
  
  beforeEach(async () => {
    await db('contracts').delete();
    await db('users').delete();
    
    [testUser] = await db('users')
      .insert({
        email: 'test@example.com',
        password_hash: 'hash',
        first_name: 'Test',
        last_name: 'User'
      })
      .returning('*');
  });
  
  describe('create', () => {
    it('should create contract with parties', async () => {
      const contractData = {
        title: 'Test Contract',
        type: 'service',
        created_by: testUser.id,
        parties: [
          {
            name: 'Client Corp',
            type: 'company',
            role: 'client'
          },
          {
            name: 'Vendor Inc',
            type: 'company',
            role: 'vendor'
          }
        ]
      };
      
      const contract = await repository.create(contractData);
      
      expect(contract).toMatchObject({
        id: expect.any(String),
        title: contractData.title,
        status: 'draft',
        version: 1
      });
      
      // Verify parties
      const parties = await db('contract_parties')
        .where({ contract_id: contract.id })
        .join('parties', 'contract_parties.party_id', 'parties.id')
        .select('parties.*', 'contract_parties.role');
      
      expect(parties).toHaveLength(2);
      expect(parties).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Client Corp', role: 'client' }),
          expect.objectContaining({ name: 'Vendor Inc', role: 'vendor' })
        ])
      );
    });
    
    it('should create version entry', async () => {
      const contract = await repository.create({
        title: 'Test Contract',
        type: 'service',
        content: 'Contract content',
        created_by: testUser.id
      });
      
      const version = await db('contract_versions')
        .where({ contract_id: contract.id })
        .first();
      
      expect(version).toMatchObject({
        version_number: 1,
        content: 'Contract content',
        created_by: testUser.id
      });
    });
  });
  
  describe('findWithRelations', () => {
    it('should load contract with all relations', async () => {
      // Create contract with relations
      const [contract] = await db('contracts')
        .insert({
          title: 'Full Contract',
          type: 'service',
          created_by: testUser.id
        })
        .returning('*');
      
      // Add party
      const [party] = await db('parties')
        .insert({ name: 'Test Party', type: 'company' })
        .returning('*');
      
      await db('contract_parties').insert({
        contract_id: contract.id,
        party_id: party.id,
        role: 'client'
      });
      
      // Add comment
      await db('comments').insert({
        contract_id: contract.id,
        user_id: testUser.id,
        content: 'Test comment'
      });
      
      // Add attachment
      await db('attachments').insert({
        contract_id: contract.id,
        filename: 'test.pdf',
        storage_path: '/uploads/test.pdf',
        uploaded_by: testUser.id
      });
      
      const result = await repository.findWithRelations(contract.id);
      
      expect(result).toMatchObject({
        id: contract.id,
        parties: expect.arrayContaining([
          expect.objectContaining({ name: 'Test Party' })
        ]),
        comments: expect.arrayContaining([
          expect.objectContaining({ content: 'Test comment' })
        ]),
        attachments: expect.arrayContaining([
          expect.objectContaining({ filename: 'test.pdf' })
        ])
      });
    });
  });
});
End-to-End Testing
Playwright Tests
javascript// tests/e2e/contract-workflow.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Contract Management Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('http://localhost:3000/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'Test123!');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('**/dashboard');
  });
  
  test('should create and submit contract for approval', async ({ page }) => {
    // Navigate to contracts
    await page.click('[data-testid="nav-contracts"]');
    await page.click('[data-testid="create-contract-button"]');
    
    // Fill contract form
    await page.fill('[data-testid="contract-title"]', 'E2E Test Contract');
    await page.selectOption('[data-testid="contract-type"]', 'service');
    await page.fill('[data-testid="contract-description"]', 'This is an E2E test contract');
    await page.fill('[data-testid="contract-value"]', '25000');
    
    // Add parties
    await page.click('[data-testid="add-party-button"]');
    await page.fill('[data-testid="party-name-0"]', 'Test Client Corp');
    await page.fill('[data-testid="party-email-0"]', 'client@testcorp.com');
    await page.selectOption('[data-testid="party-role-0"]', 'client');
    
    await page.click('[data-testid="add-party-button"]');
    await page.fill('[data-testid="party-name-1"]', 'Our Company');
    await page.fill('[data-testid="party-email-1"]', 'contracts@ourcompany.com');
    await page.selectOption('[data-testid="party-role-1"]', 'vendor');
    
    // Upload attachment
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('[data-testid="upload-attachment"]')
    ]);
    await fileChooser.setFiles('./tests/fixtures/sample-contract.pdf');
    
    // Save contract
    await page.click('[data-testid="save-contract-button"]');
    
    // Wait for success message
    await expect(page.locator('[data-testid="success-toast"]')).toContainText('Contract created successfully');
    
    // Submit for approval
    await page.click('[data-testid="submit-for-approval-button"]');
    
    // Select approvers
    await page.click('[data-testid="approver-select"]');
    await page.click('[data-testid="approver-option-manager@ourcompany.com"]');
    await page.click('[data-testid="approver-option-legal@ourcompany.com"]');
    
    // Add approval message
    await page.fill('[data-testid="approval-message"]', 'Please review and approve this service contract.');
    
    // Submit
    await page.click('[data-testid="send-for-approval-button"]');
    
    // Verify status change
    await expect(page.locator('[data-testid="contract-status"]')).toContainText('Pending Approval');
    
    // Verify in contract list
    await page.click('[data-testid="nav-contracts"]');
    const contractRow = page.locator('[data-testid="contract-row"]', { hasText: 'E2E Test Contract' });
    await expect(contractRow.locator('[data-testid="status-badge"]')).toContainText('Pending Approval');
  });
  
  test('should handle real-time collaboration', async ({ page, context }) => {
    // Create contract
    await page.goto('http://localhost:3000/contracts/new');
    await page.fill('[data-testid="contract-title"]', 'Collaboration Test');
    await page.selectOption('[data-testid="contract-type"]', 'nda');
    await page.click('[data-testid="save-contract-button"]');
    
    // Get contract URL
    await page.waitForURL(/\/contracts\/[a-f0-9-]+$/);
    const contractUrl = page.url();
    
    // Open second browser tab
    const page2 = await context.newPage();
    await page2.goto(contractUrl);
    
    // User 1 starts editing
    await page.click('[data-testid="contract-content-editor"]');
    await page.type('[data-testid="contract-content-editor"]', 'This is user 1 typing...');
    
    // Verify user 2 sees the changes
    await expect(page2.locator('[data-testid="contract-content-editor"]')).toContainText('This is user 1 typing...');
    
    // User 2 adds a comment
    await page2.fill('[data-testid="comment-input"]', 'Great addition!');
    await page2.click('[data-testid="add-comment-button"]');
    
    // Verify user 1 sees the comment
    await expect(page.locator('[data-testid="comment-list"]')).toContainText('Great addition!');
    
    // Check presence indicators
    await expect(page.locator('[data-testid="active-users"]')).toContainText('2 users active');
  });
  
  test('should export contract to PDF', async ({ page }) => {
    // Navigate to existing contract
    await page.goto('http://localhost:3000/contracts');
    await page.click('[data-testid="contract-row"]:first-child');
    
    // Click export button
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-testid="export-pdf-button"]')
    ]);
    
    // Verify download
    expect(download.suggestedFilename()).toMatch(/contract-.*\.pdf/);
    
    // Save and verify file exists
    const path = await download.path();
    expect(path).toBeTruthy();
  });
});
Mobile E2E Tests
javascript// tests/e2e/mobile.spec.js
const { devices, test, expect } = require('@playwright/test');

test.use({ ...devices['iPhone 12'] });

test.describe('Mobile Contract Management', () => {
  test('should navigate and create contract on mobile', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Login
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'Test123!');
    await page.click('[data-testid="login-button"]');
    
    // Open mobile menu
    await page.click('[data-testid="mobile-menu-toggle"]');
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
    
    // Navigate to contracts
    await page.click('[data-testid="mobile-nav-contracts"]');
    
    // Create contract
    await page.click('[data-testid="mobile-create-button"]');
    
    // Fill form (mobile optimized)
    await page.fill('[data-testid="contract-title"]', 'Mobile Contract');
    await page.selectOption('[data-testid="contract-type"]', 'service');
    
    // Test mobile-specific interactions
    await page.locator('[data-testid="value-input"]').tap();
    await page.keyboard.type('15000');
    
    // Save
    await page.click('[data-testid="save-contract-button"]');
    
    // Verify success on mobile
    await expect(page.locator('[data-testid="mobile-toast"]')).toBeVisible();
  });
  
  test('should handle touch gestures', async ({ page }) => {
    await page.goto('http://localhost:3000/contracts');
    
    // Swipe to reveal actions
    const contractCard = page.locator('[data-testid="contract-card"]:first-child');
    await contractCard.swipe({ direction: 'left', distance: 100 });
    
    // Verify quick actions appear
    await expect(page.locator('[data-testid="quick-actions"]')).toBeVisible();
    
    // Tap to edit
    await page.locator('[data-testid="quick-edit"]').tap();
    await expect(page).toHaveURL(/\/contracts\/.*\/edit/);
  });
});
Performance Testing
Load Testing with k6
javascript// tests/performance/load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 10 },   // Ramp up to 10 users
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    errors: ['rate<0.1'],             // Error rate under 10%
  },
};

const BASE_URL = 'http://localhost:8000';

export function setup() {
  // Login and get token
  const loginRes = http.post(`${BASE_URL}/api/v1/auth/login`, JSON.stringify({
    email: 'loadtest@example.com',
    password: 'LoadTest123!'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
  
  return { token: loginRes.json('token') };
}

export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${data.token}`
  };
  
  // Scenario 1: List contracts
  const listRes = http.get(`${BASE_URL}/api/v1/contracts`, { headers });
  check(listRes, {
    'list contracts status is 200': (r) => r.status === 200,
    'list contracts response time < 500ms': (r) => r.timings.duration < 500,
  });
  errorRate.add(listRes.status !== 200);
  
  sleep(1);
  
  // Scenario 2: Create contract
  const createRes = http.post(
    `${BASE_URL}/api/v1/contracts`,
    JSON.stringify({
      title: `Load Test Contract ${Date.now()}`,
      type: 'service',
      description: 'Performance test contract',
      value: Math.floor(Math.random() * 100000)
    }),
    { headers }
  );
  
  check(createRes, {
    'create contract status is 201': (r) => r.status === 201,
    'create contract response time < 1000ms': (r) => r.timings.duration < 1000,
  });
  errorRate.add(createRes.status !== 201);
  
  if (createRes.status === 201) {
    const contractId = createRes.json('data.id');
    
    sleep(1);
    
    // Scenario 3: Get contract details
    const getRes = http.get(`${BASE_URL}/api/v1/contracts/${contractId}`, { headers });
    check(getRes, {
      'get contract status is 200': (r) => r.status === 200,
      'get contract response time < 300ms': (r) => r.timings.duration < 300,
    });
    errorRate.add(getRes.status !== 200);
  }
  
  sleep(2);
}

export function teardown(data) {
  // Cleanup if needed
}
Stress Testing
javascript// tests/performance/stress-test.js
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 200 },   // Ramp to 200 users quickly
    { duration: '3m', target: 500 },   // Push to 500 users
    { duration: '1m', target: 1000 },  // Spike to 1000 users
    { duration: '2m', target: 1000 },  // Maintain peak load
    { duration: '2m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_failed: ['rate<0.5'],     // Less than 50% failure rate
    http_req_duration: ['p(90)<2000'], // 90% under 2 seconds
  },
};

export default function () {
  const responses = http.batch([
    ['GET', 'http://localhost:8000/api/v1/health'],
    ['GET', 'http://localhost:8000/api/v1/contracts'],
    ['GET', 'http://localhost:8000/api/v1/templates'],
  ]);
  
  responses.forEach((res, idx) => {
    check(res, {
      [`request ${idx} succeeded`]: (r) => r.status === 200 || r.status === 401,
    });
  });
}
Security Testing
OWASP ZAP Configuration
yaml# tests/security/zap-config.yaml
env:
  contexts:
    - name: "Contract Management API"
      urls:
        - "http://localhost:8000"
      authentication:
        method: "json"
        parameters:
          loginUrl: "http://localhost:8000/api/v1/auth/login"
          loginRequestData: '{"email":"security@test.com","password":"Security123!"}'
      users:
        - name: "test-user"
          credentials:
            email: "security@test.com"
            password: "Security123!"

jobs:
  - type: spider
    parameters:
      maxDuration: 10
      
  - type: activeScan
    parameters:
      maxRuleDurationInMins: 5
      
  - type: report
    parameters:
      template: "traditional-html"
      reportDir: "./security-reports"
      reportFile: "zap-report.html"
Security Test Script
bash#!/bin/bash
# tests/security/run-security-tests.sh

echo "Running security tests..."

# 1. Dependency scanning
echo "Checking dependencies for vulnerabilities..."
npm audit --production
AUDIT_EXIT=$?

# 2. OWASP Dependency Check
echo "Running OWASP dependency check..."
dependency-check --project "Contract Management" \
  --scan ./package.json \
  --format HTML \
  --out ./security-reports

# 3. Static code analysis
echo "Running static security analysis..."
npm run lint:security

# 4. Dynamic scanning with OWASP ZAP
echo "Starting OWASP ZAP scan..."
docker run -v $(pwd):/zap/wrk/:rw \
  -t owasp/zap2docker-stable zap-baseline.py \
  -t http://host.docker.internal:8000 \
  -c zap-config.yaml \
  -r zap-report.html

# 5. Check for secrets
echo "Scanning for secrets..."
trufflehog --regex --entropy=True --json . > security-reports/secrets-scan.json

# Generate summary
if [ $AUDIT_EXIT -ne 0 ]; then
  echo "FAILED: Vulnerabilities found in dependencies"
  exit 1
fi

echo "Security tests completed. Check security-reports/ for details."
Test Data Management
Test Data Factory
javascript// tests/factories/index.js
const { faker } = require('@faker-js/faker');
const bcrypt = require('bcrypt');

class TestDataFactory {
  static async createUser(overrides = {}) {
    const defaultUser = {
      email: faker.internet.email(),
      password_hash: await bcrypt.hash('Test123!', 10),
      first_name: faker.person.firstName(),
      last_name: faker.person.lastName(),
      role: 'user',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    return { ...defaultUser, ...overrides };
  }
  
  static createContract(overrides = {}) {
    const types = ['service', 'nda', 'employment', 'sales', 'lease'];
    const statuses = ['draft', 'pending_review', 'approved', 'active'];
    
    const defaultContract = {
      title: faker.company.catchPhrase(),
      description: faker.lorem.paragraph(),
      type: faker.helpers.arrayElement(types),
      status: faker.helpers.arrayElement(statuses),
      value: faker.number.float({ min: 1000, max: 100000, precision: 0.01 }),
      currency: 'USD',
      start_date: faker.date.future(),
      end_date: faker.date.future({ years: 2 }),
      created_at: new Date(),
      updated_at: new Date()
    };
    
    return { ...defaultContract, ...overrides };
  }
  
  static createParty(overrides = {}) {
    const types = ['individual', 'company'];
    const type = overrides.type || faker.helpers.arrayElement(types);
    
    const defaultParty = {
      name: type === 'company' ? faker.company.name() : faker.person.fullName(),
      type,
      email: faker.internet.email(),
      phone: faker.phone.number(),
      address: faker.location.streetAddress(),
      city: faker.location.city(),
      state: faker.location.state(),
      country: faker.location.country(),
      postal_code: faker.location.zipCode()
    };
    
    return { ...defaultParty, ...overrides };
  }
  
  static async seedDatabase(db, counts = {}) {
    const { users = 10, contracts = 50, parties = 20 } = counts;
    
    // Create users
    const createdUsers = [];
    for (let i = 0; i < users; i++) {
      const userData = await this.createUser();
      const [user] = await db('users').insert(userData).returning('*');
      createdUsers.push(user);
    }
    
    // Create parties
    const createdParties = [];
    for (let i = 0; i < parties; i++) {
      const partyData = this.createParty();
      const [party] = await db('parties').insert(partyData).returning('*');
      createdParties.push(party);
    }
    
    // Create contracts
    const createdContracts = [];
    for (let i = 0; i < contracts; i++) {
      const user = faker.helpers.arrayElement(createdUsers);
      const contractData = this.createContract({
        created_by: user.id
      });
      
      const [contract] = await db('contracts').insert(contractData).returning('*');
      
      // Add random parties to contract
      const numParties = faker.number.int({ min: 1, max: 3 });
      for (let j = 0; j < numParties; j++) {
        const party = faker.helpers.arrayElement(createdParties);
        await db('contract_parties').insert({
          contract_id: contract.id,
          party_id: party.id,
          role: faker.helpers.arrayElement(['client', 'vendor', 'partner'])
        });
      }
      
      createdContracts.push(contract);
    }
    
    return {
      users: createdUsers,
      contracts: createdContracts,
      parties: createdParties
    };
  }
}

module.exports = TestDataFactory;
Database Seeder
javascript// tests/seeds/test-data.js
const TestDataFactory = require('../factories');

exports.seed = async function(knex) {
  // Clear existing data
  await knex('contract_parties').del();
  await knex('contracts').del();
  await knex('parties').del();
  await knex('users').del();
  
  // Create admin user
  const [adminUser] = await knex('users').insert({
    email: 'admin@test.com',
    password_hash: '$2b$10$YourHashedPasswordHere',
    first_name: 'Admin',
    last_name: 'User',
    role: 'admin',
    is_active: true
  }).returning('*');
  
  // Create test users
  const [regularUser] = await knex('users').insert({
    email: 'user@test.com',
    password_hash: '$2b$10$YourHashedPasswordHere',
    first_name: 'Regular',
    last_name: 'User',
    role: 'user',
    is_active: true
  }).returning('*');
  
  // Seed random data
  if (process.env.SEED_RANDOM_DATA === 'true') {
    await TestDataFactory.seedDatabase(knex, {
      users: 50,
      contracts: 200,
      parties: 100
    });
  }
  
  console.log('Test data seeded successfully');
};
Continuous Integration
GitHub Actions CI
yaml# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: contract_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
          
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: |
        npm ci --prefix backend
        npm ci --prefix frontend
    
    - name: Run linting
      run: |
        npm run lint --prefix backend
        npm run lint --prefix frontend
    
    - name: Run unit tests
      run: |
        npm run test:unit --prefix backend
        npm run test:unit --prefix frontend
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/contract_test
        REDIS_URL: redis://localhost:6379
        JWT_SECRET: test-secret
    
    - name: Run integration tests
      run: npm run test:integration --prefix backend
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/contract_test
        REDIS_URL: redis://localhost:6379
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        files: ./backend/coverage/lcov.info,./frontend/coverage/lcov.info
        flags: unittests
        name: codecov-umbrella
    
    - name: Run E2E tests
      run: |
        npm run build --prefix frontend
        npm run start --prefix backend &
        npm run serve --prefix frontend &
        sleep 10
        npm run test:e2e
      env:
        CI: true
    
    - name: Run security tests
      run: |
        npm audit --audit-level=high --prefix backend
        npm audit --audit-level=high --prefix frontend
    
    - name: Archive test results
      if: always()
      uses: actions/upload-artifact@v3
      with:
        name: test-results
        path: |
          backend/coverage
          frontend/coverage
          test-results/
          playwright-report/
Test Scripts
json// package.json scripts
{
  "scripts": {
    "test": "npm run test:unit && npm run test:integration",
    "test:unit": "jest --testPathPattern=unit --coverage",
    "test:integration": "jest --testPathPattern=integration --runInBand",
    "test:e2e": "playwright test",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:debug": "playwright test --debug",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage --coverageReporters=text-lcov | coveralls",
    "test:performance": "k6 run tests/performance/load-test.js",
    "test:security": "./tests/security/run-security-tests.sh",
    "test:all": "npm run test && npm run test:e2e && npm run test:performance"
  }
}
Best Practices
1. Test Structure
javascript// Follow AAA pattern
describe('Feature', () => {
  it('should behavior description', () => {
    // Arrange - Setup test data
    const input = { /* ... */ };
    
    // Act - Execute the function
    const result = functionUnderTest(input);
    
    // Assert - Verify the result
    expect(result).toEqual(expected);
  });
});
2. Test Naming
javascript// Use descriptive test names
// ✅ Good
it('should return 404 when contract does not exist', () => {});
it('should validate email format before creating user', () => {});
it('should emit contract.updated event after successful update', () => {});

// ❌ Bad
it('test contract', () => {});
it('works', () => {});
it('error case', () => {});
3. Test Isolation
javascript// Each test should be independent
beforeEach(() => {
  // Fresh setup for each test
  jest.clearAllMocks();
  // Reset database state
  // Clear caches
});

afterEach(() => {
  // Cleanup
});
4. Mock External Dependencies
javascript// Mock external services
jest.mock('../services/EmailService');
jest.mock('../services/PaymentService');

// But don't mock what you're testing
// If testing ContractService, mock its dependencies but not the service itself
5. Test Data Builders
javascript// Use builders for complex test data
class ContractBuilder {
  constructor() {
    this.contract = {
      title: 'Default Title',
      type: 'service',
      status: 'draft'
    };
  }
  
  withTitle(title) {
    this.contract.title = title;
    return this;
  }
  
  withStatus(status) {
    this.contract.status = status;
    return this;
  }
  
  withParties(parties) {
    this.contract.parties = parties;
    return this;
  }
  
  build() {
    return this.contract;
  }
}

// Usage
const contract = new ContractBuilder()
  .withTitle('Test Contract')
  .withStatus('active')
  .withParties([{ name: 'Client Corp', role: 'client' }])
  .build();
6. Async Testing
javascript// Always handle async properly
// ✅ Good
it('should handle async operations', async () => {
  const result = await asyncFunction();
  expect(result).toBe(expected);
});

// ✅ Good - with promises
it('should handle promises', () => {
  return expectAsync(promiseFunction()).resolves.toBe(expected);
});

// ❌ Bad - missing async/await
it('should handle async operations', () => {
  const result = asyncFunction(); // This won't wait!
  expect(result).toBe(expected);
});
7. Performance Considerations
javascript// Don't test implementation details
// ✅ Good - Test behavior
it('should calculate total contract value', () => {
  const contracts = [{ value: 100 }, { value: 200 }];
  expect(calculateTotal(contracts)).toBe(300);
});

// ❌ Bad - Testing implementation
it('should use reduce to calculate total', () => {
  // Don't test HOW it's done, test WHAT it does
});
Conclusion
A comprehensive testing strategy is essential for maintaining code quality and preventing regressions. By following these guidelines and best practices, you can build a robust test suite that gives confidence in your application's behavior and performance.
Remember:

Write tests first (TDD)
Test behavior, not implementation
Keep tests simple and focused
Maintain high coverage on critical paths
Run tests frequently
Fix broken tests immediately


## **docs/guides/troubleshooting.md**

```markdown
# Troubleshooting Guide

## Table of Contents
1. [Common Issues](#common-issues)
2. [Installation Problems](#installation-problems)
3. [Runtime Errors](#runtime-errors)
4. [Database Issues](#database-issues)
5. [Authentication Problems](#authentication-problems)
6. [Performance Issues](#performance-issues)
7. [Docker Issues](#docker-issues)
8. [Debugging Tips](#debugging-tips)
9. [FAQ](#faq)
10. [Getting Help](#getting-help)

## Common Issues

### Application Won't Start

**Symptoms:**
- Server crashes on startup
- Port already in use error
- Module not found errors

**Solutions:**

1. **Check port availability:**
```bash
# Check if port 8000 is in use
lsof -i :8000

# Kill the process using the port
kill -9 <PID>

# Or use a different port
PORT=8001 npm run dev

Verify dependencies:

bash# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check for missing dependencies
npm ls

Check environment variables:

bash# Verify .env file exists
ls -la .env

# Check required variables
node -e "console.log(require('./config/env'))"
Build Failures
Symptoms:

TypeScript compilation errors
Webpack build errors
Missing modules during build

Solutions:

Clear build cache:

bash# Clear all build artifacts
rm -rf dist build .cache

# Rebuild
npm run build

Check Node version:

bash# Verify Node version
node --version

# Should be 18.0.0 or higher
# Use nvm to switch versions
nvm use 18

Fix TypeScript errors:

bash# Check TypeScript errors
npx tsc --noEmit

# Generate missing types
npx tsc --declaration
Installation Problems
npm install Fails
Common errors and solutions:

Permission errors (EACCES):

bash# Fix npm permissions
sudo chown -R $(whoami) ~/.npm

# Or use npm with proper permissions
npm install --unsafe-perm

Network timeout errors:

bash# Use different registry
npm config set registry https://registry.npmjs.org/

# Increase timeout
npm config set fetch-retry-maxtimeout 120000

# Clear npm cache
npm cache clean --force

Node-gyp errors:

bash# Install build tools
# macOS
xcode-select --install

# Ubuntu/Debian
sudo apt-get install build-essential

# Windows
npm install --global windows-build-tools
PostgreSQL Connection Issues
Error: ECONNREFUSED 127.0.0.1:5432
Solutions:

Verify PostgreSQL is running:

bash# Check status
systemctl status postgresql
# or
brew services list | grep postgresql

# Start PostgreSQL
systemctl start postgresql
# or
brew services start postgresql

Check connection settings:

bash# Test connection
psql -U postgres -h localhost -p 5432

# Verify pg_hba.conf allows connections
sudo nano /etc/postgresql/15/main/pg_hba.conf

Create database:

bash# Create database
createdb contract_management

# Or using psql
psql -U postgres -c "CREATE DATABASE contract_management;"
Redis Connection Issues
Error: Redis connection to localhost:6379 failed
Solutions:

Start Redis:

bash# Check if Redis is running
redis-cli ping

# Start Redis
redis-server
# or
brew services start redis

Check Redis configuration:

bash# Test connection
redis-cli -h localhost -p 6379

# Check Redis config
redis-cli CONFIG GET bind
redis-cli CONFIG GET protected-mode
Runtime Errors
JWT Token Errors
Error: JsonWebTokenError: invalid signature
Solutions:

Verify JWT secret:

javascript// Check if JWT_SECRET is set
console.log(process.env.JWT_SECRET);

// Ensure it's the same across services
// Must be at least 32 characters

Clear browser storage:

javascript// In browser console
localStorage.clear();
sessionStorage.clear();

Regenerate tokens:

bash# Generate new secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
CORS Errors
Error: Access to XMLHttpRequest blocked by CORS policy
Solutions:

Update CORS configuration:

javascript// backend/config/cors.js
module.exports = {
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    process.env.FRONTEND_URL
  ],
  credentials: true
};

Check request headers:

javascript// Ensure credentials are included
fetch(url, {
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json'
  }
});
File Upload Errors
Error: PayloadTooLargeError: request entity too large
Solutions:

Increase body parser limit:

javascript// backend/app.js
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

Configure multer limits:

javascript// backend/middleware/upload.js
const upload = multer({
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});
Database Issues
Migration Errors
Error: Migration failed: relation already exists
Solutions:

Check migration status:

bash# View completed migrations
npm run migrate:status

# Rollback last migration
npm run migrate:rollback

# Reset all migrations (CAUTION: Deletes data)
npm run migrate:reset

Fix duplicate migrations:

sql-- Check migrations table
SELECT * FROM knex_migrations;

-- Remove duplicate entry
DELETE FROM knex_migrations WHERE name = 'duplicate_migration.js';
Query Performance Issues
Symptoms:

Slow page loads
Database timeouts
High CPU usage

Solutions:

Add missing indexes:

sql-- Find slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC;

-- Add index
CREATE INDEX idx_contracts_user_status 
ON contracts(created_by, status) 
WHERE deleted_at IS NULL;

Optimize queries:

javascript// ❌ Bad - N+1 query
const contracts = await Contract.findAll();
for (const contract of contracts) {
  contract.parties = await contract.getParties();
}

// ✅ Good - Eager loading
const contracts = await Contract.findAll({
  include: ['parties']
});

Use query explain:

sqlEXPLAIN ANALYZE
SELECT * FROM contracts
WHERE created_by = 'user-id'
AND status = 'active';
Authentication Problems
Login Failures
Symptoms:

"Invalid credentials" even with correct password
Session expires immediately
2FA not working

Solutions:

Reset password:

javascript// Generate password reset
const resetToken = crypto.randomBytes(32).toString('hex');
await user.update({
  passwordResetToken: resetToken,
  passwordResetExpires: Date.now() + 3600000 // 1 hour
});

Check session configuration:

javascript// Verify session settings
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

Debug 2FA:

javascript// Verify 2FA secret
const secret = user.twoFactorSecret;
const token = req.body.token;

// Check time sync
const verified = speakeasy.totp.verify({
  secret,
  encoding: 'base32',
  token,
  window: 2 // Allow 2 time windows
});
OAuth Issues
Error: OAuth callback error
Solutions:

Verify callback URLs:

javascript// Check OAuth configuration
console.log({
  clientID: process.env.GOOGLE_CLIENT_ID,
  callbackURL: process.env.GOOGLE_CALLBACK_URL
});

Update OAuth app settings:


Google Console: Add correct redirect URIs
Include both dev and production URLs
Format: http://localhost:8000/api/v1/auth/google/callback

Performance Issues
Slow API Responses
Diagnosis:
javascript// Add request timing middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.url} - ${duration}ms`);
  });
  next();
});
Solutions:

Enable query caching:

javascript// Redis caching middleware
const cacheMiddleware = async (req, res, next) => {
  const key = `cache:${req.originalUrl}`;
  const cached = await redis.get(key);
  
  if (cached) {
    return res.json(JSON.parse(cached));
  }
  
  res.sendResponse = res.json;
  res.json = (body) => {
    redis.setex(key, 300, JSON.stringify(body));
    res.sendResponse(body);
  };
  next();
};

Optimize database queries:

javascript// Use query optimization
const contracts = await db('contracts')
  .select('contracts.*')
  .leftJoin('users', 'contracts.created_by', 'users.id')
  .where('contracts.status', 'active')
  .limit(20)
  .offset(offset)
  .orderBy('contracts.created_at', 'desc');

Enable compression:

javascriptconst compression = require('compression');
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));
Memory Leaks
Symptoms:

Increasing memory usage
Application crashes
Slow performance over time

Diagnosis:
javascript// Monitor memory usage
setInterval(() => {
  const used = process.memoryUsage();
  console.log('Memory Usage:', {
    rss: `${Math.round(used.rss / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)}MB`
  });
}, 30000);
Solutions:

Fix event listener leaks:

javascript// ❌ Bad - Memory leak
events.on('contract.updated', handler);

// ✅ Good - Clean up listeners
const handler = (data) => { /* ... */ };
events.on('contract.updated', handler);

// Clean up
events.removeListener('contract.updated', handler);

Close database connections:

javascript// Ensure connections are closed
process.on('SIGTERM', async () => {
  await db.destroy();
  await redis.quit();
  process.exit(0);
});
Docker Issues
Container Won't Start
Error: docker-compose up fails
Solutions:

Check Docker daemon:

bash# Verify Docker is running
docker version

# Start Docker daemon
sudo systemctl start docker
# or
open -a Docker # macOS

Clean up resources:

bash# Remove all containers
docker-compose down

# Clean up volumes
docker volume prune

# Remove dangling images
docker image prune

# Full cleanup (CAUTION)
docker system prune -a

Fix port conflicts:

yaml# docker-compose.yml
services:
  backend:
    ports:
      - "8001:8000" # Change host port if needed
Database Container Issues
Error: Container fails to initialize database
Solutions:

Reset database volume:

bash# Stop containers
docker-compose down

# Remove database volume
docker volume rm contractmanagement_postgres_data

# Restart
docker-compose up -d

Check initialization scripts:

dockerfile# Ensure init scripts are copied
COPY ./scripts/init-db.sql /docker-entrypoint-initdb.d/
Debugging Tips
Enable Debug Logging
javascript// Set debug environment variable
DEBUG=app:* npm run dev

// Or in code
const debug = require('debug')('app:contracts');
debug('Processing contract:', contractId);
Use Chrome DevTools

Start with inspect:

bashnode --inspect server.js

Open Chrome:


Navigate to chrome://inspect
Click "inspect" under your process

Database Query Logging
javascript// Enable query logging
const knex = require('knex')({
  client: 'postgresql',
  debug: true, // Enable debug mode
  // ... other config
});

// Or log specific queries
knex.on('query', (query) => {
  console.log('SQL:', query.sql);
  console.log('Bindings:', query.bindings);
});
API Request Logging
javascript// Use morgan for request logging
const morgan = require('morgan');

// Detailed logging in development
app.use(morgan('dev'));

// Custom format
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));
FAQ
Q: How do I reset my local development environment?
A: Run the reset script:
bash# Create reset script
cat > scripts/reset-dev.sh << 'EOF'
#!/bin/bash
echo "Resetting development environment..."

# Stop services
docker-compose down

# Clear data
rm -rf node_modules
rm -rf frontend/node_modules
rm -rf dist build

# Clear Docker
docker system prune -f

# Reinstall
npm install
cd frontend && npm install && cd ..

# Reset database
npm run db:reset
npm run db:seed

echo "Reset complete!"
EOF

chmod +x scripts/reset-dev.sh
./scripts/reset-dev.sh
Q: How do I enable hot reloading?
A: Hot reloading should work by default:

Backend hot reload:

json// package.json
"scripts": {
  "dev": "nodemon server.js"
}

Frontend hot reload:

javascript// vite.config.js
export default {
  server: {
    hmr: true,
    watch: {
      usePolling: true // For Docker
    }
  }
}
Q: How do I run a specific test file?
A:
bash# Run specific test file
npm test -- contracts.test.js

# Run tests matching pattern
npm test -- --testNamePattern="should create contract"

# Run tests in watch mode
npm test -- --watch contracts.test.js
Q: How do I profile the application?
A: Use built-in Node.js profiler:
bash# Generate CPU profile
node --prof server.js

# Process the profile
node --prof-process isolate-*.log > profile.txt

# Or use clinic.js
npx clinic doctor -- node server.js
Getting Help
Before Asking for Help

Check the logs:

bash# Application logs
tail -f logs/app.log

# Docker logs
docker-compose logs -f backend

# System logs
journalctl -u postgresql

Search existing issues:


GitHub Issues: https://github.com/your-org/contract-management/issues
Stack Overflow: Search with tags [node.js], [postgresql], [react]


Gather information:

bash# System info
node --version
npm --version
postgres --version

# Error details
npm run diagnose
Creating a Good Bug Report
Include the following information:
markdown## Bug Report

**Environment:**
- OS: macOS 12.6
- Node: 18.12.0
- PostgreSQL: 15.1
- Browser: Chrome 109

**Steps to Reproduce:**
1. Login as admin user
2. Navigate to contracts page
3. Click "Create Contract"
4. Fill in form and submit

**Expected Behavior:**
Contract should be created and appear in the list

**Actual Behavior:**
Error message: "Failed to create contract"

**Error Logs:**
TypeError: Cannot read property 'id' of undefined
at ContractService.create (services/ContractService.js:45:23)
at async ContractController.create (controllers/ContractController.js:23:18)

**Additional Context:**
This started happening after upgrading to version 2.0.0
Debug Information Script
Create a diagnostic script:
javascript// scripts/diagnose.js
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

console.log('=== System Diagnostics ===\n');

// System info
console.log('System Information:');
console.log(`- OS: ${os.type()} ${os.release()}`);
console.log(`- Node: ${process.version}`);
console.log(`- NPM: ${execSync('npm --version').toString().trim()}`);
console.log(`- Memory: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB`);
console.log(`- CPUs: ${os.cpus().length}`);

// Check services
console.log('\nService Status:');
try {
  execSync('pg_isready', { stdio: 'ignore' });
  console.log('- PostgreSQL: ✓ Running');
} catch {
  console.log('- PostgreSQL: ✗ Not running');
}

try {
  execSync('redis-cli ping', { stdio: 'ignore' });
  console.log('- Redis: ✓ Running');
} catch {
  console.log('- Redis: ✗ Not running');
}

// Check environment
console.log('\nEnvironment Variables:');
const requiredEnvVars = [
  'NODE_ENV',
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET'
];

requiredEnvVars.forEach(varName => {
  const exists = process.env[varName] ? '✓' : '✗';
  console.log(`- ${varName}: ${exists}`);
});

// Check file permissions
console.log('\nFile Permissions:');
const checkPaths = [
  '.env',
  'logs',
  'uploads',
  'node_modules'
];

checkPaths.forEach(path => {
  try {
    fs.accessSync(path, fs.constants.R_OK | fs.constants.W_OK);
    console.log(`- ${path}: ✓ Read/Write`);
  } catch {
    console.log(`- ${path}: ✗ Permission denied or missing`);
  }
});

// Check disk space
console.log('\nDisk Space:');
const diskSpace = execSync('df -h .').toString();
console.log(diskSpace);

// Recent errors
console.log('\nRecent Application Errors:');
try {
  const errorLog = fs.readFileSync('logs/error.log', 'utf8');
  const lines = errorLog.split('\n').slice(-10);
  lines.forEach(line => console.log(line));
} catch {
  console.log('No error log found');
}
Common Error Codes
Error CodeMeaningSolutionECONNREFUSEDConnection refusedService not runningEADDRINUSEPort already in useKill process or change portEACCESPermission deniedFix file permissionsENOENTFile not foundCheck file pathETIMEDOUTConnection timeoutCheck network/firewallENOMEMOut of memoryIncrease memory limitE11000Duplicate key errorCheck unique constraints
Useful Commands Reference
bash# Database
psql -U postgres -d contract_management  # Connect to database
\dt                                       # List tables
\d+ contracts                            # Describe table
SELECT * FROM contracts LIMIT 10;        # Query data

# Redis
redis-cli                                # Connect to Redis
KEYS *                                   # List all keys
GET "key"                               # Get value
FLUSHALL                                # Clear all data (CAUTION)

# Process Management
ps aux | grep node                      # Find Node processes
lsof -i :8000                          # Find process on port
kill -9 <PID>                          # Force kill process
pm2 list                               # List PM2 processes
pm2 logs                               # View PM2 logs

# Docker
docker ps                              # List containers
docker logs <container>                # View logs
docker exec -it <container> bash       # Enter container
docker-compose restart backend         # Restart service

# Network
netstat -tulpn | grep LISTEN          # List listening ports
curl -I http://localhost:8000/health  # Test endpoint
nslookup api.example.com              # DNS lookup
traceroute api.example.com            # Trace network path

# File System
find . -name "*.log"                  # Find log files
tail -f logs/app.log                  # Follow log file
du -sh *                              # Check directory sizes
df -h                                 # Check disk space

# NPM
npm ls                                # List dependencies
npm outdated                          # Check outdated packages
npm run                               # List available scripts
npm cache clean --force               # Clear npm cache
Emergency Procedures
Application Crash
bash# 1. Check logs
tail -n 100 logs/error.log

# 2. Restart services
pm2 restart all
# or
docker-compose restart

# 3. Check system resources
free -m
df -h
top

# 4. Roll back if needed
git checkout stable
npm install
npm run build
pm2 restart all
Database Corruption
bash# 1. Stop application
pm2 stop all

# 2. Backup current state
pg_dump contract_management > backup_$(date +%Y%m%d_%H%M%S).sql

# 3. Check database
psql -U postgres -d contract_management -c "SELECT pg_is_in_recovery();"

# 4. Restore from backup if needed
psql -U postgres -d contract_management < last_known_good_backup.sql

# 5. Restart application
pm2 start all
Security Breach
bash# 1. Isolate the system
# Disable external access

# 2. Preserve evidence
tar -czf evidence_$(date +%Y%m%d_%H%M%S).tar.gz logs/ uploads/

# 3. Revoke all tokens
node -e "require('./scripts/revoke-all-tokens')"

# 4. Reset all passwords
node -e "require('./scripts/force-password-reset')"

# 5. Audit logs
grep -r "suspicious_pattern" logs/

# 6. Notify security team
Support Channels

Documentation: https://docs.contractmanagement.com
GitHub Issues: https://github.com/your-org/contract-management/issues
Discord Community: https://discord.gg/contractmgmt
Email Support: support@contractmanagement.com
Stack Overflow: Tag with contract-management-system

Response Times

Critical Issues (Production down): < 1 hour
High Priority (Major feature broken): < 4 hours
Medium Priority (Minor bugs): < 1 business day
Low Priority (Feature requests): < 1 week

Remember to always check the documentation and search existing issues before creating new support requests!

