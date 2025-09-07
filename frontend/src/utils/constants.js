// API Endpoints
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
export const WS_BASE_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:5000';

// Contract Status
export const CONTRACT_STATUS = {
  DRAFT: 'draft',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SIGNED: 'signed',
  EXPIRED: 'expired',
};

// Contract Types
export const CONTRACT_TYPES = {
  NDA: 'nda',
  SERVICE: 'service',
  PURCHASE: 'purchase',
  EMPLOYMENT: 'employment',
  LEASE: 'lease',
  PARTNERSHIP: 'partnership',
  OTHER: 'other',
};

// User Roles
export const USER_ROLES = {
  USER: 'user',
  EDITOR: 'editor',
  APPROVER: 'approver',
  ADMIN: 'admin',
};

// Permissions
export const PERMISSIONS = {
  // Contracts
  CREATE_CONTRACT: 'create_contract',
  VIEW_CONTRACT: 'view_contract',
  EDIT_CONTRACT: 'edit_contract',
  DELETE_CONTRACT: 'delete_contract',
  APPROVE_CONTRACT: 'approve_contract',
  SIGN_CONTRACT: 'sign_contract',
  
  // Templates
  CREATE_TEMPLATE: 'create_template',
  VIEW_TEMPLATE: 'view_template',
  EDIT_TEMPLATE: 'edit_template',
  DELETE_TEMPLATE: 'delete_template',
  PUBLISH_TEMPLATE: 'publish_template',
  
  // Users
  VIEW_USERS: 'view_users',
  MANAGE_USERS: 'manage_users',
  
  // Analytics
  VIEW_ANALYTICS: 'view_analytics',
  EXPORT_ANALYTICS: 'export_analytics',
  
  // System
  MANAGE_SETTINGS: 'manage_settings',
  VIEW_AUDIT_LOG: 'view_audit_log',
};

// Date Formats
export const DATE_FORMATS = {
  SHORT: 'MM/DD/YYYY',
  LONG: 'MMMM D, YYYY',
  WITH_TIME: 'MM/DD/YYYY h:mm A',
  ISO: 'YYYY-MM-DD',
};

// File Types
export const ALLOWED_FILE_TYPES = {
  DOCUMENTS: ['.pdf', '.doc', '.docx', '.txt'],
  IMAGES: ['.jpg', '.jpeg', '.png', '.gif', '.svg'],
  SPREADSHEETS: ['.xls', '.xlsx', '.csv'],
};

// File Size Limits (in bytes)
export const FILE_SIZE_LIMITS = {
  DOCUMENT: 10 * 1024 * 1024, // 10MB
  IMAGE: 5 * 1024 * 1024, // 5MB
  AVATAR: 2 * 1024 * 1024, // 2MB
};

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100],
};

// Notification Types
export const NOTIFICATION_TYPES = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
  CONTRACT_UPDATE: 'contract_update',
  CONTRACT_APPROVAL: 'contract_approval',
  CONTRACT_SIGNATURE: 'contract_signature',
  COMMENT: 'comment',
  MENTION: 'mention',
};

// Activity Types
export const ACTIVITY_TYPES = {
  CONTRACT_CREATED: 'contract_created',
  CONTRACT_UPDATED: 'contract_updated',
  CONTRACT_DELETED: 'contract_deleted',
  CONTRACT_APPROVED: 'contract_approved',
  CONTRACT_REJECTED: 'contract_rejected',
  CONTRACT_SIGNED: 'contract_signed',
  COMMENT_ADDED: 'comment_added',
  TEMPLATE_CREATED: 'template_created',
  TEMPLATE_PUBLISHED: 'template_published',
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
};

// Chart Colors
export const CHART_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#14B8A6', // Teal
  '#F97316', // Orange
];

// Regex Patterns
export const REGEX_PATTERNS = {
  EMAIL: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/,
  PHONE: /^\+?[\d\s-()]+$/,
  URL: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)$/,
};

// Local Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_DATA: 'user_data',
  THEME: 'theme',
  SIDEBAR_STATE: 'sidebar_state',
  RECENT_CONTRACTS: 'recent_contracts',
  FILTER_PREFERENCES: 'filter_preferences',
};

// Environment
export const ENV = {
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
  IS_TEST: process.env.NODE_ENV === 'test',
};

// Feature Flags
export const FEATURES = {
  WEBSOCKETS: process.env.REACT_APP_ENABLE_WEBSOCKETS === 'true',
  PUSH_NOTIFICATIONS: process.env.REACT_APP_ENABLE_PUSH_NOTIFICATIONS === 'true',
  TWO_FACTOR_AUTH: process.env.REACT_APP_ENABLE_2FA === 'true',
  MARKETPLACE: process.env.REACT_APP_ENABLE_MARKETPLACE === 'true',
};