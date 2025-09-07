const { Contract, Activity, Notification, EmailLog } = require('../../models');
const config = require('../../config');
const logger = require('../../utils/logger');
const fs = require('fs').promises;
const path = require('path');
const moment = require('moment');

module.exports = {
  async cleanTempFiles(job) {
    const { maxAge = 24 * 60 * 60 * 1000 } = job.data; // 24 hours default

    try {
      logger.info('Starting temporary files cleanup');

      const tempDir = path.join(__dirname, '../../temp');
      const now = Date.now();
      let deletedCount = 0;

      // Read all files in temp directory
      const files = await fs.readdir(tempDir);

      for (const file of files) {
        const filePath = path.join(tempDir, file);
        const stats = await fs.stat(filePath);

        // Check if file is older than maxAge
        if (now - stats.mtimeMs > maxAge) {
          await fs.unlink(filePath);
          deletedCount++;
          logger.debug(`Deleted temp file: ${file}`);
        }
      }

      // Clean up upload directory
      const uploadDir = path.join(__dirname, '../../public/uploads/temp');
      try {
        const uploadFiles = await fs.readdir(uploadDir);
        
        for (const file of uploadFiles) {
          const filePath = path.join(uploadDir, file);
          const stats = await fs.stat(filePath);

          if (now - stats.mtimeMs > maxAge) {
            await fs.unlink(filePath);
            deletedCount++;
          }
        }
      } catch (error) {
        // Upload directory might not exist
        logger.debug('Upload temp directory not found');
      }

      logger.info(`Cleaned up ${deletedCount} temporary files`);
      return { deletedFiles: deletedCount };
    } catch (error) {
      logger.error('Temp file cleanup failed:', error);
      throw error;
    }
  },

  async cleanExpiredTokens(job) {
    try {
      logger.info('Cleaning expired tokens');

      // Clean expired refresh tokens from Redis
      const tokenKeys = await config.redis.client.keys('refresh_token:*');
      let expiredCount = 0;

      for (const key of tokenKeys) {
        const ttl = await config.redis.client.ttl(key);
        if (ttl === -2) { // Key doesn't exist
          expiredCount++;
        }
      }

      // Clean expired password reset tokens
      const resetTokenKeys = await config.redis.client.keys('reset_token:*');
      
      for (const key of resetTokenKeys) {
        const ttl = await config.redis.client.ttl(key);
        if (ttl === -2) {
          expiredCount++;
        }
      }

      logger.info(`Cleaned ${expiredCount} expired tokens`);
      return { expiredTokens: expiredCount };
    } catch (error) {
      logger.error('Token cleanup failed:', error);
      throw error;
    }
  },

  async cleanOldLogs(job) {
    const { retentionDays = 30 } = job.data;

    try {
      logger.info(`Cleaning logs older than ${retentionDays} days`);

      const cutoffDate = moment().subtract(retentionDays, 'days').toDate();

      // Clean old activity logs
      const deletedActivities = await Activity.deleteMany({
        createdAt: { $lt: cutoffDate }
      });

      // Clean old email logs
      const deletedEmails = await EmailLog.deleteMany({
        sentAt: { $lt: cutoffDate }
      });

      // Clean old notifications
      const deletedNotifications = await Notification.deleteMany({
        createdAt: { $lt: cutoffDate },
        isRead: true
      });

      // Clean log files
      const logDir = path.join(__dirname, '../../logs');
      let deletedFiles = 0;

      try {
        const files = await fs.readdir(logDir);
        
        for (const file of files) {
          if (file.endsWith('.log')) {
            const filePath = path.join(logDir, file);
            const stats = await fs.stat(filePath);
            
            if (stats.mtime < cutoffDate) {
              await fs.unlink(filePath);
              deletedFiles++;
            }
          }
        }
      } catch (error) {
        logger.debug('Log directory not found or inaccessible');
      }

      const results = {
        activities: deletedActivities.deletedCount,
        emails: deletedEmails.deletedCount,
        notifications: deletedNotifications.deletedCount,
        logFiles: deletedFiles
      };

      logger.info('Log cleanup completed:', results);
      return results;
    } catch (error) {
      logger.error('Log cleanup failed:', error);
      throw error;
    }
  },

  async cleanDeletedContracts(job) {
    const { daysBeforePermanentDelete = 30 } = job.data;

    try {
      logger.info('Cleaning soft-deleted contracts');

      const cutoffDate = moment().subtract(daysBeforePermanentDelete, 'days').toDate();

      // Find contracts marked for deletion
      const contractsToDelete = await Contract.find({
        deletedAt: { $lt: cutoffDate }
      });

      let deletedCount = 0;
      let filesDeleted = 0;

      for (const contract of contractsToDelete) {
        // Delete associated files from S3
        if (contract.attachments && contract.attachments.length > 0) {
          const fileKeys = contract.attachments.map(att => att.key);
          await config.aws.deleteFiles(fileKeys);
          filesDeleted += fileKeys.length;
        }

        // Delete associated comments
        await Comment.deleteMany({ contract: contract._id });

        // Delete associated activities
        await Activity.deleteMany({ 
          resource: 'Contract',
          resourceId: contract._id 
        });

        // Permanently delete contract
        await contract.remove();
        deletedCount++;
      }

      logger.info(`Permanently deleted ${deletedCount} contracts and ${filesDeleted} files`);
      return { contractsDeleted: deletedCount, filesDeleted };
    } catch (error) {
      logger.error('Contract cleanup failed:', error);
      throw error;
    }
  },

  async cleanOrphanedFiles(job) {
    try {
      logger.info('Cleaning orphaned files from S3');

      // Get all files from S3
      const s3Files = await config.aws.listFiles('uploads/');
      const fileKeys = new Set(s3Files.files.map(f => f.key));

      // Get all referenced files from database
      const contracts = await Contract.find({}, 'attachments');
      const users = await User.find({}, 'profilePicture');
      
      const referencedFiles = new Set();

      // Add contract attachments
      contracts.forEach(contract => {
        contract.attachments?.forEach(att => {
          referencedFiles.add(att.key);
        });
      });

      // Add user profile pictures
      users.forEach(user => {
        if (user.profilePicture?.key) {
          referencedFiles.add(user.profilePicture.key);
        }
      });

      // Find orphaned files
      const orphanedFiles = Array.from(fileKeys).filter(key => !referencedFiles.has(key));

      if (orphanedFiles.length > 0) {
        // Delete orphaned files in batches
        const batchSize = 100;
        for (let i = 0; i < orphanedFiles.length; i += batchSize) {
          const batch = orphanedFiles.slice(i, i + batchSize);
          await config.aws.deleteFiles(batch);
        }
      }

      logger.info(`Deleted ${orphanedFiles.length} orphaned files`);
      return { orphanedFiles: orphanedFiles.length };
    } catch (error) {
      logger.error('Orphaned file cleanup failed:', error);
      throw error;
    }
  },

  async archiveOldData(job) {
    const { archiveAfterDays = 365 } = job.data;

    try {
      logger.info(`Archiving data older than ${archiveAfterDays} days`);

      const cutoffDate = moment().subtract(archiveAfterDays, 'days').toDate();

      // Archive old contracts
      const contractsToArchive = await Contract.find({
        status: { $in: ['completed', 'terminated', 'expired'] },
        updatedAt: { $lt: cutoffDate },
        isArchived: { $ne: true }
      });

      let archivedCount = 0;

      for (const contract of contractsToArchive) {
        // Create archive entry
        const archiveData = {
          originalId: contract._id,
          data: contract.toObject(),
          archivedAt: new Date()
        };

        // Store in archive collection or S3
        await this.storeArchive('contracts', archiveData);

        // Mark as archived
        contract.isArchived = true;
        contract.archivedAt = new Date();
        await contract.save();

        archivedCount++;
      }

      logger.info(`Archived ${archivedCount} old contracts`);
      return { archivedContracts: archivedCount };
    } catch (error) {
      logger.error('Data archiving failed:', error);
      throw error;
    }
  },

  async storeArchive(type, data) {
    // Store archive in S3 as compressed JSON
    const archiveKey = `archives/${type}/${data.originalId}-${Date.now()}.json.gz`;
    const compressed = await this.compressData(JSON.stringify(data));
    
    await config.aws.uploadFile(
      {
        buffer: compressed,
        originalname: `${data.originalId}.json.gz`,
        mimetype: 'application/gzip'
      },
      {
        folder: `archives/${type}`,
        metadata: {
          type,
          originalId: data.originalId.toString(),
          archivedAt: data.archivedAt.toISOString()
        }
      }
    );
  },

  async compressData(data) {
    const zlib = require('zlib');
    return new Promise((resolve, reject) => {
      zlib.gzip(data, (err, compressed) => {
        if (err) reject(err);
        else resolve(compressed);
      });
    });
  }
};