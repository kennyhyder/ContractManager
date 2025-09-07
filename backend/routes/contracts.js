const express = require('express');
const router = express.Router();
const { Contract, Activity, Comment, Approval, Notification } = require('../models');
const { authMiddleware } = require('../middleware/auth');
const { validateContract } = require('../middleware/validation');
const { uploadMiddleware } = require('../middleware/upload');
const ContractService = require('../services/ContractService');
const NotificationService = require('../services/NotificationService');
const logger = require('../utils/logger');

/**
 * @route   GET /api/contracts
 * @desc    Get all contracts for user
 * @access  Private
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      type,
      search,
      sortBy = 'createdAt',
      order = 'desc',
      startDate,
      endDate,
      tags
    } = req.query;

    // Build query
    const query = {
      $or: [
        { owner: req.user._id },
        { 'collaborators.user': req.user._id }
      ],
      deletedAt: null
    };

    if (status) query.status = status;
    if (type) query.type = type;
    
    if (search) {
      query.$text = { $search: search };
    }

    if (startDate || endDate) {
      query['dates.effective'] = {};
      if (startDate) query['dates.effective'].$gte = new Date(startDate);
      if (endDate) query['dates.effective'].$lte = new Date(endDate);
    }

    if (tags) {
      query.tags = { $in: Array.isArray(tags) ? tags : [tags] };
    }

    // Execute query
    const contracts = await Contract
      .find(query)
      .populate('owner', 'firstName lastName email avatar')
      .populate('collaborators.user', 'firstName lastName email avatar')
      .populate('template', 'name')
      .sort({ [sortBy]: order === 'desc' ? -1 : 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Contract.countDocuments(query);

    res.json({
      success: true,
      data: {
        contracts,
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          page: parseInt(page),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get contracts error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch contracts' 
    });
  }
});

/**
 * @route   GET /api/contracts/:id
 * @desc    Get single contract
 * @access  Private
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const contract = await Contract
      .findById(req.params.id)
      .populate('owner', 'firstName lastName email avatar')
      .populate('collaborators.user', 'firstName lastName email avatar role')
      .populate('template', 'name category')
      .populate('parties.signatories')
      .populate('approvals.approvers.user', 'firstName lastName email')
      .populate('versionHistory.changedBy', 'firstName lastName');

    if (!contract || contract.deletedAt) {
      return res.status(404).json({ 
        success: false,
        message: 'Contract not found' 
      });
    }

    // Check access
    if (!contract.hasAccess(req.user._id)) {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied' 
      });
    }

    // Increment view count
    contract.analytics.viewCount++;
    contract.analytics.lastViewed = new Date();
    await contract.save();

    // Get related data
    const [comments, approvals, activities] = await Promise.all([
      Comment.getThreads(contract._id),
      Approval.find({ contract: contract._id }).populate('requestedBy approvers.user'),
      Activity.getResourceActivities('contract', contract._id, { limit: 20 })
    ]);

    res.json({
      success: true,
      data: {
        contract,
        comments,
        approvals,
        activities
      }
    });
  } catch (error) {
    logger.error('Get contract error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch contract' 
    });
  }
});

/**
 * @route   POST /api/contracts
 * @desc    Create new contract
 * @access  Private
 */
router.post('/', authMiddleware, validateContract.create, async (req, res) => {
  try {
    const contractData = {
      ...req.body,
      owner: req.user._id,
      metadata: {
        ...req.body.metadata,
        source: 'manual',
        referenceNumber: await ContractService.generateReferenceNumber(req.body.type)
      }
    };

    // Create contract
    const contract = new Contract(contractData);
    await contract.save();

    // Add collaborators if specified
    if (req.body.collaborators) {
      for (const collaborator of req.body.collaborators) {
        await contract.addCollaborator(
          collaborator.userId,
          collaborator.role,
          collaborator.permissions,
          req.user._id
        );
      }
    }

    // Create from template if specified
    if (req.body.templateId) {
      const template = await Template.findById(req.body.templateId);
      if (template) {
        contract.template = {
          id: template._id,
          version: template.versionString,
          variables: req.body.templateVariables || {}
        };
        contract.content = await ContractService.applyTemplate(template, req.body.templateVariables);
        
        // Record template usage
        await template.recordUsage(req.user._id, contract._id);
      }
    }

    await contract.save();

    // Send notifications
    await NotificationService.notifyContractEvent('created', contract._id, {
      createdBy: req.user
    });

    // Log activity
    await Activity.track({
      user: req.user._id,
      action: 'contract.created',
      resource: { type: 'contract', id: contract._id, name: contract.title },
      details: {
        type: contract.type,
        value: contract.value.amount
      }
    });

    res.status(201).json({
      success: true,
      message: 'Contract created successfully',
      data: { contract }
    });
  } catch (error) {
    logger.error('Create contract error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to create contract' 
    });
  }
});

