const { Contract, User, Approval, Notification } = require('../models');
const NotificationService = require('./NotificationService');
const ActivityService = require('./ActivityService');
const EmailService = require('./EmailService');
const logger = require('../utils/logger');
const moment = require('moment');

class ApprovalService {
  constructor() {
    this.approvalTypes = {
      CONTRACT_APPROVAL: 'contract_approval',
      CONTRACT_CHANGE: 'contract_change',
      TEMPLATE_PUBLISH: 'template_publish',
      BULK_OPERATION: 'bulk_operation',
      ACCESS_REQUEST: 'access_request'
    };

    this.approvalStatuses = {
      PENDING: 'pending',
      APPROVED: 'approved',
      REJECTED: 'rejected',
      CANCELLED: 'cancelled',
      EXPIRED: 'expired'
    };

    this.escalationLevels = {
      NONE: 0,
      MANAGER: 1,
      DIRECTOR: 2,
      EXECUTIVE: 3
    };
  }

  /**
   * Create approval request
   */
  async createApprovalRequest(options) {
    try {
      const {
        type,
        resourceType,
        resourceId,
        requesterId,
        approvers,
        title,
        description,
        priority = 'normal',
        deadline,
        sequential = false,
        escalation = null,
        metadata = {}
      } = options;

      // Validate approvers
      if (!approvers || approvers.length === 0) {
        throw new Error('At least one approver is required');
      }

      // Get requester
      const requester = await User.findById(requesterId);
      if (!requester) {
        throw new Error('Requester not found');
      }

      // Create approval
      const approval = new Approval({
        type,
        resource: {
          type: resourceType,
          id: resourceId
        },
        requestedBy: requesterId,
        title,
        description,
        priority,
        deadline: deadline || moment().add(7, 'days').toDate(),
        sequential,
        approvers: approvers.map((approverId, index) => ({
          user: approverId,
          order: sequential ? index : 0,
          status: 'pending',
          required: true
        })),
        escalation: escalation ? {
          enabled: true,
          levels: escalation.levels || [
            { level: 1, afterHours: 24 },
            { level: 2, afterHours: 48 },
            { level: 3, afterHours: 72 }
          ]
        } : null,
        metadata
      });

      await approval.save();
      await approval.populate('approvers.user', 'firstName lastName email');

      // Update resource status if contract
      if (resourceType === 'contract') {
        await Contract.findByIdAndUpdate(resourceId, {
          status: 'pending_approval',
          currentApproval: approval._id
        });
      }

      // Send notifications to approvers
      await this.notifyApprovers(approval);

      // Schedule escalations if enabled
      if (approval.escalation?.enabled) {
        await this.scheduleEscalations(approval);
      }

      // Log activity
      await ActivityService.logActivity({
        user: requesterId,
        action: 'approval.requested',
        resource: { type: resourceType, id: resourceId },
        details: {
          approvalId: approval._id,
          type,
          approverCount: approvers.length
        }
      });

      return approval;
    } catch (error) {
      logger.error('Create approval request error:', error);
      throw error;
    }
  }

  /**
   * Process approval decision
   */
  async processApprovalDecision(approvalId, approverId, decision, options = {}) {
    try {
      const { comments, conditions } = options;

      const approval = await Approval.findById(approvalId)
        .populate('approvers.user', 'firstName lastName email')
        .populate('requestedBy', 'firstName lastName email');

      if (!approval) {
        throw new Error('Approval not found');
      }

      // Find approver
      const approverIndex = approval.approvers.findIndex(
        a => a.user._id.toString() === approverId
      );

      if (approverIndex === -1) {
        throw new Error('Not authorized to approve');
      }

      const approver = approval.approvers[approverIndex];

      // Check if already processed
      if (approver.status !== 'pending') {
        throw new Error('Approval already processed');
      }

      // Check if expired
      if (new Date() > approval.deadline) {
        approval.status = this.approvalStatuses.EXPIRED;
        await approval.save();
        throw new Error('Approval request has expired');
      }

      // Process decision
      approver.status = decision;
      approver.decidedAt = new Date();
      approver.comments = comments;
      approver.conditions = conditions;

      // Check if this completes the approval
      const result = await this.checkApprovalCompletion(approval, approverIndex);

      await approval.save();

      // Handle completion
      if (result.completed) {
        await this.completeApproval(approval, result.finalStatus);
      } else if (approval.sequential && result.nextApprover) {
        // Notify next approver in sequence
        await this.notifyNextApprover(approval, result.nextApprover);
      }

      // Log activity
      await ActivityService.logActivity({
        user: approverId,
        action: `approval.${decision}`,
        resource: approval.resource,
        details: {
          approvalId: approval._id,
          comments,
          conditions
        }
      });

      // Send notifications
      await this.notifyDecision(approval, approver, decision);

      return {
        approval,
        completed: result.completed,
        finalStatus: result.finalStatus
      };
    } catch (error) {
      logger.error('Process approval decision error:', error);
      throw error;
    }
  }

