const morgan = require('morgan');
const winston = require('winston');
const path = require('path');

// Create winston logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'contract-management' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Add file transport in production
if (process.env.NODE_ENV === 'production') {
  // Error logs
  logger.add(new winston.transports.File({
    filename: path.join(process.env.LOG_DIR || 'logs', 'error.log'),
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }));
  
  // Combined logs
  logger.add(new winston.transports.File({
    filename: path.join(process.env.LOG_DIR || 'logs', 'combined.log'),
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }));
}

/**
 * Custom morgan token for user ID
 */
morgan.token('user-id', (req) => req.user?._id || 'anonymous');

/**
 * Custom morgan token for response time in ms
 */
morgan.token('response-time-ms', (req, res) => {
  if (!req._startAt || !res._startAt) {
    return '-';
  }
  
  const ms = (res._startAt[0] - req._startAt[0]) * 1e3 +
    (res._startAt[1] - req._startAt[1]) * 1e-6;
  
  return ms.toFixed(3);
});

/**
 * Morgan format for development
 */
const developmentFormat = ':method :url :status :response-time-ms ms - :res[content-length] - :user-id';

/**
 * Morgan format for production (JSON)
 */
const productionFormat = (tokens, req, res) => {
  return JSON.stringify({
    method: tokens.method(req, res),
    url: tokens.url(req, res),
    status: parseInt(tokens.status(req, res)),
    responseTime: parseFloat(tokens['response-time-ms'](req, res)),
    contentLength: tokens.res(req, res, 'content-length'),
    userAgent: tokens['user-agent'](req, res),
    ip: tokens['remote-addr'](req, res),
    userId: tokens['user-id'](req, res),
    timestamp: new Date().toISOString()
  });
};

/**
 * Skip logging for certain requests
 */
const skip = (req) => {
  // Skip health checks and static files
  return req.url === '/health' || 
         req.url.startsWith('/static') || 
         req.url.startsWith('/public');
};

/**
 * Request logging middleware
 */
const requestLogger = process.env.NODE_ENV === 'production'
  ? morgan(productionFormat, {
      skip,
      stream: {
        write: (message) => {
          logger.info('HTTP Request', JSON.parse(message));
        }
      }
    })
  : morgan(developmentFormat, { skip });

/**
 * Error logging middleware
 */
const errorLogger = (err, req, res, next) => {
  logger.error({
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userId: req.user?._id,
    body: req.body,
    timestamp: new Date().toISOString()
  });
  
  next(err);
};

/**
 * Audit logging for sensitive operations
 */
const auditLog = (action, details = {}) => {
  return (req, res, next) => {
    // Log after response
    res.on('finish', () => {
      if (res.statusCode < 400) {
        logger.info({
          type: 'AUDIT',
          action,
          userId: req.user?._id,
          targetId: req.params.id,
          details,
          ip: req.ip,
          userAgent: req.get('user-agent'),
          timestamp: new Date().toISOString()
        });
      }
    });
    next();
  };
};

module.exports = {
  logger,
  requestLogger,
  errorLogger,
  auditLog
};