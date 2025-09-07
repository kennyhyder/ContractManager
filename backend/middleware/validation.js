const { body, param, query, validationResult } = require('express-validator');

/**
 * Validation error handler
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation Error',
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
        value: err.value
      })),
      code: 'VALIDATION_ERROR'
    });
  }
  next();
};

/**
 * Common validation rules
 */
const commonValidations = {
  mongoId: (field) => param(field)
    .isMongoId()
    .withMessage('Invalid ID format'),
  
  email: body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email address'),
  
  password: body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number and special character'),
  
  pagination: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ]
};

/**
 * Auth validation rules
 */
const validateAuth = {
  register: [
    body('firstName')
      .trim()
      .notEmpty()
      .withMessage('First name is required')
      .isLength({ min: 2, max: 50 })
      .withMessage('First name must be between 2-50 characters'),
    body('lastName')
      .trim()
      .notEmpty()
      .withMessage('Last name is required')
      .isLength({ min: 2, max: 50 })
      .withMessage('Last name must be between 2-50 characters'),
    commonValidations.email,
    commonValidations.password,
    body('company')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Company name must be between 2-100 characters'),
    handleValidationErrors
  ],
  
  login: [
    commonValidations.email,
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
    handleValidationErrors
  ],
  
  forgotPassword: [
    commonValidations.email,
    handleValidationErrors
  ],
  
  resetPassword: [
    body('token')
      .notEmpty()
      .withMessage('Reset token is required'),
    commonValidations.password,
    handleValidationErrors
  ]
};

/**
 * Contract validation rules
 */
const validateContract = {
  create: [
    body('title')
      .trim()
      .notEmpty()
      .withMessage('Title is required')
      .isLength({ min: 3, max: 200 })
      .withMessage('Title must be between 3-200 characters'),
    body('type')
      .isIn(['employment', 'service', 'nda', 'lease', 'sales', 'other'])
      .withMessage('Invalid contract type'),
    body('content')
      .notEmpty()
      .withMessage('Content is required'),
    body('parties')
      .isArray({ min: 2 })
      .withMessage('At least 2 parties are required'),
    body('parties.*.name')
      .notEmpty()
      .withMessage('Party name is required'),
    body('parties.*.email')
      .isEmail()
      .withMessage('Invalid party email'),
    body('parties.*.role')
      .isIn(['party', 'witness', 'signatory'])
      .withMessage('Invalid party role'),
    handleValidationErrors
  ],
  
  update: [
    commonValidations.mongoId('id'),
    body('title')
      .optional()
      .trim()
      .isLength({ min: 3, max: 200 })
      .withMessage('Title must be between 3-200 characters'),
    body('content')
      .optional()
      .notEmpty()
      .withMessage('Content cannot be empty'),
    body('status')
      .optional()
      .isIn(['draft', 'review', 'approved', 'signed', 'active', 'expired', 'terminated'])
      .withMessage('Invalid status'),
    handleValidationErrors
  ],
  
  query: [
    ...commonValidations.pagination,
    query('status')
      .optional()
      .isIn(['draft', 'review', 'approved', 'signed', 'active', 'expired', 'terminated'])
      .withMessage('Invalid status filter'),
    query('type')
      .optional()
      .isIn(['employment', 'service', 'nda', 'lease', 'sales', 'other'])
      .withMessage('Invalid type filter'),
    query('search')
      .optional()
      .trim()
      .escape(),
    handleValidationErrors
  ]
};

module.exports = {
  handleValidationErrors,
  commonValidations,
  validateAuth,
  validateContract
};