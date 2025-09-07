/**
 * Custom error classes
 */

class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Validation failed', errors = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.errors = errors;
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource', id = '') {
    const message = id ? `${resource} with ID ${id} not found` : `${resource} not found`;
    super(message, 404, 'NOT_FOUND');
    this.resource = resource;
    this.resourceId = id;
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409, 'CONFLICT_ERROR');
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Too many requests', retryAfter = 60) {
    super(message, 429, 'RATE_LIMIT_ERROR');
    this.retryAfter = retryAfter;
  }
}

class BusinessLogicError extends AppError {
  constructor(message, code = 'BUSINESS_ERROR') {
    super(message, 400, code);
  }
}

class ExternalServiceError extends AppError {
  constructor(service, message = 'External service error') {
    super(message, 503, 'EXTERNAL_SERVICE_ERROR');
    this.service = service;
  }
}

class FileUploadError extends AppError {
  constructor(message = 'File upload failed') {
    super(message, 400, 'FILE_UPLOAD_ERROR');
  }
}

class PaymentError extends AppError {
  constructor(message = 'Payment processing failed', details = {}) {
    super(message, 402, 'PAYMENT_ERROR');
    this.details = details;
  }
}

/**
 * Error factory
 */
class ErrorFactory {
  static validation(message, errors) {
    return new ValidationError(message, errors);
  }

  static authentication(message) {
    return new AuthenticationError(message);
  }

  static authorization(message) {
    return new AuthorizationError(message);
  }

  static notFound(resource, id) {
    return new NotFoundError(resource, id);
  }

  static conflict(message) {
    return new ConflictError(message);
  }

  static rateLimit(message, retryAfter) {
    return new RateLimitError(message, retryAfter);
  }

  static businessLogic(message, code) {
    return new BusinessLogicError(message, code);
  }

  static externalService(service, message) {
    return new ExternalServiceError(service, message);
  }

  static fileUpload(message) {
    return new FileUploadError(message);
  }

  static payment(message, details) {
    return new PaymentError(message, details);
  }
}

/**
 * Error handler utility
 */
class ErrorHandler {
  static handle(error, req, res, next) {
    let err = error;

    // Convert non-AppError to AppError
    if (!(error instanceof AppError)) {
      err = new AppError(error.message || 'Internal server error');
    }

    // Log error
    if (err.statusCode >= 500) {
      console.error('Error:', {
        message: err.message,
        code: err.code,
        statusCode: err.statusCode,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        user: req.user?.id
      });
    }

    // Send error response
    const response = {
      error: {
        message: err.message,
        code: err.code
      }
    };

    // Add additional error details in development
    if (process.env.NODE_ENV === 'development') {
      response.error.stack = err.stack;
    }

    // Add validation errors if present
    if (err instanceof ValidationError && err.errors) {
      response.error.errors = err.errors;
    }

    // Add retry-after header for rate limit errors
    if (err instanceof RateLimitError) {
      res.setHeader('Retry-After', err.retryAfter);
    }

    res.status(err.statusCode).json(response);
  }

  static async handleAsync(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  static notFound(req, res) {
    res.status(404).json({
      error: {
        message: 'Resource not found',
        code: 'NOT_FOUND',
        path: req.originalUrl
      }
    });
  }
}

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  BusinessLogicError,
  ExternalServiceError,
  FileUploadError,
  PaymentError,
  ErrorFactory,
  ErrorHandler
};