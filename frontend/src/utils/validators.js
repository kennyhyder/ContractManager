import * as Yup from 'yup';
import { REGEX_PATTERNS } from './constants';

// Common validation messages
const VALIDATION_MESSAGES = {
  REQUIRED: 'This field is required',
  EMAIL: 'Please enter a valid email address',
  MIN_LENGTH: (min) => `Must be at least ${min} characters`,
  MAX_LENGTH: (max) => `Must be no more than ${max} characters`,
  MIN_VALUE: (min) => `Must be at least ${min}`,
  MAX_VALUE: (max) => `Must be no more than ${max}`,
  PATTERN: 'Invalid format',
  URL: 'Please enter a valid URL',
  PHONE: 'Please enter a valid phone number',
  PASSWORD_STRENGTH: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  PASSWORDS_MATCH: 'Passwords must match',
  FUTURE_DATE: 'Date must be in the future',
  PAST_DATE: 'Date must be in the past',
  DATE_RANGE: 'End date must be after start date',
};

// Custom validators
export const validators = {
  required: (message = VALIDATION_MESSAGES.REQUIRED) => 
    Yup.string().required(message),
  
  email: (message = VALIDATION_MESSAGES.EMAIL) => 
    Yup.string()
      .required(VALIDATION_MESSAGES.REQUIRED)
      .email(message),
  
  password: (minLength = 8) => 
    Yup.string()
      .required(VALIDATION_MESSAGES.REQUIRED)
      .min(minLength, VALIDATION_MESSAGES.MIN_LENGTH(minLength))
      .matches(REGEX_PATTERNS.PASSWORD, VALIDATION_MESSAGES.PASSWORD_STRENGTH),
  
  confirmPassword: (ref = 'password') => 
    Yup.string()
      .required(VALIDATION_MESSAGES.REQUIRED)
      .oneOf([Yup.ref(ref), null], VALIDATION_MESSAGES.PASSWORDS_MATCH),
  
  phone: (required = true) => {
    const schema = Yup.string().matches(REGEX_PATTERNS.PHONE, VALIDATION_MESSAGES.PHONE);
    return required ? schema.required(VALIDATION_MESSAGES.REQUIRED) : schema.nullable();
  },
  
  url: (required = true) => {
    const schema = Yup.string().matches(REGEX_PATTERNS.URL, VALIDATION_MESSAGES.URL);
    return required ? schema.required(VALIDATION_MESSAGES.REQUIRED) : schema.nullable();
  },
  
  minLength: (min, message) => 
    Yup.string().min(min, message || VALIDATION_MESSAGES.MIN_LENGTH(min)),
  
  maxLength: (max, message) => 
    Yup.string().max(max, message || VALIDATION_MESSAGES.MAX_LENGTH(max)),
  
  number: (min, max) => {
    let schema = Yup.number().typeError('Must be a number');
    
    if (min !== undefined) {
      schema = schema.min(min, VALIDATION_MESSAGES.MIN_VALUE(min));
    }
    
    if (max !== undefined) {
      schema = schema.max(max, VALIDATION_MESSAGES.MAX_VALUE(max));
    }
    
    return schema;
  },
  
  futureDate: (message = VALIDATION_MESSAGES.FUTURE_DATE) => 
    Yup.date()
      .required(VALIDATION_MESSAGES.REQUIRED)
      .min(new Date(), message),
  
  pastDate: (message = VALIDATION_MESSAGES.PAST_DATE) => 
    Yup.date()
      .required(VALIDATION_MESSAGES.REQUIRED)
      .max(new Date(), message),
  
  dateRange: (startDateField = 'startDate') => 
    Yup.date()
      .required(VALIDATION_MESSAGES.REQUIRED)
      .when(startDateField, {
        is: (startDate) => startDate != null,
        then: Yup.date().min(Yup.ref(startDateField), VALIDATION_MESSAGES.DATE_RANGE),
      }),
  
  array: (min = 1, message) => 
    Yup.array()
      .min(min, message || `Select at least ${min} item${min > 1 ? 's' : ''}`),
  
  file: (maxSize, allowedTypes) => {
    let schema = Yup.mixed().required(VALIDATION_MESSAGES.REQUIRED);
    
    if (maxSize) {
      schema = schema.test(
        'fileSize',
        `File size must be less than ${formatFileSize(maxSize)}`,
        (value) => value && value.size <= maxSize
      );
    }
    
    if (allowedTypes && allowedTypes.length > 0) {
      schema = schema.test(
        'fileType',
        `File type must be one of: ${allowedTypes.join(', ')}`,
        (value) => value && allowedTypes.includes(value.type)
      );
    }
    
    return schema;
  },
};

