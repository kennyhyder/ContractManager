/**
 * Middleware exports
 */

const { 
  authMiddleware, 
  roleMiddleware, 
  permissionMiddleware, 
  optionalAuthMiddleware 
} = require('./auth');

const { 
  errorHandler, 
  asyncHandler, 
  notFound 
} = require('./errorHandler');

const { 
  handleValidationErrors,
  commonValidations,
  validateAuth,
  validateContract
} = require('./validation');

const rateLimiters = require('./rateLimiter');

const {
  PERMISSIONS,
  requirePermission,
  requireAnyPermission,
  requireOwnership
} = require('./permissions');

const {
  uploaders,
  handleUploadError,
  cleanupFiles
} = require('./upload');

const {
  cache,
  clearCache,
  invalidateCache,
  cacheMiddlewares
} = require('./cache');

const {
  logger,
  requestLogger,
  errorLogger,
  auditLog
} = require('./logger');

module.exports = {
  // Authentication
  authMiddleware,
  roleMiddleware,
  permissionMiddleware,
  optionalAuthMiddleware,
  
  // Error handling
  errorHandler,
  asyncHandler,
  notFound,
  
  // Validation
  handleValidationErrors,
  commonValidations,
  validateAuth,
  validateContract,
  
  // Rate limiting
  rateLimiters,
  
  // Permissions
  PERMISSIONS,
  requirePermission,
  requireAnyPermission,
  requireOwnership,
  
  // File uploads
  uploaders,
  handleUploadError,
  cleanupFiles,
  
  // Caching
  cache,
  clearCache,
  invalidateCache,
  cacheMiddlewares,
  
  // Logging
  logger,
  requestLogger,
  errorLogger,
  auditLog
};