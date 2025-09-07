const { Template, Contract } = require('../models');
const ActivityService = require('./ActivityService');
const { redis } = require('../middleware/cache');
const logger = require('../utils/logger');

class TemplateService {
  /**
   * Create template
   */
  async createTemplate(data, userId) {
    try {
      // Extract variables from content
      const variables = this.extractVariables(data.content);

      const template = new Template({
        ...data,
        createdBy: userId,
        variables,
        isPublic: data.isPublic || false
      });

      await template.save();

      // Log activity
      await ActivityService.logActivity({
        user: userId,
        action: 'template.created',
        resource: { type: 'template', id: template._id },
        details: { name: template.name }
      });

      return template;
    } catch (error) {
      logger.error('Create template error:', error);
      throw error;
    }
  }

  /**
   * Update template
   */
  async updateTemplate(templateId, updates, userId) {
    try {
      const template = await Template.findById(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      // Check permissions
      if (template.createdBy.toString() !== userId && !template.isPublic) {
        throw new Error('Insufficient permissions');
      }

      // Extract variables if content updated
      if (updates.content) {
        updates.variables = this.extractVariables(updates.content);
      }

      Object.assign(template, updates);
      await template.save();

      // Clear cache
      await this.clearTemplateCache(templateId);

      // Log activity
      await ActivityService.logActivity({
        user: userId,
        action: 'template.updated',
        resource: { type: 'template', id: templateId },
        details: { name: template.name }
      });

      return template;
    } catch (error) {
      logger.error('Update template error:', error);
      throw error;
    }
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateId, userId) {
    try {
      const template = await Template.findById(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      // Check permissions
      if (template.createdBy.toString() !== userId) {
        throw new Error('Insufficient permissions');
      }

      // Check if template is in use
      const contractCount = await Contract.countDocuments({ template: templateId });
      if (contractCount > 0) {
        throw new Error(`Template is used in ${contractCount} contracts`);
      }

      await template.remove();

      // Clear cache
      await this.clearTemplateCache(templateId);

      // Log activity
      await ActivityService.logActivity({
        user: userId,
        action: 'template.deleted',
        resource: { type: 'template', id: templateId },
        details: { name: template.name }
      });

      return { success: true };
    } catch (error) {
      logger.error('Delete template error:', error);
      throw error;
    }
  }

  /**
   * Get template
   */
  async getTemplate(templateId, userId) {
    try {
      // Check cache
      const cacheKey = `template:${templateId}`;
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const template = await Template.findById(templateId)
        .populate('createdBy', 'firstName lastName email');

      if (!template) {
        throw new Error('Template not found');
      }

      // Check permissions
      if (!template.isPublic && template.createdBy._id.toString() !== userId) {
        throw new Error('Access denied');
      }

      // Track usage
      template.usageCount++;
      await template.save();

      const result = template.toObject();

      // Cache for 1 hour
      await redis.setex(cacheKey, 3600, JSON.stringify(result));

      return result;
    } catch (error) {
      logger.error('Get template error:', error);
      throw error;
    }
  }

  /**
   * List templates
   */
  async listTemplates(options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        category,
        search,
        userId,
        publicOnly = false
      } = options;

      const query = {};

      if (publicOnly) {
        query.isPublic = true;
      } else if (userId) {
        query.$or = [
          { createdBy: userId },
          { isPublic: true }
        ];
      }

      if (category) {
        query.category = category;
      }

      if (search) {
        query.$text = { $search: search };
      }

      const templates = await Template
        .find(query)
        .populate('createdBy', 'firstName lastName')
        .sort({ usageCount: -1, createdAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit)
        .lean();

      const total = await Template.countDocuments(query);

      return {
        templates,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('List templates error:', error);
      throw error;
    }
  }

  /**
   * Clone template
   */
  async cloneTemplate(templateId, userId) {
    try {
      const originalTemplate = await this.getTemplate(templateId, userId);
      
      const clonedData = {
        ...originalTemplate,
        name: `${originalTemplate.name} (Copy)`,
        createdBy: userId,
        isPublic: false,
        usageCount: 0
      };

      delete clonedData._id;
      delete clonedData.createdAt;
      delete clonedData.updatedAt;

      return await this.createTemplate(clonedData, userId);
    } catch (error) {
      logger.error('Clone template error:', error);
      throw error;
    }
  }

  /**
   * Get template categories
   */
  async getCategories() {
    try {
      const cacheKey = 'template:categories';
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const categories = await Template.aggregate([
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        }
      ]);

      const result = categories.map(cat => ({
        name: cat._id,
        count: cat.count
      }));

      // Cache for 1 hour
      await redis.setex(cacheKey, 3600, JSON.stringify(result));

      return result;
    } catch (error) {
      logger.error('Get categories error:', error);
      throw error;
    }
  }

  /**
   * Helper methods
   */

  extractVariables(content) {
    const regex = /{{(\w+)}}/g;
    const variables = [];
    let match;

    while ((match = regex.exec(content)) !== null) {
      const varName = match[1];
      if (!variables.some(v => v.name === varName)) {
        variables.push({
          name: varName,
          label: this.formatLabel(varName),
          type: this.inferType(varName),
          required: true
        });
      }
    }

    return variables;
  }

  formatLabel(varName) {
    return varName
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  inferType(varName) {
    const lowerName = varName.toLowerCase();
    if (lowerName.includes('date')) return 'date';
    if (lowerName.includes('amount') || lowerName.includes('price')) return 'number';
    if (lowerName.includes('email')) return 'email';
    if (lowerName.includes('phone')) return 'phone';
    return 'text';
  }

  async clearTemplateCache(templateId) {
    await redis.del(`template:${templateId}`);
    await redis.del('template:categories');
  }
}

module.exports = new TemplateService();