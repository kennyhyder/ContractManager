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