  /**
   * Check approval completion
   */
  async checkApprovalCompletion(approval, currentApproverIndex) {
    try {
      const approver = approval.approvers[currentApproverIndex];

      // If rejected, approval fails immediately
      if (approver.status === 'rejected') {
        return {
          completed: true,
          finalStatus: this.approvalStatuses.REJECTED
        };
      }

      // For sequential approvals
      if (approval.sequential) {
        // Check if there are more approvers
        const nextIndex = currentApproverIndex + 1;
        if (nextIndex < approval.approvers.length) {
          return {
            completed: false,
            nextApprover: approval.approvers[nextIndex]
          };
        }
      }

      // Check if all required approvers have approved
      const requiredApprovers = approval.approvers.filter(a => a.required);
      const allApproved = requiredApprovers.every(a => a.status === 'approved');

      if (allApproved) {
        return {
          completed: true,
          finalStatus: this.approvalStatuses.APPROVED
        };
      }

      // Check if any required approver rejected
      const anyRejected = requiredApprovers.some(a => a.status === 'rejected');
      if (anyRejected) {
        return {
          completed: true,
          finalStatus: this.approvalStatuses.REJECTED
        };
      }

      return {
        completed: false
      };
    } catch (error) {
      logger.error('Check approval completion error:', error);
      throw error;
    }
  }

  /**
   * Complete approval
   */
  async completeApproval(approval, finalStatus) {
    try {
      approval.status = finalStatus;
      approval.completedAt = new Date();
      await approval.save();

      // Update resource based on result
      if (approval.resource.type === 'contract') {
        const newStatus = finalStatus === this.approvalStatuses.APPROVED 
          ? 'approved' 
          : 'draft';

        await Contract.findByIdAndUpdate(approval.resource.id, {
          status: newStatus,
          currentApproval: null,
          lastApprovalDate: new Date()
        });
      }

      // Execute post-approval actions
      await this.executePostApprovalActions(approval, finalStatus);

      // Notify requester
      await NotificationService.sendNotification({
        userId: approval.requestedBy._id,
        type: `approval_${finalStatus}`,
        title: `Approval ${finalStatus}`,
        message: `Your approval request "${approval.title}" has been ${finalStatus}`,
        data: {
          approvalId: approval._id,
          resourceType: approval.resource.type,
          resourceId: approval.resource.id
        }
      });

      return approval;
    } catch (error) {
      logger.error('Complete approval error:', error);
      throw error;
    }
  }

  /**
   * Get pending approvals
   */
  async getPendingApprovals(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        type,
        priority,
        includeCompleted = false
      } = options;

      const query = {
        'approvers.user': userId,
        'approvers.status': 'pending'
      };

      if (!includeCompleted) {
        query.status = 'pending';
      }

      if (type) query.type = type;
      if (priority) query.priority = priority;

      const approvals = await Approval
        .find(query)
        .populate('requestedBy', 'firstName lastName email avatar')
        .populate('approvers.user', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit)
        .lean();

      const total = await Approval.countDocuments(query);

      // Add user-specific data
      const approvalsWithUserData = approvals.map(approval => {
        const userApprover = approval.approvers.find(
          a => a.user._id.toString() === userId
        );
        
        return {
          ...approval,
          userApprovalStatus: userApprover?.status,
          userCanApprove: userApprover?.status === 'pending',
          daysUntilDeadline: moment(approval.deadline).diff(moment(), 'days')
        };
      });

