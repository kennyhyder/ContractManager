/**
 * Model exports
 * Central location for all database models
 */

module.exports = {
  // Core models
  User: require('./User'),
  Contract: require('./Contract'),
  Template: require('./Template'),
  
  // Collaboration models
  Comment: require('./Comment'),
  Approval: require('./Approval'),
  Activity: require('./Activity'),
  
  // Communication models
  Notification: require('./Notification'),
  EmailLog: require('./EmailLog'),
  
  // File management
  Attachment: require('./Attachment')
};d,
    ref: 'User'
  },
  deleteReason: String

}, {
  timestamps: true,
  collection: 'contracts',
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
contractSchema.index({ title: 'text', description: 'text', tags: 1 });
contractSchema.index({ owner: 1, status: 1, createdAt: -1 });
contractSchema.index({ type: 1, status: 1, createdAt: -1 });
contractSchema.index({ organization: 1, status: 1 });
contractSchema.index({ 'dates.expiration': 1, status: 1 });
contractSchema.index({ 'collaborators.user': 1, status: 1 });
contractSchema.index({ template: 1 });
contractSchema.index({ tags: 1 });

// Compound indexes for complex queries
contractSchema.index({
  owner: 1,
  status: 1,
  type: 1,
  createdAt: -1
});

contractSchema.index({
  organization: 1,
  'metadata.confidentialityLevel': 1,
  status: 1
});

contractSchema.index({
  'dates.expiration': 1,
  'duration.autoRenew': 1,
  status: 1
});

// Virtual fields
contractSchema.virtual('versionString').get(function() {
  return `${this.version.major}.${this.version.minor}.${this.version.patch}`;
});

contractSchema.virtual('isExpired').get(function() {
  return this.dates.expiration && this.dates.expiration < new Date();
});

contractSchema.virtual('isExpiringSoon').get(function() {
  if (!this.dates.expiration) return false;
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  return this.dates.expiration <= thirtyDaysFromNow;
});

contractSchema.virtual('isFullySigned').get(function() {
  return this.parties.every(party => party.signature.signed);
});

contractSchema.virtual('pendingApprovals').get(function() {
  return this.approvals.approvers.filter(approver => approver.status === 'pending');
});

contractSchema.virtual('totalValue').get(function() {
  return this.value.amount || 0;
});

contractSchema.virtual('daysUntilExpiration').get(function() {
  if (!this.dates.expiration) return null;
  const diffTime = this.dates.expiration - new Date();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Instance methods
contractSchema.methods.hasAccess = function(userId, permission = 'view') {
  // Owner has all permissions
  if (this.owner.equals(userId)) return true;
  
  // Check collaborator permissions
  const collaborator = this.collaborators.find(c => c.user.equals(userId));
  if (!collaborator) return false;
  
  switch (permission) {
    case 'view':
      return collaborator.permissions.canView;
    case 'edit':
      return collaborator.permissions.canEdit;
    case 'comment':
      return collaborator.permissions.canComment;
    case 'approve':
      return collaborator.permissions.canApprove;
    case 'sign':
      return collaborator.permissions.canSign;
    case 'delete':
      return collaborator.permissions.canDelete;
    case 'share':
      return collaborator.permissions.canShare;
    default:
      return false;
  }
};

contractSchema.methods.addCollaborator = function(userId, role, permissions, addedBy) {
  const existing = this.collaborators.find(c => c.user.equals(userId));
  if (existing) {
    throw new Error('User is already a collaborator');
  }
  
  this.collaborators.push({
    user: userId,
    role,
    permissions,
    addedBy,
    addedAt: new Date()
  });
  
  return this.save();
};

contractSchema.methods.updateStatus = function(newStatus, userId, reason) {
  this.statusHistory.push({
    status: this.status,
    changedBy: userId,
    changedAt: new Date(),
    reason
  });
  
  this.status = newStatus;
  
  // Update analytics
  if (newStatus === 'fully_signed' && !this.dates.signed) {
    this.dates.signed = new Date();
    
    // Calculate time to sign
    const daysToSign = Math.ceil((this.dates.signed - this.createdAt) / (1000 * 60 * 60 * 24));
    this.analytics.averageTimeToSign = daysToSign;
  }
  
  return this.save();
};

contractSchema.methods.addVersion = function(content, changes, userId) {
  const newVersion = {
    major: this.version.major,
    minor: this.version.minor,
    patch: this.version.patch + 1
  };
  
  // Increment version based on change type
  if (changes.includes('major')) {
    newVersion.major++;
    newVersion.minor = 0;
    newVersion.patch = 0;
  } else if (changes.includes('minor')) {
    newVersion.minor++;
    newVersion.patch = 0;
  }
  
  this.versionHistory.push({
    version: { ...this.version },
    content: this.content,
    changes,
    changedBy: userId,
    changedAt: new Date()
  });
  
  this.version = newVersion;
  this.content = content;
  
  return this.save();
};

contractSchema.methods.canBeApprovedBy = function(userId) {
  if (!this.approvals.required) return false;
  
  const approver = this.approvals.approvers.find(a => a.user.equals(userId));
  return approver && approver.status === 'pending';
};

contractSchema.methods.approve = function(userId, comments, conditions) {
  const approver = this.approvals.approvers.find(a => a.user.equals(userId));
  if (!approver || approver.status !== 'pending') {
    throw new Error('Cannot approve this contract');
  }
  
  approver.status = 'approved';
  approver.decision = {
    approvedAt: new Date(),
    comments,
    conditions
  };
  
  // Check if all approvals are complete
  const allApproved = this.approvals.approvers.every(a => a.status === 'approved');
  if (allApproved) {
    this.approvals.completedAt = new Date();
    this.status = 'approved';
  }
  
  return this.save();
};

contractSchema.methods.addReminder = function(type, daysBeforeEvent, recipients, message) {
  this.notifications.reminders.push({
    type,
    daysBeforeEvent,
    recipients,
    message,
    nextSendDate: this.calculateReminderDate(type, daysBeforeEvent)
  });
  
  return this.save();
};

contractSchema.methods.calculateReminderDate = function(type, daysBefore) {
  let eventDate;
  
  switch (type) {
    case 'expiration':
      eventDate = this.dates.expiration;
      break;
    case 'renewal':
      eventDate = this.duration.renewalPeriod ? 
        new Date(this.dates.expiration.getTime() - (this.duration.noticePeriod.value * 24 * 60 * 60 * 1000)) :
        this.dates.expiration;
      break;
    case 'review':
      eventDate = this.dates.nextReview;
      break;
    default:
      return null;
  }
  
  if (!eventDate) return null;
  
  const reminderDate = new Date(eventDate);
  reminderDate.setDate(reminderDate.getDate() - daysBefore);
  
  return reminderDate;
};

// Static methods
contractSchema.statics.findByUser = function(userId, options = {}) {
  const query = {
    $or: [
      { owner: userId },
      { 'collaborators.user': userId }
    ],
    deletedAt: null
  };
  
  if (options.status) {
    query.status = options.status;
  }
  
  return this.find(query).sort({ updatedAt: -1 });
};

contractSchema.statics.findExpiring = function(days = 30) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return this.find({
    'dates.expiration': {
      $gte: new Date(),
      $lte: futureDate
    },
    status: 'active',
    deletedAt: null
  });
};

contractSchema.statics.search = function(searchTerm, filters = {}) {
  const query = {
    $text: { $search: searchTerm },
    deletedAt: null
  };
  
  // Apply filters
  if (filters.type) query.type = filters.type;
  if (filters.status) query.status = filters.status;
  if (filters.owner) query.owner = filters.owner;
  if (filters.dateRange) {
    query.createdAt = {
      $gte: filters.dateRange.start,
      $lte: filters.dateRange.end
    };
  }
  
  return this.find(query)
    .select({ score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' } });
};

// Middleware
contractSchema.pre('save', function(next) {
  // Update timestamp
  this.updatedAt = new Date();
  
  // Generate reference number if not exists
  if (!this.metadata.referenceNumber) {
    const year = new Date().getFullYear();
    const random = Math.random().toString(36).substr(2, 6).toUpperCase();
    this.metadata.referenceNumber = `${this.type.toUpperCase()}-${year}-${random}`;
  }
  
  next();
});

// Soft delete middleware
contractSchema.pre('remove', function(next) {
  // Instead of actually deleting, mark as deleted
  this.deletedAt = new Date();
  this.save();
});

module.exports = mongoose.model('Contract', contractSchema);