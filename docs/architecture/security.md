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
    - name: cache
    mountPath: /app/.cache
   
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
