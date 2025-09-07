const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

/**
 * Consolidated User Model
 * Complete user schema with all features including OAuth, 2FA, permissions, etc.
 */
const userSchema = new mongoose.Schema({
  // Basic Information
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },

  password: {
    type: String,
    required: function() {
      return !this.oauth.provider;
    },
    select: false
  },

  firstName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },

  lastName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },

  displayName: {
    type: String,
    trim: true,
    maxlength: 100
  },

  // Profile Information
  profile: {
    phone: {
      type: String,
      trim: true
    },
    
    avatar: {
      url: String,
      publicId: String,
      provider: {
        type: String,
        enum: ['local', 'gravatar', 'oauth', 'cloudinary', 's3']
      }
    },
    
    bio: {
      type: String,
      maxlength: 500
    },
    
    title: {
      type: String,
      maxlength: 100
    },
    
    department: String,
    
    location: {
      city: String,
      state: String,
      country: String,
      timezone: {
        type: String,
        default: 'UTC'
      }
    },
    
    language: {
      type: String,
      default: 'en'
    },
    
    dateFormat: {
      type: String,
      default: 'MM/DD/YYYY'
    }
  },

  // Organization
  company: {
    type: String,
    trim: true,
    maxlength: 100
  },

  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization'
  },

  // Authentication & Security
  role: {
    type: String,
    enum: ['user', 'manager', 'admin', 'super_admin'],
    default: 'user',
    index: true
  },

  permissions: [{
    resource: {
      type: String,
      required: true
    },
    actions: [{
      type: String,
      enum: ['create', 'read', 'update', 'delete', 'approve', 'sign', 'share']
    }]
  }],

  isActive: {
    type: Boolean,
    default: true,
    index: true
  },

  isVerified: {
    type: Boolean,
    default: false
  },

  emailVerificationToken: {
    type: String,
    select: false
  },

  emailVerificationExpires: Date,

  // Password Management
  passwordResetToken: {
    type: String,
    select: false
  },

  passwordResetExpires: Date,

  passwordChangedAt: Date,

  passwordHistory: [{
    password: String,
    changedAt: Date
  }],

  mustChangePassword: {
    type: Boolean,
    default: false
  },

  // Two-Factor Authentication
  twoFactor: {
    enabled: {
      type: Boolean,
      default: false
    },
    
    secret: {
      type: String,
      select: false
    },
    
    tempSecret: {
      type: String,
      select: false
    },
    
    backupCodes: [{
      code: {
        type: String,
        select: false
      },
      used: {
        type: Boolean,
        default: false
      },
      usedAt: Date
    }],
    
    lastUsed: Date,
    
    methods: [{
      type: String,
      enum: ['authenticator', 'sms', 'email'],
      default: 'authenticator'
    }]
  },

  // OAuth Integration
  oauth: {
    provider: {
      type: String,
      enum: ['google', 'microsoft', 'linkedin', 'github', 'okta', 'auth0']
    },
    
    providerId: String,
    
    accessToken: {
      type: String,
      select: false
    },
    
    refreshToken: {
      type: String,
      select: false
    },
    
    tokenExpires: Date,
    
    profile: {
      type: mongoose.Schema.Types.Mixed,
      select: false
    }
  },

  // Login & Session Management
  loginAttempts: {
    type: Number,
    default: 0
  },

  lockUntil: Date,

  lastLogin: {
    timestamp: Date,
    ipAddress: String,
    userAgent: String,
    location: {
      city: String,
      country: String
    }
  },

  loginHistory: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    ipAddress: String,
    userAgent: String,
    location: {
      city: String,
      country: String
    },
    success: Boolean
  }],

  sessions: [{
    token: {
      type: String,
      select: false
    },
    
    createdAt: {
      type: Date,
      default: Date.now
    },
    
    expiresAt: Date,
    
    lastActivity: Date,
    
    ipAddress: String,
    
    userAgent: String,
    
    deviceInfo: {
      type: String,
      browser: String,
      os: String,
      device: String
    }
  }],

  // API Keys
  apiKeys: [{
    name: {
      type: String,
      required: true
    },
    
    key: {
      type: String,
      required: true,
      select: false
    },
    
    scopes: [{
      type: String,
      enum: ['contracts:read', 'contracts:write', 'templates:read', 'templates:write', 'users:read', 'users:write', 'admin']
    }],
    
    expiresAt: Date,
    
    lastUsed: Date,
    
    usageCount: {
      type: Number,
      default: 0
    },
    
    isActive: {
      type: Boolean,
      default: true
    },
    
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Notifications & Preferences
  notifications: {
    email: {
      enabled: { type: Boolean, default: true },
      frequency: {
        type: String,
        enum: ['immediate', 'hourly', 'daily', 'weekly'],
        default: 'immediate'
      },
      types: {
        contractUpdates: { type: Boolean, default: true },
        approvalRequests: { type: Boolean, default: true },
        reminders: { type: Boolean, default: true },
        comments: { type: Boolean, default: true },
        systemAlerts: { type: Boolean, default: true }
      }
    },
    
    push: {
      enabled: { type: Boolean, default: false },
      token: String,
      platform: {
        type: String,
        enum: ['web', 'ios', 'android']
      }
    },
    
    inApp: {
      enabled: { type: Boolean, default: true }
    },
    
    sms: {
      enabled: { type: Boolean, default: false },
      number: String,
      verified: { type: Boolean, default: false }
    }
  },

  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system'
    },
    
    contractView: {
      type: String,
      enum: ['grid', 'list', 'board'],
      default: 'list'
    },
    
    defaultContractStatus: {
      type: String,
      default: 'draft'
    },
    
    emailSignature: String,
    
    autoSave: {
      type: Boolean,
      default: true
    },
    
    keyboardShortcuts: {
      type: Boolean,
      default: true
    }
  },

  // Subscription & Billing
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'starter', 'professional', 'enterprise', 'custom'],
      default: 'free'
    },
    
    status: {
      type: String,
      enum: ['active', 'trialing', 'past_due', 'cancelled', 'suspended'],
      default: 'active'
    },
    
    customerId: String,
    
    subscriptionId: String,
    
    currentPeriodStart: Date,
    
    currentPeriodEnd: Date,
    
    cancelledAt: Date,
    
    features: {
      maxContracts: { type: Number, default: 10 },
      maxUsers: { type: Number, default: 1 },
      maxStorage: { type: Number, default: 1073741824 }, // 1GB in bytes
      advancedFeatures: { type: Boolean, default: false },
      apiAccess: { type: Boolean, default: false },
      customBranding: { type: Boolean, default: false },
      prioritySupport: { type: Boolean, default: false }
    }
  },

  // Usage Statistics
  usage: {
    contractsCreated: { type: Number, default: 0 },
    contractsSigned: { type: Number, default: 0 },
    templatesCreated: { type: Number, default: 0 },
    storageUsed: { type: Number, default: 0 }, // in bytes
    lastActivity: Date,
    totalLoginCount: { type: Number, default: 0 }
  },

  // Compliance & Legal
  compliance: {
    gdprConsent: {
      given: { type: Boolean, default: false },
      givenAt: Date,
      version: String
    },
    
    termsAccepted: {
      accepted: { type: Boolean, default: false },
      acceptedAt: Date,
      version: String
    },
    
    privacyPolicyAccepted: {
      accepted: { type: Boolean, default: false },
      acceptedAt: Date,
      version: String
    },
    
    dataProcessingConsent: {
      marketing: { type: Boolean, default: false },
      analytics: { type: Boolean, default: true },
      thirdParty: { type: Boolean, default: false }
    }
  },

  // Metadata
  tags: [String],
  
  notes: {
    type: String,
    maxlength: 1000
  },
  
  customFields: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Audit Trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  deletedAt: Date,
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }

}, {
  timestamps: true,
  collection: 'users',
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.passwordHistory;
      delete ret.twoFactor.secret;
      delete ret.twoFactor.tempSecret;
      delete ret.twoFactor.backupCodes;
      delete ret.passwordResetToken;
      delete ret.apiKeys;
      delete ret.sessions;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Indexes for performance
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ company: 1, isActive: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ lastActivity: -1 });
userSchema.index({ 'subscription.plan': 1, 'subscription.status': 1 });

