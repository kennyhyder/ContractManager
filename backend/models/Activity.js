const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true 
  },
  
  action: { 
    type: String, 
    required: true,
    index: true 
  },
  
  resource: {
    type: { 
      type: String, 
      enum: ['contract', 'template', 'user', 'approval', 'comment', 'system'],
      required: true,
      index: true
    },
    id: { 
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'resource.type'
    },
    name: String
  },
  
  details: { 
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  metadata: {
    ip: String,
    userAgent: String,
    location: {
      city: String,
      country: String,
      coordinates: {
        latitude: Number,
        longitude: Number
      }
    },
    device: {
      type: String,
      browser: String,
      os: String
    }
  },
  
  timestamp: { 
    type: Date, 
    default: Date.now,
    index: true
  }
}, {
  collection: 'activities'
});

// Compound indexes
activitySchema.index({ user: 1, timestamp: -1 });
activitySchema.index({ 'resource.type': 1, 'resource.id': 1, timestamp: -1 });
activitySchema.index({ action: 1, timestamp: -1 });

// TTL index to auto-delete old activities after 1 year
activitySchema.index({ timestamp: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

// Static methods
activitySchema.statics.track = async function(data) {
  const activity = new this(data);
  return activity.save();
};

activitySchema.statics.getUserActivities = function(userId, options = {}) {
  const query = { user: userId };
  const limit = options.limit || 50;
  const skip = options.skip || 0;
  
  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(limit)
    .skip(skip)
    .populate('user', 'firstName lastName email')
    .populate('resource.id');
};

activitySchema.statics.getResourceActivities = function(resourceType, resourceId, options = {}) {
  const query = {
    'resource.type': resourceType,
    'resource.id': resourceId
  };
  
  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(options.limit || 50)
    .populate('user', 'firstName lastName email avatar');
};

module.exports = mongoose.model('Activity', activitySchema);