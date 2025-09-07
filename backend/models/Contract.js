const mongoose = require('mongoose');

/**
 * Consolidated Contract Model
 * Unified contract schema with all features: collaboration, approvals, versioning, etc.
 */
const contractSchema = new mongoose.Schema({
  // Basic Information
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
    index: true
  },

  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },

  content: {
    type: String,
    required: true
  },

  // Contract Classification
  type: {
    type: String,
    required: true,
    enum: [
      'nda', 'service_agreement', 'employment', 'lease', 'purchase',
      'license', 'partnership', 'consulting', 'maintenance', 'support',
      'vendor', 'supplier', 'distribution', 'franchise', 'joint_venture',
      'amendment', 'addendum', 'renewal', 'termination', 'other'
    ],
    index: true
  },

  category: {
    type: String,
    enum: ['legal', 'sales', 'hr', 'finance', 'operations', 'it', 'marketing'],
    index: true
  },

  subCategory: {
    type: String,
    maxlength: 100
  },

  // Status Management
  status: {
    type: String,
    required: true,
    enum: [
      'draft', 'review', 'pending_approval', 'approved', 'pending_signature',
      'partially_signed', 'fully_signed', 'active', 'suspended', 'expired',
      'terminated', 'cancelled', 'archived', 'rejected'
    ],
    default: 'draft',
    index: true
  },

  substatus: {
    type: String,
    maxlength: 50
  },

  statusHistory: [{
    status: {
      type: String,
      required: true
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    reason: String,
    notes: String
  }],

  // Financial Information
  value: {
    amount: {
      type: Number,
      min: 0
    },
    currency: {
      type: String,
      default: 'USD',
      enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY', 'INR']
    }
  },

  financialTerms: {
    paymentSchedule: {
      type: String,
      enum: ['upfront', 'monthly', 'quarterly', 'annually', 'milestone', 'custom']
    },
    
    paymentTerms: {
      type: String // e.g., "Net 30", "Due on receipt"
    },
    
    penalties: {
      latePayment: {
        type: Number,
        min: 0
      },
      earlyTermination: {
        type: Number,
        min: 0
      }
    },
    
    discounts: [{
      condition: String,
      amount: Number,
      type: { type: String, enum: ['percentage', 'fixed'] }
    }],
    
    taxes: {
      inclusive: { type: Boolean, default: false },
      rate: Number
    }
  },

  // Important Dates
  dates: {
    effective: {
      type: Date,
      required: true,
      index: true
    },
    expiration: {
      type: Date,
      index: true
    },
    signed: Date,
    nextReview: Date,
    lastReviewed: Date
  },

  // Duration and Renewal
  duration: {
    value: Number,
    unit: {
      type: String,
      enum: ['days', 'weeks', 'months', 'years']
    },
    autoRenew: {
      type: Boolean,
      default: false
    },
    renewalPeriod: {
      value: Number,
      unit: {
        type: String,
        enum: ['days', 'weeks', 'months', 'years']
      }
    },
    noticePeriod: {
      value: Number,
      unit: {
        type: String,
        enum: ['days', 'weeks', 'months', 'years']
      }
    }
  },

  // Parties Involved
  parties: [{
    name: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['individual', 'company', 'organization', 'government'],
      required: true
    },
    role: {
      type: String,
      required: true,
      enum: ['client', 'vendor', 'partner', 'contractor', 'employer', 'employee', 'landlord', 'tenant', 'buyer', 'seller', 'licensor', 'licensee', 'other']
    },
    contactInfo: {
      email: String,
      phone: String,
      address: {
        street: String,
        city: String,
        state: String,
        country: String,
        postalCode: String
      }
    },
    signatories: [{
      name: {
        type: String,
        required: true
      },
      title: String,
      email: String,
      phone: String
    }],
    legalInfo: {
      registrationNumber: String,
      taxId: String,
      jurisdiction: String
    },
    internal: {
      type: Boolean,
      default: false
    },
    isPrimary: {
      type: Boolean,
      default: false
    },
    signature: {
      signed: {
        type: Boolean,
        default: false
      },
      signedBy: String,
      signedAt: Date,
      signatureId: String,
      ipAddress: String,
      method: {
        type: String,
        enum: ['electronic', 'physical', 'docusign', 'hellosign', 'manual']
      }
    }
  }],

  // Ownership and Permissions
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    index: true
  },

  department: {
    type: String,
    enum: ['legal', 'sales', 'hr', 'finance', 'operations', 'it', 'marketing', 'procurement'],
    index: true
  },

  // Collaboration
  collaborators: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['viewer', 'editor', 'reviewer', 'approver', 'signer', 'admin'],
      default: 'viewer'
    },
    permissions: {
      canView: { type: Boolean, default: true },
      canEdit: { type: Boolean, default: false },
      canComment: { type: Boolean, default: true },
      canApprove: { type: Boolean, default: false },
      canSign: { type: Boolean, default: false },
      canDelete: { type: Boolean, default: false },
      canShare: { type: Boolean, default: false }
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    lastAccessed: Date,
    accessCount: {
      type: Number,
      default: 0
    }
  }],

  // Version Control
  version: {
    major: { type: Number, default: 1 },
    minor: { type: Number, default: 0 },
    patch: { type: Number, default: 0 }
  },

  versionHistory: [{
    version: {
      major: Number,
      minor: Number,
      patch: Number
    },
    content: String,
    changes: String,
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    fileHash: String,
    size: Number
  }],

  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contract'
  },

  children: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contract'
  }],

  // Template Relationship
  template: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Template'
    },
    version: String,
    variables: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },

  // Approvals Workflow
  approvals: {
    required: { type: Boolean, default: false },
    workflow: {
      type: String,
      enum: ['sequential', 'parallel', 'any_one', 'majority'],
      default: 'sequential'
    },
    approvers: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      role: String,
      order: { type: Number, default: 0 },
      status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'delegated'],
        default: 'pending'
      },
      decision: {
        approvedAt: Date,
        rejectedAt: Date,
        reason: String,
        comments: String,
        conditions: [String]
      },
      delegatedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      notifiedAt: Date,
      reminderCount: { type: Number, default: 0 }
    }],
    deadline: Date,
    escalation: {
      enabled: { type: Boolean, default: false },
      after: Number, // hours
      to: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }]
    },
    currentStage: { type: Number, default: 0 },
    completedAt: Date
  },

  // Attachments and Documents
  attachments: [{
    name: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true
    },
    size: Number,
    mimeType: String,
    category: {
      type: String,
      enum: ['supporting', 'amendment', 'exhibit', 'schedule', 'other']
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    version: { type: Number, default: 1 },
    isDeleted: { type: Boolean, default: false }
  }],

  // Metadata and Search
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
    index: true
  }],

  metadata: {
    source: {
      type: String,
      enum: ['manual', 'template', 'import', 'api', 'email']
    },
    importedFrom: String,
    referenceNumber: {
      type: String,
      unique: true,
      sparse: true
    },
    externalId: String,
    confidentialityLevel: {
      type: String,
      enum: ['public', 'internal', 'confidential', 'highly_confidential'],
      default: 'internal'
    },
    retentionDate: Date,
    legalJurisdiction: String,
    governingLaw: String,
    disputeResolution: {
      type: String,
      enum: ['negotiation', 'mediation', 'arbitration', 'litigation']
    },
    customFields: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },

  // Risk and Compliance
  risk: {
    level: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'low'
    },
    factors: [{
      factor: String,
      severity: {
        type: String,
        enum: ['low', 'medium', 'high']
      },
      notes: String
    }],
    lastAssessment: Date,
    assessedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },

  compliance: {
    requirements: [{
      requirement: String,
      status: {
        type: String,
        enum: ['compliant', 'non_compliant', 'pending', 'not_applicable']
      },
      notes: String,
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      verifiedAt: Date
    }],
    certifications: [{
      name: String,
      issuedBy: String,
      issuedDate: Date,
      expiryDate: Date,
      documentUrl: String
    }]
  },

  // Notifications and Reminders
  notifications: {
    enabled: { type: Boolean, default: true },
    
    reminders: [{
      type: {
        type: String,
        enum: ['expiration', 'renewal', 'review', 'payment', 'milestone', 'custom']
      },
      daysBeforeEvent: Number,
      recipients: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }],
      sent: { type: Boolean, default: false },
      sentAt: Date,
      nextSendDate: Date,
      message: String
    }],
    
    preferences: {
      expirationAlerts: { type: Boolean, default: true },
      renewalAlerts: { type: Boolean, default: true },
      statusChangeAlerts: { type: Boolean, default: true },
      commentAlerts: { type: Boolean, default: true },
      approvalAlerts: { type: Boolean, default: true }
    }
  },

  // Analytics and Performance
  analytics: {
    viewCount: { type: Number, default: 0 },
    downloadCount: { type: Number, default: 0 },
    averageTimeToSign: Number, // in days
    averageTimeToApprove: Number, // in hours
    lastViewed: Date,
    lastModified: Date
  },

  // Activity Log
  activityLog: [{
    action: {
      type: String,
      required: true
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    performedAt: {
      type: Date,
      default: Date.now
    },
    details: mongoose.Schema.Types.Mixed,
    ipAddress: String,
    userAgent: String
  }],

  // Soft Delete
  deletedAt: Date,
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }

}, {
  timestamps: true,
  collection: 'templates',
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
templateSchema.index({ name: 'text', description: 'text', tags: 1 });
templateSchema.index({ owner: 1, status: 1, createdAt: -1 });
templateSchema.index({ category: 1, status: 1, visibility: 1 });
templateSchema.index({ 'marketplace.listed': 1, 'marketplace.approved': 1 });
templateSchema.index({ 'usage.popularityScore': -1 });
templateSchema.index({ organization: 1, visibility: 1 });

// Compound indexes
templateSchema.index({
  category: 1,
  industry: 1,
  status: 1,
  visibility: 1
});

templateSchema.index({
  'marketplace.listed': 1,
  'marketplace.rating.average': -1,
  'usage.popularityScore': -1
});

// Virtual fields
templateSchema.virtual('versionString').get(function() {
  return `${this.version.major}.${this.version.minor}.${this.version.patch}`;
});

templateSchema.virtual('isPublished').get(function() {
  return this.status === 'published';
});

templateSchema.virtual('isMarketplaceListed').get(function() {
  return this.marketplace.listed && this.marketplace.approved;
});

templateSchema.virtual('qualityScore').get(function() {
  let score = 0;
  const checks = this.quality.checks;
  
  if (checks.hasDescription) score += 20;
  if (checks.hasVariables) score += 20;
  if (checks.hasValidation) score += 20;
  if (checks.hasHelpText) score += 20;
  if (checks.legalReviewed) score += 20;
  
  return score;
});

// Instance methods
templateSchema.methods.canBeUsedBy = function(userId) {
  // Owner can always use
  if (this.owner.equals(userId)) return true;
  
  // Check visibility
  switch (this.visibility) {
    case 'public':
    case 'marketplace':
      return true;
    case 'organization':
      // Check if user is in same organization
      return this.organization && this.organization.equals(userId.organization);
    case 'private':
      // Check specific permissions
      return this.permissions.canUse.some(id => id.equals(userId));
    default:
      return false;
  }
};

templateSchema.methods.recordUsage = function(userId, contractId) {
  this.usage.count++;
  this.usage.lastUsed = new Date();
  
  this.usage.usedBy.push({
    user: userId,
    contractId: contractId,
    usedAt: new Date()
  });
  
  // Update popularity score
  this.updatePopularityScore();
  
  return this.save();
};

templateSchema.methods.updatePopularityScore = function() {
  // Algorithm considers usage count, recency, and ratings
  const usageWeight = 0.4;
  const ratingWeight = 0.4;
  const recencyWeight = 0.2;
  
  // Usage score (normalized to 0-100)
  const usageScore = Math.min(this.usage.count / 100 * 100, 100);
  
  // Rating score
  const ratingScore = this.marketplace.rating.average * 20;
  
  // Recency score
  const daysSinceLastUse = this.usage.lastUsed ? 
    (Date.now() - this.usage.lastUsed.getTime()) / (1000 * 60 * 60 * 24) : 
    365;
  const recencyScore = Math.max(0, 100 - daysSinceLastUse);
  
  this.usage.popularityScore = 
    usageScore * usageWeight + 
    ratingScore * ratingWeight + 
    recencyScore * recencyWeight;
};

templateSchema.methods.addVersion = function(content, variables, changes, userId) {
  // Save current version to history
  this.versionHistory.push({
    version: { ...this.version },
    content: this.content,
    variables: this.variables,
    changes,
    changedBy: userId,
    changedAt: new Date()
  });
  
  // Update version number
  if (changes.includes('major')) {
    this.version.major++;
    this.version.minor = 0;
    this.version.patch = 0;
  } else if (changes.includes('minor')) {
    this.version.minor++;
    this.version.patch = 0;
  } else {
    this.version.patch++;
  }
  
  // Update content and variables
  this.content = content;
  this.variables = variables;
  
  return this.save();
};

templateSchema.methods.publishToMarketplace = function(pricing, tags) {
  this.marketplace.listed = true;
  this.marketplace.pricing = pricing;
  this.marketplace.tags = tags;
  this.visibility = 'marketplace';
  this.status = 'published';
  
  return this.save();
};

templateSchema.methods.addReview = function(userId, rating, comment) {
  // Check if user already reviewed
  const existingReview = this.marketplace.reviews.find(
    r => r.user.equals(userId)
  );
  
  if (existingReview) {
    throw new Error('User has already reviewed this template');
  }
  
  this.marketplace.reviews.push({
    user: userId,
    rating,
    comment,
    createdAt: new Date()
  });
  
  // Update average rating
  const totalRating = this.marketplace.reviews.reduce((sum, r) => sum + r.rating, 0);
  this.marketplace.rating.count = this.marketplace.reviews.length;
  this.marketplace.rating.average = totalRating / this.marketplace.rating.count;
  
  return this.save();
};

// Static methods
templateSchema.statics.findPublic = function(filters = {}) {
  const query = {
    visibility: { $in: ['public', 'marketplace'] },
    status: 'published',
    deletedAt: null,
    ...filters
  };
  
  return this.find(query);
};

templateSchema.statics.findByCategory = function(category, options = {}) {
  const query = {
    category,
    status: 'published',
    deletedAt: null
  };
  
  if (options.visibility) {
    query.visibility = options.visibility;
  }
  
  return this.find(query).sort({ 'usage.popularityScore': -1 });
};

templateSchema.statics.searchMarketplace = function(searchTerm, filters = {}) {
  const query = {
    $text: { $search: searchTerm },
    'marketplace.listed': true,
    'marketplace.approved': true,
    status: 'published',
    deletedAt: null
  };
  
  // Apply filters
  if (filters.category) query.category = filters.category;
  if (filters.industry) query.industry = { $in: filters.industry };
  if (filters.priceRange) {
    query['marketplace.pricing.amount'] = {
      $gte: filters.priceRange.min,
      $lte: filters.priceRange.max
    };
  }
  if (filters.rating) {
    query['marketplace.rating.average'] = { $gte: filters.rating };
  }
  
  return this.find(query)
    .select({ score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' } });
};

// Middleware
templateSchema.pre('save', function(next) {
  // Update quality checks
  this.quality.checks.hasDescription = !!this.description;
  this.quality.checks.hasVariables = this.variables.length > 0;
  this.quality.checks.hasValidation = this.variables.some(v => v.validation);
  this.quality.checks.hasHelpText = this.variables.some(v => v.helpText);
  
  // Update quality score
  this.quality.score = this.qualityScore;
  
  next();
});

module.exports = mongoose.model('Template', templateSchema);