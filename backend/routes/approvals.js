const express = require('express');
const router = express.Router();
const { Approval, Contract, Activity } = require('../models');
const { authMiddleware } = require('../middleware/auth');
const { validateApproval } = require('../middleware/validation');
const NotificationService = require('../services/NotificationService');
const EmailService = require('../services/EmailService');
const logger = require('../utils/logger');

/**
 * @route   GET /api/approvals
 * @desc    Get approvals for current user
 * @access  Private
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const query = {
      'approvers.user': req.user._id,
      isDeleted: false
    };

    if (status) {
      if (status === 'pending') {
        query['approvers.status'] = 'pending';
        query.status = 'pending';
      } else {
        query.status = status;
      }
    }

    const approvals = await Approval
      .find(query)
      .populate('contract', 'title type status')
      .populate('requestedBy', 'firstName lastName')
      .sort({ priority: -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Approval.countDocuments(query);

    res.json({
      success: true,
      data: {
        approvals,
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          page: parseInt(page),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get approvals error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch approvals' 
    });
  }
});

/**
 * @route   POST /api/approvals
 * @desc    Create approval request
 * @access  Private
 */
router.post('/', authMiddleware, validateApproval.create, async (req, res) => {
  try {
    const {
      contractId,
      title,
      description,
      type,
      priority,
      approvers,
      workflow,
      deadline,
      attachments
    } = req.body;

    // Check contract access
    const contract = await Contract.findById(contractId);
    if (!contract || !contract.hasAccess(req.user._id)) {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied' 
      });
    }

    // Create approval
    const approval = new Approval({
      contract: contractId,
      requestedBy: req.user._id,
      title,
      description,
      type,
      priority,
      approvers: approvers.map((a, index) => ({
        user: a.userId,
        role: a.role,
        order: workflow.type === 'sequential' ? index : 0
      })),
      workflow,
      deadline,
      attachments
    });

    await approval.save();

    // Update contract approval status
    contract.approvals.required = true;
    contract.status = 'pending_approval';
    await contract.save();

    // Send notifications to approvers
    const firstApprovers = workflow.type === 'sequential' 
      ? [approvers[0]] 
      : approvers;

    for (const approver of firstApprovers) {
      await NotificationService.createNotification({
        user: approver.userId,
        type: 'approval_requested',
        title: 'Approval requested',
        message: `${req.user.firstName} requested your approval for "${contract.title}"`,
        resource: { type: 'approval', id: approval._id },
        from: req.user._id,
        priority: priority,
        actionUrl: `/approvals/${approval._id}`,
        actionLabel: 'Review',
        actionType: 'approve'
      });

      // Send email
      const user = await User.findById(approver.userId);
      if (user) {
        await EmailService.sendEmail({
          to: user.email,
          template: 'approval-request',
          data: {
            firstName: user.firstName,
            requestedBy: req.user.fullName,
            contractTitle: contract.title,
            description: description,
            deadline: deadline,
            approvalUrl: `${process.env.FRONTEND_URL}/approvals/${approval._id}`
          },
          priority: priority === 'urgent' ? 'high' : 'normal'
        });
      }
    }

    // Log activity
    await Activity.track({
      user: req.user._id,
      action: 'approval.created',
      resource: { type: 'approval', id: approval._id },
      details: {
        contractId,
        approverCount: approvers.length,
        workflow: workflow.type
      }
    });

    res.status(201).json({
      success: true,
      message: 'Approval request created successfully',
      data: { approval }
    });
  } catch (error) {
    logger.error('Create approval error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to create approval' 
    });
  }
});

