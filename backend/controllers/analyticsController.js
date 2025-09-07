const { Contract, User, Activity, Template } = require('../models');
const moment = require('moment');
const logger = require('../utils/logger');

class AnalyticsController {
  /**
   * Get dashboard analytics
   */
  async getDashboardAnalytics(req, res, next) {
    try {
      const userId = req.user._id;
      const { period = '30d' } = req.query;

      const dateRange = this.getDateRange(period);

      // Get multiple analytics in parallel
      const [
        contractStats,
        activityStats,
        performanceMetrics,
        upcomingTasks
      ] = await Promise.all([
        this.getContractStats(userId, dateRange),
        this.getActivityStats(userId, dateRange),
        this.getPerformanceMetrics(userId, dateRange),
        this.getUpcomingTasks(userId)
      ]);

      res.json({
        success: true,
        data: {
          period,
          dateRange,
          contracts: contractStats,
          activity: activityStats,
          performance: performanceMetrics,
          upcoming: upcomingTasks
        }
      });
    } catch (error) {
      logger.error('Get dashboard analytics error:', error);
      next(error);
    }
  }

  /**
   * Get contract analytics
   */
  async getContractAnalytics(req, res, next) {
    try {
      const userId = req.user._id;
      const { 
        startDate, 
        endDate, 
        groupBy = 'day',
        type,
        status
      } = req.query;

      const match = {
        $or: [
          { owner: userId },
          { 'collaborators.user': userId }
        ],
        deletedAt: null
      };

      if (startDate || endDate) {
        match.createdAt = {};
        if (startDate) match.createdAt.$gte = new Date(startDate);
        if (endDate) match.createdAt.$lte = new Date(endDate);
      }

      if (type) match.type = type;
      if (status) match.status = status;

      // Time series data
      const timeFormat = {
        day: '%Y-%m-%d',
        week: '%Y-%V',
        month: '%Y-%m',
        year: '%Y'
      };

      const timeSeries = await Contract.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              $dateToString: {
                format: timeFormat[groupBy],
                date: '$createdAt'
              }
            },
            count: { $sum: 1 },
            value: { $sum: { $ifNull: ['$value', 0] } }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      // Status distribution
      const statusDistribution = await Contract.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      // Type distribution
      const typeDistribution = await Contract.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
            totalValue: { $sum: { $ifNull: ['$value', 0] } }
          }
        }
      ]);

      // Average metrics
      const averageMetrics = await Contract.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            avgValue: { $avg: { $ifNull: ['$value', 0] } },
            avgDuration: {
              $avg: {
                $cond: [
                  { $and: ['$dates.effective', '$dates.expiry'] },
                  { $subtract: ['$dates.expiry', '$dates.effective'] },
                  null
                ]
              }
            },
            avgSigningTime: {
              $avg: {
                $cond: [
                  { $and: ['$createdAt', '$signedAt'] },
                  { $subtract: ['$signedAt', '$createdAt'] },
                  null
                ]
              }
            }
          }
        }
      ]);

      res.json({
        success: true,
        data: {
          timeSeries,
          statusDistribution,
          typeDistribution,
          averageMetrics: averageMetrics[0] || {
            avgValue: 0,
            avgDuration: 0,
            avgSigningTime: 0
          }
        }
      });
    } catch (error) {
      logger.error('Get contract analytics error:', error);
      next(error);
    }
  }

  /**
   * Get user analytics
   */
  async getUserAnalytics(req, res, next) {
    try {
      const userId = req.params.id || req.user._id;
      
      // Check permissions
      if (userId !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'Access denied',
          code: 'ACCESS_DENIED'
        });
      }

      const { period = '30d' } = req.query;
      const dateRange = this.getDateRange(period);

      // User activity timeline
      const activityTimeline = await Activity.aggregate([
        {
          $match: {
            user: mongoose.Types.ObjectId(userId),
            createdAt: { $gte: dateRange.start, $lte: dateRange.end }
          }
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
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

      // Most used features
      const featureUsage = await Activity.aggregate([
        {
          $match: {
            user: mongoose.Types.ObjectId(userId),
            createdAt: { $gte: dateRange.start, $lte: dateRange.end }
          }
        },
        {
          $group: {
            _id: '$action',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);

      // Collaboration stats
      const collaborationStats = await Contract.aggregate([
        {
          $match: {
            'collaborators.user': mongoose.Types.ObjectId(userId),
            createdAt: { $gte: dateRange.start, $lte: dateRange.end }
          }
        },
        {
          $group: {
            _id: null,
            totalCollaborations: { $sum: 1 },
            uniqueCollaborators: { $addToSet: '$owner' }
          }
        },
        {
          $project: {
            totalCollaborations: 1,
            uniqueCollaboratorsCount: { $size: '$uniqueCollaborators' }
          }
        }
      ]);

      res.json({
        success: true,
        data: {
          activityTimeline,
          featureUsage,
          collaborationStats: collaborationStats[0] || {
            totalCollaborations: 0,
            uniqueCollaboratorsCount: 0
          }
        }
      });
    } catch (error) {
      logger.error('Get user analytics error:', error);
      next(error);
    }
  }

  /**
   * Get organization analytics (admin only)
   */
  async getOrganizationAnalytics(req, res, next) {
    try {
      // Check admin permission
      if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({
          error: 'Admin access required',
          code: 'ADMIN_REQUIRED'
        });
      }

      const { period = '30d' } = req.query;
      const dateRange = this.getDateRange(period);

      // Overall statistics
      const [
        userStats,
        contractStats,
        storageStats,
        systemHealth
      ] = await Promise.all([
        this.getOrganizationUserStats(dateRange),
        this.getOrganizationContractStats(dateRange),
        this.getOrganizationStorageStats(),
        this.getSystemHealthMetrics()
      ]);

      // Department breakdown
      const departmentStats = await User.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: '$department',
            count: { $sum: 1 }
          }
        }
      ]);

      res.json({
        success: true,
        data: {
          period,
          users: userStats,
          contracts: contractStats,
          storage: storageStats,
          systemHealth,
          departments: departmentStats
        }
      });
    } catch (error) {
      logger.error('Get organization analytics error:', error);
      next(error);
    }
  }

  /**
   * Export analytics report
   */
  async exportAnalytics(req, res, next) {
    try {
      const { 
        type = 'contracts',
        format = 'csv',
        startDate,
        endDate
      } = req.query;

      const userId = req.user._id;

      let data;
      switch (type) {
        case 'contracts':
          data = await this.getContractExportData(userId, { startDate, endDate });
          break;
        case 'activity':
          data = await this.getActivityExportData(userId, { startDate, endDate });
          break;
        case 'templates':
          data = await this.getTemplateExportData(userId, { startDate, endDate });
          break;
        default:
          return res.status(400).json({
            error: 'Invalid export type',
            code: 'INVALID_TYPE'
          });
      }

      let exportContent;
      let contentType;
      let filename;

      switch (format) {
        case 'csv':
          exportContent = this.convertToCSV(data);
          contentType = 'text/csv';
          filename = `${type}_export_${moment().format('YYYY-MM-DD')}.csv`;
          break;
        case 'json':
          exportContent = JSON.stringify(data, null, 2);
          contentType = 'application/json';
          filename = `${type}_export_${moment().format('YYYY-MM-DD')}.json`;
          break;
        case 'xlsx':
          exportContent = await this.convertToXLSX(data);
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          filename = `${type}_export_${moment().format('YYYY-MM-DD')}.xlsx`;
          break;
        default:
          return res.status(400).json({
            error: 'Invalid export format',
            code: 'INVALID_FORMAT'
          });
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(exportContent);
    } catch (error) {
      logger.error('Export analytics error:', error);
      next(error);
    }
  }

  /**
   * Helper methods
   */
  getDateRange(period) {
    const end = moment().endOf('day');
    let start;

    switch (period) {
      case '7d':
        start = moment().subtract(7, 'days').startOf('day');
        break;
      case '30d':
        start = moment().subtract(30, 'days').startOf('day');
        break;
      case '90d':
        start = moment().subtract(90, 'days').startOf('day');
        break;
      case '1y':
        start = moment().subtract(1, 'year').startOf('day');
        break;
      case 'mtd': // Month to date
        start = moment().startOf('month');
        break;
      case 'ytd': // Year to date
        start = moment().startOf('year');
        break;
      default:
        start = moment().subtract(30, 'days').startOf('day');
    }

    return {
      start: start.toDate(),
      end: end.toDate()
    };
  }

  async getContractStats(userId, dateRange) {
    const stats = await Contract.aggregate([
      {
        $match: {
          $or: [
            { owner: userId },
            { 'collaborators.user': userId }
          ],
          createdAt: { $gte: dateRange.start, $lte: dateRange.end }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          signed: {
            $sum: { $cond: [{ $eq: ['$status', 'signed'] }, 1, 0] }
          },
          pending: {
            $sum: { $cond: [{ $in: ['$status', ['draft', 'review', 'approved']] }, 1, 0] }
          },
          expired: {
            $sum: { $cond: [{ $eq: ['$status', 'expired'] }, 1, 0] }
          }
        }
      }
    ]);

    return stats[0] || {
      total: 0,
      signed: 0,
      pending: 0,
      expired: 0
    };
  }

  async getActivityStats(userId, dateRange) {
    const activities = await Activity.find({
      user: userId,
      createdAt: { $gte: dateRange.start, $lte: dateRange.end }
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const actionCounts = activities.reduce((acc, activity) => {
      acc[activity.action] = (acc[activity.action] || 0) + 1;
      return acc;
    }, {});

    return {
      total: activities.length,
      byAction: actionCounts,
      recent: activities.slice(0, 10)
    };
  }

  async getPerformanceMetrics(userId, dateRange) {
    // Implementation for performance metrics
    return {
      avgResponseTime: 0,
      completionRate: 0,
      efficiencyScore: 0
    };
  }

  async getUpcomingTasks(userId) {
    const tasks = [];

    // Contracts expiring soon
    const expiringContracts = await Contract.find({
      $or: [
        { owner: userId },
        { 'collaborators.user': userId }
      ],
      'dates.expiry': {
        $gte: new Date(),
        $lte: moment().add(30, 'days').toDate()
      },
      status: { $ne: 'expired' }
    })
      .sort({ 'dates.expiry': 1 })
      .limit(5)
      .lean();

    expiringContracts.forEach(contract => {
      tasks.push({
        type: 'contract_expiring',
        title: `Contract expiring: ${contract.title}`,
        dueDate: contract.dates.expiry,
        resourceId: contract._id
      });
    });

    // Pending approvals
    const pendingApprovals = await Approval.find({
      'approvers.user': userId,
      'approvers.status': 'pending',
      status: 'pending'
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    pendingApprovals.forEach(approval => {
      tasks.push({
        type: 'approval_pending',
        title: `Approval required: ${approval.title}`,
        dueDate: approval.deadline,
        resourceId: approval._id
      });
    });

    return tasks.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  }

  async getOrganizationUserStats(dateRange) {
    const [totalUsers, activeUsers, newUsers] = await Promise.all([
      User.countDocuments({ isActive: true }),
      User.countDocuments({
        isActive: true,
        lastLogin: { $gte: moment().subtract(30, 'days').toDate() }
      }),
      User.countDocuments({
        createdAt: { $gte: dateRange.start, $lte: dateRange.end }
      })
    ]);

    return {
      total: totalUsers,
      active: activeUsers,
      new: newUsers,
      activePercentage: totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0
    };
  }

  async getOrganizationContractStats(dateRange) {
    const stats = await Contract.aggregate([
      {
        $match: {
          createdAt: { $gte: dateRange.start, $lte: dateRange.end }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          totalValue: { $sum: { $ifNull: ['$value', 0] } },
          avgValue: { $avg: { $ifNull: ['$value', 0] } }
        }
      }
    ]);

    return stats[0] || {
      total: 0,
      totalValue: 0,
      avgValue: 0
    };
  }

  async getOrganizationStorageStats() {
    // Implementation for storage statistics
    return {
      totalUsed: 0,
      totalLimit: 0,
      percentageUsed: 0
    };
  }

  async getSystemHealthMetrics() {
    // Implementation for system health
    return {
      uptime: process.uptime(),
      responseTime: 0,
      errorRate: 0,
      queueSize: 0
    };
  }

  convertToCSV(data) {
    if (!Array.isArray(data) || data.length === 0) {
      return '';
    }

    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          return typeof value === 'string' && value.includes(',') 
            ? `"${value}"` 
            : value;
        }).join(',')
      )
    ].join('\n');

    return csv;
  }

  async convertToXLSX(data) {
    // Implementation for XLSX conversion
    // Would use a library like xlsx or exceljs
    return Buffer.from('');
  }

  async getContractExportData(userId, filters) {
    const query = {
      $or: [
        { owner: userId },
        { 'collaborators.user': userId }
      ]
    };

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
    }

    const contracts = await Contract.find(query)
      .populate('owner', 'firstName lastName email')
      .lean();

    return contracts.map(contract => ({
      title: contract.title,
      type: contract.type,
      status: contract.status,
      createdAt: contract.createdAt,
      value: contract.value || 0,
      owner: `${contract.owner.firstName} ${contract.owner.lastName}`,
      parties: contract.parties.length
    }));
  }

  async getActivityExportData(userId, filters) {
    const query = { user: userId };

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
    }

    const activities = await Activity.find(query)
      .sort({ createdAt: -1 })
      .lean();

    return activities.map(activity => ({
      action: activity.action,
      resourceType: activity.resource.type,
      resourceId: activity.resource.id,
      timestamp: activity.createdAt,
      ip: activity.ip
    }));
  }

  async getTemplateExportData(userId, filters) {
    const templates = await Template.find({ createdBy: userId })
      .lean();

    return templates.map(template => ({
      name: template.name,
      category: template.category,
      usageCount: template.usageCount,
      isPublic: template.isPublic,
      createdAt: template.createdAt
    }));
  }
}

module.exports = new AnalyticsController();