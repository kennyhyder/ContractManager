const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  contract: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Contract', 
    required: true,
    index: true
  },
  
  author: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  
  text: { 
    type: String, 
    required: true,
    maxlength: 2000
  },
  
  type: {
    type: String,
    enum: ['general', 'question', 'suggestion', 'issue', 'approval', 'revision'],
    default: 'general'
  },
  
  status: {
    type: String,
    enum: ['active', 'resolved', 'archived'],
    default: 'active'
  },
  
  // For threaded comments
  parent: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Comment' 
  },
  
  thread: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment'
  },
  
  replies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment'
  }],
  
  // Mentions
  mentions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    notified: {
      type: Boolean,
      default: false
    }
  }],
  
  // Position in document
  position: {
    section: String,
    paragraph: Number,
    sentence: Number,
    startOffset: Number,
    endOffset: Number,
    selectedText: String
  },
  
  // Attachments
  attachments: [{
    name: String,
    url: String,
    type: String,
    size: Number
  }],
  
  // Reactions
  reactions: {
    type: Map,
    of: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    default: {}
  },
  
  // Resolution
  resolved: {
    type: Boolean,
    default: false
  },
  
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  resolvedAt: Date,
  
  // Edit history
  edited: {
    type: Boolean,
    default: false
  },
  
  editHistory: [{
    text: String,
    editedAt: Date,
    editedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  
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
commentSchema.index({ contract: 1, createdAt: -1 });
commentSchema.index({ author: 1 });
commentSchema.index({ parent: 1 });
commentSchema.index({ thread: 1 });
commentSchema.index({ 'mentions.user': 1 });
commentSchema.index({ text: 'text' });

// Virtual for reply count
commentSchema.virtual('replyCount').get(function() {
  return this.replies ? this.replies.length : 0;
});

// Instance methods
commentSchema.methods.addReaction = function(userId, emoji) {
  if (!this.reactions.has(emoji)) {
    this.reactions.set(emoji, []);
  }
  
  const users = this.reactions.get(emoji);
  if (!users.includes(userId)) {
    users.push(userId);
  }
  
  return this.save();
};

commentSchema.methods.removeReaction = function(userId, emoji) {
  if (this.reactions.has(emoji)) {
    const users = this.reactions.get(emoji);
    const index = users.indexOf(userId);
    if (index > -1) {
      users.splice(index, 1);
      if (users.length === 0) {
        this.reactions.delete(emoji);
      }
    }
  }
  
  return this.save();
};

commentSchema.methods.resolve = function(userId) {
  this.resolved = true;
  this.resolvedBy = userId;
  this.resolvedAt = new Date();
  this.status = 'resolved';
  
  return this.save();
};

commentSchema.methods.edit = function(newText, userId) {
  // Save current text to history
  this.editHistory.push({
    text: this.text,
    editedAt: new Date(),
    editedBy: userId
  });
  
  this.text = newText;
  this.edited = true;
  
  return this.save();
};

// Static methods
commentSchema.statics.getThreads = function(contractId) {
  return this.find({
    contract: contractId,
    parent: null,
    isDeleted: false
  })
  .populate('author', 'firstName lastName avatar')
  .populate({
    path: 'replies',
    populate: {
      path: 'author',
      select: 'firstName lastName avatar'
    }
  })
  .sort({ createdAt: -1 });
};

// Middleware
commentSchema.pre('save', function(next) {
  // Extract mentions from text
  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const mentions = [];
  let match;
  
  while ((match = mentionRegex.exec(this.text)) !== null) {
    mentions.push({
      user: match[2], // User ID
      notified: false
    });
  }
  
  this.mentions = mentions;
  next();
});

module.exports = mongoose.model('Comment', commentSchema);