/**
 * @route   GET /api/approvals/:id
 * @desc    Get approval details
 * @access  Private
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const approval = await Approval
      .findById(req.params.id)
      .populate('contract')
      .populate('requestedBy', 'firstName lastName email')
      .populate('approvers.user', 'firstName lastName email avatar')
      .populate('approvers.delegatedTo', 'firstName lastName email');

    if (!approval || approval.isDeleted) {
      return res.status(404).json({ 
        success: false,
        message: 'Approval not found' 
      });
    }

    // Check if user has access
    const isApprover = approval.approvers.some(a => a.user._id.equals(req.user._id));
    const isRequester = approval.requestedBy._id.equals(req.user._id);
    const hasContractAccess = await approval.contract.hasAccess(req.user._id);

    if (!isApprover && !isRequester && !hasContractAccess) {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied' 
      });
    }

    // Mark as viewed by approver
    if (isApprover) {
      const approver = approval.approvers.find(a => a.user._id.equals(req.user._id));
      if (!approver.viewedAt) {
        approver.viewedAt = new Date();
        await approval.save();
      }
    }

    res.json({
      success: true,
      data: { approval }
    });
  } catch (error) {
    logger.error('Get approval error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch approval' 
    });
  }
});

/**
 * @route   POST /api/approvals/:id/approve
 * @desc    Approve request
 * @access  Private
 */
router.post('/:id/approve', authMiddleware, validateApproval.decision, async (req, res) => {
  try {
    const { comments, conditions } = req.body;

    const approval = await Approval
      .findById(req.params.id)
      .populate('contract', 'title')
      .populate('requestedBy', 'firstName lastName email');

    if (!approval || approval.isDeleted) {
      return res.status(404).json({ 
        success: false,
        message: 'Approval not found' 
      });
    }

    // Check if user can approve
    const approverIndex = approval.approvers.findIndex(
      a => a.user.equals(req.user._id) && a.status === 'pending'
    );

    if (approverIndex === -1) {
      return res.status(403).json({ 
        success: false,
        message: 'You cannot approve this request' 
      });
    }

    // Process approval
    await approval.approve(req.user._id, comments, conditions);

    // Send notifications
    await NotificationService.createNotification({
      user: approval.requestedBy._id,
      type: 'approval_received',
      title: 'Approval received',
      message: `${req.user.firstName} approved your request for "${approval.contract.title}"`,
      resource: { type: 'approval', id: approval._id },
      from: req.user._id
    });

    // If sequential and not complete, notify next approver
    if (approval.workflow.type === 'sequential' && approval.status === 'pending') {
      const nextApprover = approval.approvers.find(a => a.status === 'pending');
      if (nextApprover) {
        await NotificationService.createNotification({
          user: nextApprover.user,
          type: 'approval_requested',
          title: 'Your approval is needed',
          message: `Your approval is now required for "${approval.contract.title}"`,
          resource: { type: 'approval', id: approval._id },
          from: approval.requestedBy._id,
          priority: approval.priority,
          actionUrl: `/approvals/${approval._id}`,
          actionLabel: 'Review',
          actionType: 'approve'
        });
      }
    }

    // If approval is complete, update contract
    if (approval.status === 'approved') {
      const contract = await Contract.findById(approval.contract._id);
      contract.status = 'approved';
      contract.approvals.completedAt = new Date();
      await contract.save();
    }

    // Log activity
    await Activity.track({
      user: req.user._id,
      action: 'approval.approved',
      resource: { type: 'approval', id: approval._id },
      details: {
        comments,
        conditions
      }
    });

    res.json({
      success: true,
      message: 'Approved successfully',
      data: { approval }
    });
  } catch (error) {
    logger.error('Approve error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to approve' 
    });
  }
});

/**
 * @route   POST /api/approvals/:id/reject
 * @desc    Reject request
 * @access  Private
 */
router.post('/:id/reject', authMiddleware, validateApproval.decision, async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ 
        success: false,
        message: 'Rejection reason is required' 
      });
    }

    const approval = await Approval
      .findById(req.params.id)
      .populate('contract', 'title')
      .populate('requestedBy', 'firstName lastName email');

    if (!approval || approval.isDeleted) {
      return res.status(404).json({ 
        success: false,
        message: 'Approval not found' 
      });
    }

    // Check if user can reject
    const approverIndex = approval.approvers.findIndex(
      a => a.user.equals(req.user._id) && a.status === 'pending'
    );

    if (approverIndex === -1) {
      return res.status(403).json({ 
        success: false,
        message: 'You cannot reject this request' 
      });
    }

    // Process rejection
    await approval.reject(req.user._id, reason);

    // Update contract status
    const contract = await Contract.findById(approval.contract._id);
    contract.status = 'rejected';
    await contract.save();

    // Send notification
    await NotificationService.createNotification({
      user: approval.requestedBy._id,
      type: 'approval_received',
      title: 'Approval rejected',
      message: `${req.user.firstName} rejected your request for "${approval.contract.title}"`,
      resource: { type: 'approval', id: approval._id },
      from: req.user._id,
      data: { reason }
    });

    // Log activity
    await Activity.track({
      user: req.user._id,
      action: 'approval.rejected',
      resource: { type: 'approval', id: approval._id },
      details: { reason }
    });

    res.json({
      success: true,
      message: 'Rejected successfully',
      data: { approval }
    });
  } catch (error) {
    logger.error('Reject error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to reject' 
    });
  }
});

