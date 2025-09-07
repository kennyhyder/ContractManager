const mongoose = require('mongoose');

const approvalSchema = new mongoose.Schema({
  contract: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contract',
    required: true,
    index: true
  },
  
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  
  description: {
    type: String,
    maxlength: 1000
  },
  
  type: {
    type: String,
    enum: ['review', 'approval', 'signature', 'legal_review', 'financial_review'],
    default: 'approval'
  },
  
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'approved', 'rejected', 'cancelled'],
    default: 'pending',
    index: true
  },
  
  workflow: {
    type: {
      type: String,
      enum: ['sequential', 'parallel', 'any_one', 'majority', 'unanimous'],
      default: 'sequential'
    },
    threshold: Number // For majority approval
  },
  
  approvers: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: String,
    order: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['pending', 'reviewing', 'approved', 'rejected', 'abstained'],
      default: 'pending'
    },
    decision: {
      type: String,
      enum: ['approved', 'rejected', 'conditional', 'abstained']
    },
    comments: String,
    conditions: [String],
    decidedAt: Date,
    notifiedAt: Date,
    viewedAt: Date,
    reminderCount: {
      type: Number,
      default: 0
    },
    delegatedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    delegatedAt: Date
  }],
  
  currentStage: {
    type: Number,
    default: 0
  },
  
  deadline: {
    type: Date,
    index: true
  },
  
  completedAt: Date,
  
  // Escalation
  escalation: {
    enabled: {
      type: Boolean,
      default: false
    },
    levels: [{
      afterHours: Number,
      notifyUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }],
      escalatedAt: Date
    }]
  },
  
  // Attachments
  attachments: [{
    name: String,
    url: String,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: { type: Date, default: Date.now }
  }],
  
  // History
  history: [{
    action: { 
      type: String, 
      enum: ['created', 'updated', 'approved', 'rejected', 'reminder_sent', 'deadline_extended', 'approver_added', 'approver_removed'] 
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now },
    details: { type: mongoose.Schema.Types.Mixed }
  }],
  
  result: {
    approvedCount: { type: Number, default: 0 },
    rejectedCount: { type: Number, default: 0 },
    abstainedCount: { type: Number, default: 0 },
    finalDecision: { type: String, enum: ['approved', 'rejected'] },
    completedAt: { type: Date }
  },
  
  notifications: {
    onApproval: { type: Boolean, default: true },
    onRejection: { type: Boolean, default: true },
    onCompletion: { type: Boolean, default: true },
    reminderFrequency: { type: String, enum: ['daily', 'every_two_days', 'weekly'], default: 'every_two_days' }
  },
  
  isDeleted: {
    type: Boolean,
    default: false
  },
  
  deletedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes
approvalSchema.index({ contract: 1, status: 1 });
approvalSchema.index({ requestedBy: 1, createdAt: -1 });
approvalSchema.index({ 'approvers.user': 1, 'approvers.status': 1 });
approvalSchema.index({ deadline: 1 });
approvalSchema.index({ status: 1, deadline: 1 });

// Virtual for progress percentage
approvalSchema.virtual('progress').get(function() {
  if (this.approvers.length === 0) return 0;
  
  const responded = this.approvers.filter(a => a.status !== 'pending').length;
  return Math.round((responded / this.approvers.length) * 100);
});

// Virtual for is overdue
approvalSchema.virtual('isOverdue').get(function() {
  if (!this.deadline || this.status !== 'pending') return false;
  return new Date() > this.deadline;
});

// Virtual for current approver (for sequential)
approvalSchema.virtual('currentApprover').get(function() {
  if (this.workflow.type !== 'sequential') return null;
  
  const pending = this.approvers
    .sort((a, b) => a.order - b.order)
    .find(a => a.status === 'pending');
    
  return pending ? pending.user : null;
});