// Pre-defined schemas
export const schemas = {
  login: Yup.object().shape({
    email: validators.email(),
    password: Yup.string().required(VALIDATION_MESSAGES.REQUIRED),
    rememberMe: Yup.boolean(),
  }),
  
  register: Yup.object().shape({
    name: validators.required('Full name is required')
      .min(2, VALIDATION_MESSAGES.MIN_LENGTH(2)),
    email: validators.email(),
    password: validators.password(),
    confirmPassword: validators.confirmPassword(),
    company: Yup.string(),
    role: validators.required('Please select a role'),
    agreeToTerms: Yup.boolean()
      .oneOf([true], 'You must accept the terms and conditions'),
  }),
  
  forgotPassword: Yup.object().shape({
    email: validators.email(),
  }),
  
  resetPassword: Yup.object().shape({
    code: validators.required('Verification code is required')
      .length(6, 'Code must be 6 characters'),
    password: validators.password(),
    confirmPassword: validators.confirmPassword(),
  }),
  
  changePassword: Yup.object().shape({
    currentPassword: validators.required('Current password is required'),
    newPassword: validators.password()
      .notOneOf([Yup.ref('currentPassword')], 'New password must be different'),
    confirmPassword: validators.confirmPassword('newPassword'),
  }),
  
  profile: Yup.object().shape({
    name: validators.required().min(2, VALIDATION_MESSAGES.MIN_LENGTH(2)),
    email: validators.email(),
    phone: validators.phone(false),
    company: Yup.string(),
    bio: validators.maxLength(500),
  }),
  
  contract: Yup.object().shape({
    title: validators.required('Contract title is required')
      .min(3, VALIDATION_MESSAGES.MIN_LENGTH(3)),
    type: validators.required('Contract type is required'),
    content: validators.required('Contract content is required'),
    parties: validators.array(2, 'At least two parties are required')
      .of(
        Yup.object().shape({
          name: validators.required('Party name is required'),
          email: validators.email('Invalid email'),
          role: validators.required('Role is required'),
        })
      ),
    value: validators.number(0).nullable(),
    startDate: Yup.date().nullable(),
    endDate: validators.dateRange('startDate'),
    tags: Yup.array().of(Yup.string()),
  }),
  
  template: Yup.object().shape({
    name: validators.required('Template name is required'),
    category: validators.required('Category is required'),
    description: Yup.string(),
    content: validators.required('Template content is required'),
    variables: Yup.array().of(
      Yup.object().shape({
        name: validators.required('Variable name is required'),
        type: validators.required('Variable type is required'),
        defaultValue: Yup.string(),
        required: Yup.boolean(),
      })
    ),
    tags: Yup.array().of(Yup.string()),
    isPublic: Yup.boolean(),
  }),
  
  comment: Yup.object().shape({
    content: validators.required('Comment cannot be empty')
      .min(1, 'Comment cannot be empty')
      .max(1000, VALIDATION_MESSAGES.MAX_LENGTH(1000)),
  }),
};

// Validation helpers
export const validateField = async (schema, field, value) => {
  try {
    await schema.validateAt(field, { [field]: value });
    return { isValid: true, error: null };
  } catch (error) {
    return { isValid: false, error: error.message };
  }
};

export const validateForm = async (schema, values) => {
  try {
    await schema.validate(values, { abortEarly: false });
    return { isValid: true, errors: {} };
  } catch (error) {
    const errors = {};
    
    error.inner.forEach((err) => {
      if (!errors[err.path]) {
        errors[err.path] = err.message;
      }
    });
    
    return { isValid: false, errors };
  }
};

// Field-level validation functions
export const validateEmail = (email) => {
  return REGEX_PATTERNS.EMAIL.test(email);
};

export const validatePassword = (password) => {
  return password.length >= 8 && REGEX_PATTERNS.PASSWORD.test(password);
};

export const validatePhone = (phone) => {
  return REGEX_PATTERNS.PHONE.test(phone);
};

export const validateUrl = (url) => {
  return REGEX_PATTERNS.URL.test(url);
};

// Format file size for display
function formatFileSize(bytes) {
  const sizes = ['B', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}