// Compound indexes
userSchema.index({ 
  isActive: 1, 
  isVerified: 1, 
  role: 1 
});

userSchema.index({ 
  company: 1, 
  role: 1, 
  isActive: 1 
});

// Text search index
userSchema.index({
  firstName: 'text',
  lastName: 'text',
  email: 'text',
  company: 'text'
});

// Virtual fields
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.virtual('initials').get(function() {
  return `${this.firstName?.[0] || ''}${this.lastName?.[0] || ''}`.toUpperCase();
});

userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

userSchema.virtual('canLogin').get(function() {
  return this.isActive && this.isVerified && !this.isLocked;
});

// Instance methods
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.hasPermission = function(resource, action) {
  // Super admin has all permissions
  if (this.role === 'super_admin') return true;
  
  // Check specific permissions
  const permission = this.permissions.find(p => p.resource === resource);
  return permission && permission.actions.includes(action);
};

userSchema.methods.createPasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
    
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  
  return resetToken;
};

userSchema.methods.createEmailVerificationToken = function() {
  const verificationToken = crypto.randomBytes(32).toString('hex');
  
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');
    
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  
  return verificationToken;
};

userSchema.methods.createApiKey = function(name, scopes, expiresIn = null) {
  const key = crypto.randomBytes(32).toString('hex');
  const hashedKey = crypto
    .createHash('sha256')
    .update(key)
    .digest('hex');
  
  const apiKey = {
    name,
    key: hashedKey,
    scopes,
    createdAt: new Date()
  };
  
  if (expiresIn) {
    apiKey.expiresAt = new Date(Date.now() + expiresIn);
  }
  
  this.apiKeys.push(apiKey);
  
  return key; // Return unhashed key to show user once
};

