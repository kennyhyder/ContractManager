const mongoose = require('mongoose');

module.exports = {
  description: 'Create initial database schema and indexes',

  async up(session) {
    // Create indexes for User model
    const User = mongoose.model('User');
    await User.collection.createIndexes([
      { key: { email: 1 }, unique: true },
      { key: { role: 1 } },
      { key: { isActive: 1 } },
      { key: { createdAt: -1 } },
      { key: { 'oauthProviders.provider': 1, 'oauthProviders.providerId': 1 } }
    ], { session });

    // Create indexes for Contract model
    const Contract = mongoose.model('Contract');
    await Contract.collection.createIndexes([
      { key: { owner: 1, status: 1 } },
      { key: { collaborators: 1 } },
      { key: { template: 1 } },
      { key: { status: 1, endDate: 1 } },
      { key: { createdAt: -1 } },
      { key: { tags: 1 } },
      { key: { 'searchContent': 'text' } }
    ], { session });

    // Create indexes for Template model
    const Template = mongoose.model('Template');
    await Template.collection.createIndexes([
      { key: { category: 1, isActive: 1 } },
      { key: { owner: 1 } },
      { key: { isPublic: 1, isActive: 1 } },
      { key: { tags: 1 } },
      { key: { usageCount: -1 } }
    ], { session });

    // Create indexes for Comment model
    const Comment = mongoose.model('Comment');
    await Comment.collection.createIndexes([
      { key: { contract: 1, createdAt: -1 } },
      { key: { author: 1 } },
      { key: { parentComment: 1 } },
      { key: { mentions: 1 } }
    ], { session });

    // Create indexes for Activity model
    const Activity = mongoose.model('Activity');
    await Activity.collection.createIndexes([
      { key: { user: 1, createdAt: -1 } },
      { key: { resource: 1, resourceId: 1 } },
      { key: { action: 1 } },
      { key: { createdAt: -1 } }
    ], { session });

    // Create indexes for Notification model
    const Notification = mongoose.model('Notification');
    await Notification.collection.createIndexes([
      { key: { recipient: 1, isRead: 1, createdAt: -1 } },
      { key: { type: 1 } },
      { key: { relatedContract: 1 } },
      { key: { createdAt: -1 } }
    ], { session });
// Create indexes for Approval model
    const Approval = mongoose.model('Approval');
    await Approval.collection.createIndexes([
      { key: { contract: 1, status: 1 } },
      { key: { approver: 1, status: 1 } },
      { key: { createdAt: -1 } },
      { key: { dueDate: 1 } }
    ], { session });

    // Create indexes for EmailLog model
    const EmailLog = mongoose.model('EmailLog');
    await EmailLog.collection.createIndexes([
      { key: { to: 1 } },
      { key: { status: 1 } },
      { key: { sentAt: -1 } },
      { key: { messageId: 1 } }
    ], { session });

    return {
      collections: ['users', 'contracts', 'templates', 'comments', 'activities', 'notifications', 'approvals', 'emaillogs'],
      indexesCreated: true
    };
  },

  async down(session) {
    // Drop all indexes except _id
    const collections = ['users', 'contracts', 'templates', 'comments', 'activities', 'notifications', 'approvals', 'emaillogs'];
    
    for (const collectionName of collections) {
      const collection = mongoose.connection.collection(collectionName);
      const indexes = await collection.indexes();
      
      for (const index of indexes) {
        if (index.name !== '_id_') {
          await collection.dropIndex(index.name, { session });
        }
      }
    }

    return {
      indexesDropped: true
    };
  }
};