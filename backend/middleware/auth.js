const jwt = require('jsonwebtoken');
const { User } = require('../models');
const logger = require('../utils/logger');

/**
 * Authentication middleware
 */
const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('No token provided');
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      throw new Error('User not found');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    // Check if account is locked
    if (user.isLocked()) {
      throw new Error('Account is locked');
    }

    // Attach user to request
    req.user = user;
    req.token = token;
    req.userId = user._id;
    
    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    
    res.status(401).json({ message: 'Please authenticate' });
  }
};

/**
 * Role-based access control middleware
 */
const roleMiddleware = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'Access denied. Insufficient permissions.' 
      });
    }

    next();
  };
};

/**
 * Permission-based access control middleware
 */
const permissionMiddleware = (resource, action) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Admins have all permissions
    if (req.user.role === 'admin' || req.user.role === 'super_admin') {
      return next();
    }

    // Check specific permissions
    const hasPermission = req.user.permissions.some(perm => 
      perm.resource === resource && perm.actions.includes(action)
    );

    if (!hasPermission) {
      return res.status(403).json({ 
        message: `Access denied. Missing ${action} permission for ${resource}.` 
      });
    }

    next();
  };
};

/**
 * Optional auth middleware - doesn't fail if no token
 */
const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (user && user.isActive) {
      req.user = user;
      req.token = token;
      req.userId = user._id;
    }
  } catch (error) {
    // Ignore errors for optional auth
    logger.debug('Optional auth error:', error.message);
  }
  
  next();
};

module.exports = {
  authMiddleware,
  roleMiddleware,
  permissionMiddleware,
  optionalAuthMiddleware
};