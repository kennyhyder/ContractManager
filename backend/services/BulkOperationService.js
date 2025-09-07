const { Contract, Template, User, Activity } = require('../models');
const ContractService = require('./ContractService');
const NotificationService = require('./NotificationService');
const FileService = require('./FileService');
const ActivityService = require('./ActivityService');
const { redis } = require('../middleware/cache');
const logger = require('../utils/logger');
const Bull = require('bull');

class BulkOperationService {
  constructor() {
    this.operationQueue = new Bull('bulk-operations', {
      redis: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT
      }
    });

    this.setupQueueHandlers();

    this.operations = {
      DELETE: 'delete',
      ARCHIVE: 'archive',
      UNARCHIVE: 'unarchive',
      UPDATE_STATUS: 'update_status',
      ADD_TAG: 'add_tag',
      REMOVE_TAG: 'remove_tag',
      SHARE: 'share',
      EXPORT: 'export',
      ASSIGN: 'assign',
      APPLY_TEMPLATE: 'apply_template',
      SEND_REMINDER: 'send_reminder',
      REQUEST_SIGNATURE: 'request_signature'
    };
  }

  /**
   * Setup queue handlers
   */
  setupQueueHandlers() {
    this.operationQueue.process('bulk-operation', async (job) => {
      const { operationId } = job.data;
      return await this.processBulkOperation(operationId);
    });

    this.operationQueue.on('completed', (job, result) => {
      logger.info(`Bulk operation completed: ${job.data.operationId}`);
    });

    this.operationQueue.on('failed', (job, err) => {
      logger.error(`Bulk operation failed: ${job.data.operationId}`, err);
    });
  }

  /**
   * Create bulk operation
   */
  async createBulkOperation(options) {
    try {
      const {
        operation,
        resourceType = 'contract',
        resourceIds,
        userId,
        data = {},
        requireApproval = false
      } = options;

      // Validate operation
      if (!Object.values(this.operations).includes(operation)) {
        throw new Error('Invalid operation type');
      }

      // Validate resources
      if (!resourceIds || resourceIds.length === 0) {
        throw new Error('No resources selected');
      }

      // Check permissions for each resource
      const validatedResources = await this.validateResources(
        resourceType,
        resourceIds,
        userId,
        operation
      );

      if (validatedResources.valid.length === 0) {
        throw new Error('No valid resources found');
      }

      // Create operation record
      const operationId = `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const operationData = {
        id: operationId,
        operation,
        resourceType,
        resourceIds: validatedResources.valid,
        invalidResources: validatedResources.invalid,
        userId,
        data,
        status: requireApproval ? 'pending_approval' : 'queued',
        createdAt: new Date(),
        stats: {
          total: validatedResources.valid.length,
          completed: 0,
          failed: 0,
          skipped: validatedResources.invalid.length
        }
      };

      // Store operation data
      await redis.setex(
        `bulk_operation:${operationId}`,
        86400, // 24 hours
        JSON.stringify(operationData)
      );

      // If approval required, create approval request
      if (requireApproval) {
        const ApprovalService = require('./ApprovalService');
        await ApprovalService.createApprovalRequest({
          type: 'bulk_operation',
          resourceType: 'bulk_operation',
          resourceId: operationId,
          requesterId: userId,
          approvers: await this.getBulkOperationApprovers(operation, resourceIds.length),
          title: `Bulk ${operation} operation`,
          description: `Approve bulk ${operation} operation on ${resourceIds.length} ${resourceType}s`,
          metadata: operationData
        });
      } else {
        // Queue operation
        await this.queueOperation(operationId);
      }

      // Log activity
      await ActivityService.logActivity({
        user: userId,
        action: 'bulk_operation.created',
        resource: { type: 'bulk_operation', id: operationId },
        details: {
          operation,
          resourceCount: validatedResources.valid.length,
          requireApproval
        }
      });

      return {
        operationId,
        status: operationData.status,
        stats: operationData.stats,
        requireApproval
      };
    } catch (error) {
      logger.error('Create bulk operation error:', error);
      throw error;
    }
  }

  /**
   * Queue operation for processing
   */
  async queueOperation(operationId) {
    try {
      await this.operationQueue.add('bulk-operation', {
        operationId
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      });

      // Update status
      const operation = await this.getOperation(operationId);
      operation.status = 'queued';
      operation.queuedAt = new Date();
      await this.saveOperation(operation);

      return { queued: true };
    } catch (error) {
      logger.error('Queue operation error:', error);
      throw error;
    }
  }

  /**
   * Process bulk operation
   */
  async processBulkOperation(operationId) {
    try {
      const operation = await this.getOperation(operationId);
      if (!operation) {
        throw new Error('Operation not found');
      }

      // Update status
      operation.status = 'processing';
      operation.startedAt = new Date();
      await this.saveOperation(operation);

      // Process each resource
      const results = {
        success: [],
        failed: []
      };

      for (const resourceId of operation.resourceIds) {
        try {
          await this.processResource(
            operation.operation,
            operation.resourceType,
            resourceId,
            operation.userId,
            operation.data
          );

          results.success.push(resourceId);
          operation.stats.completed++;
        } catch (error) {
          logger.error(`Failed to process resource ${resourceId}:`, error);
          results.failed.push({
            resourceId,
            error: error.message
          });
          operation.stats.failed++;
        }

        // Update progress
        operation.progress = Math.round(
          ((operation.stats.completed + operation.stats.failed) / operation.stats.total) * 100
        );
        await this.saveOperation(operation);

        // Send progress update
        await this.sendProgressUpdate(operation);
      }

      // Complete operation
      operation.status = 'completed';
      operation.completedAt = new Date();
      operation.results = results;
      await this.saveOperation(operation);

      // Send completion notification
      await this.sendCompletionNotification(operation);

      // Log activity
      await ActivityService.logActivity({
        user: operation.userId,
        action: 'bulk_operation.completed',
        resource: { type: 'bulk_operation', id: operationId },
        details: {
          operation: operation.operation,
          stats: operation.stats
        }
      });

      return results;
    } catch (error) {
      logger.error('Process bulk operation error:', error);
      
      // Update operation status
      const operation = await this.getOperation(operationId);
      if (operation) {
        operation.status = 'failed';
        operation.error = error.message;
        operation.failedAt = new Date();
        await this.saveOperation(operation);
      }

      throw error;
    }
  }

  /**
   * Process individual resource
   */
  async processResource(operation, resourceType, resourceId, userId, data) {
    try {
      switch (operation) {
        case this.operations.DELETE:
          await this.deleteResource(resourceType, resourceId, userId);
          break;

        case this.operations.ARCHIVE:
          await this.archiveResource(resourceType, resourceId, userId);
          break;

        case this.operations.UNARCHIVE:
          await this.unarchiveResource(resourceType, resourceId, userId);
          break;

        case this.operations.UPDATE_STATUS:
          await this.updateResourceStatus(resourceType, resourceId, userId, data.status);
          break;

        case this.operations.ADD_TAG:
          await this.addResourceTag(resourceType, resourceId, userId, data.tag);
          break;

        case this.operations.REMOVE_TAG:
          await this.removeResourceTag(resourceType, resourceId, userId, data.tag);
          break;

        case this.operations.SHARE:
          await this.shareResource(resourceType, resourceId, userId, data);
          break;

        case this.operations.EXPORT:
          await this.exportResource(resourceType, resourceId, userId, data.format);
          break;

        case this.operations.ASSIGN:
          await this.assignResource(resourceType, resourceId, userId, data.assigneeId);
          break;

        case this.operations.APPLY_TEMPLATE:
          await this.applyTemplate(resourceId, userId, data.templateId);
          break;

        case this.operations.SEND_REMINDER:
          await this.sendResourceReminder(resourceType, resourceId, userId, data);
          break;

        case this.operations.REQUEST_SIGNATURE:
          await this.requestResourceSignature(resourceId, userId, data);
          break;

        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    } catch (error) {
      logger.error(`Process resource error for ${resourceId}:`, error);
      throw error;
    }
  }

  /**
   * Individual operation handlers
   */

  async deleteResource(resourceType, resourceId, userId) {
    if (resourceType === 'contract') {
      await ContractService.deleteContract(resourceId, userId);
    } else if (resourceType === 'template') {
      const TemplateService = require('./TemplateService');
      await TemplateService.deleteTemplate(resourceId, userId);
    }
  }

  async archiveResource(resourceType, resourceId, userId) {
    if (resourceType === 'contract') {
      await Contract.findByIdAndUpdate(resourceId, {
        archived: true,
        archivedAt: new Date(),
        archivedBy: userId
      });
    }
  }

  async unarchiveResource(resourceType, resourceId, userId) {
    if (resourceType === 'contract') {
      await Contract.findByIdAndUpdate(resourceId, {
        archived: false,
        $unset: { archivedAt: 1, archivedBy: 1 }
      });
    }
  }

  async updateResourceStatus(resourceType, resourceId, userId, status) {
    if (resourceType === 'contract') {
      await ContractService.updateContract(resourceId, { status }, userId);
    }
  }

  async addResourceTag(resourceType, resourceId, userId, tag) {
    if (resourceType === 'contract') {
      await Contract.findByIdAndUpdate(resourceId, {
        $addToSet: { tags: tag }
      });
    }
  }

  async removeResourceTag(resourceType, resourceId, userId, tag) {
    if (resourceType === 'contract') {
      await Contract.findByIdAndUpdate(resourceId, {
        $pull: { tags: tag }
      });
    }
  }

  async shareResource(resourceType, resourceId, userId, shareData) {
    if (resourceType === 'contract') {
      await ContractService.shareContract(resourceId, userId, shareData);
    }
  }

  async exportResource(resourceType, resourceId, userId, format) {
    // This would be implemented based on your export requirements
    logger.info(`Exporting ${resourceType} ${resourceId} as ${format}`);
  }

  async assignResource(resourceType, resourceId, userId, assigneeId) {
    if (resourceType === 'contract') {
      await Contract.findByIdAndUpdate(resourceId, {
        assignedTo: assigneeId,
        assignedAt: new Date(),
        assignedBy: userId
      });
    }
  }

  async applyTemplate(contractId, userId, templateId) {
    const template = await Template.findById(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    await ContractService.updateContract(contractId, {
      content: template.content,
      template: templateId
    }, userId);
  }

  async sendResourceReminder(resourceType, resourceId, userId, reminderData) {
    const ReminderService = require('./ReminderService');
    await ReminderService.scheduleReminder({
      type: reminderData.type || 'custom',
      resourceType,
      resourceId,
      userId,
      scheduledFor: reminderData.scheduledFor || new Date(),
      customMessage: reminderData.message
    });
  }

  async requestResourceSignature(contractId, userId, signatureData) {
    const SignatureService = require('./SignatureService');
    await SignatureService.createSignatureRequest(
      contractId,
      signatureData.parties,
      signatureData.options
    );
  }

  /**
   * Helper methods
   */

  async validateResources(resourceType, resourceIds, userId, operation) {
    const valid = [];
    const invalid = [];

    for (const resourceId of resourceIds) {
      try {
        const hasPermission = await this.checkResourcePermission(
          resourceType,
          resourceId,
          userId,
          operation
        );

        if (hasPermission) {
          valid.push(resourceId);
        } else {
          invalid.push({
            resourceId,
            reason: 'Insufficient permissions'
          });
        }
      } catch (error) {
        invalid.push({
          resourceId,
          reason: error.message
        });
      }
    }

    return { valid, invalid };
  }

  async checkResourcePermission(resourceType, resourceId, userId, operation) {
    if (resourceType === 'contract') {
      const contract = await Contract.findById(resourceId);
      if (!contract) return false;

      switch (operation) {
        case this.operations.DELETE:
          return contract.hasDeleteAccess(userId);
        case this.operations.SHARE:
          return contract.hasShareAccess(userId);
        default:
          return contract.hasEditAccess(userId);
      }
    }

    return true;
  }

  async getBulkOperationApprovers(operation, resourceCount) {
    // Define approval rules based on operation and scale
    const approvalRules = {
      delete: {
        small: [], // < 10 items, no approval needed
        medium: ['manager'], // 10-50 items
        large: ['manager', 'director'] // > 50 items
      },
      share: {
        small: [],
        medium: ['manager'],
        large: ['manager', 'director']
      }
    };

    const size = resourceCount < 10 ? 'small' : 
                 resourceCount <= 50 ? 'medium' : 'large';

    const roles = approvalRules[operation]?.[size] || [];

    // Get users with required roles
    const approvers = await User.find({
      role: { $in: roles },
      isActive: true
    }).select('_id');

    return approvers.map(a => a._id);
  }

  async getOperation(operationId) {
    const data = await redis.get(`bulk_operation:${operationId}`);
    return data ? JSON.parse(data) : null;
  }

  async saveOperation(operation) {
    await redis.setex(
      `bulk_operation:${operation.id}`,
      86400, // 24 hours
      JSON.stringify(operation)
    );
  }

  async sendProgressUpdate(operation) {
    // Send real-time progress update
    const io = require('../websocket');
    io.to(`user:${operation.userId}`).emit('bulk-operation-progress', {
      operationId: operation.id,
      progress: operation.progress,
      stats: operation.stats
    });
  }

  async sendCompletionNotification(operation) {
    await NotificationService.sendNotification({
      userId: operation.userId,
      type: 'bulk_operation_completed',
      title: 'Bulk Operation Completed',
      message: `Your bulk ${operation.operation} operation has completed. ${operation.stats.completed} succeeded, ${operation.stats.failed} failed.`,
      data: {
        operationId: operation.id,
        operation: operation.operation,
        stats: operation.stats
      }
    });
  }

  /**
   * Get operation status
   */
  async getOperationStatus(operationId) {
    try {
      const operation = await this.getOperation(operationId);
      if (!operation) {
        throw new Error('Operation not found');
      }

      return {
        id: operation.id,
        status: operation.status,
        progress: operation.progress || 0,
        stats: operation.stats,
        createdAt: operation.createdAt,
        startedAt: operation.startedAt,
        completedAt: operation.completedAt,
        error: operation.error
      };
    } catch (error) {
      logger.error('Get operation status error:', error);
      throw error;
    }
  }

  /**
   * Cancel bulk operation
   */
  async cancelOperation(operationId, userId) {
    try {
      const operation = await this.getOperation(operationId);
      if (!operation) {
        throw new Error('Operation not found');
      }

      if (operation.userId !== userId) {
        throw new Error('Unauthorized to cancel this operation');
      }

      if (!['queued', 'processing'].includes(operation.status)) {
        throw new Error('Operation cannot be cancelled');
      }

      // Cancel job if queued
      if (operation.status === 'queued') {
        const jobs = await this.operationQueue.getJobs(['waiting', 'delayed']);
        const job = jobs.find(j => j.data.operationId === operationId);
        if (job) {
          await job.remove();
        }
      }

      // Update status
      operation.status = 'cancelled';
      operation.cancelledAt = new Date();
      operation.cancelledBy = userId;
      await this.saveOperation(operation);

      return { success: true };
    } catch (error) {
      logger.error('Cancel operation error:', error);
      throw error;
    }
  }
}

module.exports = new BulkOperationService();