/**
 * @route   POST /api/approvals/:id/delegate
 * @desc    Delegate approval
 * @access  Private
 */
router.post('/:id/delegate', authMiddleware, validateApproval.delegate, async (req, res) => {
  try {
    const { delegateToUserId, reason } = req.body;

    const approval = await Approval.findById(req.params.id);

    if (!approval || approval.isDeleted) {
      return res.status(404).json({ 
        success: false,
        message: 'Approval not found' 
      });
    }

    // Find approver
    const approver = approval.approvers.find(
      a => a.user.equals(req.user._id) && a.status === 'pending'
    );

    if (!approver) {
      return res.status(403).json({ 
        success: false,
        message: 'You cannot delegate this approval' 
      });
    }

    // Delegate
    approver.delegatedTo = delegateToUserId;
    approver.delegatedAt = new Date();
    
    // Add new approver
    approval.approvers.push({
      user: delegateToUserId,
      role: approver.role,
      order: approver.order,
      status: 'pending'
    });

    await approval.save();

    // Send notification to delegate
    await NotificationService.createNotification({
      user: delegateToUserId,
      type: 'approval_requested',
      title: 'Approval delegated to you',
      message: `${req.user.firstName} delegated an approval request to you`,
      resource: { type: 'approval', id: approval._id },
      from: req.user._id,
      data: { reason },
      priority: approval.priority,
      actionUrl: `/approvals/${approval._id}`,
      actionLabel: 'Review',
      actionType: 'approve'
    });

    // Log activity
    await Activity.track({
      user: req.user._id,
      action: 'approval.delegated',
      resource: { type: 'approval', id: approval._id },
      details: {
        delegatedTo: delegateToUserId,
        reason
      }
    });

    res.json({
      success: true,
      message: 'Approval delegated successfully',
      data: { approval }
    });
  } catch (error) {
    logger.error('Delegate error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to delegate approval' 
    });
  }
});

/**
 * @route   POST /api/approvals/:id/remind
 * @desc    Send reminder to approvers
 * @access  Private
 */
router.post('/:id/remind', authMiddleware, async (req, res) => {
  try {
    const approval = await Approval
      .findById(req.params.id)
      .populate('contract', 'title')
      .populate('approvers.user', 'firstName lastName email');

    if (!approval || approval.isDeleted) {
      return res.status(404).json({ 
        success: false,
        message: 'Approval not found' 
      });
    }

    // Check if user is requester
    if (!approval.requestedBy.equals(req.user._id)) {
      return res.status(403).json({ 
        success: false,
        message: 'Only requester can send reminders' 
      });
    }

    // Send reminders to pending approvers
    const pendingApprovers = approval.approvers.filter(a => a.status === 'pending');
    
    for (const approver of pendingApprovers) {
      await approval.sendReminder(approver.user._id);
      
      // Send notification
      await NotificationService.createNotification({
        user: approver.user._id,
        type: 'approval_reminder',
        title: 'Approval reminder',
        message: `Reminder: Your approval is needed for "${approval.contract.title}"`,
        resource: { type: 'approval', id: approval._id },
        from: req.user._id,
        priority: 'high',
        actionUrl: `/approvals/${approval._id}`,
        actionLabel: 'Review Now',
        actionType: 'approve'
      });
    }

    res.json({
      success: true,
      message: `Reminders sent to ${pendingApprovers.length} approvers`
    });
  } catch (error) {
    logger.error('Send reminder error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to send reminders' 
    });
  }
});

module.exports = router;