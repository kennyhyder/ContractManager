const TemplateService = require('../services/TemplateService');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

class TemplateController {
  /**
   * Get templates list
   */
  async getTemplates(req, res, next) {
    try {
      const {
        page = 1,
        limit = 20,
        category,
        search,
        publicOnly = false
      } = req.query;

      const userId = req.user._id;

      const templates = await TemplateService.listTemplates({
        page: parseInt(page),
        limit: parseInt(limit),
        category,
        search,
        userId: publicOnly === 'true' ? null : userId,
        publicOnly: publicOnly === 'true'
      });

      res.json({
        success: true,
        data: templates
      });
    } catch (error) {
      logger.error('Get templates error:', error);
      next(error);
    }
  }

  /**
   * Get single template
   */
  async getTemplate(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user._id;

      const template = await TemplateService.getTemplate(id, userId);

      res.json({
        success: true,
        data: template
      });
    } catch (error) {
      logger.error('Get template error:', error);
      
      if (error.message === 'Template not found') {
        return res.status(404).json({
          error: 'Template not found',
          code: 'TEMPLATE_NOT_FOUND'
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
   * Create template
   */
  async createTemplate(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          errors: errors.array()
        });
      }

      const userId = req.user._id;
      const templateData = req.body;

      const template = await TemplateService.createTemplate(templateData, userId);

      res.status(201).json({
        success: true,
        message: 'Template created successfully',
        data: template
      });
    } catch (error) {
      logger.error('Create template error:', error);
      next(error);
    }
  }

  /**
   * Update template
   */
  async updateTemplate(req, res, next) {
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

      const template = await TemplateService.updateTemplate(id, updates, userId);

      res.json({
        success: true,
        message: 'Template updated successfully',
        data: template
      });
    } catch (error) {
      logger.error('Update template error:', error);
      
      if (error.message === 'Template not found') {
        return res.status(404).json({
          error: 'Template not found',
          code: 'TEMPLATE_NOT_FOUND'
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
   * Delete template
   */
  async deleteTemplate(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user._id;

      await TemplateService.deleteTemplate(id, userId);

      res.json({
        success: true,
        message: 'Template deleted successfully'
      });
    } catch (error) {
      logger.error('Delete template error:', error);
      
      if (error.message === 'Template not found') {
        return res.status(404).json({
          error: 'Template not found',
          code: 'TEMPLATE_NOT_FOUND'
        });
      }
      
      if (error.message.includes('in use')) {
        return res.status(409).json({
          error: error.message,
          code: 'TEMPLATE_IN_USE'
        });
      }
      
      next(error);
    }
  }

  /**
   * Clone template
   */
  async cloneTemplate(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user._id;

      const cloned = await TemplateService.cloneTemplate(id, userId);

      res.json({
        success: true,
        message: 'Template cloned successfully',
        data: cloned
      });
    } catch (error) {
      logger.error('Clone template error:', error);
      next(error);
    }
  }

  /**
   * Get template categories
   */
  async getCategories(req, res, next) {
    try {
      const categories = await TemplateService.getCategories();

      res.json({
        success: true,
        data: categories
      });
    } catch (error) {
      logger.error('Get categories error:', error);
      next(error);
    }
  }

  /**
   * Preview template
   */
  async previewTemplate(req, res, next) {
    try {
      const { id } = req.params;
      const { variables = {} } = req.body;
      const userId = req.user._id;

      const template = await TemplateService.getTemplate(id, userId);
      
      // Merge variables into content
      let preview = template.content;
      Object.keys(variables).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        preview = preview.replace(regex, variables[key] || `{{${key}}}`);
      });

      res.json({
        success: true,
        data: {
          preview,
          variables: template.variables,
          providedVariables: variables
        }
      });
    } catch (error) {
      logger.error('Preview template error:', error);
      next(error);
    }
  }

  /**
   * Publish template
   */
  async publishTemplate(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user._id;

      const template = await Template.findById(id);
      
      if (!template) {
        return res.status(404).json({
          error: 'Template not found',
          code: 'TEMPLATE_NOT_FOUND'
        });
      }

      if (template.createdBy.toString() !== userId) {
        return res.status(403).json({
          error: 'Only template owner can publish',
          code: 'NOT_OWNER'
        });
      }

      template.isPublic = true;
      template.publishedAt = new Date();
      await template.save();

      res.json({
        success: true,
        message: 'Template published successfully',
        data: template
      });
    } catch (error) {
      logger.error('Publish template error:', error);
      next(error);
    }
  }

  /**
   * Unpublish template
   */
  async unpublishTemplate(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user._id;

      const template = await Template.findById(id);
      
      if (!template) {
        return res.status(404).json({
          error: 'Template not found',
          code: 'TEMPLATE_NOT_FOUND'
        });
      }

      if (template.createdBy.toString() !== userId) {
        return res.status(403).json({
          error: 'Only template owner can unpublish',
          code: 'NOT_OWNER'
        });
      }

      template.isPublic = false;
      template.publishedAt = null;
      await template.save();

      res.json({
        success: true,
        message: 'Template unpublished successfully',
        data: template
      });
    } catch (error) {
      logger.error('Unpublish template error:', error);
      next(error);
    }
  }

  /**
   * Get popular templates
   */
  async getPopularTemplates(req, res, next) {
    try {
      const { limit = 10 } = req.query;

      const templates = await Template
        .find({ isPublic: true })
        .sort({ usageCount: -1 })
        .limit(parseInt(limit))
        .populate('createdBy', 'firstName lastName')
        .lean();

      res.json({
        success: true,
        data: templates
      });
    } catch (error) {
      logger.error('Get popular templates error:', error);
      next(error);
    }
  }
}

module.exports = new TemplateController();