/**
 * @route   PUT /api/contracts/:id
 * @desc    Update contract
 * @access  Private
 */
router.put('/:id', authMiddleware, validateContract.update, async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id);

    if (!contract || contract.deletedAt) {
      return res.status(404).json({ 
        success: false,
        message: 'Contract not found' 
      });
    }

    // Check edit permission
    if (!contract.hasAccess(req.user._id, 'edit')) {
      return res.status(403).json({ 
        success: false,
        message: 'You do not have permission to edit this contract' 
      });
    }

    // Check if contract is editable
    if (['fully_signed', 'terminated', 'expired'].includes(contract.status)) {
      return res.status(400).json({ 
        success: false,
        message: 'Cannot edit contract in current status' 
      });
    }

    // Save current version if content changed
    if (req.body.content && req.body.content !== contract.content) {
      await contract.addVersion(
        req.body.content,
        req.body.changeLog || 'Content updated',
        req.user._id
      );
    }

    // Update fields
    const allowedUpdates = [
      'title', 'description', 'type', 'category', 'subcategory',
      'value', 'financialTerms', 'dates', 'duration', 'parties',
      'tags', 'metadata', 'notifications', 'customFields'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        contract[field] = req.body[field];
      }
    });

    // Update status if changed
    if (req.body.status && req.body.status !== contract.status) {
      await contract.updateStatus(req.body.status, req.user._id, req.body.statusReason);
    }

    contract.analytics.lastModified = new Date();
    await contract.save();

    // Send notifications
    await NotificationService.notifyContractEvent('updated', contract._id, {
      updatedBy: req.user,
      changes: Object.keys(req.body)
    });

    // Log activity
    await Activity.track({
      user: req.user._id,
      action: 'contract.updated',
      resource: { type: 'contract', id: contract._id, name: contract.title },
      details: {
        updatedFields: Object.keys(req.body)
      }
    });

    res.json({
      success: true,
      message: 'Contract updated successfully',
      data: { contract }
    });
  } catch (error) {
    logger.error('Update contract error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update contract' 
    });
  }
});

/**
 * @route   DELETE /api/contracts/:id
 * @desc    Delete contract (soft delete)
 * @access  Private
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id);

    if (!contract || contract.deletedAt) {
      return res.status(404).json({ 
        success: false,
        message: 'Contract not found' 
      });
    }

    // Check delete permission
    if (!contract.hasAccess(req.user._id, 'delete')) {
      return res.status(403).json({ 
        success: false,
        message: 'You do not have permission to delete this contract' 
      });
    }

    // Soft delete
    contract.deletedAt = new Date();
    contract.deletedBy = req.user._id;
    contract.deleteReason = req.body.reason;
    await contract.save();

    // Log activity
    await Activity.track({
      user: req.user._id,
      action: 'contract.deleted',
      resource: { type: 'contract', id: contract._id, name: contract.title },
      details: {
        reason: req.body.reason
      }
    });

    res.json({
      success: true,
      message: 'Contract deleted successfully'
    });
  } catch (error) {
    logger.error('Delete contract error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to delete contract' 
    });
  }
});

/**
 * @route   POST /api/contracts/:id/collaborators
 * @desc    Add collaborator to contract
 * @access  Private
 */
