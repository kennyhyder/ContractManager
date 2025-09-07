const express = require('express');
const router = express.Router();
const { Contract, User, Activity, Template } = require('../models');
const { authMiddleware } = require('../middleware/auth');
const { permissionMiddleware } = require('../middleware/permissions');
const { cacheMiddleware } = require('../middleware/cache');
const analyticsQueue = require('../jobs/analyticsQueue');
const logger = require('../utils/logger');
const moment = require('moment');

/**
 * @route   GET /api/analytics/dashboard
 * @desc    Get dashboard analytics
 * @access  Private
 */
router.get('/dashboard', authMiddleware, cacheMiddleware(300), async (req, res) => {
  try {
    const userId = req.user._id;
    const { period = '30d' } = req.query;

    const startDate = getPeriodStartDate(period);
    const previousStartDate = getPreviousPeriodStartDate(period);

    // Parallel queries for performance
    const [
      contractStats,
      activityStats,
      upcomingDeadlines,
      recentActivities
    ] = await Promise.all([
      getContractStats(userId, startDate, previousStartDate),
      getActivityStats(userId, startDate),
      getUpcomingDeadlines(userId),
      getRecentActivities(userId)
    ]);

    res.json({
      success: true,
      data: {
        period,
        contracts: contractStats,
        activities: activityStats,
        deadlines: upcomingDeadlines,
        recentActivities
      }
    });
  } catch (error) {
    logger.error('Dashboard analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard analytics'
    });
  }
});

/**
 * @route   GET /api/analytics/contracts
 * @desc    Get detailed contract analytics
 * @access  Private
 */
router.get('/contracts', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const { startDate, endDate, groupBy = 'status' } = req.query;

    const query = {
      $or: [
        { owner: userId },
        { 'collaborators.user': userId }
      ]
    };

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    let aggregation;
    switch (groupBy) {
      case 'status':
        aggregation = [
          { $match: query },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
              totalValue: { $sum: '$value' }
            }
          }
        ];
        break;
      case 'category':
        aggregation = [
          { $match: query },
          {
            $lookup: {
              from: 'templates',
              localField: 'template',
              foreignField: '_id',
              as: 'templateData'
            }
          },
          {
            $group: {
              _id: '$templateData.category',
              count: { $sum: 1 },
              totalValue: { $sum: '$value' }
            }
          }
        ];
        break;
      case 'timeline':
        aggregation = [
          { $match: query },
          {
            $group: {
              _id: {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' }
              },
              count: { $sum: 1 },
              totalValue: { $sum: '$value' }
            }
          },
          { $sort: { '_id.year': 1, '_id.month': 1 } }
        ];
        break;
      default:
        aggregation = [{ $match: query }];
    }

    const results = await Contract.aggregate(aggregation);

    res.json({
      success: true,
      data: {
        groupBy,
        results
      }
    });
  } catch (error) {
    logger.error('Contract analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contract analytics'
    });
  }
});

/**
 * @route   GET /api/analytics/performance
 * @desc    Get user performance metrics
 * @access  Private
 */
router.get('/performance', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const { period = '30d' } = req.query;

    const startDate = getPeriodStartDate(period);

    const [
      contractMetrics,
      collaborationMetrics,
      efficiencyMetrics
    ] = await Promise.all([
      calculateContractMetrics(userId, startDate),
      calculateCollaborationMetrics(userId, startDate),
      calculateEfficiencyMetrics(userId, startDate)
    ]);

    res.json({
      success: true,
      data: {
        period,
        contracts: contractMetrics,
        collaboration: collaborationMetrics,
        efficiency: efficiencyMetrics
      }
    });
  } catch (error) {
    logger.error('Performance analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch performance metrics'
    });
  }
});

/**
 * @route   POST /api/analytics/report
 * @desc    Generate analytics report
 * @access  Private
 */
router.post('/report', authMiddleware, async (req, res) => {
  try {
    const {
      type,
      startDate,
      endDate,
      format = 'pdf',
      email = req.user.email
    } = req.body;

    // Validate report type
    const validTypes = ['contracts', 'activity', 'executive', 'custom'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid report type'
      });
    }

    // Queue report generation
    const job = await analyticsQueue.generateReport(type, {
      startDate,
      endDate,
      format,
      userId: req.user._id,
      email
    });

    res.json({
      success: true,
      message: 'Report generation queued',
      data: {
        jobId: job.id,
        estimatedTime: '5-10 minutes'
      }
    });
  } catch (error) {
    logger.error('Report generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to queue report generation'
    });
  }
});

