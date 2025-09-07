const { Contract, User, Activity, Notification, Template } = require('../models');
const VersionControlService = require('./VersionControlService');
const NotificationService = require('./NotificationService');
const FileService = require('./FileService');
const ActivityService = require('./ActivityService');
const SearchService = require('./SearchService');
const { redis } = require('../middleware/cache');
const logger = require('../utils/logger');

class ContractService {
  /**
   * Create contract
   */
  async createContract(data, userId) {
    try {
      // If using template, merge template content
      if (data.templateId) {
        const template = await Template.findById(data.templateId);
        if (template) {
          data.content = this.mergeTemplateVariables(template.content, data.variables);
          data.template = template._id;
        }
      }

      // Create contract
      const contract = new Contract({
        ...data,
        owner: userId,
        createdBy: userId,
        updatedBy: userId
      });

      await contract.save();

      // Create initial version
      await VersionControlService.createVersion(contract._id, {
        content: contract.content,
        userId,
        message: 'Initial version'
      });

      // Index for search
      await SearchService.indexContract(contract);

      // Log activity
      await ActivityService.logActivity({
        user: userId,
        action: 'contract.created',
        resource: { type: 'contract', id: contract._id },
        details: { title: contract.title }
      });

      // Notify collaborators
      if (data.collaborators?.length > 0) {
        await this.notifyCollaborators(contract, userId, 'added');
      }

      return contract;
    } catch (error) {
      logger.error('Create contract error:', error);
      throw error;
    }
  }

  /**
   * Update contract
   */
  async updateContract(contractId, updates, userId) {
    try {
      const contract = await Contract.findById(contractId);
      if (!contract) {
        throw new Error('Contract not found');
      }

      // Check permissions
      if (!contract.hasEditAccess(userId)) {
        throw new Error('Insufficient permissions');
      }

      // Track changes
      const changes = this.trackChanges(contract, updates);

      // Create version if content changed
      if (updates.content && updates.content !== contract.content) {
        await VersionControlService.createVersion(contractId, {
          content: updates.content,
          userId,
          message: updates.versionMessage || 'Content updated'
        });
      }

      // Update contract
      Object.assign(contract, updates);
      contract.updatedBy = userId;
      await contract.save();

      // Update search index
      await SearchService.updateContract(contract);

      // Clear cache
      await this.clearContractCache(contractId);

      // Log activity
      await ActivityService.logActivity({
        user: userId,
        action: 'contract.updated',
        resource: { type: 'contract', id: contractId },
        details: { changes }
      });

      // Notify relevant parties
      if (changes.length > 0) {
        await this.notifyChanges(contract, userId, changes);
      }

      return contract;
    } catch (error) {
      logger.error('Update contract error:', error);
      throw error;
    }
  }

  /**
   * Delete contract
   */
  async deleteContract(contractId, userId) {
    try {
      const contract = await Contract.findById(contractId);
      if (!contract) {
        throw new Error('Contract not found');
      }

      // Check permissions
      if (!contract.hasDeleteAccess(userId)) {
        throw new Error('Insufficient permissions');
      }

      // Soft delete
      contract.deletedAt = new Date();
      contract.deletedBy = userId;
      await contract.save();

      // Remove from search index
      await SearchService.removeContract(contractId);

      // Clear cache
      await this.clearContractCache(contractId);

      // Log activity
      await ActivityService.logActivity({
        user: userId,
        action: 'contract.deleted',
        resource: { type: 'contract', id: contractId },
        details: { title: contract.title }
      });

      return { success: true };
    } catch (error) {
      logger.error('Delete contract error:', error);
      throw error;
    }
  }

