const { body, param, query, check } = require('express-validator');
const { CONSTANTS } = require('./constants');

/**
 * Custom validators
 */

/**
 * Password strength validator
 */
const isStrongPassword = (value) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(value);
  const hasLowerCase = /[a-z]/.test(value);
  const hasNumber = /\d/.test(value);
  const hasSpecialChar = /[@$!%*?&]/.test(value);
  
  return value.length >= minLength && 
         hasUpperCase && 
         hasLowerCase && 
         hasNumber && 
         hasSpecialChar;
};

/**
 * Phone number validator
 */
const isValidPhone = (value) => {
  const phoneRegex = /^\+?[\d\s-()]+$/;
  return phoneRegex.test(value) && value.replace(/\D/g, '').length >= 10;
};

/**
 * Date validator
 */
const isValidDate = (value) => {
  const date = new Date(value);
  return date instanceof Date && !isNaN(date);
};

/**
 * Future date validator
 */
const isFutureDate = (value) => {
  const date = new Date(value);
  return isValidDate(value) && date > new Date();
};

/**
 * Array validator
 */
const isValidArray = (value, options = {}) => {
  const { minLength = 0, maxLength = Infinity, itemValidator } = options;
  
  if (!Array.isArray(value)) return false;
  if (value.length < minLength || value.length > maxLength) return false;
  
  if (itemValidator) {
    return value.every(item => itemValidator(item));
  }
  
  return true;
};

/**
 * JSON validator
 */
const isValidJSON = (value) => {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
};

/**
 * Common validation schemas
 */
const validators = {
  // ID validators
  mongoId: (field = 'id') => param(field)
    .isMongoId()
    .withMessage('Invalid ID format'),

  // User validators
  email: (field = 'email') => body(field)
    .trim()
    .normalizeEmail()
    .isEmail()
    .withMessage('Invalid email address'),

  password: (field = 'password') => body(field)
    .custom(isStrongPassword)
    .withMessage('Password must be at least 8 characters with uppercase, lowercase, number and special character'),

  username: (field = 'username') => body(field)
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3-30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers and underscore'),

  firstName: (field = 'firstName') => body(field)
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2-50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('First name contains invalid characters'),

  lastName: (field = 'lastName') => body(field)
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2-50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Last name contains invalid characters'),

  phone: (field = 'phone') => body(field)
    .optional()
    .custom(isValidPhone)
    .withMessage('Invalid phone number'),

  // Contract validators
  contractTitle: (field = 'title') => body(field)
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3-200 characters'),

  contractType: (field = 'type') => body(field)
    .isIn(Object.values(CONSTANTS.CONTRACT_TYPES))
    .withMessage('Invalid contract type'),

  contractStatus: (field = 'status') => body(field)
    .optional()
    .isIn(Object.values(CONSTANTS.CONTRACT_STATUS))
    .withMessage('Invalid contract status'),

  contractValue: (field = 'value') => body(field)
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Value must be a positive number'),

  contractContent: (field = 'content') => body(field)
    .notEmpty()
    .withMessage('Content is required')
    .isLength({ min: 10 })
    .withMessage('Content is too short'),

  contractParties: (field = 'parties') => body(field)
    .isArray({ min: 2 })
    .withMessage('At least 2 parties are required'),

  // Date validators
  date: (field) => body(field)
    .optional()
    .custom(isValidDate)
    .withMessage('Invalid date format'),

  futureDate: (field) => body(field)
    .optional()
    .custom(isFutureDate)
    .withMessage('Date must be in the future'),

  dateRange: (startField = 'startDate', endField = 'endDate') => [
    body(startField)
      .optional()
      .custom(isValidDate)
      .withMessage('Invalid start date'),
    body(endField)
      .optional()
      .custom(isValidDate)
      .withMessage('Invalid end date')
      .custom((value, { req }) => {
        if (req.body[startField] && value) {
          return new Date(value) > new Date(req.body[startField]);
        }
        return true;
      })
      .withMessage('End date must be after start date')
  ],

  // Pagination validators
  pagination: () => [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer')
      .toInt(),
    query('limit')
      .optional()
      .isInt({ min: 1, max: CONSTANTS.PAGINATION.MAX_LIMIT })
      .withMessage(`Limit must be between 1-${CONSTANTS.PAGINATION.MAX_LIMIT}`)
      .toInt()
  ],

  // Search validators
  search: (field = 'search') => query(field)
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1-100 characters')
    .escape(),

  // Sort validators
  sortBy: (allowedFields = []) => query('sortBy')
    .optional()
    .isIn(allowedFields)
    .withMessage(`Sort field must be one of: ${allowedFields.join(', ')}`),

  sortOrder: () => query('order')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),

  // File validators
  fileUpload: (field = 'file') => check(field)
    .custom((value, { req }) => {
      if (!req.file) {
        throw new Error('File is required');
      }
      return true;
    }),

  fileType: (allowedTypes = []) => check('file')
    .custom((value, { req }) => {
      if (req.file) {
        const ext = req.file.originalname.split('.').pop().toLowerCase();
        if (!allowedTypes.includes(ext)) {
          throw new Error(`File type must be one of: ${allowedTypes.join(', ')}`);
        }
      }
      return true;
    }),

  fileSize: (maxSize = 10 * 1024 * 1024) => check('file')
    .custom((value, { req }) => {
      if (req.file && req.file.size > maxSize) {
        throw new Error(`File size must not exceed ${maxSize / (1024 * 1024)}MB`);
      }
      return true;
    }),

  // Array validators
  arrayField: (field, options = {}) => body(field)
    .custom(value => isValidArray(value, options))
    .withMessage('Invalid array format'),

  // JSON validators
  jsonField: (field) => body(field)
    .custom(isValidJSON)
    .withMessage('Invalid JSON format'),

  // Custom field validators
  url: (field) => body(field)
    .optional()
    .isURL()
    .withMessage('Invalid URL format'),

  boolean: (field) => body(field)
    .optional()
    .isBoolean()
    .withMessage('Value must be true or false'),

  enum: (field, values) => body(field)
    .isIn(values)
    .withMessage(`Value must be one of: ${values.join(', ')}`),

  // Conditional validators
  requiredIf: (field, condition) => body(field)
    .custom((value, { req }) => {
      if (condition(req)) {
        return value !== undefined && value !== null && value !== '';
      }
      return true;
    })
    .withMessage(`${field} is required`),

  // Sanitizers
  sanitizeHtml: (field) => body(field)
    .customSanitizer(value => {
      // Basic HTML sanitization
      return value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
    }),

  // Complex validators
  party: () => [
    body('*.name')
      .notEmpty()
      .withMessage('Party name is required'),
    body('*.email')
      .isEmail()
      .withMessage('Invalid party email'),
    body('*.role')
      .isIn(['party', 'witness', 'signatory'])
      .withMessage('Invalid party role')
  ],

  address: (prefix = '') => [
    body(`${prefix}street`)
      .optional()
      .trim()
      .isLength({ min: 3, max: 100 }),
    body(`${prefix}city`)
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 }),
    body(`${prefix}state`)
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 }),
    body(`${prefix}zipCode`)
      .optional()
      .matches(/^\d{5}(-\d{4})?$/)
      .withMessage('Invalid ZIP code'),
    body(`${prefix}country`)
      .optional()
      .isISO31661Alpha2()
      .withMessage('Invalid country code')
  ]
};

