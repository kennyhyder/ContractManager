const crypto = require('crypto');
const moment = require('moment');
const { CONSTANTS } = require('./constants');

/**
 * Helper functions
 */

/**
 * Generate random string
 */
exports.generateRandomString = (length = 32, type = 'hex') => {
  if (type === 'hex') {
    return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
  } else if (type === 'base64') {
    return crypto.randomBytes(Math.ceil(length * 3 / 4)).toString('base64').slice(0, length);
  } else if (type === 'alphanumeric') {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Generate unique ID
 */
exports.generateUniqueId = (prefix = '') => {
  const timestamp = Date.now().toString(36);
  const randomStr = this.generateRandomString(8, 'alphanumeric');
  return prefix ? `${prefix}_${timestamp}_${randomStr}` : `${timestamp}_${randomStr}`;
};

/**
 * Hash data
 */
exports.hashData = (data, algorithm = 'sha256') => {
  return crypto.createHash(algorithm).update(data).digest('hex');
};

/**
 * Slugify string
 */
exports.slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

/**
 * Capitalize first letter
 */
exports.capitalize = (str) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Capitalize words
 */
exports.capitalizeWords = (str) => {
  return str.replace(/\b\w/g, l => l.toUpperCase());
};

/**
 * Format currency
 */
exports.formatCurrency = (amount, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);
};

/**
 * Format file size
 */
exports.formatFileSize = (bytes) => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Bytes';
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Parse boolean
 */
exports.parseBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true' || value === '1';
  }
  return !!value;
};

/**
 * Safe JSON parse
 */
exports.safeJsonParse = (str, defaultValue = null) => {
  try {
    return JSON.parse(str);
  } catch (error) {
    return defaultValue;
  }
};

/**
 * Deep clone object
 */
exports.deepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(item => this.deepClone(item));
  if (obj instanceof Object) {
    const clonedObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = this.deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
};

/**
 * Merge objects deeply
 */
