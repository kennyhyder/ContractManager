const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true,
    trim: true
  },
  
  originalName: {
    type: String,
    required: true
  },
  
  mimetype: {
    type: String,
    required: true
  },
  
  size: {
    type: Number,
    required: true
  },
  
  url: {
    type: String,
    required: true
  },
  
  path: {
    type: String
  },
  
  storage: {
    type: String,
    enum: ['local', 's3', 'cloudinary', 'azure'],
    default: 'local'
  },
  
  // Resource association
  resourceType: {
    type: String,
    enum: ['contract', 'comment', 'template', 'user', 'approval'],
    required: true
  },
  
  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'resourceType'
  },
  
  // Upload information
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Thumbnail (for images)
  thumbnailUrl: {
    type: String
  },
  
  // Metadata
  metadata: {
    width: Number,
    height: Number,
    duration: Number, // For videos
    pages: Number, // For PDFs
    encoding: String,
    compression: String
  },
  
  // Categorization
  category: {
    type: String,
    enum: ['document', 'image', 'video', 'audio', 'archive', 'other'],
    default: 'document'
  },
  
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  
  // Access control
  isPublic: {
    type: Boolean,
    default: false
  },
  
  accessControl: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    permissions: {
      canView: { type: Boolean, default: true },
      canDownload: { type: Boolean, default: true },
      canDelete: { type: Boolean, default: false }
    }
  }],
  
  // Virus scanning
  virusScanStatus: {
    type: String,
    enum: ['pending', 'clean', 'infected', 'error'],
    default: 'pending'
  },
  
  virusScanDate: Date,
  virusScanResult: mongoose.Schema.Types.Mixed,
  
  // Usage tracking
  downloads: {
    type: Number,
    default: 0
  },
  
  lastDownloadedAt: Date,
  
  // Expiration
  expiresAt: Date,
  
  // Soft delete
  isDeleted: {
    type: Boolean,
    default: false
  },
  
  deletedAt: Date,
  
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
attachmentSchema.index({ resourceType: 1, resourceId: 1 });
attachmentSchema.index({ uploadedBy: 1, createdAt: -1 });
attachmentSchema.index({ mimetype: 1 });
attachmentSchema.index({ tags: 1 });
attachmentSchema.index({ isDeleted: 1 });
attachmentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for file extension
attachmentSchema.virtual('extension').get(function() {
  const parts = this.filename.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
});

// Virtual for is image
attachmentSchema.virtual('isImage').get(function() {
  return /^image\//i.test(this.mimetype);
});

// Virtual for is document
attachmentSchema.virtual('isDocument').get(function() {
  const docTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
  return docTypes.includes(this.mimetype);
});

// Instance methods
attachmentSchema.methods.recordDownload = function(userId) {
  this.downloads++;
  this.lastDownloadedAt = new Date();
  
  return this.save();
};

attachmentSchema.methods.hasAccess = function(userId, permission = 'canView') {
  // Public files are accessible to all
  if (this.isPublic && permission === 'canView') return true;
  
  // Owner has all permissions
  if (this.uploadedBy.equals(userId)) return true;
  
  // Check access control list
  const access = this.accessControl.find(a => a.user.equals(userId));
  return access && access.permissions[permission];
};

// Static methods
attachmentSchema.statics.getByResource = function(resourceType, resourceId) {
  return this.find({
    resourceType,
    resourceId,
    isDeleted: false
  }).sort({ createdAt: -1 });
};

attachmentSchema.statics.getTotalSize = function(userId) {
  return this.aggregate([
    {
      $match: {
        uploadedBy: mongoose.Types.ObjectId(userId),
        isDeleted: false
      }
    },
    {
      $group: {
        _id: null,
        totalSize: { $sum: '$size' }
      }
    }
  ]);
};

// Middleware
attachmentSchema.pre('save', function(next) {
  // Set category based on mimetype
  if (this.isImage) {
    this.category = 'image';
  } else if (this.mimetype.includes('video')) {
    this.category = 'video';
  } else if (this.mimetype.includes('audio')) {
    this.category = 'audio';
  } else if (this.mimetype.includes('zip') || this.mimetype.includes('rar')) {
    this.category = 'archive';
  } else if (this.isDocument) {
    this.category = 'document';
  } else {
    this.category = 'other';
  }
  
  next();
});

module.exports = mongoose.model('Attachment', attachmentSchema);