/**
 * Validation middleware groups
 */
const validationGroups = {
  // Auth validations
  register: [
    validators.email(),
    validators.password(),
    validators.firstName(),
    validators.lastName(),
    validators.phone(),
    body('company')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Company name must be between 2-100 characters')
  ],

  login: [
    validators.email(),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ],

  updateProfile: [
    validators.firstName().optional(),
    validators.lastName().optional(),
    validators.phone(),
    body('bio')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Bio must not exceed 500 characters')
  ],

  changePassword: [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    validators.password('newPassword')
  ],

  // Contract validations
  createContract: [
    validators.contractTitle(),
    validators.contractType(),
    validators.contractContent(),
    validators.contractParties(),
    validators.contractValue(),
    validators.dateRange('dates.effective', 'dates.expiry')
  ],

  updateContract: [
    validators.contractTitle().optional(),
    validators.contractContent().optional(),
    validators.contractStatus(),
    validators.contractValue(),
    validators.dateRange('dates.effective', 'dates.expiry')
  ],

  // Template validations
  createTemplate: [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Template name is required')
      .isLength({ min: 3, max: 100 })
      .withMessage('Name must be between 3-100 characters'),
    body('category')
      .notEmpty()
      .withMessage('Category is required'),
    body('content')
      .notEmpty()
      .withMessage('Content is required'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Description must not exceed 500 characters')
  ],

  // Approval validations
  createApproval: [
    body('type')
      .isIn(Object.values(CONSTANTS.APPROVAL_STATUS))
      .withMessage('Invalid approval type'),
    body('title')
      .trim()
      .notEmpty()
      .withMessage('Title is required'),
    body('approvers')
      .isArray({ min: 1 })
      .withMessage('At least one approver is required'),
    body('approvers.*')
      .isMongoId()
      .withMessage('Invalid approver ID'),
    validators.futureDate('deadline')
  ]
};

module.exports = {
  validators,
  validationGroups,
  // Export custom validators
  isStrongPassword,
  isValidPhone,
  isValidDate,
  isFutureDate,
  isValidArray,
  isValidJSON
};