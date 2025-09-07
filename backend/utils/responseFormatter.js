/**
 * Response formatter utilities
 */

class ResponseFormatter {
  /**
   * Success response
   */
  static success(data = null, message = 'Success', meta = {}) {
    const response = {
      success: true,
      message
    };

    if (data !== null) {
      response.data = data;
    }

    if (Object.keys(meta).length > 0) {
      response.meta = meta;
    }

    return response;
  }

  /**
   * Error response
   */
  static error(message = 'Error', code = 'ERROR', errors = null) {
    const response = {
      success: false,
      error: {
        message,
        code
      }
    };

    if (errors) {
      response.error.errors = errors;
    }

    return response;
  }

  /**
   * Paginated response
   */
  static paginated(data, pagination, message = 'Success') {
    return {
      success: true,
      message,
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        pages: Math.ceil(pagination.total / pagination.limit),
        hasNext: pagination.page < Math.ceil(pagination.total / pagination.limit),
        hasPrev: pagination.page > 1
      }
    };
  }

  /**
   * Created response
   */
  static created(data, message = 'Resource created successfully', location = null) {
    const response = this.success(data, message);
    
    if (location) {
      response.location = location;
    }
    
    return response;
  }

  /**
   * Updated response
   */
  static updated(data, message = 'Resource updated successfully') {
    return this.success(data, message);
  }

  /**
   * Deleted response
   */
  static deleted(message = 'Resource deleted successfully') {
    return this.success(null, message);
  }

  /**
   * No content response
   */
  static noContent() {
    return null;
  }

  /**
   * Validation error response
   */
  static validationError(errors, message = 'Validation failed') {
    return this.error(message, 'VALIDATION_ERROR', errors);
  }

  /**
   * Not found response
   */
  static notFound(resource = 'Resource', message = null) {
    return this.error(
      message || `${resource} not found`,
      'NOT_FOUND'
    );
  }

  /**
   * Unauthorized response
   */
  static unauthorized(message = 'Unauthorized') {
    return this.error(message, 'UNAUTHORIZED');
  }

  /**
   * Forbidden response
   */
  static forbidden(message = 'Access denied') {
    return this.error(message, 'FORBIDDEN');
  }

  /**
   * Conflict response
   */
  static conflict(message = 'Resource conflict') {
    return this.error(message, 'CONFLICT');
  }

  /**
   * Too many requests response
   */
  static tooManyRequests(message = 'Too many requests', retryAfter = null) {
    const response = this.error(message, 'RATE_LIMIT_EXCEEDED');
    
    if (retryAfter) {
      response.retryAfter = retryAfter;
    }
    
    return response;
  }

  /**
   * Internal error response
   */
  static internalError(message = 'Internal server error') {
    return this.error(message, 'INTERNAL_ERROR');
  }

  /**
   * Service unavailable response
   */
  static serviceUnavailable(message = 'Service temporarily unavailable') {
    return this.error(message, 'SERVICE_UNAVAILABLE');
  }

  /**
   * Custom response
   */
  static custom(statusCode, data) {
    return data;
  }

  /**
   * Format list response
   */
  static list(items, meta = {}) {
    return this.success({
      items,
      count: items.length,
      ...meta
    });
  }

  /**
   * Format search results
   */
  static searchResults(results, query, pagination = null) {
    const response = {
      success: true,
      query,
      results,
      totalResults: results.length
    };

    if (pagination) {
      response.pagination = {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        pages: Math.ceil(pagination.total / pagination.limit)
      };
    }

    return response;
  }

  /**
   * Format file upload response
   */
  static fileUploaded(file, message = 'File uploaded successfully') {
    return this.success({
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      url: file.url || file.location
    }, message);
  }

  /**
   * Format bulk operation response
   */
  static bulkOperation(results, operation = 'operation') {
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    return this.success({
      results,
      summary: {
        total: results.length,
        successful,
        failed
      }
    }, `Bulk ${operation} completed`);
  }

  /**
   * Format analytics response
   */
  static analytics(data, period, meta = {}) {
    return this.success({
      period,
      data,
      generated: new Date().toISOString(),
      ...meta
    });
  }

  /**
   * Format health check response
   */
  static healthCheck(services = {}) {
    const allHealthy = Object.values(services).every(s => s.status === 'healthy');
    
    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services,
      version: process.env.APP_VERSION || '1.0.0'
    };
  }
}

/**
 * Express response middleware
 */
function responseMiddleware(req, res, next) {
  // Success responses
  res.success = function(data, message, meta) {
    return res.json(ResponseFormatter.success(data, message, meta));
  };

  res.created = function(data, message, location) {
    res.status(201);
    if (location) {
      res.location(location);
    }
    return res.json(ResponseFormatter.created(data, message));
  };

  res.updated = function(data, message) {
    return res.json(ResponseFormatter.updated(data, message));
  };

  res.deleted = function(message) {
    return res.json(ResponseFormatter.deleted(message));
  };

  res.noContent = function() {
    return res.status(204).send();
  };

  res.paginated = function(data, pagination, message) {
    return res.json(ResponseFormatter.paginated(data, pagination, message));
  };

  // Error responses
  res.error = function(message, code, statusCode = 400) {
    return res.status(statusCode).json(ResponseFormatter.error(message, code));
  };

  res.validationError = function(errors, message) {
    return res.status(400).json(ResponseFormatter.validationError(errors, message));
  };

  res.notFound = function(resource, message) {
    return res.status(404).json(ResponseFormatter.notFound(resource, message));
  };

  res.unauthorized = function(message) {
    return res.status(401).json(ResponseFormatter.unauthorized(message));
  };

  res.forbidden = function(message) {
    return res.status(403).json(ResponseFormatter.forbidden(message));
  };

  res.conflict = function(message) {
    return res.status(409).json(ResponseFormatter.conflict(message));
  };

  res.tooManyRequests = function(message, retryAfter) {
    if (retryAfter) {
      res.setHeader('Retry-After', retryAfter);
    }
    return res.status(429).json(ResponseFormatter.tooManyRequests(message, retryAfter));
  };

  res.internalError = function(message) {
    return res.status(500).json(ResponseFormatter.internalError(message));
  };

  res.serviceUnavailable = function(message) {
    return res.status(503).json(ResponseFormatter.serviceUnavailable(message));
  };

  // Custom responses
  res.list = function(items, meta) {
    return res.json(ResponseFormatter.list(items, meta));
  };

  res.searchResults = function(results, query, pagination) {
    return res.json(ResponseFormatter.searchResults(results, query, pagination));
  };

  res.fileUploaded = function(file, message) {
    return res.json(ResponseFormatter.fileUploaded(file, message));
  };

  res.bulkOperation = function(results, operation) {
    return res.json(ResponseFormatter.bulkOperation(results, operation));
  };

  res.analytics = function(data, period, meta) {
    return res.json(ResponseFormatter.analytics(data, period, meta));
  };

  res.healthCheck = function(services) {
    return res.json(ResponseFormatter.healthCheck(services));
  };

  next();
}

module.exports = {
  ResponseFormatter,
  responseMiddleware
};