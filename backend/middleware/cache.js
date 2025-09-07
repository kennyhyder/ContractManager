const Redis = require('ioredis');
const crypto = require('crypto');
const logger = require('../utils/logger');

// Initialize Redis client
const redis = process.env.REDIS_URL 
  ? new Redis(process.env.REDIS_URL)
  : null;

if (redis) {
  redis.on('error', (err) => {
    logger.error('Redis error:', err);
  });
  
  redis.on('connect', () => {
    logger.info('Redis connected');
  });
}

/**
 * Generate cache key
 */
const generateCacheKey = (req, prefix = 'cache') => {
  const url = req.originalUrl || req.url;
  const userId = req.user?._id || 'anonymous';
  const method = req.method;
  
  // Create a hash of the request
  const hash = crypto
    .createHash('md5')
    .update(method + url + userId)
    .digest('hex');
  
  return `${prefix}:${hash}`;
};

/**
 * Cache middleware factory
 */
const cache = (options = {}) => {
  const {
    prefix = 'cache',
    ttl = 300, // 5 minutes default
    condition = () => true,
    keyGenerator = generateCacheKey
  } = options;
  
  return async (req, res, next) => {
    // Skip if Redis not available
    if (!redis) return next();
    
    // Skip if condition not met
    if (!condition(req)) return next();
    
    // Only cache GET requests by default
    if (req.method !== 'GET') return next();
    
    const key = keyGenerator(req, prefix);
    
    try {
      // Check cache
      const cached = await redis.get(key);
      
      if (cached) {
        logger.debug(`Cache hit: ${key}`);
        const data = JSON.parse(cached);
        
        // Set cache headers
        res.set('X-Cache', 'HIT');
        res.set('X-Cache-TTL', ttl);
        
        return res.status(data.statusCode || 200).json(data.body);
      }
      
      // Cache miss
      logger.debug(`Cache miss: ${key}`);
      res.set('X-Cache', 'MISS');
      
      // Store original send function
      const originalSend = res.json;
      
      // Override send function to cache the response
      res.json = function(body) {
        res.json = originalSend;
        
        // Only cache successful responses
        if (res.statusCode < 400) {
          const data = {
            body,
            statusCode: res.statusCode,
            timestamp: Date.now()
          };
          
          redis
            .setex(key, ttl, JSON.stringify(data))
            .catch(err => logger.error('Cache set error:', err));
        }
        
        return res.json(body);
      };
      
      next();
    } catch (error) {
      logger.error('Cache middleware error:', error);
      next();
    }
  };
};

/**
 * Clear cache utility
 */
const clearCache = async (pattern) => {
  if (!redis) return;
  
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
      logger.info(`Cleared ${keys.length} cache entries`);
    }
  } catch (error) {
    logger.error('Clear cache error:', error);
  }
};

/**
 * Cache invalidation middleware
 */
const invalidateCache = (patterns) => {
  return async (req, res, next) => {
    // Invalidate after response
    res.on('finish', async () => {
      if (res.statusCode < 400) {
        for (const pattern of patterns) {
          await clearCache(pattern);
        }
      }
    });
    next();
  };
};

/**
 * Specific cache instances
 */
const cacheMiddlewares = {
  // Cache contract list for 5 minutes
  contracts: cache({
    prefix: 'contracts',
    ttl: 300,
    condition: (req) => !req.query.nocache
  }),
  
  // Cache user profiles for 10 minutes
  users: cache({
    prefix: 'users',
    ttl: 600,
    condition: (req) => !req.query.nocache
  }),
  
  // Cache templates for 1 hour
  templates: cache({
    prefix: 'templates',
    ttl: 3600,
    condition: (req) => !req.query.nocache
  }),
  
  // Cache analytics for 30 minutes
  analytics: cache({
    prefix: 'analytics',
    ttl: 1800,
    condition: (req) => !req.query.nocache
  })
};

module.exports = {
  cache,
  clearCache,
  invalidateCache,
  cacheMiddlewares,
  redis
};