router.post('/:id/collaborators', authMiddleware, validateContract.addCollaborator, async (req, res) => {
  try {
    const { userId, role, permissions, message } = req.body;

    const contract = await Contract.findById(req.params.id);

    if (!contract || contract.deletedAt) {
      return res.status(404).json({ 
        success: false,
        message: 'Contract not found' 
      });
    }

    // Check share permission
    if (!contract.hasAccess(req.user._id, 'share')) {
      return res.status(403).json({ 
        success: false,
        message: 'You do not have permission to share this contract' 
      });
    }

    // Add collaborator
    await contract.addCollaborator(userId, role, permissions, req.user._id);

    // Send notification
    await NotificationService.createNotification({
      user: userId,
      type: 'contract_shared',
      title: 'Contract shared with you',
      message: `${req.user.firstName} ${req.user.lastName} shared a contract with you: ${contract.title}`,
      resource: { type: 'contract', id: contract._id },
      from: req.user._id,
      actionUrl: `/contracts/${contract._id}`,
      actionLabel: 'View Contract'
    });

    // Send email
    const user = await User.findById(userId);
    if (user) {
      await EmailService.sendEmail({
        to: user.email,
        template: 'contract-shared',
        data: {
          firstName: user.firstName,
          sharedBy: `${req.user.firstName} ${req.user.lastName}`,
          contractTitle: contract.title,
          role: role,
          message: message,
          contractUrl: `${process.env.FRONTEND_URL}/contracts/${contract._id}`
        }
      });
    }

    // Log activity
    await Activity.track({
      user: req.user._id,
      action: 'contract.collaborator_added',
      resource: { type: 'contract', id: contract._id, name: contract.title },
      details: {
        collaboratorId: userId,
        role: role
      }
    });

    res.json({
      success: true,
      message: 'Collaborator added successfully',
      data: { contract }
    });
  } catch (error) {
    logger.error('Add collaborator error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to add collaborator' 
    });
  }
});

/**
 * @route   DELETE /api/contracts/:id/collaborators/:userId
 * @desc    Remove collaborator from contract
 * @access  Private
 */
router.delete('/:id/collaborators/:userId', authMiddleware, async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id);

    if (!contract || contract.deletedAt) {
      return res.status(404).json({ 
        success: false,
        message: 'Contract not found' 
      });
    }

    // Only owner can remove collaborators
    if (!contract.owner.equals(req.user._id)) {
      return res.status(403).json({ 
        success: false,
        message: 'Only contract owner can remove collaborators' 
      });
    }

    // Remove collaborator
    contract.collaborators = contract.collaborators.filter(
      c => !c.user.equals(req.params.userId)
    );
    await contract.save();

    // Log activity
    await Activity.track({
      user: req.user._id,
      action: 'contract.collaborator_removed',
      resource: { type: 'contract', id: contract._id, name: contract.title },
      details: {
        collaboratorId: req.params.userId
      }
    });

    res.json({
      success: true,
      message: 'Collaborator removed successfully',
      data: { contract }
    });
  } catch (error) {
    logger.error('Remove collaborator error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to remove collaborator' 
    });
  }
});

/**
 * @route   POST /api/contracts/:id/attachments
 * @desc    Upload attachment to contract
 * @access  Private
 */
router.post('/:id/attachments', 
  authMiddleware, 
  uploadMiddleware.single('file'),
  async (req, res) => {
    try {
      const contract = await Contract.findById(req.params.id);

      if (!contract || contract.deletedAt) {
        return res.status(404).json({ 
          success: false,
          message: 'Contract not found' 
        });
      }

      // Check permission
      if (!contract.hasAccess(req.user._id, 'edit')) {
        return res.status(403).json({ 
          success: false,
          message: 'You do not have permission to add attachments' 
        });
      }

      // Add attachment
      const attachment = {
        name: req.file.originalname,
        url: req.file.location || req.file.path,
        size: req.file.size,
        mimeType: req.file.mimetype,
        category: req.body.category || 'supporting',
        uploadedBy: req.user._id,
        uploadedAt: new Date()
      };

      contract.attachments.push(attachment);
      await contract.save();

      // Create attachment record
      await Attachment.create({
        ...attachment,
        resourceType: 'contract',
        resourceId: contract._id
      });

      // Log activity
      await Activity.track({
        user: req.user._id,
        action: 'contract.attachment_added',
        resource: { type: 'contract', id: contract._id, name: contract.title },
        details: {
          fileName: attachment.name,
          fileSize: attachment.size
        }
      });

      res.json({
        success: true,
        message: 'Attachment uploaded successfully',
        data: { attachment }
      });
    } catch (error) {
      logger.error('Upload attachment error:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to upload attachment' 
      });
    }
  }
);

