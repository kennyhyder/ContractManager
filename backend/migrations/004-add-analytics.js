module.exports = {
  description: 'Add analytics tables and indexes for reporting',

  async up(session) {
    const mongoose = require('mongoose');

    // Create Analytics schema for storing computed metrics
    const analyticsSchema = new mongoose.Schema({
      type: {
        type: String,
        required: true,
        enum: ['daily', 'weekly', 'monthly', 'custom']
      },
      date: {
        type: Date,
        required: true
      },
      metrics: {
        contracts: {
          created: Number,
          signed: Number,
          expired: Number,
          active: Number,
          totalValue: Number
        },
        users: {
          new: Number,
          active: Number,
          total: Number
        },
        templates: {
          created: Number,
          used: Number,
          purchased: Number
        },
        activities: {
          total: Number,
          byType: mongoose.Schema.Types.Mixed
        },
        revenue: {
          subscriptions: Number,
          templates: Number,
          total: Number
        }
      },
      metadata: mongoose.Schema.Types.Mixed,
      createdAt: {
        type: Date,
        default: Date.now
      }
    });

    // Create Insights schema for AI-generated insights
    const insightSchema = new mongoose.Schema({
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      type: {
        type: String,
        enum: ['tip', 'warning', 'improvement', 'achievement'],
        required: true
      },
      title: String,
      message: String,
      priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
      },
      data: mongoose.Schema.Types.Mixed,
      isRead: {
        type: Boolean,
        default: false
      },
      isDismissed: {
        type: Boolean,
        default: false
      },
      generatedAt: {
        type: Date,
        default: Date.now
      },
      expiresAt: Date
    });

    // Create Report schema for generated reports
    const reportSchema = new mongoose.Schema({
      type: {
        type: String,
        required: true
      },
      generatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      parameters: mongoose.Schema.Types.Mixed,
      status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending'
      },
      format: {
        type: String,
        enum: ['pdf', 'csv', 'excel', 'json'],
        default: 'pdf'
      },
      fileUrl: String,
      fileSize: Number,
      recordCount: Number,
      error: String,
      startedAt: Date,
      completedAt: Date,
      createdAt: {
        type: Date,
        default: Date.now
      },
      expiresAt: {
        type: Date,
        default: () => new Date(+new Date() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }
    });

    // Create models
    const Analytics = mongoose.model('Analytics', analyticsSchema);
    const Insight = mongoose.model('Insight', insightSchema);
    const Report = mongoose.model('Report', reportSchema);

    // Create indexes
    await Analytics.collection.createIndexes([
      { key: { type: 1, date: -1 }, unique: true },
      { key: { createdAt: -1 } },
      { key: { date: -1 } }
    ], { session });

    await Insight.collection.createIndexes([
      { key: { user: 1, isRead: 1, isDismissed: 1 } },
      { key: { generatedAt: -1 } },
      { key: { expiresAt: 1 }, expireAfterSeconds: 0 }
    ], { session });

    await Report.collection.createIndexes([
      { key: { generatedBy: 1, status: 1 } },
      { key: { createdAt: -1 } },
      { key: { expiresAt: 1 }, expireAfterSeconds: 0 }
    ], { session });

    // Add analytics fields to existing models
    const Contract = mongoose.model('Contract');
    const User = mongoose.model('User');
    const Template = mongoose.model('Template');

    // Add analytics tracking to contracts
    await Contract.updateMany(
      {},
      {
        $set: {
          analytics: {
            viewCount: 0,
            editCount: 0,
            commentCount: 0,
            shareCount: 0,
            lastViewed: null,
            avgTimeToSign: null
          }
        }
      },
      { session }
    );

    // Add analytics preferences to users
    await User.updateMany(
      {},
      {
        $set: {
          'preferences.analytics': {
            dashboardLayout: 'default',
            emailReports: true,
            reportFrequency: 'weekly',
            insightsEnabled: true
          }
        }
      },
      { session }
    );

    // Add marketplace analytics to templates
    await Template.updateMany(
      {},
      {
        $set: {
          analytics: {
            viewCount: 0,
            purchaseCount: 0,
            usageCount: 0,
            revenue: 0,
            conversionRate: 0
          }
        }
      },
      { session }
    );

    return {
      tablesCreated: ['analytics', 'insights', 'reports'],
      fieldsAdded: {
        contracts: 'analytics',
        users: 'preferences.analytics',
        templates: 'analytics'
      }
    };
  },

  async down(session) {
    const mongoose = require('mongoose');

    // Drop analytics collections
    await mongoose.connection.dropCollection('analytics');
    await mongoose.connection.dropCollection('insights');
    await mongoose.connection.dropCollection('reports');

    // Remove analytics fields
    const Contract = mongoose.model('Contract');
    const User = mongoose.model('User');
    const Template = mongoose.model('Template');

    await Contract.updateMany(
      {},
      { $unset: { analytics: 1 } },
      { session }
    );

    await User.updateMany(
      {},
      { $unset: { 'preferences.analytics': 1 } },
      { session }
    );

    await Template.updateMany(
      {},
      { $unset: { analytics: 1 } },
      { session }
    );

    return {
      tablesDropped: ['analytics', 'insights', 'reports'],
      fieldsRemoved: true
    };
  }
};