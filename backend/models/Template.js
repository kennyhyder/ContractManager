const mongoose = require('mongoose');

/**
 * Consolidated Template Model
 * Complete template schema with marketplace features, versioning, and analytics
 */
const templateSchema = new mongoose.Schema({
  // Basic Information
  name: {
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

  // Categorization
  category: {
    type: String,
    required: true,
    enum: [
      'legal', 'sales', 'hr', 'finance', 'operations', 
      'technology', 'real_estate', 'intellectual_property', 
      'procurement', 'partnership', 'other'
    ],
    index: true
  },

  subcategory: {
    type: String,
    maxlength: 100
  },

  type: {
    type: String,
    enum: [
      'nda', 'service_agreement', 'employment', 'lease', 
      'purchase', 'license', 'partnership', 'consulting',
      'maintenance', 'support', 'vendor', 'supplier',
      'distribution', 'franchise', 'loan', 'investment'
    ],
    index: true
  },

  industry: [{
    type: String,
    enum: [
      'technology', 'healthcare', 'finance', 'retail',
      'manufacturing', 'education', 'real_estate',
      'hospitality', 'transportation', 'energy',
      'telecommunications', 'media', 'nonprofit',
      'government', 'other'
    ]
  }],

  jurisdiction: [{
    type: String,
    trim: true
  }],

  language: {
    type: String,
    default: 'en',
    enum: ['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'ru', 'ar']
  },

  // Template Variables
  variables: [{
    key: {
      type: String,
      required: true,
      trim: true
    },
    label: {
      type: String,
      required: true
    },
    type: {
      type: String,
      required: true,
      enum: ['text', 'number', 'date', 'boolean', 'select', 'multiselect', 'address', 'currency', 'percentage', 'email', 'phone', 'url']
    },
    required: {
      type: Boolean,
      default: false
    },
    defaultValue: mongoose.Schema.Types.Mixed,
    placeholder: String,
    description: String,
    validation: {
      pattern: String,
      min: mongoose.Schema.Types.Mixed,
      max: mongoose.Schema.Types.Mixed,
      minLength: Number,
      maxLength: Number,
      options: [mongoose.Schema.Types.Mixed], // For select/multiselect
      customValidator: String // JavaScript expression
    },
    formatting: {
      prefix: String,
      suffix: String,
      decimals: Number,
      thousandsSeparator: Boolean
    },
    conditional: {
      dependsOn: String, // Variable key
      condition: String, // Condition expression
      value: mongoose.Schema.Types.Mixed
    },
    group: String, // For organizing variables into sections
    order: { type: Number, default: 0 },
    helpText: String
  }],

  sections: [{
    name: {
      type: String,
      required: true
    },
    order: { type: Number, default: 0 },
    variables: [String], // Array of variable keys
    conditional: {
      dependsOn: String,
      condition: String,
      value: mongoose.Schema.Types.Mixed
    },
    description: String
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
    variables: [{
      key: String,
      label: String,
      type: String,
      defaultValue: mongoose.Schema.Types.Mixed
    }],
    changes: String,
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    changedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Ownership and Access
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

  // Sharing and Permissions
  visibility: {
    type: String,
    enum: ['private', 'organization', 'public', 'marketplace'],
    default: 'private',
    index: true
  },

  permissions: {
    canView: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    canEdit: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    canUse: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  },

  // Usage and Analytics
  usage: {
    count: { type: Number, default: 0 },
    lastUsed: Date,
    usedBy: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      usedAt: {
        type: Date,
        default: Date.now
      },
      contractId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Contract'
      }
    }],
    popularityScore: { type: Number, default: 0 },
    successRate: { type: Number, default: 0 }, // Percentage of contracts created that are completed
    avgCompletionTime: { type: Number, default: 0 } // Average days to complete contracts from this template
  },

  // Marketplace Features
  marketplace: {
    listed: { type: Boolean, default: false },
    approved: { type: Boolean, default: false },
    featured: { type: Boolean, default: false },
    
    pricing: {
      model: {
        type: String,
        enum: ['free', 'one_time', 'subscription', 'pay_per_use'],
        default: 'free'
      },
      amount: { type: Number, min: 0 },
      currency: { type: String, default: 'USD' },
      subscriptionPeriod: {
        type: String,
        enum: ['monthly', 'quarterly', 'yearly']
      },
      trialDays: { type: Number, default: 0 }
    },
    
    sales: {
      count: { type: Number, default: 0 },
      revenue: { type: Number, default: 0 },
      lastSale: Date
    },
    
    rating: {
      average: { type: Number, min: 1, max: 5, default: 0 },
      count: { type: Number, default: 0 }
    },
    
    reviews: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      rating: {
        type: Number,
        min: 1,
        max: 5,
        required: true
      },
      comment: {
        type: String,
        maxlength: 1000
      },
      helpful: {
        type: Number,
        default: 0
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    
    tags: [{
      type: String,
      trim: true,
      lowercase: true
    }],
    
    seo: {
      title: String,
      description: String,
      keywords: [String]
    },
    
    preview: {
      enabled: { type: Boolean, default: true },
      content: String, // Preview version of template
      images: [String]
    }
  },

  // Status and Quality
  status: {
    type: String,
    enum: ['draft', 'published', 'archived', 'deprecated'],
    default: 'draft',
    index: true
  },

  quality: {
    score: { type: Number, min: 0, max: 100 },
    
    checks: {
      hasDescription: { type: Boolean, default: false },
      hasVariables: { type: Boolean, default: false },
      hasValidation: { type: Boolean, default: false },
      hasHelpText: { type: Boolean, default: false },
      spellChecked: { type: Boolean, default: false },
      legalReviewed: { type: Boolean, default: false },
      lastReviewDate: Date,
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    },
    
    certifications: [{
      type: {
        type: String,
        enum: ['legal_approved', 'industry_standard', 'government_compliant']
      },
      issuedBy: String,
      issuedDate: Date,
      expiryDate: Date,
      details: String
    }]
  },

  // Dependencies and Relations
  basedOn: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Template'
  },

  relatedTemplates: [{
    template: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Template'
    },
    relationship: {
      type: String,
      enum: ['parent', 'child', 'sibling', 'alternative', 'complement']
    }
  }],

  requiredTemplates: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Template'
  }],

  // AI and Automation
  ai: {
    generated: { type: Boolean, default: false },
    improvedBy: { type: Boolean, default: false },
    
    suggestions: [{
      type: {
        type: String,
        enum: ['clause', 'variable', 'improvement']
      },
      content: String,
      confidence: Number,
      applied: { type: Boolean, default: false },
      appliedAt: Date,
      appliedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    }],
    
    riskScore: {
      value: { type: Number, min: 0, max: 100 },
      factors: [{
        factor: String,
        weight: Number,
        score: Number
      }],
      lastAnalyzed: Date
    }
  },

  // Attachments and Resources
  attachments: [{
    name: String,
    description: String,
    url: String,
    type: {
      type: String,
      enum: ['guide', 'example', 'checklist', 'legal_note']
    },
    size: Number,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Metadata
  metadata: {
    estimatedValue: {
      min: Number,
      max: Number,
      currency: String
    },
    
    typicalDuration: {
      min: Number, // months
      max: Number
    },
    
    recommendedFor: [{
      type: String,
      enum: ['startup', 'small_business', 'enterprise', 'nonprofit', 'government']
    }],
    
    difficulty: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'intermediate'
    },
    
    estimatedTime: {
      setup: Number, // minutes
      completion: Number
    }
  },

  // Audit Trail
  auditLog: [{
    action: String,
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    performedAt: {
      type: Date,
      default: Date.now
    },
    details: mongoose.Schema.Types.Mixed
  }],

  // Soft Delete
  deletedAt: Date,
  deletedBy: {
    type: mongoose.Schema.Types.ObjectI