  /**
   * Get contract with related data
   */
  async getContract(contractId, userId, options = {}) {
    try {
      const { includeVersions, includeActivity, includeComments } = options;

      // Check cache
      const cacheKey = `contract:${contractId}:${userId}`;
      if (!includeVersions && !includeActivity && !includeComments) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      }

      const contract = await Contract.findById(contractId)
        .populate('owner', 'firstName lastName email avatar')
        .populate('collaborators.user', 'firstName lastName email avatar')
        .populate('template', 'name');

      if (!contract || contract.deletedAt) {
        throw new Error('Contract not found');
      }

      // Check permissions
      if (!contract.hasReadAccess(userId)) {
        throw new Error('Access denied');
      }

      const result = contract.toObject();

      // Load additional data if requested
      if (includeVersions) {
        result.versions = await VersionControlService.getVersions(contractId);
      }

      if (includeActivity) {
        result.activity = await ActivityService.getResourceActivity('contract', contractId);
      }

      if (includeComments) {
        const Comment = require('../models/Comment');
        result.comments = await Comment.find({ contract: contractId })
          .populate('author', 'firstName lastName avatar')
          .sort({ createdAt: -1 });
      }

      // Cache basic contract data
      if (!includeVersions && !includeActivity && !includeComments) {
        await redis.setex(cacheKey, 300, JSON.stringify(result));
      }

      // Record view
      await this.recordView(contractId, userId);

      return result;
    } catch (error) {
      logger.error('Get contract error:', error);
      throw error;
    }
  }

  /**
   * Sign contract
   */
  async signContract(contractId, userId, signatureData) {
    try {
      const contract = await Contract.findById(contractId);
      if (!contract) {
        throw new Error('Contract not found');
      }

      // Check if user can sign
      const party = contract.parties.find(p => 
        p.email === signatureData.email && p.role === 'signatory'
      );
      
      if (!party) {
        throw new Error('Not authorized to sign this contract');
      }

      if (party.signedAt) {
        throw new Error('Already signed');
      }

      // Store signature
      party.signedAt = new Date();
      party.signedBy = userId;
      party.signature = signatureData.signature;
      party.ipAddress = signatureData.ipAddress;

      // Check if all required signatures are collected
      const allSigned = contract.parties
        .filter(p => p.role === 'signatory')
        .every(p => p.signedAt);

      if (allSigned) {
        contract.status = 'signed';
        contract.signedAt = new Date();
      }

      await contract.save();

      // Generate signed PDF
      if (allSigned) {
        await this.generateSignedPDF(contract);
      }

      // Log activity
      await ActivityService.logActivity({
        user: userId,
        action: 'contract.signed',
        resource: { type: 'contract', id: contractId },
        details: { 
          party: party.name,
          allSigned 
        }
      });

      // Send notifications
      await this.notifySignature(contract, party, allSigned);

      return contract;
    } catch (error) {
      logger.error('Sign contract error:', error);
      throw error;
    }
  }

  /**
   * Share contract
   */
  async shareContract(contractId, userId, shareData) {
    try {
      const contract = await Contract.findById(contractId);
      if (!contract) {
        throw new Error('Contract not found');
      }

      // Check permissions
      if (!contract.hasShareAccess(userId)) {
        throw new Error('Cannot share this contract');
      }

      const { emails, permissions, message } = shareData;

      // Add collaborators
      for (const email of emails) {
        const user = await User.findOne({ email });
        if (user) {
          // Add as collaborator
          if (!contract.collaborators.some(c => c.user.equals(user._id))) {
            contract.collaborators.push({
              user: user._id,
              permissions: permissions || ['read'],
              addedBy: userId
            });
          }

          // Send notification
          await NotificationService.sendNotification({
            userId: user._id,
            type: 'contract_shared',
            title: 'Contract Shared',
            message: `${contract.title} has been shared with you`,
            data: { contractId, message }
          });
        } else {
          // Send invitation email
          await EmailService.sendEmail({
            to: email,
            template: 'contract-invitation',
            data: {
              contractTitle: contract.title,
              message,
              inviteUrl: `${process.env.FRONTEND_URL}/invite?contract=${contractId}`
            }
          });
        }
      }

      await contract.save();

      // Log activity
      await ActivityService.logActivity({
        user: userId,
        action: 'contract.shared',
        resource: { type: 'contract', id: contractId },
        details: { 
          recipients: emails,
          permissions 
        }
      });

      return { success: true };
    } catch (error) {
      logger.error('Share contract error:', error);
      throw error;
    }
  }

  /**
   * Bulk operations
   */
  async bulkOperation(operation, contractIds, userId, data = {}) {
    try {
      const results = {
        success: [],
        failed: []
      };

      for (const contractId of contractIds) {
        try {
          switch (operation) {
            case 'delete':
              await this.deleteContract(contractId, userId);
              results.success.push(contractId);
              break;
              
            case 'archive':
              await this.updateContract(contractId, { archived: true }, userId);
              results.success.push(contractId);
              break;
              
            case 'unarchive':
              await this.updateContract(contractId, { archived: false }, userId);
              results.success.push(contractId);
              break;
              
            case 'addTag':
              const contract = await Contract.findById(contractId);
              if (contract && contract.hasEditAccess(userId)) {
                contract.tags.push(data.tag);
                await contract.save();
                results.success.push(contractId);
              } else {
                results.failed.push({ id: contractId, reason: 'Access denied' });
              }
              break;
              
            case 'removeTag':
              const contract2 = await Contract.findById(contractId);
              if (contract2 && contract2.hasEditAccess(userId)) {
                contract2.tags = contract2.tags.filter(t => t !== data.tag);
                await contract2.save();
                results.success.push(contractId);
              } else {
                results.failed.push({ id: contractId, reason: 'Access denied' });
              }
              break;
              
            default:
              results.failed.push({ id: contractId, reason: 'Invalid operation' });
          }
        } catch (error) {
          results.failed.push({ id: contractId, reason: error.message });
        }
      }

      // Log bulk operation
      await ActivityService.logActivity({
        user: userId,
        action: `contract.bulk_${operation}`,
        resource: { type: 'contract', id: 'bulk' },
        details: { 
          total: contractIds.length,
          success: results.success.length,
          failed: results.failed.length
        }
      });

      return results;
    } catch (error) {
      logger.error('Bulk operation error:', error);
      throw error;
    }
  }

  /**
   * Helper methods
   */
  
  mergeTemplateVariables(content, variables) {
    let merged = content;
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      merged = merged.replace(regex, variables[key] || '');
    });
    return merged;
  }

  trackChanges(original, updates) {
    const changes = [];
    const trackFields = ['title', 'status', 'type', 'parties', 'dates'];
    
    trackFields.forEach(field => {
      if (updates[field] && updates[field] !== original[field]) {
        changes.push({
          field,
          oldValue: original[field],
          newValue: updates[field]
        });
      }
    });
    
    return changes;
  }

  async clearContractCache(contractId) {
    const pattern = `contract:${contractId}:*`;
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }

  async recordView(contractId, userId) {
    try {
      await ActivityService.logActivity({
        user: userId,
        action: 'contract.viewed',
        resource: { type: 'contract', id: contractId }
      });
    } catch (error) {
      // Don't throw on view logging errors
      logger.error('Record view error:', error);
    }
  }

  async notifyCollaborators(contract, userId, action) {
    const user = await User.findById(userId);
    const notifications = contract.collaborators.map(collaborator => 
      NotificationService.sendNotification({
        userId: collaborator.user,
        type: `contract_${action}`,
        title: `Contract ${action}`,
        message: `${user.firstName} ${action} you to "${contract.title}"`,
        data: { contractId: contract._id }
      })
    );
    
    await Promise.all(notifications);
  }

  async notifyChanges(contract, userId, changes) {
    const user = await User.findById(userId);
    const notifications = contract.collaborators
      .filter(c => c.user.toString() !== userId)
      .map(collaborator => 
        NotificationService.sendNotification({
          userId: collaborator.user,
          type: 'contract_updated',
          title: 'Contract Updated',
          message: `${user.firstName} updated "${contract.title}"`,
          data: { 
            contractId: contract._id,
            changes: changes.map(c => c.field)
          }
        })
      );
    
    await Promise.all(notifications);
  }

  async notifySignature(contract, party, allSigned) {
    const notifications = [];
    
    // Notify owner
    notifications.push(
      NotificationService.sendNotification({
        userId: contract.owner,
        type: allSigned ? 'contract_fully_signed' : 'contract_signed',
        title: allSigned ? 'Contract Fully Signed' : 'Contract Signed',
        message: allSigned 
          ? `"${contract.title}" has been fully signed`
          : `${party.name} signed "${contract.title}"`,
        data: { contractId: contract._id }
      })
    );
    
    // Notify other parties if fully signed
    if (allSigned) {
      contract.parties
        .filter(p => p.email !== party.email)
        .forEach(p => {
          notifications.push(
            EmailService.sendEmail({
              to: p.email,
              template: 'contract-fully-signed',
              data: {
                contractTitle: contract.title,
                viewUrl: `${process.env.FRONTEND_URL}/contracts/${contract._id}`
              }
            })
          );
        });
    }
    
    await Promise.all(notifications);
  }

  async generateSignedPDF(contract) {
    // This would integrate with a PDF generation service
    logger.info('Generating signed PDF for contract:', contract._id);
  }
}

module.exports = new ContractService();