const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  type: {
    type: String,
    required: true,
    enum: [
      'contract_created', 'contract_updated', 'contract_deleted',
      'contract_shared', 'contract_signed', 'contract_expired',
      'approval_requested', 'approval_received', 'approval_reminder',
      'comment_added', 'comment_mention', 'comment_reply',
      'deadline_approaching', 'deadline_passed',
      'template_shared', 'template_updated',
      'system_announcement', 'security_alert'
    ],
    index: true
  },
  
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  
  message: {
    type: String,
    required: true,
    maxlength: 1000
  },
  
  // Related resources
  resource: {
    type: {
      type: String,
      enum: ['contract', 'template', 'comment', 'approval', 'user']
    },
    id: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'resource.type'
    }
  },
  
  // Sender (if applicable)
  from: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Additional data
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Priority
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  // Status
  read: {
    type: Boolean,
    default: false,
    index: true
  },
  
  readAt: Date,
  
  // Delivery status
  delivered: {
    email: { type: Boolean, default: false },
    push: { type: Boolean, default: false },
    inApp: { type: Boolean, default: true },
    sms: { type: Boolean, default: false }
  },
  
  deliveredAt: {
    email: Date,
    push: Date,
    inApp: Date,
    sms: Date
  },
  
  // Action
  actionUrl: String,
  actionLabel: String,
  actionType: {
    type: String,
    enum: ['link', 'button', 'approve', 'reject']
  },
  
  // Grouping
  groupId: String,
  groupCount: {
    type: Number,
    default: 1
  },
  
  // Expiration
  expiresAt: Date,
  
  // Tags for filtering
  tags: [String]
}, {
  timestamps: true
});

// Indexes
notificationSchema.index({ user: 1, read: 1, createdAt: -1 });
notificationSchema.index({ user: 1, type: 1 });
notificationSchema.index({ groupId: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for age
notificationSchema.virtual('age').get(function() {
  const now = new Date();
  const created = this.createdAt;
  const diff = now - created;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
});

// Instance methods
notificationSchema.methods.markAsRead = function() {
  if (!this.read) {
    this.read = true;
    this.readAt = new Date();
    return this.save();
  }
  return Promise.resolve(this);
};

notificationSchema.methods.markAsDelivered = function(channel) {
  this.delivered[channel] = true;
  this.deliveredAt[channel] = new Date();
  return this.save();
};

// Static methods
notificationSchema.statics.createNotification = async function(data) {
  const notification = new this(data);
  await notification.save();
  
  // Emit real-time event
  const io = require('../server').io;
  if (io) {
    io.to(`user:${data.user}`).emit('notification:new', notification);
  }
  
  return notification;
};

notificationSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({
    user: userId,
    read: false,
    expiresAt: { $gt: new Date() }
  });
};

notificationSchema.statics.markAllAsRead = function(userId) {
  return this.updateMany(
    { user: userId, read: false },
    { read: true, readAt: new Date() }
  );
};

notificationSchema.statics.groupNotifications = async function(userId) {
  const pipeline = [
    { $match: { user: mongoose.Types.ObjectId(userId), read: false } },
    {
      $group: {
        _id: '$groupId',
        notifications: { $push: '$ROOT' },
        count: { $sum: 1 },
        latest: { $max: '$createdAt' }
      }
    },
    { $sort: { latest: -1 } }
  ];
  
  return this.aggregate(pipeline);
};

module.exports = mongoose.model('Notification', notificationSchema);