/**
 * Application Constants
 */

module.exports = {
  // User Roles
  USER_ROLES: {
    SUPER_ADMIN: 'super_admin',
    ADMIN: 'admin',
    MANAGER: 'manager',
    USER: 'user',
    VIEWER: 'viewer'
  },

  // Contract Status
  CONTRACT_STATUS: {
    DRAFT: 'draft',
    REVIEW: 'review',
    APPROVED: 'approved',
    PENDING_SIGNATURE: 'pending_signature',
    SIGNED: 'signed',
    ACTIVE: 'active',
    EXPIRED: 'expired',
    TERMINATED: 'terminated',
    ARCHIVED: 'archived'
  },

  // Contract Types
  CONTRACT_TYPES: {
    EMPLOYMENT: 'employment',
    SERVICE: 'service',
    NDA: 'nda',
    LEASE: 'lease',
    SALES: 'sales',
    PARTNERSHIP: 'partnership',
    LICENSING: 'licensing',
    OTHER: 'other'
  },

  // Approval Status
  APPROVAL_STATUS: {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    CANCELLED: 'cancelled',
    EXPIRED: 'expired'
  },

  // Notification Types
  NOTIFICATION_TYPES: {
    CONTRACT_CREATED: 'contract_created',
    CONTRACT_SHARED: 'contract_shared',
    CONTRACT_SIGNED: 'contract_signed',
    CONTRACT_EXPIRED: 'contract_expired',
    CONTRACT_EXPIRING: 'contract_expiring',
    APPROVAL_REQUESTED: 'approval_requested',
    APPROVAL_COMPLETED: 'approval_completed',
    COMMENT_ADDED: 'comment_added',
    MENTION_RECEIVED: 'mention_received',
    REMINDER: 'reminder',
    SYSTEM: 'system'
  },

  // Activity Actions
  ACTIVITY_ACTIONS: {
    // User actions
    USER_LOGIN: 'user.login',
    USER_LOGOUT: 'user.logout',
    USER_REGISTER: 'user.register',
    USER_PROFILE_UPDATED: 'user.profile_updated',
    USER_PASSWORD_CHANGED: 'user.password_changed',
    USER_2FA_ENABLED: 'user.2fa_enabled',
    USER_2FA_DISABLED: 'user.2fa_disabled',
    
    // Contract actions
    CONTRACT_CREATED: 'contract.created',
    CONTRACT_UPDATED: 'contract.updated',
    CONTRACT_DELETED: 'contract.deleted',
    CONTRACT_VIEWED: 'contract.viewed',
    CONTRACT_SHARED: 'contract.shared',
    CONTRACT_SIGNED: 'contract.signed',
    CONTRACT_EXPORTED: 'contract.exported',
    CONTRACT_ARCHIVED: 'contract.archived',
    
    // Template actions
    TEMPLATE_CREATED: 'template.created',
    TEMPLATE_UPDATED: 'template.updated',
    TEMPLATE_DELETED: 'template.deleted',
    TEMPLATE_PUBLISHED: 'template.published',
    TEMPLATE_PURCHASED: 'template.purchased',
    
    // Approval actions
    APPROVAL_REQUESTED: 'approval.requested',
    APPROVAL_APPROVED: 'approval.approved',
    APPROVAL_REJECTED: 'approval.rejected',
    APPROVAL_CANCELLED: 'approval.cancelled',
    
    // Integration actions
    INTEGRATION_CONNECTED: 'integration.connected',
    INTEGRATION_DISCONNECTED: 'integration.disconnected',
    INTEGRATION_SYNC: 'integration.sync'
  },

  // File Types
  FILE_TYPES: {
    DOCUMENTS: ['pdf', 'doc', 'docx', 'txt', 'rtf'],
    IMAGES: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    SPREADSHEETS: ['xls', 'xlsx', 'csv']
  },

  // Mime Types
  MIME_TYPES: {
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'txt': 'text/plain',
    'rtf': 'application/rtf',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'csv': 'text/csv'
  },

  // Time Constants
  TIME: {
    SECOND: 1000,
    MINUTE: 60 * 1000,
    HOUR: 60 * 60 * 1000,
    DAY: 24 * 60 * 60 * 1000,
    WEEK: 7 * 24 * 60 * 60 * 1000,
    MONTH: 30 * 24 * 60 * 60 * 1000,
    YEAR: 365 * 24 * 60 * 60 * 1000
  },

  // Cache TTL
  CACHE_TTL: {
    SHORT: 300, // 5 minutes
    MEDIUM: 3600, // 1 hour
    LONG: 86400, // 24 hours
    EXTRA_LONG: 604800 // 7 days
  },

  // Pagination
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100
  },

  // Security
  SECURITY: {
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_DURATION: 30 * 60 * 1000, // 30 minutes
    SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours
    REFRESH_TOKEN_EXPIRY: 7 * 24 * 60 * 60 * 1000, // 7 days
    PASSWORD_RESET_EXPIRY: 60 * 60 * 1000, // 1 hour
    EMAIL_VERIFICATION_EXPIRY: 24 * 60 * 60 * 1000 // 24 hours
  },

  // Email Templates
  EMAIL_TEMPLATES: {
    WELCOME: 'welcome',
    EMAIL_VERIFICATION: 'email-verification',
    PASSWORD_RESET: 'password-reset',
    PASSWORD_CHANGED: 'password-changed',
    CONTRACT_SHARED: 'contract-shared',
    CONTRACT_SIGNED: 'contract-signed',
    SIGNATURE_REQUEST: 'signature-request',
    APPROVAL_REQUEST: 'approval-request',
    NOTIFICATION: 'notification',
    REMINDER: 'reminder',
    INVITATION: 'invitation'
  },

  // Regular Expressions
  REGEX: {
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    PHONE: /^\+?[\d\s-()]+$/,
    URL: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
    MONGO_ID: /^[0-9a-fA-F]{24}$/
  },

  // Error Codes
  ERROR_CODES: {
    // Authentication errors (1000-1099)
    INVALID_CREDENTIALS: 'E1001',
    ACCOUNT_LOCKED: 'E1002',
    EMAIL_NOT_VERIFIED: 'E1003',
    INVALID_TOKEN: 'E1004',
    TOKEN_EXPIRED: 'E1005',
    INVALID_2FA: 'E1006',
    
    // Authorization errors (1100-1199)
    UNAUTHORIZED: 'E1101',
    FORBIDDEN: 'E1102',
    INSUFFICIENT_PERMISSIONS: 'E1103',
    
    // Validation errors (1200-1299)
    VALIDATION_ERROR: 'E1201',
    INVALID_INPUT: 'E1202',
    MISSING_REQUIRED_FIELD: 'E1203',
    
    // Resource errors (1300-1399)
    NOT_FOUND: 'E1301',
    ALREADY_EXISTS: 'E1302',
    CONFLICT: 'E1303',
    
    // Business logic errors (1400-1499)
    BUSINESS_RULE_VIOLATION: 'E1401',
    LIMIT_EXCEEDED: 'E1402',
    OPERATION_NOT_ALLOWED: 'E1403',
    
    // System errors (1500-1599)
    INTERNAL_ERROR: 'E1501',
    SERVICE_UNAVAILABLE: 'E1502',
    EXTERNAL_SERVICE_ERROR: 'E1503'
  },

  // Success Messages
  SUCCESS_MESSAGES: {
    CREATED: 'Resource created successfully',
    UPDATED: 'Resource updated successfully',
    DELETED: 'Resource deleted successfully',
    OPERATION_COMPLETED: 'Operation completed successfully'
  },

  // Subscription Plans
  SUBSCRIPTION_PLANS: {
    FREE: {
      id: 'free',
      name: 'Free',
      contracts: 10,
      users: 1,
      storage: 100 * 1024 * 1024, // 100MB
      features: ['basic_features']
    },
    STARTER: {
      id: 'starter',
      name: 'Starter',
      contracts: 100,
      users: 5,
      storage: 5 * 1024 * 1024 * 1024, // 5GB
      features: ['basic_features', 'email_support']
    },
    PROFESSIONAL: {
      id: 'professional',
      name: 'Professional',
      contracts: 1000,
      users: 20,
      storage: 50 * 1024 * 1024 * 1024, // 50GB
      features: ['all_features', 'priority_support', 'api_access']
    },
    ENTERPRISE: {
      id: 'enterprise',
      name: 'Enterprise',
      contracts: -1, // Unlimited
      users: -1, // Unlimited
      storage: -1, // Unlimited
      features: ['all_features', 'dedicated_support', 'custom_integrations']
    }
  }
};