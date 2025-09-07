const database = require('./database');
const redis = require('./redis');
const email = require('./email');
const aws = require('./aws');
const auth = require('./auth');
const app = require('./app');
const logger = require('../utils/logger');

class Config {
  constructor() {
    this.database = database;
    this.redis = redis;
    this.email = email;
    this.aws = aws;
    this.auth = auth;
    this.app = app;
  }

  async initialize() {
    try {
      // Validate environment variables
      this.app.validate();
      
      // Initialize auth configuration
      this.auth.initialize();
      
      // Connect to database
      await this.database.connect();
      
      // Connect to Redis if enabled
      if (process.env.REDIS_URL) {
        await this.redis.connect();
      }
      
      // Initialize email service
      await this.email.initialize();
      
      // Initialize AWS if configured
      if (process.env.AWS_ACCESS_KEY_ID) {
        this.aws.initialize();
      }
      
      logger.info('All configurations initialized successfully');
    } catch (error) {
      logger.error('Configuration initialization failed:', error);
      throw error;
    }
  }

  async shutdown() {
    try {
      await this.database.disconnect();
      await this.redis.disconnect();
      await this.email.close();
      logger.info('All configurations shut down successfully');
    } catch (error) {
      logger.error('Configuration shutdown error:', error);
    }
  }

  async healthCheck() {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {}
    };

    // Check database
    try {
      health.services.database = await this.database.healthCheck();
    } catch (error) {
      health.services.database = { status: 'unhealthy', error: error.message };
      health.status = 'degraded';
    }

    // Check Redis
    if (process.env.REDIS_URL) {
      try {
        health.services.redis = await this.redis.healthCheck();
      } catch (error) {
        health.services.redis = { status: 'unhealthy', error: error.message };
        health.status = 'degraded';
      }
    }

    // Check AWS S3
    if (process.env.AWS_ACCESS_KEY_ID) {
      try {
        health.services.aws = await this.aws.healthCheck();
      } catch (error) {
        health.services.aws = { status: 'unhealthy', error: error.message };
        health.status = 'degraded';
      }
    }

    return health;
  }
}

module.exports = new Config();