/**
 * @route   POST /api/contracts/:id/versions
 * @desc    Create new version of contract
 * @access  Private
 */
router.post('/:id/versions', authMiddleware, validateContract.createVersion, async (req, res) => {
  try {
    const { content, changes } = req.body;

    const contract = await Contract.findById(req.params.id);

    if (!contract || contract.deletedAt) {
      return res.status(404).json({ 
        success: false,
        message: 'Contract not found' 
      });
    }

    // Check permission
    if (!contract.hasAccess(req.user._id, 'edit')) {
      return res.status(403).json({ 
        success: false,
        message: 'You do not have permission to create versions' 
      });
    }

    // Create new version
    await contract.addVersion(content, changes, req.user._id);

    // Log activity
    await Activity.track({
      user: req.user._id,
      action: 'contract.version_created',
      resource: { type: 'contract', id: contract._id, name: contract.title },
      details: {
        version: contract.versionString,
        changes: changes
      }
    });

    res.json({
      success: true,
      message: 'Version created successfully',
      data: { 
        contract,
        version: contract.versionString 
      }
    });
  } catch (error) {
    logger.error('Create version error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to create version' 
    });
  }
});

/**
 * @route   POST /api/contracts/:id/approve
 * @desc    Approve contract
 * @access  Private
 */
router.post('/:id/approve', authMiddleware, async (req, res) => {
  try {
    const { comments, conditions } = req.body;

    const contract = await Contract.findById(req.params.id);

    if (!contract || contract.deletedAt) {
      return res.status(404).json({ 
        success: false,
        message: 'Contract not found' 
      });
    }

    // Check if user can approve
    if (!contract.canBeApprovedBy(req.user._id)) {
      return res.status(403).json({ 
        success: false,
        message: 'You cannot approve this contract' 
      });
    }

    // Approve contract
    await contract.approve(req.user._id, comments, conditions);

    // Send notifications
    await NotificationService.notifyContractEvent('approved', contract._id, {
      approvedBy: req.user,
      comments,
      conditions
    });

    // Log activity
    await Activity.track({
      user: req.user._id,
      action: 'contract.approved',
      resource: { type: 'contract', id: contract._id, name: contract.title },
      details: {
        comments,
        conditions
      }
    });

    res.json({
      success: true,
      message: 'Contract approved successfully',
      data: { contract }
    });
  } catch (error) {
    logger.error('Approve contract error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to approve contract' 
    });
  }
});

/**
 * @route   POST /api/contracts/:id/sign
 * @desc    Sign contract
 * @access  Private
 */