userSchema.methods.generateTwoFactorSecret = function() {
  const speakeasy = require('speakeasy');
  const secret = speakeasy.generateSecret({
    name: `Contract Management (${this.email})`,
    issuer: 'Contract Management System'
  });
  
  this.twoFactor.tempSecret = secret.base32;
  
  return {
    secret: secret.base32,
    qrCode: secret.otpauth_url
  };
};

userSchema.methods.verifyTwoFactorToken = function(token) {
  const speakeasy = require('speakeasy');
  const secret = this.twoFactor.secret || this.twoFactor.tempSecret;
  
  if (!secret) return false;
  
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 2
  });
};

userSchema.methods.generateBackupCodes = function() {
  const codes = [];
  
  for (let i = 0; i < 10; i++) {
    const code = crypto.randomBytes(4).toString('hex');
    const hashedCode = crypto
      .createHash('sha256')
      .update(code)
      .digest('hex');
      
    codes.push(code);
    this.twoFactor.backupCodes.push({
      code: hashedCode,
      used: false
    });
  }
  
  return codes; // Return unhashed codes to show user once
};

userSchema.methods.useBackupCode = function(code) {
  const hashedCode = crypto
    .createHash('sha256')
    .update(code)
    .digest('hex');
  
  const backupCode = this.twoFactor.backupCodes.find(
    bc => bc.code === hashedCode && !bc.used
  );
  
  if (!backupCode) return false;
  
  backupCode.used = true;
  backupCode.usedAt = new Date();
  
  return true;
};

userSchema.methods.recordLogin = function(ipAddress, userAgent, success = true) {
  const login = {
    timestamp: new Date(),
    ipAddress,
    userAgent,
    success
  };
  
  this.loginHistory.push(login);
  
  if (success) {
    this.lastLogin = login;
    this.loginAttempts = 0;
    this.usage.totalLoginCount++;
  } else {
    this.loginAttempts++;
    
    // Lock account after max attempts
    const maxAttempts = process.env.MAX_LOGIN_ATTEMPTS || 5;
    if (this.loginAttempts >= maxAttempts) {
      this.lockUntil = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
    }
  }
  
  // Keep only last 100 login records
  if (this.loginHistory.length > 100) {
    this.loginHistory = this.loginHistory.slice(-100);
  }
};

