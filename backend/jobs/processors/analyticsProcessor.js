const { Contract, User, Activity, Template } = require('../../models');
const logger = require('../../utils/logger');
const moment = require('moment');
const fs = require('fs').promises;
const path = require('path');
const PDFGenerator = require('../../services/pdfGenerator');

module.exports = {
  async generateReport(job) {
    const { type, startDate, endDate, userId, format = 'pdf' } = job.data;

    try {
      logger.info(`Generating ${type} report from ${startDate} to ${endDate}`);

      let reportData;
      switch (type) {
        case 'contracts':
          reportData = await this.generateContractReport(startDate, endDate, userId);
          break;
        case 'users':
          reportData = await this.generateUserReport(startDate, endDate);
          break;
        case 'activity':
          reportData = await this.generateActivityReport(startDate, endDate, userId);
          break;
        case 'templates':
          reportData = await this.generateTemplateReport(startDate, endDate);
          break;
        case 'executive':
          reportData = await this.generateExecutiveReport(startDate, endDate);
          break;
        default:
          throw new Error(`Unknown report type: ${type}`);
      }

      // Generate report file
      let reportPath;
      if (format === 'pdf') {
        reportPath = await this.generatePDFReport(type, reportData, { startDate, endDate });
      } else if (format === 'csv') {
        reportPath = await this.generateCSVReport(type, reportData);
      } else {
        reportPath = await this.generateJSONReport(type, reportData);
      }

      // Upload to S3 if configured
      if (process.env.AWS_ACCESS_KEY_ID) {
        const uploadResult = await config.aws.uploadFile(
          { 
            buffer: await fs.readFile(reportPath),
            originalname: path.basename(reportPath),
            mimetype: format === 'pdf' ? 'application/pdf' : 'text/csv'
          },
          { folder: 'reports' }
        );

        // Clean up local file
        await fs.unlink(reportPath);
        reportPath = uploadResult.location;
      }

      logger.info(`Report generated successfully: ${reportPath}`);
      return { reportPath, type, format, recordCount: reportData.length };
    } catch (error) {
      logger.error(`Failed to generate report:`, error);
      throw error;
    }
  },

  async generateContractReport(startDate, endDate, userId) {
    const query = {
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    };

    if (userId) {
      query.$or = [
        { owner: userId },
        { 'collaborators.user': userId }
      ];
    }

    const contracts = await Contract.find(query)
      .populate('owner', 'name email')
      .populate('template', 'name')
      .sort({ createdAt: -1 });

    return contracts.map(contract => ({
      id: contract._id,
      title: contract.title,
      status: contract.status,
      owner: contract.owner.name,
      template: contract.template?.name || 'Custom',
      value: contract.value,
      currency: contract.currency,
      createdAt: contract.createdAt,
      startDate: contract.startDate,
      endDate: contract.endDate,
      signatureCount: contract.signatures.length,
      collaboratorCount: contract.collaborators.length
    }));
  },

  async generateUserReport(startDate, endDate) {
    const users = await User.find({
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    }).select('-password');

    const userStats = await Promise.all(users.map(async (user) => {
      const contractCount = await Contract.countDocuments({
        $or: [
          { owner: user._id },
          { 'collaborators.user': user._id }
        ]
      });

      const activityCount = await Activity.countDocuments({
        user: user._id,
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      });

      return {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        contractCount,
        activityCount,
        isActive: user.isActive,
        isVerified: user.isVerified
      };
    }));

    return userStats;
  },

  async generateActivityReport(startDate, endDate, userId) {
    const query = {
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    };

    if (userId) {
      query.user = userId;
    }

    const activities = await Activity.find(query)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(10000);

    return activities.map(activity => ({
      id: activity._id,
      user: activity.user.name,
      action: activity.action,
      resource: activity.resource,
      resourceId: activity.resourceId,
      description: activity.description,
      ipAddress: activity.ipAddress,
      userAgent: activity.userAgent,
      createdAt: activity.createdAt
    }));
  },

  async generateTemplateReport(startDate, endDate) {
    const templates = await Template.find({
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    }).populate('owner', 'name email');

    const templateStats = await Promise.all(templates.map(async (template) => {
      const usageCount = await Contract.countDocuments({ template: template._id });
      
      return {
        id: template._id,
        name: template.name,
        category: template.category,
        owner: template.owner.name,
        isPublic: template.isPublic,
        usageCount,
        rating: template.rating,
        reviewCount: template.reviews.length,
        createdAt: template.createdAt
      };
    }));

    return templateStats;
  },

  async generateExecutiveReport(startDate, endDate) {
    const [
      totalContracts,
      activeContracts,
      totalUsers,
      activeUsers,
      totalValue,
      templateUsage
    ] = await Promise.all([
      Contract.countDocuments({
        createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
      }),
      Contract.countDocuments({
        status: 'active',
        createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
      }),
      User.countDocuments({
        createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
      }),
      User.countDocuments({
        lastLogin: { $gte: new Date(startDate), $lte: new Date(endDate) }
      }),
      Contract.aggregate([
        {
          $match: {
            createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) },
            value: { $exists: true }
          }
        },
        {
          $group: {
            _id: '$currency',
            total: { $sum: '$value' }
          }
        }
      ]),
      Template.aggregate([
        {
          $lookup: {
            from: 'contracts',
            localField: '_id',
            foreignField: 'template',
            as: 'contracts'
          }
        },
        {
          $project: {
            name: 1,
            category: 1,
            usageCount: { $size: '$contracts' }
          }
        },
        {
          $sort: { usageCount: -1 }
        },
        {
          $limit: 10
        }
      ])
    ]);

    return {
      summary: {
        period: { startDate, endDate },
        totalContracts,
        activeContracts,
        totalUsers,
        activeUsers,
        contractValue: totalValue
      },
      topTemplates: templateUsage,
      trends: await this.calculateTrends(startDate, endDate)
    };
  },

  async calculateTrends(startDate, endDate) {
    const start = moment(startDate);
    const end = moment(endDate);
    const days = end.diff(start, 'days');
    
    let groupBy;
    if (days <= 31) {
      groupBy = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
    } else if (days <= 365) {
      groupBy = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
    } else {
      groupBy = { $year: '$createdAt' };
    }

    const contractTrend = await Contract.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
        }
      },
      {
        $group: {
          _id: groupBy,
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    return { contractTrend };
  },

  async calculateMetrics(job) {
    const { type = 'daily' } = job.data;

    try {
      logger.info(`Calculating ${type} metrics`);

      const now = new Date();
      let startDate;

      switch (type) {
        case 'daily':
          startDate = moment(now).subtract(1, 'day').startOf('day').toDate();
          break;
        case 'weekly':
          startDate = moment(now).subtract(1, 'week').startOf('week').toDate();
          break;
        case 'monthly':
          startDate = moment(now).subtract(1, 'month').startOf('month').toDate();
          break;
      }

      const metrics = {
        contracts: {
          created: await Contract.countDocuments({
            createdAt: { $gte: startDate }
          }),
          signed: await Contract.countDocuments({
            signedDate: { $gte: startDate }
          }),
          expired: await Contract.countDocuments({
            endDate: { $lte: now, $gte: startDate },
            status: 'expired'
          })
        },
        users: {
          new: await User.countDocuments({
            createdAt: { $gte: startDate }
          }),
          active: await User.countDocuments({
            lastLogin: { $gte: startDate }
          })
        },
        activities: await Activity.countDocuments({
          createdAt: { $gte: startDate }
        })
      };

      // Store metrics in database or cache
      await this.storeMetrics(type, metrics, startDate);

      logger.info(`${type} metrics calculated:`, metrics);
      return metrics;
    } catch (error) {
      logger.error(`Failed to calculate metrics:`, error);
      throw error;
    }
  },

  async storeMetrics(type, metrics, date) {
    // Store in Redis for quick access
    const key = `metrics:${type}:${moment(date).format('YYYY-MM-DD')}`;
    await config.redis.set(key, metrics, 30 * 24 * 60 * 60); // 30 days TTL
  },

  async generatePDFReport(type, data, options) {
    const pdfGenerator = new PDFGenerator();
    const reportPath = path.join(__dirname, '../../temp', `report-${type}-${Date.now()}.pdf`);
    
    // Ensure temp directory exists
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    
    // Generate PDF based on report type
    await pdfGenerator.generateReport(type, data, reportPath, options);
    
    return reportPath;
  },

  async generateCSVReport(type, data) {
    const reportPath = path.join(__dirname, '../../temp', `report-${type}-${Date.now()}.csv`);
    
    // Ensure temp directory exists
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    
    // Convert data to CSV
    const csvContent = this.convertToCSV(data);
    await fs.writeFile(reportPath, csvContent);
    
    return reportPath;
  },

  async generateJSONReport(type, data) {
    const reportPath = path.join(__dirname, '../../temp', `report-${type}-${Date.now()}.json`);
    
    // Ensure temp directory exists
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    
    await fs.writeFile(reportPath, JSON.stringify(data, null, 2));
    
    return reportPath;
  },

  convertToCSV(data) {
    if (!Array.isArray(data) || data.length === 0) {
      return '';
    }

    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');
    
    const csvRows = data.map(row => {
      return headers.map(header => {
        const value = row[header];
        // Escape values containing commas or quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',');
    });

    return [csvHeaders, ...csvRows].join('\n');
  }
};