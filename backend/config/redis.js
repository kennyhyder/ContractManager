const Redis = require('redis');
const logger = require('../utils/logger');

class RedisConfig {
  constructor() {
    this.client = null;
    this.subscriber = null;
    this.publisher = null;
  }

  async connect() {
    const config = {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        connectTimeout: 10000,
        keepAlive: 5000,
      },
      password: process.env.REDIS_PASSWORD || undefined,
      database: process.env.REDIS_DB || 0,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    };

    try {
      // Create main client
      this.client = Redis.createClient(config);
      
      // Create pub/sub clients
      this.subscriber = this.client.duplicate();
      this.publisher = this.client.duplicate();

      // Set up error handlers
      this.client.on('error', (err) => logger.error('Redis Client Error:', err));
      this.subscriber.on('error', (err) => logger.error('Redis Subscriber Error:', err));
      this.publisher.on('error', (err) => logger.error('Redis Publisher Error:', err));

      // Set up connection handlers
      this.client.on('connect', () => logger.info('Redis Client Connected'));
      this.client.on('ready', () => logger.info('Redis Client Ready'));

      // Connect all clients
      await Promise.all([
        this.client.connect(),
        this.subscriber.connect(),
        this.publisher.connect()
      ]);

      return true;
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.client) await this.client.quit();
      if (this.subscriber) await this.subscriber.quit();
      if (this.publisher) await this.publisher.quit();
      logger.info('Redis connections closed');
    } catch (error) {
      logger.error('Error disconnecting from Redis:', error);
    }
  }

  // Cache operations
  async get(key) {
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Redis GET error for key ${key}:`, error);
      return null;
    }
  }

  async set(key, value, ttl = 3600) {
    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await this.client.setex(key, ttl, serialized);
      } else {
        await this.client.set(key, serialized);
      }
      return true;
    } catch (error) {
      logger.error(`Redis SET error for key ${key}:`, error);
      return false;
    }
  }

  async del(key) {
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error(`Redis DEL error for key ${key}:`, error);
      return false;
    }
  }

  async exists(key) {
    try {
      return await this.client.exists(key);
    } catch (error) {
      logger.error(`Redis EXISTS error for key ${key}:`, error);
      return false;
    }
  }

  // Pattern-based operations
  async deletePattern(pattern) {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
      return keys.length;
    } catch (error) {
      logger.error(`Redis DELETE PATTERN error for pattern ${pattern}:`, error);
      return 0;
    }
  }

  // List operations
  async lpush(key, value) {
    try {
      return await this.client.lpush(key, JSON.stringify(value));
    } catch (error) {
      logger.error(`Redis LPUSH error for key ${key}:`, error);
      return null;
    }
  }

  async lrange(key, start, stop) {
    try {
      const values = await this.client.lrange(key, start, stop);
      return values.map(v => JSON.parse(v));
    } catch (error) {
      logger.error(`Redis LRANGE error for key ${key}:`, error);
      return [];
    }
  }

  // Hash operations
  async hset(key, field, value) {
    try {
      return await this.client.hset(key, field, JSON.stringify(value));
    } catch (error) {
      logger.error(`Redis HSET error for key ${key}:`, error);
      return null;
    }
  }

  async hget(key, field) {
    try {
      const value = await this.client.hget(key, field);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Redis HGET error for key ${key}:`, error);
      return null;
    }
  }

  async hgetall(key) {
    try {
      const hash = await this.client.hgetall(key);
      const result = {};
      for (const [field, value] of Object.entries(hash)) {
        result[field] = JSON.parse(value);
      }
      return result;
    } catch (error) {
      logger.error(`Redis HGETALL error for key ${key}:`, error);
      return {};
    }
  }

  // Set operations
  async sadd(key, member) {
    try {
      return await this.client.sadd(key, member);
    } catch (error) {
      logger.error(`Redis SADD error for key ${key}:`, error);
      return null;
    }
  }

  async smembers(key) {
    try {
      return await this.client.smembers(key);
    } catch (error) {
      logger.error(`Redis SMEMBERS error for key ${key}:`, error);
      return [];
    }
  }

  async srem(key, member) {
    try {
      return await this.client.srem(key, member);
    } catch (error) {
      logger.error(`Redis SREM error for key ${key}:`, error);
      return null;
    }
  }

  // Pub/Sub operations
  async publish(channel, message) {
    try {
      return await this.publisher.publish(channel, JSON.stringify(message));
    } catch (error) {
      logger.error(`Redis PUBLISH error for channel ${channel}:`, error);
      return null;
    }
  }

  async subscribe(channel, callback) {
    try {
      await this.subscriber.subscribe(channel, (message) => {
        try {
          const parsed = JSON.parse(message);
          callback(parsed);
        } catch (error) {
          logger.error('Error parsing subscription message:', error);
        }
      });
    } catch (error) {
      logger.error(`Redis SUBSCRIBE error for channel ${channel}:`, error);
    }
  }

  async unsubscribe(channel) {
    try {
      await this.subscriber.unsubscribe(channel);
    } catch (error) {
      logger.error(`Redis UNSUBSCRIBE error for channel ${channel}:`, error);
    }
  }

  // Utility methods
  async healthCheck() {
    try {
      await this.client.ping();
      return { status: 'healthy', message: 'Redis is responsive' };
    } catch (error) {
      return { status: 'unhealthy', message: error.message };
    }
  }

  async flushDb() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot flush database in production');
    }
    try {
      await this.client.flushDb();
      logger.info('Redis database flushed');
    } catch (error) {
      logger.error('Error flushing Redis database:', error);
    }
  }
}

module.exports = new RedisConfig();