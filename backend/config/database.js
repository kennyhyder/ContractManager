const mongoose = require('mongoose');
const logger = require('../utils/logger');

const config = {
  development: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/contract-management',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      autoIndex: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    }
  },
  test: {
    uri: process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/contract-management-test',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      autoIndex: true,
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    }
  },
  production: {
    uri: process.env.MONGODB_URI,
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      autoIndex: false,
      maxPoolSize: 50,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      // SSL/TLS Options for production
      ...(process.env.MONGODB_SSL === 'true' && {
        ssl: true,
        sslValidate: true,
        sslCA: process.env.MONGODB_CA_CERT,
      })
    }
  }
};

class Database {
  constructor() {
    this.connection = null;
    this.isConnected = false;
  }

  async connect() {
    const environment = process.env.NODE_ENV || 'development';
    const dbConfig = config[environment];

    if (!dbConfig.uri) {
      throw new Error('Database URI is not configured');
    }

    try {
      // Set up mongoose connection events
      mongoose.connection.on('connected', () => {
        logger.info('MongoDB connected successfully');
        this.isConnected = true;
      });

      mongoose.connection.on('error', (err) => {
        logger.error('MongoDB connection error:', err);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
        this.isConnected = false;
      });

      // Connect to MongoDB
      this.connection = await mongoose.connect(dbConfig.uri, dbConfig.options);
      
      // Graceful shutdown
      process.on('SIGINT', async () => {
        await this.disconnect();
        process.exit(0);
      });

      return this.connection;
    } catch (error) {
      logger.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.connection) {
      await mongoose.disconnect();
      logger.info('MongoDB connection closed');
    }
  }

  async healthCheck() {
    if (!this.isConnected) {
      return { status: 'disconnected', message: 'Database is not connected' };
    }

    try {
      await mongoose.connection.db.admin().ping();
      return { status: 'healthy', message: 'Database is responsive' };
    } catch (error) {
      return { status: 'unhealthy', message: error.message };
    }
  }

  // Get database statistics
  async getStats() {
    if (!this.isConnected) {
      throw new Error('Database is not connected');
    }

    const stats = await mongoose.connection.db.stats();
    return {
      database: stats.db,
      collections: stats.collections,
      documents: stats.objects,
      dataSize: stats.dataSize,
      storageSize: stats.storageSize,
      indexes: stats.indexes,
      indexSize: stats.indexSize,
    };
  }
}

module.exports = new Database();