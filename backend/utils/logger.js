const winston = require('winston');
const path = require('path');
const fs = require('fs');
const DailyRotateFile = require('winston-daily-rotate-file');

// Create logs directory if it doesn't exist
const logsDir = process.env.LOG_DIR || 'logs';
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Log levels
 */
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6
};

/**
 * Log colors
 */
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  verbose: 'cyan',
  debug: 'blue',
  silly: 'gray'
};

winston.addColors(colors);

/**
 * Format configuration
 */
const formatConfig = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

/**
 * Console format for development
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  })
);

/**
 * Transport configurations
 */
const transports = [];

// Console transport
transports.push(
  new winston.transports.Console({
    format: process.env.NODE_ENV === 'development' ? consoleFormat : formatConfig,
    level: process.env.LOG_LEVEL || 'debug'
  })
);

// File transports for production
if (process.env.NODE_ENV === 'production') {
  // Error log file
  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '30d',
      zippedArchive: true
    })
  );

  // Combined log file
  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true
    })
  );

  // Application log file
  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'application-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'info',
      maxSize: '20m',
      maxFiles: '7d',
      zippedArchive: true,
      format: winston.format.combine(
        winston.format.uncolorize(),
        formatConfig
      )
    })
  );
}

/**
 * Create logger instance
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format: formatConfig,
  transports,
  exitOnError: false
});

/**
 * Stream for Morgan HTTP logger
 */
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  }
};

/**
 * Extended logging methods
 */
class Logger {
  constructor(winstonLogger) {
    this.logger = winstonLogger;
    
    // Bind Winston methods
    ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'].forEach(level => {
      this[level] = this.logger[level].bind(this.logger);
    });
  }

  /**
   * Log error with context
   */
  logError(error, context = {}) {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      code: error.code,
      statusCode: error.statusCode,
      ...context
    };

    this.error('Error occurred', errorInfo);
  }

  /**
   * Log API request
   */
  logRequest(req, additionalInfo = {}) {
    this.http('API Request', {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      userId: req.user?.id,
      ...additionalInfo
    });
  }

  /**
   * Log API response
   */
  logResponse(req, res, responseTime) {
    this.http('API Response', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      userId: req.user?.id
    });
  }

  /**
   * Log database query
   */
  logQuery(operation, collection, query = {}, duration) {
    this.debug('Database Query', {
      operation,
      collection,
      query,
      duration: duration ? `${duration}ms` : undefined
    });
  }

  /**
   * Log security event
   */
  logSecurity(event, details = {}) {
    this.warn('Security Event', {
      event,
      ...details,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log performance metric
   */
  logPerformance(metric, value, context = {}) {
    this.info('Performance Metric', {
      metric,
      value,
      ...context
    });
  }

  /**
   * Log business event
   */
  logBusinessEvent(event, userId, details = {}) {
    this.info('Business Event', {
      event,
      userId,
      ...details,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log integration event
   */
  logIntegration(service, action, status, details = {}) {
    const level = status === 'error' ? 'error' : 'info';
    this[level]('Integration Event', {
      service,
      action,
      status,
      ...details
    });
  }

  /**
   * Create child logger with context
   */
  child(defaultMeta) {
    const childWinston = this.logger.child(defaultMeta);
    return new Logger(childWinston);
  }

  /**
   * Measure and log execution time
   */
  async measureTime(name, fn) {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.debug(`${name} completed`, { duration: `${duration}ms` });
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.error(`${name} failed`, { 
        duration: `${duration}ms`, 
        error: error.message 
      });
      throw error;
    }
  }
}

// Create and export logger instance
const loggerInstance = new Logger(logger);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  loggerInstance.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  loggerInstance.error('Unhandled Rejection', {
    reason: reason,
    promise: promise
  });
});

module.exports = loggerInstance;