// Instance methods
approvalSchema.methods.approve = function(userId, comments, conditions) {
  const approver = this.approvers.find(a => a.user.equals(userId));
  
  if (!approver) {
    throw new Error('User is not an approver');
  }
  
  if (approver.status !== 'pending' && approver.status !== 'reviewing') {
    throw new Error('Approval already processed');
  }
  
  approver.status = 'approved';
  approver.decision = conditions && conditions.length > 0 ? 'conditional' : 'approved';
  approver.comments = comments;
  approver.conditions = conditions || [];
  approver.decidedAt = new Date();
  
  this.result.approvedCount++;
  
  // Add to history
  this.history.push({
    action: 'approved',
    user: userId,
    details: { comments, conditions }
  });
  
  // Check if approval is complete
  this.checkCompletion();
  
  return this.save();
};

approvalSchema.methods.reject = function(userId, reason) {
  const approver = this.approvers.find(a => a.user.equals(userId));
  
  if (!approver) {
    throw new Error('User is not an approver');
  }
  
  if (approver.status !== 'pending' && approver.status !== 'reviewing') {
    throw new Error('Approval already processed');
  }
  
  approver.status = 'rejected';
  approver.decision = 'rejected';
  approver.comments = reason;
  approver.decidedAt = new Date();
  
  this.result.rejectedCount++;
  
  // Add to history
  this.history.push({
    action: 'rejected',
    user: userId,
    details: { reason }
  });
  
  // Check if approval is complete
  this.checkCompletion();
  
  return this.save();
};

approvalSchema.methods.checkCompletion = function() {
  const total = this.approvers.length;
  const responded = this.result.approvedCount + this.result.rejectedCount + this.result.abstainedCount;
  
  let isComplete = false;
  let finalDecision = null;
  
  switch (this.workflow.type) {
    case 'sequential':
      // Complete if rejected or all approved
      if (this.result.rejectedCount > 0) {
        isComplete = true;
        finalDecision = 'rejected';
      } else if (responded === total) {
        isComplete = true;
        finalDecision = 'approved';
      }
      break;
      
    case 'parallel':
      // Complete when all have responded
      if (responded === total) {
        isComplete = true;
        finalDecision = this.result.rejectedCount === 0 ? 'approved' : 'rejected';
      }
      break;
      
    case 'any_one':
      // Complete on first approval
      if (this.result.approvedCount > 0) {
        isComplete = true;
        finalDecision = 'approved';
      } else if (responded === total) {
        isComplete = true;
        finalDecision = 'rejected';
      }
      break;
      
    case 'majority':
      const threshold = this.workflow.threshold || Math.ceil(total / 2);
      if (this.result.approvedCount >= threshold) {
        isComplete = true;
        finalDecision = 'approved';
      } else if (this.result.rejectedCount > total - threshold) {
        isComplete = true;
        finalDecision = 'rejected';
      }
      break;
      
    case 'unanimous':
      if (this.result.rejectedCount > 0) {
        isComplete = true;
        finalDecision = 'rejected';
      } else if (this.result.approvedCount === total) {
        isComplete = true;
        finalDecision = 'approved';
      }
      break;
  }
  
  if (isComplete) {
    this.status = finalDecision === 'approved' ? 'approved' : 'rejected';
    this.result.finalDecision = finalDecision;
    this.result.completedAt = new Date();
    this.completedAt = new Date();
  } else if (this.workflow.type === 'sequential') {
    // Update current stage for sequential workflow
    this.currentStage = this.approvers.filter(a => a.status !== 'pending').length;
  }
};

approvalSchema.methods.sendReminder = function(approverId) {
  const approver = this.approvers.find(a => a.user.equals(approverId));
  
  if (!approver) return;
  
  approver.reminderCount++;
  
  this.history.push({
    action: 'reminder_sent',
    user: approverId,
    details: { reminderCount: approver.reminderCount }
  });
  
  return this.save();
};

// Static methods
approvalSchema.statics.getPendingForUser = function(userId) {
  return this.find({
    'approvers.user': userId,
    'approvers.status': 'pending',
    status: 'pending',
    isDeleted: false
  })
  .populate('contract', 'title type')
  .populate('requestedBy', 'firstName lastName')
  .sort({ priority: -1, createdAt: -1 });
};

approvalSchema.statics.getOverdue = function() {
  return this.find({
    status: 'pending',
    deadline: { $lt: new Date() },
    isDeleted: false
  })
  .populate('contract', 'title')
  .populate('approvers.user', 'firstName lastName email');
};

module.exports = mongoose.model('Approval', approvalSchema);