      return {
        approvals: approvalsWithUserData,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Get pending approvals error:', error);
      throw error;
    }
  }

  /**
   * Cancel approval
   */
  async cancelApproval(approvalId, userId, reason) {
    try {
      const approval = await Approval.findById(approvalId);
      
      if (!approval) {
        throw new Error('Approval not found');
      }

      // Check permissions
      if (approval.requestedBy.toString() !== userId) {
        throw new Error('Only requester can cancel approval');
      }

      if (approval.status !== 'pending') {
        throw new Error('Cannot cancel completed approval');
      }

      // Cancel approval
      approval.status = this.approvalStatuses.CANCELLED;
      approval.cancelledAt = new Date();
      approval.cancelReason = reason;
      await approval.save();

      // Update resource
      if (approval.resource.type === 'contract') {
        await Contract.findByIdAndUpdate(approval.resource.id, {
          status: 'draft',
          currentApproval: null
        });
      }

      // Notify approvers
      await this.notifyCancellation(approval, reason);

      // Log activity
      await ActivityService.logActivity({
        user: userId,
        action: 'approval.cancelled',
        resource: approval.resource,
        details: {
          approvalId: approval._id,
          reason
        }
      });

      return { success: true };
    } catch (error) {
      logger.error('Cancel approval error:', error);
      throw error;
    }
  }

  /**
   * Escalate approval
   */
  async escalateApproval(approvalId, level) {
    try {
      const approval = await Approval.findById(approvalId)
        .populate('approvers.user');

      if (!approval || !approval.escalation?.enabled) {
        throw new Error('Approval not found or escalation not enabled');
      }

      // Get escalation manager based on level
      const escalationManager = await this.getEscalationManager(
        approval.approvers[0].user,
        level
      );

      if (!escalationManager) {
        logger.warn('No escalation manager found for level:', level);
        return;
      }

      // Add escalation manager as approver
      approval.approvers.push({
        user: escalationManager._id,
        order: approval.approvers.length,
        status: 'pending',
        required: true,
        escalated: true,
        escalationLevel: level
      });

      approval.escalation.currentLevel = level;
      approval.escalation.lastEscalatedAt = new Date();
      
      await approval.save();

      // Notify escalation manager
      await NotificationService.sendNotification({
        userId: escalationManager._id,
        type: 'approval_escalated',
        title: 'Escalated Approval Request',
        message: `An approval request has been escalated to you: "${approval.title}"`,
        data: {
          approvalId: approval._id,
          escalationLevel: level
        },
        priority: 'high'
      });

      logger.info(`Approval ${approvalId} escalated to level ${level}`);

      return approval;
    } catch (error) {
      logger.error('Escalate approval error:', error);
      throw error;
    }
  }

  /**
   * Helper methods
   */

  async notifyApprovers(approval) {
    try {
      const notifications = [];

      // For sequential approval, only notify first approver
      const approversToNotify = approval.sequential 
        ? [approval.approvers[0]]
        : approval.approvers;

      for (const approver of approversToNotify) {
        notifications.push(
          NotificationService.sendNotification({
            userId: approver.user._id,
            type: 'approval_requested',
            title: 'Approval Required',
            message: `${approval.requestedBy.firstName} has requested your approval for "${approval.title}"`,
            data: {
              approvalId: approval._id,
              resourceType: approval.resource.type,
              resourceId: approval.resource.id,
              deadline: approval.deadline
            },
            channels: ['email', 'inApp'],
            priority: approval.priority
          })
        );
      }

      await Promise.all(notifications);
    } catch (error) {
      logger.error('Notify approvers error:', error);
    }
  }

  async notifyNextApprover(approval, nextApprover) {
    try {
      await NotificationService.sendNotification({
        userId: nextApprover.user._id,
        type: 'approval_requested',
        title: 'Your Approval Required',
        message: `You are next in line to approve "${approval.title}"`,
        data: {
          approvalId: approval._id,
          resourceType: approval.resource.type,
          resourceId: approval.resource.id,
          deadline: approval.deadline,
          sequential: true
        },
        channels: ['email', 'inApp'],
        priority: approval.priority
      });
    } catch (error) {
      logger.error('Notify next approver error:', error);
    }
  }

  async notifyDecision(approval, approver, decision) {
    try {
      // Notify requester
      await NotificationService.sendNotification({
        userId: approval.requestedBy._id,
        type: `approval_decision`,
        title: `Approval ${decision}`,
        message: `${approver.user.firstName} has ${decision} your approval request`,
        data: {
          approvalId: approval._id,
          decision,
          approver: approver.user.email
        }
      });

      // Notify other approvers if rejected
      if (decision === 'rejected' && !approval.sequential) {
        const otherApprovers = approval.approvers.filter(
          a => a.user._id.toString() !== approver.user._id.toString() && 
              a.status === 'pending'
        );

        for (const other of otherApprovers) {
          await NotificationService.sendNotification({
            userId: other.user._id,
            type: 'approval_rejected_by_other',
            title: 'Approval Rejected',
            message: `The approval request "${approval.title}" has been rejected by ${approver.user.firstName}`,
            data: {
              approvalId: approval._id
            }
          });
        }
      }
    } catch (error) {
      logger.error('Notify decision error:', error);
    }
  }

  async notifyCancellation(approval, reason) {
    try {
      const notifications = approval.approvers
        .filter(a => a.status === 'pending')
        .map(approver =>
          NotificationService.sendNotification({
            userId: approver.user._id,
            type: 'approval_cancelled',
            title: 'Approval Cancelled',
            message: `The approval request "${approval.title}" has been cancelled`,
            data: {
              approvalId: approval._id,
              reason
            }
          })
        );

      await Promise.all(notifications);
    } catch (error) {
      logger.error('Notify cancellation error:', error);
    }
  }

  async scheduleEscalations(approval) {
    try {
      const ReminderService = require('./ReminderService');

      for (const level of approval.escalation.levels) {
        const escalateAt = moment(approval.createdAt)
          .add(level.afterHours, 'hours')
          .toDate();

        await ReminderService.scheduleReminder({
          type: 'approval_escalation',
          resourceType: 'approval',
          resourceId: approval._id,
          userId: approval.requestedBy,
          scheduledFor: escalateAt,
          metadata: {
            escalationLevel: level.level,
            approvalTitle: approval.title
          }
        });
      }
    } catch (error) {
      logger.error('Schedule escalations error:', error);
    }
  }

  async getEscalationManager(user, level) {
    try {
      // This would integrate with your organization hierarchy
      // For now, return a mock manager
      const managers = await User.find({
        role: { $in: ['manager', 'director', 'executive'] },
        isActive: true
      }).limit(1);

      return managers[0] || null;
    } catch (error) {
      logger.error('Get escalation manager error:', error);
      return null;
    }
  }

  async executePostApprovalActions(approval, finalStatus) {
    try {
      // Execute any automated actions based on approval type and result
      if (finalStatus === this.approvalStatuses.APPROVED) {
        switch (approval.type) {
          case this.approvalTypes.TEMPLATE_PUBLISH:
            // Publish template
            break;
          case this.approvalTypes.ACCESS_REQUEST:
            // Grant access
            break;
          default:
            // Custom actions based on metadata
            break;
        }
      }
    } catch (error) {
      logger.error('Execute post-approval actions error:', error);
    }
  }

  /**
   * Get approval statistics
   */
  async getApprovalStats(userId, options = {}) {
    try {
      const { startDate, endDate } = options;

      const matchStage = {
        $or: [
          { requestedBy: userId },
          { 'approvers.user': userId }
        ]
      };

      if (startDate || endDate) {
        matchStage.createdAt = {};
        if (startDate) matchStage.createdAt.$gte = new Date(startDate);
        if (endDate) matchStage.createdAt.$lte = new Date(endDate);
      }

      const stats = await Approval.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            pending: {
              $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
            },
            approved: {
              $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
            },
            rejected: {
              $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
            },
            avgCompletionTime: {
              $avg: {
                $cond: [
                  { $ne: ['$completedAt', null] },
                  { $subtract: ['$completedAt', '$createdAt'] },
                  null
                ]
              }
            }
          }
        }
      ]);

      return stats[0] || {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        avgCompletionTime: 0
      };
    } catch (error) {
      logger.error('Get approval stats error:', error);
      throw error;
    }
  }
}

module.exports = new ApprovalService();