exports.deepMerge = (target, ...sources) => {
  if (!sources.length) return target;
  const source = sources.shift();

  if (this.isObject(target) && this.isObject(source)) {
    for (const key in source) {
      if (this.isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        this.deepMerge(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return this.deepMerge(target, ...sources);
};

/**
 * Check if object
 */
exports.isObject = (item) => {
  return item && typeof item === 'object' && !Array.isArray(item);
};

/**
 * Remove undefined/null values from object
 */
exports.cleanObject = (obj) => {
  const cleaned = {};
  Object.keys(obj).forEach(key => {
    if (obj[key] !== undefined && obj[key] !== null) {
      cleaned[key] = obj[key];
    }
  });
  return cleaned;
};

/**
 * Pick fields from object
 */
exports.pick = (obj, fields) => {
  const picked = {};
  fields.forEach(field => {
    if (obj.hasOwnProperty(field)) {
      picked[field] = obj[field];
    }
  });
  return picked;
};

/**
 * Omit fields from object
 */
exports.omit = (obj, fields) => {
  const result = { ...obj };
  fields.forEach(field => {
    delete result[field];
  });
  return result;
};

/**
 * Paginate array
 */
exports.paginate = (array, page = 1, limit = 20) => {
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  
  return {
    data: array.slice(startIndex, endIndex),
    pagination: {
      page,
      limit,
      total: array.length,
      pages: Math.ceil(array.length / limit)
    }
  };
};

/**
 * Group array by key
 */
exports.groupBy = (array, key) => {
  return array.reduce((grouped, item) => {
    const groupKey = typeof key === 'function' ? key(item) : item[key];
    (grouped[groupKey] = grouped[groupKey] || []).push(item);
    return grouped;
  }, {});
};

/**
 * Sort by multiple fields
 */
exports.sortBy = (array, ...keys) => {
  return array.sort((a, b) => {
    for (const key of keys) {
      const isDescending = key.startsWith('-');
      const actualKey = isDescending ? key.substring(1) : key;
      const multiplier = isDescending ? -1 : 1;
      
      if (a[actualKey] > b[actualKey]) return multiplier;
      if (a[actualKey] < b[actualKey]) return -multiplier;
    }
    return 0;
  });
};

/**
 * Retry function
 */
exports.retry = async (fn, options = {}) => {
  const {
    retries = 3,
    delay = 1000,
    backoff = 2,
    onRetry = () => {}
  } = options;

  let lastError;
  
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (i < retries - 1) {
        const waitTime = delay * Math.pow(backoff, i);
        onRetry(error, i + 1, waitTime);
        await this.sleep(waitTime);
      }
    }
  }
  
  throw lastError;
};

/**
 * Sleep function
 */
exports.sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Chunk array
 */
exports.chunk = (array, size) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

/**
 * Flatten array
 */
exports.flatten = (array, depth = 1) => {
  return depth > 0
    ? array.reduce((acc, val) => 
        acc.concat(Array.isArray(val) ? this.flatten(val, depth - 1) : val), [])
    : array.slice();
};

/**
 * Get nested property
 */
exports.get = (obj, path, defaultValue) => {
  const keys = path.split('.');
  let result = obj;
  
  for (const key of keys) {
    result = result?.[key];
    if (result === undefined) {
      return defaultValue;
    }
  }
  
  return result;
};

/**
 * Set nested property
 */
exports.set = (obj, path, value) => {
  const keys = path.split('.');
  const lastKey = keys.pop();
  
  const target = keys.reduce((acc, key) => {
    if (!acc[key] || typeof acc[key] !== 'object') {
      acc[key] = {};
    }
    return acc[key];
  }, obj);
  
  target[lastKey] = value;
  return obj;
};

/**
 * Debounce function
 */
exports.debounce = (func, wait) => {
  let timeout;
  
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Throttle function
 */
exports.throttle = (func, limit) => {
  let inThrottle;
  
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * Validate email
 */
exports.isValidEmail = (email) => {
  return CONSTANTS.REGEX.EMAIL.test(email);
};

/**
 * Validate URL
 */
exports.isValidUrl = (url) => {
  return CONSTANTS.REGEX.URL.test(url);
};

/**
 * Validate MongoDB ID
 */
exports.isValidMongoId = (id) => {
  return CONSTANTS.REGEX.MONGO_ID.test(id);
};

/**
 * Generate contract number
 */
exports.generateContractNumber = (prefix = 'CNT') => {
  const date = moment().format('YYYYMMDD');
  const random = this.generateRandomString(6, 'alphanumeric').toUpperCase();
  return `${prefix}-${date}-${random}`;
};

/**
 * Calculate percentage
 */
exports.calculatePercentage = (value, total) => {
  if (total === 0) return 0;
  return Math.round((value / total) * 100 * 100) / 100;
};

/**
 * Format duration
 */
exports.formatDuration = (milliseconds) => {
  const duration = moment.duration(milliseconds);
  
  if (duration.years() > 0) {
    return `${duration.years()}y ${duration.months()}m`;
  } else if (duration.months() > 0) {
    return `${duration.months()}m ${duration.days()}d`;
  } else if (duration.days() > 0) {
    return `${duration.days()}d ${duration.hours()}h`;
  } else if (duration.hours() > 0) {
    return `${duration.hours()}h ${duration.minutes()}m`;
  } else {
    return `${duration.minutes()}m`;
  }
};

/**
 * Parse query filters
 */
exports.parseQueryFilters = (query) => {
  const filters = {};
  const allowedOperators = ['gt', 'gte', 'lt', 'lte', 'ne', 'in', 'nin'];
  
  Object.keys(query).forEach(key => {
    if (typeof query[key] === 'object' && !Array.isArray(query[key])) {
      Object.keys(query[key]).forEach(operator => {
        if (allowedOperators.includes(operator)) {
          filters[key] = filters[key] || {};
          filters[key][`$${operator}`] = query[key][operator];
        }
      });
    } else {
      filters[key] = query[key];
    }
  });
  
  return filters;
};

/**
 * Sanitize filename
 */
exports.sanitizeFilename = (filename) => {
  return filename
    .replace(/[^a-z0-9_\-\.]/gi, '_')
    .replace(/_{2,}/g, '_')
    .toLowerCase();
};

/**
 * Get IP address from request
 */
exports.getIpAddress = (req) => {
  return req.ip || 
         req.headers['x-forwarded-for']?.split(',')[0] || 
         req.headers['x-real-ip'] ||
         req.connection.remoteAddress;
};

/**
 * Mask sensitive data
 */
exports.maskSensitiveData = (str, showChars = 4) => {
  if (!str || str.length <= showChars) return str;
  const visiblePart = str.slice(-showChars);
  const maskedPart = '*'.repeat(Math.max(str.length - showChars, 4));
  return maskedPart + visiblePart;
};

/**
 * Calculate expiry status
 */
exports.calculateExpiryStatus = (expiryDate) => {
  if (!expiryDate) return null;
  
  const now = moment();
  const expiry = moment(expiryDate);
  const daysUntilExpiry = expiry.diff(now, 'days');
  
  if (daysUntilExpiry < 0) {
    return { status: 'expired', days: Math.abs(daysUntilExpiry) };
  } else if (daysUntilExpiry <= 7) {
    return { status: 'expiring_soon', days: daysUntilExpiry };
  } else if (daysUntilExpiry <= 30) {
    return { status: 'expiring', days: daysUntilExpiry };
  } else {
    return { status: 'active', days: daysUntilExpiry };
  }
};