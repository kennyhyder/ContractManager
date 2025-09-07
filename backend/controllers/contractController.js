const ContractService = require('../services/ContractService');
const VersionControlService = require('../services/VersionControlService');
const SignatureService = require('../services/SignatureService');
const ActivityService = require('../services/ActivityService');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

class ContractController {
  /**
   * Get contracts list
   */
  async getContracts(req, res, next) {
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
        tags,
        archived = false
      } = req.query;

      const userId = req.user._id;

      // Build query
      const query = {
        $or: [
          { owner: userId },
          { 'collaborators.user': userId }
        ],
        archived: archived === 'true',
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
        .populate('collaborators.user', 'firstName lastName email')
        .populate('template', 'name')
        .sort({ [sortBy]: order === 'desc' ? -1 : 1 })
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit))
        .lean();

      const total = await Contract.countDocuments(query);

      res.json({
        success: true,
        data: {
          contracts,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
          }
        }
      });
    } catch (error) {
      logger.error('Get contracts error:', error);
      next(error);
    }
  }

  /**
   * Get single contract
   */
  async getContract(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user._id;
      const { 
        includeVersions = false,
        includeActivity = false,
        includeComments = false 
      } = req.query;

      const contract = await ContractService.getContract(id, userId, {
        includeVersions: includeVersions === 'true',
        includeActivity: includeActivity === 'true',
        includeComments: includeComments === 'true'
      });

      res.json({
        success: true,
        data: contract
      });
    } catch (error) {
      logger.error('Get contract error:', error);
      
      if (error.message === 'Contract not found') {
        return res.status(404).json({
          error: 'Contract not found',
          code: 'CONTRACT_NOT_FOUND'
        });
      }
      
      if (error.message === 'Access denied') {
        return res.status(403).json({
          error: 'Access denied',
          code: 'ACCESS_DENIED'
        });
      }
      
      next(error);
    }
  }

  /**
   * Create contract
   */
  async createContract(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          errors: errors.array()
        });
      }

      const userId = req.user._id;
      const contractData = req.body;

      const contract = await ContractService.createContract(contractData, userId);

      res.status(201).json({
        success: true,
        message: 'Contract created successfully',
        data: contract
      });
    } catch (error) {
      logger.error('Create contract error:', error);
      next(error);
    }
  }

  /**
   * Update contract
   */
  async updateContract(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const userId = req.user._id;
      const updates = req.body;

      const contract = await ContractService.updateContract(id, updates, userId);

      res.json({
        success: true,
        message: 'Contract updated successfully',
        data: contract
      });
    } catch (error) {
      logger.error('Update contract error:', error);
      
      if (error.message === 'Contract not found') {
        return res.status(404).json({
          error: 'Contract not found',
          code: 'CONTRACT_NOT_FOUND'
        });
      }
      
      if (error.message === 'Insufficient permissions') {
        return res.status(403).json({
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }
      
      next(error);
    }
  }

  /**
   * Delete contract
   */
  async deleteContract(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user._id;

      await ContractService.deleteContract(id, userId);

      res.json({
        success: true,
        message: 'Contract deleted successfully'
      });
    } catch (error) {
      logger.error('Delete contract error:', error);
      
      if (error.message === 'Contract not found') {
        return res.status(404).json({
          error: 'Contract not found',
          code: 'CONTRACT_NOT_FOUND'
        });
      }
      
      if (error.message === 'Insufficient permissions') {
        return res.status(403).json({
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }
      
      next(error);
    }
  }

  /**
   * Share contract
   */
  async shareContract(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user._id;
      const { emails, permissions, message } = req.body;

      const result = await ContractService.shareContract(id, userId, {
        emails,
        permissions,
        message
      });

      res.json({
        success: true,
        message: 'Contract shared successfully',
        data: result
      });
    } catch (error) {
      logger.error('Share contract error:', error);
      
      if (error.message === 'Cannot share this contract') {
        return res.status(403).json({
          error: 'Cannot share this contract',
          code: 'CANNOT_SHARE'
        });
      }
      
      next(error);
    }
  }

  /**
   * Clone contract
   */
  async cloneContract(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user._id;
      const { title } = req.body;

      // Get original contract
      const original = await ContractService.getContract(id, userId);
      
      // Create clone
      const cloneData = {
        ...original,
        title: title || `Copy of ${original.title}`,
        status: 'draft',
        parties: original.parties.map(p => ({
          ...p,
          signed: false,
          signedAt: null,
          signature: null
        })),
        signatures: [],
        signedAt: null,
        template: original.template?._id
      };

      delete cloneData._id;
      delete cloneData.createdAt;
      delete cloneData.updatedAt;
      delete cloneData.versions;
      delete cloneData.activity;
      delete cloneData.comments;

      const cloned = await ContractService.createContract(cloneData, userId);

      res.json({
        success: true,
        message: 'Contract cloned successfully',
        data: cloned
      });
    } catch (error) {
      logger.error('Clone contract error:', error);
      next(error);
    }
  }

  /**
   * Export contract
   */
  async exportContract(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user._id;
      const { format = 'pdf' } = req.query;

      const contract = await ContractService.getContract(id, userId);
      
      let exportData;
      let contentType;
      let filename;

      switch (format) {
        case 'pdf':
          exportData = await PDFService.generateContractPDF(contract);
          contentType = 'application/pdf';
          filename = `${contract.title.replace(/[^a-z0-9]/gi, '_')}.pdf`;
          break;
          
        case 'docx':
          exportData = await DOCXService.generateContractDOCX(contract);
          contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          filename = `${contract.title.replace(/[^a-z0-9]/gi, '_')}.docx`;
          break;
          
        case 'json':
          exportData = JSON.stringify(contract, null, 2);
          contentType = 'application/json';
          filename = `${contract.title.replace(/[^a-z0-9]/gi, '_')}.json`;
          break;
          
        default:
          return res.status(400).json({
            error: 'Invalid export format',
            code: 'INVALID_FORMAT'
          });
      }

      // Log export
      await ActivityService.logActivity({
        user: userId,
        action: 'contract.exported',
        resource: { type: 'contract', id },
        details: { format }
      });

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(exportData);
    } catch (error) {
      logger.error('Export contract error:', error);
      next(error);
    }
  }

  /**
   * Get contract versions
   */
  async getVersions(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user._id;
      const { page = 1, limit = 20 } = req.query;

      // Check access
      await ContractService.getContract(id, userId);

      const versions = await VersionControlService.getVersions(id, {
        page: parseInt(page),
        limit: parseInt(limit)
      });

      res.json({
        success: true,
        data: versions
      });
    } catch (error) {
      logger.error('Get versions error:', error);
      next(error);
    }
  }

  /**
   * Compare versions
   */
  async compareVersions(req, res, next) {
    try {
      const { id } = req.params;
      const { version1, version2 } = req.query;
      const userId = req.user._id;

      // Check access
      await ContractService.getContract(id, userId);

      const comparison = await VersionControlService.compareVersions(
        id,
        version1,
        version2
      );

      res.json({
        success: true,
        data: comparison
      });
    } catch (error) {
      logger.error('Compare versions error:', error);
      next(error);
    }
  }

  /**
   * Restore version
   */
  async restoreVersion(req, res, next) {
    try {
      const { id, version } = req.params;
      const userId = req.user._id;

      const result = await VersionControlService.restoreVersion(id, version, userId);

      res.json({
        success: true,
        message: 'Version restored successfully',
        data: result
      });
    } catch (error) {
      logger.error('Restore version error:', error);
      next(error);
    }
  }

  /**
   * Request signatures
   */
  async requestSignatures(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user._id;
      const { parties, message, deadline, options } = req.body;

      // Check access
      const contract = await ContractService.getContract(id, userId);
      
      if (!contract.hasEditAccess(userId)) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      const requests = await SignatureService.createSignatureRequest(
        id,
        parties,
        { message, deadline, ...options }
      );

      res.json({
        success: true,
        message: 'Signature requests sent successfully',
        data: requests
      });
    } catch (error) {
      logger.error('Request signatures error:', error);
      next(error);
    }
  }

  /**
   * Sign contract
   */
  async signContract(req, res, next) {
    try {
      const { id } = req.params;
      const { token } = req.query;
      const signatureData = req.body;

      const result = await SignatureService.signDocument(id, token, {
        ...signatureData,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      res.json({
        success: true,
        message: result.allSigned 
          ? 'Contract fully signed' 
          : 'Contract signed successfully',
        data: result
      });
    } catch (error) {
      logger.error('Sign contract error:', error);
      
      if (error.message === 'Invalid signature token') {
        return res.status(400).json({
          error: 'Invalid signature token',
          code: 'INVALID_TOKEN'
        });
      }
      
      if (error.message === 'Signature request expired') {
        return res.status(410).json({
          error: 'Signature request expired',
          code: 'REQUEST_EXPIRED'
        });
      }
      
      next(error);
    }
  }

  /**
   * Get contract statistics
   */
  async getStatistics(req, res, next) {
    try {
      const userId = req.user._id;
      const { startDate, endDate } = req.query;

      const stats = await Contract.aggregate([
        {
          $match: {
            $or: [
              { owner: userId },
              { 'collaborators.user': userId }
            ],
            deletedAt: null,
            ...(startDate || endDate ? {
              createdAt: {
                ...(startDate ? { $gte: new Date(startDate) } : {}),
                ...(endDate ? { $lte: new Date(endDate) } : {})
              }
            } : {})
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            byStatus: {
              $push: '$status'
            },
            byType: {
              $push: '$type'
            },
            totalValue: {
              $sum: { $ifNull: ['$value', 0] }
            }
          }
        },
        {
          $project: {
            _id: 0,
            total: 1,
            totalValue: 1,
            statusCounts: {
              $arrayToObject: {
                $map: {
                  input: { $setUnion: ['$byStatus', []] },
                  as: 'status',
                  in: {
                    k: '$$status',
                    v: {
                      $size: {
                        $filter: {
                          input: '$byStatus',
                          cond: { $eq: ['$$this', '$$status'] }
                        }
                      }
                    }
                  }
                }
              }
            },
            typeCounts: {
              $arrayToObject: {
                $map: {
                  input: { $setUnion: ['$byType', []] },
                  as: 'type',
                  in: {
                    k: '$$type',
                    v: {
                      $size: {
                        $filter: {
                          input: '$byType',
                          cond: { $eq: ['$$this', '$$type'] }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      ]);

      res.json({
        success: true,
        data: stats[0] || {
          total: 0,
          totalValue: 0,
          statusCounts: {},
          typeCounts: {}
        }
      });
    } catch (error) {
      logger.error('Get statistics error:', error);
      next(error);
    }
  }
}

module.exports = new ContractController();