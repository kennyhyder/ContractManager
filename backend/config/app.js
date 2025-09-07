const path = require('path');

class AppConfig {
  constructor() {
    this.environment = process.env.NODE_ENV || 'development';
    this.isDevelopment = this.environment === 'development';
    this.isProduction = this.environment === 'production';
    this.isTest = this.environment === 'test';
  }

  get server() {
    return {
      port: parseInt(process.env.PORT, 10) || 5000,
      host: process.env.HOST || 'localhost',
      url: process.env.SERVER_URL || `http://localhost:${this.server.port}`,
    };
  }

  get client() {
    return {
      url: process.env.FRONTEND_URL || 'http://localhost:3000',
    };
  }

  get api() {
    return {
      prefix: '/api',
      version: 'v1',
      pagination: {
        defaultLimit: 20,
        maxLimit: 100,
      },
    };
  }

  get security() {
    return {
      bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,
      saltLength: 16,
      passwordMinLength: 8,
      passwordMaxLength: 128,
      maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS, 10) || 5,
      lockoutDuration: parseInt(process.env.LOCKOUT_DURATION, 10) || 15 * 60 * 1000, // 15 minutes
      sessionTimeout: parseInt(process.env.SESSION_TIMEOUT, 10) || 30 * 60 * 1000, // 30 minutes
    };
  }

  get uploads() {
    return {
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 10 * 1024 * 1024, // 10MB
      allowedMimeTypes: {
        documents: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ],
        images: [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
        ],
      },
      tempDir: path.join(__dirname, '../temp'),
      uploadDir: path.join(__dirname, '../public/uploads'),
    };
  }

  get cache() {
    return {
      ttl: {
        short: 5 * 60, // 5 minutes
        medium: 30 * 60, // 30 minutes
        long: 24 * 60 * 60, // 24 hours
      },
      prefix: {
        user: 'user:',
        contract: 'contract:',
        template: 'template:',
        session: 'session:',
        rate: 'rate:',
      },
    };
  }

  get websocket() {
    return {
      pingTimeout: 60000,
      pingInterval: 25000,
      maxHttpBufferSize: 1e8, // 100 MB
      transports: ['websocket', 'polling'],
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        credentials: true,
      },
    };
  }

  get notifications() {
    return {
      channels: ['email', 'in-app', 'push'],
      events: {
        CONTRACT_CREATED: 'contract.created',
        CONTRACT_UPDATED: 'contract.updated',
        CONTRACT_DELETED: 'contract.deleted',
        CONTRACT_SIGNED: 'contract.signed',
        CONTRACT_APPROVED: 'contract.approved',
        CONTRACT_REJECTED: 'contract.rejected',
        CONTRACT_EXPIRED: 'contract.expired',
        CONTRACT_EXPIRING_SOON: 'contract.expiring_soon',
        USER_MENTIONED: 'user.mentioned',
        COMMENT_ADDED: 'comment.added',
        COLLABORATOR_ADDED: 'collaborator.added',
        COLLABORATOR_REMOVED: 'collaborator.removed',
      },
    };
  }

  get logging() {
    return {
      level: this.isDevelopment ? 'debug' : 'info',
      format: this.isDevelopment ? 'dev' : 'combined',
      errorLogFile: path.join(__dirname, '../logs/error.log'),
      combinedLogFile: path.join(__dirname, '../logs/combined.log'),
      maxFileSize: '20m',
      maxFiles: '14d',
    };
  }

  get features() {
    return {
      registration: process.env.ENABLE_REGISTRATION !== 'false',
      oauth: {
        google: !!process.env.GOOGLE_CLIENT_ID,
        microsoft: !!process.env.MICROSOFT_CLIENT_ID,
        linkedin: !!process.env.LINKEDIN_CLIENT_ID,
      },
      twoFactor: process.env.ENABLE_2FA !== 'false',
      fileUploads: process.env.ENABLE_FILE_UPLOADS !== 'false',
      emailNotifications: process.env.ENABLE_EMAIL_NOTIFICATIONS !== 'false',
      realTimeCollaboration: process.env.ENABLE_REALTIME !== 'false',
      marketplace: process.env.ENABLE_MARKETPLACE === 'true',
      analytics: process.env.ENABLE_ANALYTICS !== 'false',
      audit: process.env.ENABLE_AUDIT !== 'false',
    };
  }

  get jobs() {
    return {
      contractExpiry: {
        schedule: '0 9 * * *', // Daily at 9 AM
        daysBeforeExpiry: [30, 14, 7, 1],
      },
      cleanup: {
        schedule: '0 2 * * *', // Daily at 2 AM
        tempFileAge: 24 * 60 * 60 * 1000, // 24 hours
        deletedItemsAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      },
      backup: {
        schedule: '0 3 * * *', // Daily at 3 AM
        enabled: this.isProduction,
      },
      analytics: {
        schedule: '0 0 * * 0', // Weekly on Sunday at midnight
        enabled: this.features.analytics,
      },
    };
  }

  get locale() {
    return {
      default: 'en',
      supported: ['en', 'es', 'fr', 'de', 'pt', 'ja', 'zh'],
      fallback: 'en',
    };
  }

  get seo() {
    return {
      title: 'Contract Management System',
      description: 'Streamline your contract lifecycle with our comprehensive management platform',
      keywords: 'contract management, document management, digital signatures, collaboration',
      author: 'Your Company Name',
    };
  }

  get monitoring() {
    return {
      sentry: {
        enabled: !!process.env.SENTRY_DSN,
        dsn: process.env.SENTRY_DSN,
        environment: this.environment,
        tracesSampleRate: this.isProduction ? 0.1 : 1.0,
      },
      metrics: {
        enabled: process.env.ENABLE_METRICS === 'true',
        port: parseInt(process.env.METRICS_PORT, 10) || 9090,
      },
    };
  }

  validate() {
    const required = [
      'JWT_SECRET',
      'JWT_REFRESH_SECRET',
      'MONGODB_URI',
      'SMTP_HOST',
      'SMTP_USER',
      'SMTP_PASS',
      'SMTP_FROM',
    ];

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    // Validate JWT secrets length
    if (process.env.JWT_SECRET.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long');
    }

    if (process.env.JWT_REFRESH_SECRET.length < 32) {
      throw new Error('JWT_REFRESH_SECRET must be at least 32 characters long');
    }

    return true;
  }

  toJSON() {
    return {
      environment: this.environment,
      server: this.server,
      client: this.client,
      api: this.api,
      features: this.features,
      locale: this.locale,
      monitoring: {
        sentry: {
          enabled: this.monitoring.sentry.enabled,
        },
        metrics: this.monitoring.metrics,
      },
    };
  }
}

module.exports = new AppConfig();