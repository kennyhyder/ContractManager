const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');
const logger = require('../utils/logger');

// Create Redis client if available
let redisClient;
if (process.env.REDIS_URL) {
  redisClient = new Redis(process.env.REDIS_URL);
  
  redisClient.on('error', (err) => {
    logger.error('Redis client error:', err);
  });
}

/**
 * Create rate limiter with given options
 */
const createRateLimiter = (options) => {
  const config = {
    windowMs: 15 * 60 * 1000, // 15 minutes default
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        userId: req.user?._id
      });
      
      res.status(429).json({
        error: config.message,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.round(config.windowMs / 1000)
      });
    },
    ...options
  };

  // Use Redis store if available
  if (redisClient) {
    config.store = new RedisStore({
      client: redisClient,
      prefix: 'rate-limit:'
    });
  }

  return rateLimit(config);
};

/**
 * Different rate limiters for different endpoints
 */
const rateLimiters = {
  // Strict limit for auth endpoints
  auth: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window
    message: 'Too many authentication attempts, please try again later.',
    skipSuccessfulRequests: true
  }),

  // Moderate limit for API endpoints
  api: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // 100 requests per window
  }),

  // Relaxed limit for read operations
  read: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200 // 200 requests per window
  }),

  // Strict limit for file uploads
  upload: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // 20 uploads per hour
    message: 'Upload limit exceeded, please try again later.'
  }),

  // Very strict limit for password reset
  passwordReset: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 requests per hour
    message: 'Too many password reset requests, please try again later.',
    skipSuccessfulRequests: false
  })
};

module.exports = rateLimiters;