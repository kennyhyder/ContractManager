const ApprovalService = require('../services/ApprovalService');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

class ApprovalController {
  /**
   * Create approval request
   */
  async createApproval(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          errors: errors.array()
        });
      }

      const requesterId = req.user._id;
      const approvalData = {
        ...req.body,
        requesterId
      };

      const approval = await ApprovalService.createApprovalRequest(approvalData);

      res.status(201).json({
        success: true,
        message: 'Approval request created successfully',
        data: approval
      });
    } catch (error) {
      logger.error('Create approval error:', error);
      
      if (error.message === 'At least one approver is required') {
        return res.status(400).json({
          error: error.message,
          code: 'NO_APPROVERS'
        });
      }
      
      next(error);
    }
  }

  /**
   * Get pending approvals
   */
  async getPendingApprovals(req, res, next) {
    try {
      const userId = req.user._id;
      const {
        page = 1,
        limit = 20,
        type,
        priority,
        includeCompleted = false
      } = req.query;

      const approvals = await ApprovalService.getPendingApprovals(userId, {
        page: parseInt(page),
        limit: parseInt(limit),
        type,
        priority,
        includeCompleted: includeCompleted === 'true'
      });

      res.json({
        success: true,
        data: approvals
      });
    } catch (error) {
      logger.error('Get pending approvals error:', error);
      next(error);
    }
  }

  /**
   * Get approval details
   */
  async getApproval(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user._id;

      const approval = await Approval.findById(id)
        .populate('requestedBy', 'firstName lastName email avatar')
        .populate('approvers.user', 'firstName lastName email')
        .lean();

      if (!approval) {
        return res.status(404).json({
          error: 'Approval not found',
          code: 'APPROVAL_NOT_FOUND'
        });
      }

      // Check if user has access
      const hasAccess = approval.requestedBy._id.toString() === userId ||
                       approval.approvers.some(a => a.user._id.toString() === userId) ||
                       req.user.role === 'admin';

      if (!hasAccess) {
        return res.status(403).json({
          error: 'Access denied',
          code: 'ACCESS_DENIED'
        });
      }

      // Add user-specific data
      const userApprover = approval.approvers.find(
        a => a.user._id.toString() === userId
      );

      res.json({
        success: true,
        data: {
          ...approval,
          userApprovalStatus: userApprover?.status,
          userCanApprove: userApprover?.status === 'pending'
        }
      });
    } catch (error) {
      logger.error('Get approval error:', error);
      next(error);
    }
  }

  /**
   * Approve request
   */
  async approve(req, res, next) {
    try {
      const { id } = req.params;
      const approverId = req.user._id;
      const { comments, conditions } = req.body;

      const result = await ApprovalService.processApprovalDecision(
        id,
        approverId,
        'approved',
        { comments, conditions }
      );

      res.json({
        success: true,
        message: result.completed 
          ? `Approval ${result.finalStatus}`
          : 'Approval recorded successfully',
        data: result
      });
    } catch (error) {
      logger.error('Approve error:', error);
      
      if (error.message === 'Approval not found') {
        return res.status(404).json({
          error: 'Approval not found',
          code: 'APPROVAL_NOT_FOUND'
        });
      }
      
      if (error.message === 'Not authorized to approve') {
        return res.status(403).json({
          error: 'Not authorized to approve',
          code: 'NOT_AUTHORIZED'
        });
      }
      
      if (error.message === 'Approval already processed') {
        return res.status(409).json({
          error: 'Approval already processed',
          code: 'ALREADY_PROCESSED'
        });
      }
      
      next(error);
    }
  }

  /**
   * Reject request
   */
  async reject(req, res, next) {
    try {
      const { id } = req.params;
      const approverId = req.user._id;
      const { comments, reason } = req.body;

      const result = await ApprovalService.processApprovalDecision(
        id,
        approverId,
        'rejected',
        { comments, reason }
      );

      res.json({
        success: true,
        message: 'Approval rejected',
        data: result
      });
    } catch (error) {
      logger.error('Reject error:', error);
      next(error);
    }
  }

  /**
   * Cancel approval request
   */
  async cancelApproval(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user._id;
      const { reason } = req.body;

      await ApprovalService.cancelApproval(id, userId, reason);

      res.json({
        success: true,
        message: 'Approval request cancelled successfully'
      });
    } catch (error) {
      logger.error('Cancel approval error:', error);
      
      if (error.message === 'Only requester can cancel approval') {
        return res.status(403).json({
          error: error.message,
          code: 'NOT_REQUESTER'
        });
      }
      
      if (error.message === 'Cannot cancel completed approval') {
        return res.status(409).json({
          error: error.message,
          code: 'ALREADY_COMPLETED'
        });
      }
      
      next(error);
    }
  }

  /**
   * Get approval statistics
   */
  async getApprovalStats(req, res, next) {
    try {
      const userId = req.user._id;
      const { startDate, endDate } = req.query;

      const stats = await ApprovalService.getApprovalStats(userId, {
        startDate,
        endDate
      });

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Get approval stats error:', error);
      next(error);
    }
  }

  /**
   * Get approval history
   */
  async getApprovalHistory(req, res, next) {
    try {
      const userId = req.user._id;
      const {
        page = 1,
        limit = 20,
        role = 'all' // 'requester', 'approver', 'all'
      } = req.query;

      const query = {};
      
      if (role === 'requester') {
        query.requestedBy = userId;
      } else if (role === 'approver') {
        query['approvers.user'] = userId;
      } else {
        query.$or = [
          { requestedBy: userId },
          { 'approvers.user': userId }
        ];
      }

      const approvals = await Approval
        .find(query)
        .populate('requestedBy', 'firstName lastName email')
        .populate('approvers.user', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit))
        .lean();

      const total = await Approval.countDocuments(query);

      res.json({
        success: true,
        data: {
          approvals,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
          }
        }
      });
    } catch (error) {
      logger.error('Get approval history error:', error);
      next(error);
    }
  }

  /**
   * Bulk approve
   */
  async bulkApprove(req, res, next) {
    try {
      const { approvalIds, comments } = req.body;
      const approverId = req.user._id;

      const results = {
        success: [],
        failed: []
      };

      for (const approvalId of approvalIds) {
        try {
          await ApprovalService.processApprovalDecision(
            approvalId,
            approverId,
            'approved',
            { comments }
          );
          results.success.push(approvalId);
        } catch (error) {
          results.failed.push({
            approvalId,
            error: error.message
          });
        }
      }

      res.json({
        success: true,
        message: `Processed ${results.success.length} approvals`,
        data: results
      });
    } catch (error) {
      logger.error('Bulk approve error:', error);
      next(error);
    }
  }
}

module.exports = new ApprovalController();