userSchema.methods.createSession = function(token, ipAddress, userAgent) {
  const session = {
    token: crypto
      .createHash('sha256')
      .update(token)
      .digest('hex'),
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    lastActivity: new Date(),
    ipAddress,
    userAgent
  };
  
  this.sessions.push(session);
  
  // Keep only last 10 sessions
  if (this.sessions.length > 10) {
    this.sessions = this.sessions.slice(-10);
  }
  
  return session;
};

userSchema.methods.invalidateSession = function(token) {
  const hashedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
  
  this.sessions = this.sessions.filter(s => s.token !== hashedToken);
};

userSchema.methods.updateUsage = function(metric, value = 1) {
  if (this.usage[metric] !== undefined) {
    this.usage[metric] += value;
  }
  this.usage.lastActivity = new Date();
};

// Static methods
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

userSchema.statics.findActive = function(filters = {}) {
  const query = {
    isActive: true,
    isVerified: true,
    deletedAt: null,
    ...filters
  };
  
  return this.find(query);
};

userSchema.statics.search = function(searchTerm, options = {}) {
  const query = {
    $text: { $search: searchTerm },
    isActive: true,
    deletedAt: null
  };
  
  if (options.role) query.role = options.role;
  if (options.company) query.company = options.company;
  
  return this.find(query)
    .select({ score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' } })
    .limit(options.limit || 20);
};

// Middleware
userSchema.pre('save', async function(next) {
  // Hash password if modified
  if (this.isModified('password')) {
    // Add to password history
    if (this.password) {
      this.passwordHistory.push({
        password: this.password,
        changedAt: new Date()
      });
      
      // Keep only last 5 passwords
      if (this.passwordHistory.length > 5) {
        this.passwordHistory = this.passwordHistory.slice(-5);
      }
    }
    
    this.password = await bcrypt.hash(this.password, 12);
    this.passwordChangedAt = new Date();
  }
  
  // Generate display name if not set
  if (!this.displayName) {
    this.displayName = this.fullName;
  }
  
  // Set default avatar if not set
  if (!this.profile.avatar?.url) {
    const hash = crypto
      .createHash('md5')
      .update(this.email)
      .digest('hex');
    
    this.profile.avatar = {
      url: `https://www.gravatar.com/avatar/${hash}?d=identicon`,
      provider: 'gravatar'
    };
  }
  
  next();
});

// Ensure email uniqueness (case-insensitive)
userSchema.pre('save', async function(next) {
  if (this.isModified('email')) {
    const existingUser = await this.constructor.findOne({
      email: this.email,
      _id: { $ne: this._id }
    });
    
    if (existingUser) {
      const error = new Error('Email already exists');
      error.code = 'DUPLICATE_EMAIL';
      return next(error);
    }
  }
  
  next();
});

// Clean up sessions periodically
userSchema.methods.cleanupSessions = function() {
  this.sessions = this.sessions.filter(
    session => session.expiresAt > new Date()
  );
};

// Password validation
userSchema.methods.validatePassword = function(password) {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  if (password.length < minLength) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }
  
  if (!hasUpperCase || !hasLowerCase) {
    return { valid: false, message: 'Password must contain both uppercase and lowercase letters' };
  }
  
  if (!hasNumber) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  
  if (!hasSpecialChar) {
    return { valid: false, message: 'Password must contain at least one special character' };
  }
  
  // Check password history
  for (const oldPassword of this.passwordHistory) {
    const isReused = bcrypt.compareSync(password, oldPassword.password);
    if (isReused) {
      return { valid: false, message: 'Password has been used recently. Please choose a different password' };
    }
  }
  
  return { valid: true };
};

module.exports = mongoose.model('User', userSchema);