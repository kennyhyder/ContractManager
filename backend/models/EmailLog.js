const mongoose = require('mongoose');

const emailLogSchema = new mongoose.Schema({
  // Email details
  messageId: {
    type: String,
    unique: true,
    sparse: true
  },
  
  from: {
    email: { type: String, required: true },
    name: String
  },
  
  to: [{
    email: { type: String, required: true },
    name: String
  }],
  
  cc: [{
    email: String,
    name: String
  }],
  
  bcc: [{
    email: String,
    name: String
  }],
  
  subject: {
    type: String,
    required: true
  },
  
  body: {
    html: String,
    text: String
  },
  
  template: {
    name: String,
    data: mongoose.Schema.Types.Mixed
  },
  
  // Categorization
  type: {
    type: String,
    enum: [
      'transactional', 'notification', 'marketing',
      'contract_share', 'approval_request', 'reminder',
      'password_reset', 'email_verification', 'welcome',
      'report', 'alert', 'system'
    ],
    required: true,
    index: true
  },
  
  category: String,
  tags: [String],
  
  // Related resources
  contract: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contract'
  },
  
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  
  sentBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Status tracking
  status: {
    type: String,
    enum: ['queued', 'sending', 'sent', 'delivered', 'bounced', 'failed', 'complained'],
    default: 'queued',
    index: true
  },
  
  attempts: {
    type: Number,
    default: 0
  },
  
  lastAttempt: Date,
  
  error: {
    message: String,
    code: String,
    details: mongoose.Schema.Types.Mixed
  },
  
  // Timestamps
  queuedAt: {
    type: Date,
    default: Date.now
  },
  
  sentAt: Date,
  deliveredAt: Date,
  bouncedAt: Date,
  
  // Engagement tracking
  opens: [{
    timestamp: Date,
    ip: String,
    userAgent: String,
    location: {
      city: String,
      country: String
    }
  }],
  
  clicks: [{
    url: String,
    timestamp: Date,
    ip: String,
    userAgent: String
  }],
  
  // Provider information
  provider: {
    name: { type: String, enum: ['smtp', 'sendgrid', 'mailgun', 'ses', 'postmark'] },
    messageId: String,
    response: mongoose.Schema.Types.Mixed
  },
  
  // Attachments
  attachments: [{
    filename: String,
    contentType: String,
    size: Number,
    url: String
  }],
  
  // Metadata
  metadata: mongoose.Schema.Types.Mixed,
  
  // Priority
  priority: {
    type: String,
    enum: ['low', 'normal', 'high'],
    default: 'normal'
  },
  
  // Scheduling
  scheduledFor: Date,
  
  // Retention
  expiresAt: Date
}, {
  timestamps: true
});

// Indexes
emailLogSchema.index({ sentBy: 1, createdAt: -1 });
emailLogSchema.index({ 'to.email': 1 });
emailLogSchema.index({ status: 1, queuedAt: 1 });
emailLogSchema.index({ contract: 1 });
emailLogSchema.index({ type: 1, createdAt: -1 });
emailLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for open rate
emailLogSchema.virtual('openRate').get(function() {
  return this.opens.length > 0;
});

// Virtual for click rate
emailLogSchema.virtual('clickRate').get(function() {
  return this.clicks.length > 0;
});

// Instance methods
emailLogSchema.methods.recordOpen = function(data) {
  // Avoid duplicate opens from same IP within 1 hour
  const recentOpen = this.opens.find(open => 
    open.ip === data.ip && 
    (Date.now() - open.timestamp) < 3600000
  );
  
  if (!recentOpen) {
    this.opens.push({
      timestamp: new Date(),
      ...data
    });
    return this.save();
  }
  
  return Promise.resolve(this);
};

emailLogSchema.methods.recordClick = function(data) {
  this.clicks.push({
    timestamp: new Date(),
    ...data
  });
  
  return this.save();
};

emailLogSchema.methods.markAsSent = function(providerData) {
  this.status = 'sent';
  this.sentAt = new Date();
  this.provider = providerData;
  
  return this.save();
};

emailLogSchema.methods.markAsDelivered = function() {
  this.status = 'delivered';
  this.deliveredAt = new Date();
  
  return this.save();
};

emailLogSchema.methods.markAsBounced = function(bounceData) {
  this.status = 'bounced';
  this.bouncedAt = new Date();
  this.error = bounceData;
  
  return this.save();
};

// Static methods
emailLogSchema.statics.getStats = function(userId, dateRange) {
  const match = { sentBy: userId };
  
  if (dateRange) {
    match.createdAt = {
      $gte: dateRange.start,
      $lte: dateRange.end
    };
  }
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        sent: { $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] } },
        delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
        bounced: { $sum: { $cond: [{ $eq: ['$status', 'bounced'] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
        opened: { $sum: { $cond: [{ $gt: [{ $size: '$opens' }, 0] }, 1, 0] } },
        clicked: { $sum: { $cond: [{ $gt: [{ $size: '$clicks' }, 0] }, 1, 0] } }
      }
    },
    {
      $project: {
        _id: 0,
        total: 1,
        sent: 1,
        delivered: 1,
        bounced: 1,
        failed: 1,
        opened: 1,
        clicked: 1,
        deliveryRate: { $multiply: [{ $divide: ['$delivered', '$sent'] }, 100] },
        openRate: { $multiply: [{ $divide: ['$opened', '$delivered'] }, 100] },
        clickRate: { $multiply: [{ $divide: ['$clicked', '$delivered'] }, 100] }
      }
    }
  ]);
};

module.exports = mongoose.model('EmailLog', emailLogSchema);