router.post('/:id/sign', authMiddleware, validateContract.sign, async (req, res) => {
  try {
    const { signatureData, signatureMethod } = req.body;

    const contract = await Contract.findById(req.params.id);

    if (!contract || contract.deletedAt) {
      return res.status(404).json({ 
        success: false,
        message: 'Contract not found' 
      });
    }

    // Check if user can sign
    const party = contract.parties.find(p => 
      p.signatories.some(s => s.email === req.user.email)
    );

    if (!party) {
      return res.status(403).json({ 
        success: false,
        message: 'You are not authorized to sign this contract' 
      });
    }

    // Process signature
    const signature = await ContractService.processSignature(
      contract,
      req.user,
      signatureData,
      signatureMethod,
      req.ip
    );

    // Update party signature
    party.signature = {
      signed: true,
      signedBy: req.user.fullName,
      signedAt: new Date(),
      signatureId: signature.id,
      ipAddress: req.ip,
      method: signatureMethod
    };

    // Check if all parties have signed
    if (contract.isFullySigned) {
      await contract.updateStatus('fully_signed', req.user._id, 'All parties have signed');
    }

    await contract.save();

    // Send notifications
    await NotificationService.notifyContractEvent('signed', contract._id, {
      signedBy: req.user,
      party: party.name
    });

    // Log activity
    await Activity.track({
      user: req.user._id,
      action: 'contract.signed',
      resource: { type: 'contract', id: contract._id, name: contract.title },
      details: {
        party: party.name,
        method: signatureMethod
      }
    });

    res.json({
      success: true,
      message: 'Contract signed successfully',
      data: { contract }
    });
  } catch (error) {
    logger.error('Sign contract error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to sign contract' 
    });
  }
});

/**
 * @route   POST /api/contracts/:id/export
 * @desc    Export contract to PDF
 * @access  Private
 */
router.post('/:id/export', authMiddleware, async (req, res) => {
  try {
    const { format = 'pdf', includeAttachments = false } = req.body;

    const contract = await Contract
      .findById(req.params.id)
      .populate('owner parties.signatories');

    if (!contract || contract.deletedAt) {
      return res.status(404).json({ 
        success: false,
        message: 'Contract not found' 
      });
    }

    // Check permission
    if (!contract.hasAccess(req.user._id)) {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied' 
      });
    }

    // Generate export
    const exportData = await ContractService.exportContract(
      contract,
      format,
      { includeAttachments }
    );

    // Update download count
    contract.analytics.downloadCount++;
    await contract.save();

    // Log activity
    await Activity.track({
      user: req.user._id,
      action: 'contract.exported',
      resource: { type: 'contract', id: contract._id, name: contract.title },
      details: { format }
    });

    res.json({
      success: true,
      message: 'Contract exported successfully',
      data: exportData
    });
  } catch (error) {
    logger.error('Export contract error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to export contract' 
    });
  }
});

/**
 * @route   GET /api/contracts/expiring
 * @desc    Get expiring contracts
 * @access  Private
 */
router.get('/expiring', authMiddleware, async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const contracts = await Contract.findExpiring(days);
    
    // Filter by user access
    const accessibleContracts = contracts.filter(c => 
      c.hasAccess(req.user._id)
    );

    res.json({
      success: true,
      data: {
        contracts: accessibleContracts,
        count: accessibleContracts.length
      }
    });
  } catch (error) {
    logger.error('Get expiring contracts error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch expiring contracts' 
    });
  }
});

/**
 * @route   POST /api/contracts/bulk/update
 * @desc    Bulk update contracts
 * @access  Private
 */
router.post('/bulk/update', authMiddleware, validateContract.bulkUpdate, async (req, res) => {
  try {
    const { contractIds, updates } = req.body;

    const results = {
      success: [],
      failed: []
    };

    for (const contractId of contractIds) {
      try {
        const contract = await Contract.findById(contractId);
        
        if (!contract || !contract.hasAccess(req.user._id, 'edit')) {
          results.failed.push({
            contractId,
            error: 'Access denied or contract not found'
          });
          continue;
        }

        // Apply updates
        Object.keys(updates).forEach(key => {
          if (updates[key] !== undefined) {
            contract[key] = updates[key];
          }
        });

        await contract.save();
        results.success.push(contractId);

      } catch (error) {
        results.failed.push({
          contractId,
          error: error.message
        });
      }
    }

    // Log activity
    await Activity.track({
      user: req.user._id,
      action: 'contract.bulk_update',
      resource: { type: 'system', id: null },
      details: {
        totalContracts: contractIds.length,
        successCount: results.success.length,
        failedCount: results.failed.length,
        updates: Object.keys(updates)
      }
    });

    res.json({
      success: true,
      message: `Updated ${results.success.length} contracts`,
      data: results
    });
  } catch (error) {
    logger.error('Bulk update error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to perform bulk update' 
    });
  }
});

module.exports = router;