/**
 * @route   GET /api/analytics/report/:jobId
 * @desc    Check report generation status
 * @access  Private
 */
router.get('/report/:jobId', authMiddleware, async (req, res) => {
  try {
    const status = await analyticsQueue.getReportStatus(req.params.jobId);

    if (!status) {
      return res.status(404).json({
        success: false,
        message: 'Report job not found'
      });
    }

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Report status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check report status'
    });
  }
});

/**
 * @route   GET /api/analytics/insights
 * @desc    Get AI-powered insights
 * @access  Private
 */
router.get('/insights', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const insights = await generateInsights(userId);

    res.json({
      success: true,
      data: { insights }
    });
  } catch (error) {
    logger.error('Insights generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate insights'
    });
  }
});

/**
 * @route   GET /api/analytics/export
 * @desc    Export analytics data
 * @access  Private
 */
router.get('/export', authMiddleware, async (req, res) => {
  try {
    const { dataType = 'all', format = 'csv' } = req.query;

    // Queue data export
    const job = await analyticsQueue.queue.add('export-data', {
      userId: req.user._id,
      dataType,
      format,
      email: req.user.email
    });

    res.json({
      success: true,
      message: 'Data export queued',
      data: {
        jobId: job.id,
        format
      }
    });
  } catch (error) {
    logger.error('Data export error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export data'
    });
  }
});

/**
 * @route   GET /api/analytics/admin
 * @desc    Get admin analytics (admin only)
 * @access  Private/Admin
 */
router.get('/admin', 
  authMiddleware, 
  permissionMiddleware('admin'),
  async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const startDate = getPeriodStartDate(period);

    const [
      systemStats,
      userGrowth,
      contractVolume,
      revenueMetrics
    ] = await Promise.all([
      getSystemStats(),
      getUserGrowthStats(startDate),
      getContractVolumeStats(startDate),
      getRevenueMetrics(startDate)
    ]);

    res.json({
      success: true,
      data: {
        period,
        system: systemStats,
        users: userGrowth,
        contracts: contractVolume,
        revenue: revenueMetrics
      }
    });
  } catch (error) {
    logger.error('Admin analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admin analytics'
    });
  }
});

// Helper functions
function getPeriodStartDate(period) {
  const now = moment();
  switch (period) {
    case '7d': return now.subtract(7, 'days').toDate();
    case '30d': return now.subtract(30, 'days').toDate();
    case '90d': return now.subtract(90, 'days').toDate();
    case '1y': return now.subtract(1, 'year').toDate();
    default: return now.subtract(30, 'days').toDate();
  }
}

function getPreviousPeriodStartDate(period) {
  const now = moment();
  switch (period) {
    case '7d': return now.subtract(14, 'days').toDate();
    case '30d': return now.subtract(60, 'days').toDate();
    case '90d': return now.subtract(180, 'days').toDate();
    case '1y': return now.subtract(2, 'years').toDate();
    default: return now.subtract(60, 'days').toDate();
  }
}

async function getContractStats(userId, startDate, previousStartDate) {
  const currentStats = await Contract.aggregate([
    {
      $match: {
        $or: [{ owner: userId }, { 'collaborators.user': userId }],
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        draft: { $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] } },
        signed: { $sum: { $cond: [{ $eq: ['$status', 'signed'] }, 1, 0] } },
        totalValue: { $sum: '$value' }
      }
    }
  ]);

  const previousStats = await Contract.aggregate([
    {
      $match: {
        $or: [{ owner: userId }, { 'collaborators.user': userId }],
        createdAt: { $gte: previousStartDate, $lt: startDate }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 }
      }
    }
  ]);

  const current = currentStats[0] || { total: 0, active: 0, draft: 0, signed: 0, totalValue: 0 };
  const previous = previousStats[0] || { total: 0 };

  return {
    ...current,
    growth: previous.total > 0 
      ? ((current.total - previous.total) / previous.total * 100).toFixed(1)
      : 0
  };
}

