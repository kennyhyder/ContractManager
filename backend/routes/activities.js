const express = require('express');
const router = express.Router();
const { Activity, Contract } = require('../models');
const { authMiddleware } = require('../middleware/auth');
const logger = require('../utils/logger');

/**
 * @route   GET /api/activities
 * @desc    Get activities
 * @access  Private
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { 
      resourceType, 
      resourceId, 
      userId, 
      action,
      startDate,
      endDate,
      page = 1, 
      limit = 50 
    } = req.query;

    // Build query
    const query = {};

    if (resourceType) query['resource.type'] = resourceType;
    if (resourceId) query['resource.id'] = resourceId;
    if (userId) query.user = userId;
    if (action) query.action = new RegExp(action, 'i');

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    // Get activities
    const activities = await Activity
      .find(query)
      .populate('user', 'firstName lastName avatar')
      .sort({ timestamp: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Activity.countDocuments(query);

    res.json({
      success: true,
      data: {
        activities,
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          page: parseInt(page),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get activities error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch activities' 
    });
  }
});

/**
 * @route   GET /api/activities/feed
 * @desc    Get activity feed for current user
 * @access  Private
 */
router.get('/feed', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    // Get contracts user has access to
    const contracts = await Contract.find({
      $or: [
        { owner: req.user._id },
        { 'collaborators.user': req.user._id }
      ]
    }).select('_id');

    const contractIds = contracts.map(c => c._id);

    // Get activities for those contracts and user's own activities
    const activities = await Activity
      .find({
        $or: [
          { user: req.user._id },
          { 'resource.type': 'contract', 'resource.id': { $in: contractIds } }
        ]
      })
      .populate('user', 'firstName lastName avatar')
      .sort({ timestamp: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Activity.countDocuments({
      $or: [
        { user: req.user._id },
        { 'resource.type': 'contract', 'resource.id': { $in: contractIds } }
      ]
    });

    res.json({
      success: true,
      data: {
        activities,
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          page: parseInt(page),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get activity feed error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch activity feed' 
    });
  }
});

/**
 * @route   GET /api/activities/stats
 * @desc    Get activity statistics
 * @access  Private
 */
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const { period = '7d' } = req.query;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '24h':
        startDate.setHours(startDate.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
    }

    // Get activity stats
    const stats = await Activity.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            action: '$action',
            date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.action',
          dailyCounts: {
            $push: {
              date: '$_id.date',
              count: '$count'
            }
          },
          total: { $sum: '$count' }
        }
      },
      {
        $sort: { total: -1 }
      }
    ]);

    // Get top users
    const topUsers = await Activity.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$user',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          user: {
            _id: 1,
            firstName: 1,
            lastName: 1,
            avatar: '$user.profile.avatar'
          },
          count: 1
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        period,
        startDate,
        endDate,
        activityByType: stats,
        topUsers
      }
    });
  } catch (error) {
    logger.error('Get activity stats error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch activity statistics' 
    });
  }
});

module.exports = router;