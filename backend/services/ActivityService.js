const { Activity } = require('../models');
const { redis } = require('../middleware/cache');
const logger = require('../utils/logger');

class ActivityService {
  /**
   * Log activity
   */
  async logActivity(data) {
    try {
      const activity = new Activity({
        user: data.user,
        action: data.action,
        resource: data.resource,
        details: data.details || {},
        ip: data.ip,
        userAgent: data.userAgent,
        metadata: data.metadata || {}
      });

      await activity.save();

      // Cache recent activities
      await this.cacheRecentActivity(activity);

      // Emit real-time event if needed
      if (data.broadcast) {
        this.broadcastActivity(activity);
      }

      return activity;
    } catch (error) {
      logger.error('Log activity error:', error);
      // Don't throw - logging shouldn't break the main flow
    }
  }

  /**
   * Get user activities
   */
  async getUserActivities(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        startDate,
        endDate,
        actions,
        resourceType
      } = options;

      const query = { user: userId };

      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      if (actions && actions.length > 0) {
        query.action = { $in: actions };
      }

      if (resourceType) {
        query['resource.type'] = resourceType;
      }

      const activities = await Activity
        .find(query)
        .populate('user', 'firstName lastName email avatar')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit)
        .lean();

      const total = await Activity.countDocuments(query);

      return {
        activities,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Get user activities error:', error);
      throw error;
    }
  }

  /**
   * Get resource activities
   */
  async getResourceActivities(resourceType, resourceId, options = {}) {
    try {
      const { page = 1, limit = 20 } = options;

      const query = {
        'resource.type': resourceType,
        'resource.id': resourceId
      };

      const activities = await Activity
        .find(query)
        .populate('user', 'firstName lastName email avatar')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit)
        .lean();

      const total = await Activity.countDocuments(query);

      return {
        activities,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Get resource activities error:', error);
      throw error;
    }
  }

  /**
   * Get activity feed
   */
  async getActivityFeed(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        includeOwn = false
      } = options;

      // Get user's contracts and collaborations
      const Contract = require('../models/Contract');
      const contracts = await Contract.find({
        $or: [
          { owner: userId },
          { 'collaborators.user': userId }
        ]
      }).select('_id');

      const contractIds = contracts.map(c => c._id.toString());

      // Build query
      const query = {
        $or: [
          // Activities on user's contracts
          {
            'resource.type': 'contract',
            'resource.id': { $in: contractIds }
          },
          // Activities by followed users (if implemented)
          // { user: { $in: followedUserIds } }
        ]
      };

      if (!includeOwn) {
        query.user = { $ne: userId };
      }

      const activities = await Activity
        .find(query)
        .populate('user', 'firstName lastName email avatar')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit)
        .lean();

      const total = await Activity.countDocuments(query);

      return {
        activities,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Get activity feed error:', error);
      throw error;
    }
  }

  /**
   * Get activity statistics
   */
  async getActivityStats(options = {}) {
    try {
      const {
        userId,
        startDate,
        endDate,
        groupBy = 'day'
      } = options;

      const match = {};
      if (userId) match.user = userId;
      if (startDate || endDate) {
        match.createdAt = {};
        if (startDate) match.createdAt.$gte = new Date(startDate);
        if (endDate) match.createdAt.$lte = new Date(endDate);
      }

      const dateFormat = {
        day: '%Y-%m-%d',
        week: '%Y-%V',
        month: '%Y-%m',
        year: '%Y'
      };

      const stats = await Activity.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              date: {
                $dateToString: {
                  format: dateFormat[groupBy],
                  date: '$createdAt'
                }
              },
              action: '$action'
            },
            count: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: '$_id.date',
            activities: {
              $push: {
                action: '$_id.action',
                count: '$count'
              }
            },
            total: { $sum: '$count' }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      return stats;
    } catch (error) {
      logger.error('Get activity stats error:', error);
      throw error;
    }
  }

  /**
   * Search activities
   */
  async searchActivities(query, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        userId,
        actions,
        resourceType
      } = options;

      const searchQuery = {};

      if (userId) searchQuery.user = userId;
      if (actions && actions.length > 0) searchQuery.action = { $in: actions };
      if (resourceType) searchQuery['resource.type'] = resourceType;

      if (query) {
        searchQuery.$or = [
          { action: { $regex: query, $options: 'i' } },
          { 'details.title': { $regex: query, $options: 'i' } },
          { 'details.message': { $regex: query, $options: 'i' } }
        ];
      }

      const activities = await Activity
        .find(searchQuery)
        .populate('user', 'firstName lastName email avatar')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit)
        .lean();

      const total = await Activity.countDocuments(searchQuery);

      return {
        activities,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Search activities error:', error);
      throw error;
    }
  }

  /**
   * Helper methods
   */

  async cacheRecentActivity(activity) {
    try {
      const key = `recent_activities:${activity.user}`;
      const ttl = 3600; // 1 hour

      // Get existing activities
      const existing = await redis.get(key);
      let activities = existing ? JSON.parse(existing) : [];

      // Add new activity
      activities.unshift({
        _id: activity._id,
        action: activity.action,
        resource: activity.resource,
        createdAt: activity.createdAt
      });

      // Keep only last 50
      activities = activities.slice(0, 50);

      await redis.setex(key, ttl, JSON.stringify(activities));
    } catch (error) {
      logger.error('Cache recent activity error:', error);
    }
  }

  broadcastActivity(activity) {
    try {
      const io = require('../websocket');
      
      // Broadcast to relevant users
      io.to(`activity:${activity.resource.type}:${activity.resource.id}`)
        .emit('activity', {
          id: activity._id,
          user: activity.user,
          action: activity.action,
          resource: activity.resource,
          details: activity.details,
          createdAt: activity.createdAt
        });
    } catch (error) {
      logger.error('Broadcast activity error:', error);
    }
  }

  /**
   * Get action descriptions
   */
  getActionDescription(action) {
    const descriptions = {
      'contract.created': 'created a contract',
      'contract.updated': 'updated the contract',
      'contract.deleted': 'deleted the contract',
      'contract.signed': 'signed the contract',
      'contract.shared': 'shared the contract',
      'contract.viewed': 'viewed the contract',
      'template.created': 'created a template',
      'template.updated': 'updated the template',
      'comment.added': 'added a comment',
      'user.login': 'logged in',
      'user.logout': 'logged out'
    };

    return descriptions[action] || action;
  }
}

module.exports = new ActivityService();