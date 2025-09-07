const { User } = require('../models');
const logger = require('../utils/logger');

/**
 * Permission definitions
 */
const PERMISSIONS = {
  // Contract permissions
  CONTRACT_CREATE: 'contract:create',
  CONTRACT_READ: 'contract:read',
  CONTRACT_UPDATE: 'contract:update',
  CONTRACT_DELETE: 'contract:delete',
  CONTRACT_SIGN: 'contract:sign',
  CONTRACT_APPROVE: 'contract:approve',
  CONTRACT_EXPORT: 'contract:export',
  
  // Template permissions
  TEMPLATE_CREATE: 'template:create',
  TEMPLATE_READ: 'template:read',
  TEMPLATE_UPDATE: 'template:update',
  TEMPLATE_DELETE: 'template:delete',
  TEMPLATE_PUBLISH: 'template:publish',
  
  // User permissions
  USER_CREATE: 'user:create',
  USER_READ: 'user:read',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  USER_MANAGE_ROLES: 'user:manage_roles',
  
  // Admin permissions
  ADMIN_ACCESS: 'admin:access',
  ADMIN_ANALYTICS: 'admin:analytics',
  ADMIN_SYSTEM: 'admin:system',
  ADMIN_BILLING: 'admin:billing',
  
  // Organization permissions
  ORG_MANAGE: 'org:manage',
  ORG_BILLING: 'org:billing',
  ORG_MEMBERS: 'org:members',
  ORG_SETTINGS: 'org:settings'
};

/**
 * Role-based permission mappings
 */
const ROLE_PERMISSIONS = {
  super_admin: Object.values(PERMISSIONS), // All permissions
  
  admin: [
    PERMISSIONS.CONTRACT_CREATE,
    PERMISSIONS.CONTRACT_READ,
    PERMISSIONS.CONTRACT_UPDATE,
    PERMISSIONS.CONTRACT_DELETE,
    PERMISSIONS.CONTRACT_SIGN,
    PERMISSIONS.CONTRACT_APPROVE,
    PERMISSIONS.CONTRACT_EXPORT,
    PERMISSIONS.TEMPLATE_CREATE,
    PERMISSIONS.TEMPLATE_READ,
    PERMISSIONS.TEMPLATE_UPDATE,
    PERMISSIONS.TEMPLATE_DELETE,
    PERMISSIONS.TEMPLATE_PUBLISH,
    PERMISSIONS.USER_READ,
    PERMISSIONS.USER_UPDATE,
    PERMISSIONS.USER_MANAGE_ROLES,
    PERMISSIONS.ADMIN_ACCESS,
    PERMISSIONS.ADMIN_ANALYTICS,
    PERMISSIONS.ORG_MANAGE,
    PERMISSIONS.ORG_MEMBERS,
    PERMISSIONS.ORG_SETTINGS
  ],
  
  manager: [
    PERMISSIONS.CONTRACT_CREATE,
    PERMISSIONS.CONTRACT_READ,
    PERMISSIONS.CONTRACT_UPDATE,
    PERMISSIONS.CONTRACT_SIGN,
    PERMISSIONS.CONTRACT_APPROVE,
    PERMISSIONS.CONTRACT_EXPORT,
    PERMISSIONS.TEMPLATE_CREATE,
    PERMISSIONS.TEMPLATE_READ,
    PERMISSIONS.TEMPLATE_UPDATE,
    PERMISSIONS.USER_READ
  ],
  
  user: [
    PERMISSIONS.CONTRACT_CREATE,
    PERMISSIONS.CONTRACT_READ,
    PERMISSIONS.CONTRACT_UPDATE,
    PERMISSIONS.CONTRACT_SIGN,
    PERMISSIONS.CONTRACT_EXPORT,
    PERMISSIONS.TEMPLATE_READ,
    PERMISSIONS.USER_READ,
    PERMISSIONS.USER_UPDATE
  ],
  
  viewer: [
    PERMISSIONS.CONTRACT_READ,
    PERMISSIONS.TEMPLATE_READ,
    PERMISSIONS.USER_READ
  ]
};

/**
 * Check if user has permission
 */
const hasPermission = (user, permission) => {
  if (!user || !permission) return false;
  
  // Get permissions for user's role
  const rolePermissions = ROLE_PERMISSIONS[user.role] || [];
  
  // Check role permissions
  if (rolePermissions.includes(permission)) return true;
  
  // Check custom user permissions
  if (user.customPermissions && user.customPermissions.includes(permission)) return true;
  
  return false;
};

/**
 * Check if user has any of the permissions
 */
const hasAnyPermission = (user, permissions) => {
  return permissions.some(permission => hasPermission(user, permission));
};

/**
 * Check if user has all permissions
 */
const hasAllPermissions = (user, permissions) => {
  return permissions.every(permission => hasPermission(user, permission));
};

/**
 * Permission checking middleware
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!hasPermission(req.user, permission)) {
      logger.warn('Permission denied', {
        userId: req.user._id,
        permission,
        path: req.path
      });
      
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        code: 'PERMISSION_DENIED',
        required: permission
      });
    }

    next();
  };
};

/**
 * Multiple permissions middleware (any)
 */
const requireAnyPermission = (permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!hasAnyPermission(req.user, permissions)) {
      logger.warn('Permission denied', {
        userId: req.user._id,
        permissions,
        path: req.path
      });
      
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        code: 'PERMISSION_DENIED',
        required: permissions
      });
    }

    next();
  };
};

/**
 * Resource ownership middleware
 */
const requireOwnership = (modelName, paramName = 'id') => {
  return async (req, res, next) => {
    try {
      const Model = require('../models')[modelName];
      const resourceId = req.params[paramName];
      
      const resource = await Model.findById(resourceId);
      
      if (!resource) {
        return res.status(404).json({
          error: 'Resource not found',
          code: 'NOT_FOUND'
        });
      }
      
      // Check ownership
      const isOwner = resource.owner?.toString() === req.user._id.toString();
      const isCollaborator = resource.collaborators?.some(
        c => c.user?.toString() === req.user._id.toString()
      );
      
      if (!isOwner && !isCollaborator && !hasPermission(req.user, PERMISSIONS.ADMIN_ACCESS)) {
        return res.status(403).json({
          error: 'Access denied',
          code: 'OWNERSHIP_REQUIRED'
        });
      }
      
      // Attach resource to request
      req.resource = resource;
      req.isOwner = isOwner;
      req.isCollaborator = isCollaborator;
      
      next();
    } catch (error) {
      logger.error('Ownership check error:', error);
      res.status(500).json({
        error: 'Server error',
        code: 'INTERNAL_ERROR'
      });
    }
  };
};

module.exports = {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  requirePermission,
  requireAnyPermission,
  requireOwnership
};