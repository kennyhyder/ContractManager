const bcrypt = require('bcryptjs');
const { User, Activity } = require('../models');
const EmailService = require('./EmailService');
const FileService = require('./FileService');
const ActivityService = require('./ActivityService');
const { redis } = require('../middleware/cache');
const logger = require('../utils/logger');

class UserService {
  /**
   * Get user profile
   */
  async getProfile(userId) {
    try {
      // Check cache first
      const cacheKey = `user:profile:${userId}`;
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const user = await User.findById(userId)
        .select('-password -twoFactorSecret')
        .populate('department')
        .lean();

      if (!user) {
        throw new Error('User not found');
      }

      // Add computed fields
      const profile = {
        ...user,
        fullName: `${user.firstName} ${user.lastName}`,
        initials: `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
      };

      // Cache for 5 minutes
      await redis.setex(cacheKey, 300, JSON.stringify(profile));

      return profile;
    } catch (error) {
      logger.error('Get profile error:', error);
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(userId, updates) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Prevent updating sensitive fields
      delete updates.password;
      delete updates.email;
      delete updates.role;
      delete updates.permissions;

      // Update user
      Object.assign(user, updates);
      await user.save();

      // Clear cache
      await redis.del(`user:profile:${userId}`);

      // Log activity
      await ActivityService.logActivity({
        user: userId,
        action: 'user.profile_updated',
        resource: { type: 'user', id: userId },
        details: { fields: Object.keys(updates) }
      });

      return user.toJSON();
    } catch (error) {
      logger.error('Update profile error:', error);
      throw error;
    }
  }

  /**
   * Update avatar
   */
  async updateAvatar(userId, file) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Delete old avatar if exists
      if (user.avatar && user.avatar.startsWith('http')) {
        await FileService.deleteFile(user.avatar);
      }

      // Upload new avatar
      const uploadResult = await FileService.uploadFile(file, {
        folder: 'avatars',
        userId,
        resize: { width: 300, height: 300 }
      });

      user.avatar = uploadResult.url;
      await user.save();

      // Clear cache
      await redis.del(`user:profile:${userId}`);

      return { avatar: uploadResult.url };
    } catch (error) {
      logger.error('Update avatar error:', error);
      throw error;
    }
  }

  /**
   * Change password
   */
  async changePassword(userId, currentPassword, newPassword) {
    try {
      const user = await User.findById(userId).select('+password');
      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) {
        throw new Error('Current password is incorrect');
      }

      // Update password
      user.password = await bcrypt.hash(newPassword, 10);
      user.passwordChangedAt = new Date();
      await user.save();

      // Send notification
      await EmailService.sendEmail({
        to: user.email,
        template: 'password-changed',
        data: {
          firstName: user.firstName
        }
      });

      // Log activity
      await ActivityService.logActivity({
        user: userId,
        action: 'user.password_changed',
        resource: { type: 'user', id: userId }
      });

      return { success: true };
    } catch (error) {
      logger.error('Change password error:', error);
      throw error;
    }
  }

  /**
   * Update notification settings
   */
  async updateNotificationSettings(userId, settings) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      user.notificationSettings = {
        ...user.notificationSettings,
        ...settings
      };
      await user.save();

      return user.notificationSettings;
    } catch (error) {
      logger.error('Update notification settings error:', error);
      throw error;
    }
  }

  /**
   * Get user activity
   */
  async getUserActivity(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        startDate,
        endDate
      } = options;

      const query = { user: userId };

      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      const activities = await Activity
        .find(query)
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
      logger.error('Get user activity error:', error);
      throw error;
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId) {
    try {
      const cacheKey = `user:stats:${userId}`;
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const stats = await Promise.all([
        this.getContractStats(userId),
        this.getActivityStats(userId),
        this.getStorageStats(userId)
      ]);

      const result = {
        contracts: stats[0],
        activity: stats[1],
        storage: stats[2]
      };

      // Cache for 1 hour
      await redis.setex(cacheKey, 3600, JSON.stringify(result));

      return result;
    } catch (error) {
      logger.error('Get user stats error:', error);
      throw error;
    }
  }

  /**
   * Get contract statistics
   */
  async getContractStats(userId) {
    const Contract = require('../models/Contract');
    
    const [total, active, draft, signed] = await Promise.all([
      Contract.countDocuments({ owner: userId }),
      Contract.countDocuments({ owner: userId, status: 'active' }),
      Contract.countDocuments({ owner: userId, status: 'draft' }),
      Contract.countDocuments({ owner: userId, status: 'signed' })
    ]);

    return { total, active, draft, signed };
  }

  /**
   * Get activity statistics
   */
  async getActivityStats(userId) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activities = await Activity.aggregate([
      {
        $match: {
          user: userId,
          createdAt: { $gte: thirtyDaysAgo }
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
      {
        $sort: { _id: 1 }
      }
    ]);

    return activities;
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(userId) {
    // This would integrate with your file storage service
    return {
      used: 1024 * 1024 * 50, // 50MB
      limit: 1024 * 1024 * 1024, // 1GB
      percentage: 5
    };
  }

  /**
   * Search users
   */
  async searchUsers(query, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        role,
        department,
        excludeIds = []
      } = options;

      const searchQuery = {
        _id: { $nin: excludeIds },
        isActive: true
      };

      if (query) {
        searchQuery.$or = [
          { firstName: { $regex: query, $options: 'i' } },
          { lastName: { $regex: query, $options: 'i' } },
          { email: { $regex: query, $options: 'i' } }
        ];
      }

      if (role) searchQuery.role = role;
      if (department) searchQuery.department = department;

      const users = await User
        .find(searchQuery)
        .select('firstName lastName email avatar role department')
        .limit(limit)
        .skip((page - 1) * limit)
        .lean();

      return users;
    } catch (error) {
      logger.error('Search users error:', error);
      throw error;
    }
  }
}

module.exports = new UserService();