async function getActivityStats(userId, startDate) {
  return Activity.aggregate([
    {
      $match: {
        user: userId,
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);
}

async function getUpcomingDeadlines(userId) {
  return Contract.find({
    $or: [{ owner: userId }, { 'collaborators.user': userId }],
    status: { $in: ['active', 'pending'] },
    endDate: { $gte: new Date(), $lte: moment().add(30, 'days').toDate() }
  })
  .select('title endDate status')
  .sort({ endDate: 1 })
  .limit(5);
}

async function getRecentActivities(userId) {
  return Activity.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(10)
    .populate('user', 'name profilePicture');
}

async function calculateContractMetrics(userId, startDate) {
  const contracts = await Contract.find({
    $or: [{ owner: userId }, { 'collaborators.user': userId }],
    createdAt: { $gte: startDate }
  });

  const avgTimeToSign = contracts
    .filter(c => c.signedDate)
    .reduce((acc, c) => {
      const days = moment(c.signedDate).diff(moment(c.createdAt), 'days');
      return acc + days;
    }, 0) / contracts.filter(c => c.signedDate).length || 0;

  return {
    total: contracts.length,
    signed: contracts.filter(c => c.status === 'signed').length,
    avgTimeToSign: avgTimeToSign.toFixed(1),
    completionRate: (contracts.filter(c => c.status === 'signed').length / contracts.length * 100).toFixed(1)
  };
}

async function calculateCollaborationMetrics(userId, startDate) {
  const contracts = await Contract.find({
    'collaborators.user': userId,
    createdAt: { $gte: startDate }
  }).populate('collaborators.user', 'name');

  const uniqueCollaborators = new Set();
  contracts.forEach(c => {
    c.collaborators.forEach(collab => {
      if (collab.user._id.toString() !== userId.toString()) {
        uniqueCollaborators.add(collab.user._id.toString());
      }
    });
  });

  return {
    contractsCollaborated: contracts.length,
    uniqueCollaborators: uniqueCollaborators.size,
    avgCollaboratorsPerContract: (contracts.reduce((acc, c) => acc + c.collaborators.length, 0) / contracts.length).toFixed(1)
  };
}

async function calculateEfficiencyMetrics(userId, startDate) {
  const activities = await Activity.find({
    user: userId,
    createdAt: { $gte: startDate }
  });

  const actionCounts = activities.reduce((acc, activity) => {
    acc[activity.action] = (acc[activity.action] || 0) + 1;
    return acc;
  }, {});

  return {
    totalActions: activities.length,
    topActions: Object.entries(actionCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([action, count]) => ({ action, count }))
  };
}

async function generateInsights(userId) {
  // This would integrate with an AI service for advanced insights
  // For now, return rule-based insights
  const insights = [];
  
  const recentContracts = await Contract.find({
    owner: userId,
    createdAt: { $gte: moment().subtract(30, 'days').toDate() }
  });

  if (recentContracts.filter(c => c.status === 'draft').length > 3) {
    insights.push({
      type: 'tip',
      title: 'Complete Your Drafts',
      message: 'You have several contracts in draft status. Consider completing them to move forward.',
      priority: 'medium'
    });
  }

  const avgSignTime = recentContracts
    .filter(c => c.signedDate)
    .reduce((acc, c) => acc + moment(c.signedDate).diff(c.createdAt, 'days'), 0) / 
    recentContracts.filter(c => c.signedDate).length;

  if (avgSignTime > 7) {
    insights.push({
      type: 'improvement',
      title: 'Reduce Signing Time',
      message: 'Your average contract signing time is ' + avgSignTime.toFixed(0) + ' days. Consider streamlining your approval process.',
      priority: 'low'
    });
  }

  return insights;
}

async function getSystemStats() {
  const [totalUsers, totalContracts, totalTemplates] = await Promise.all([
    User.countDocuments(),
    Contract.countDocuments(),
    Template.countDocuments()
  ]);

  return {
    totalUsers,
    totalContracts,
    totalTemplates,
    activeUsers: await User.countDocuments({ 
      lastLogin: { $gte: moment().subtract(30, 'days').toDate() }
    })
  };
}

async function getUserGrowthStats(startDate) {
  return User.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);
}

async function getContractVolumeStats(startDate) {
  return Contract.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
        value: { $sum: '$value' }
      }
    },
    { $sort: { _id: 1 } }
  ]);
}

async function getRevenueMetrics(startDate) {
  // This would calculate actual revenue from template sales, subscriptions, etc.
  return {
    totalRevenue: 0,
    subscriptionRevenue: 0,
    templateRevenue: 0,
    growth: 0
  };
}

module.exports = router;