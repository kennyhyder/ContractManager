const express = require('express');
const router = express.Router();
const { Template, Activity, Contract } = require('../models');
const { authMiddleware } = require('../middleware/auth');
const { validateTemplate } = require('../middleware/validation');
const logger = require('../utils/logger');

/**
 * @route   GET /api/templates
 * @desc    Get all templates
 * @access  Private
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      type,
      industry,
      search,
      visibility = 'all',
      sortBy = 'usage.popularityScore',
      order = 'desc'
    } = req.query;

    // Build query
    const query = {
      deletedAt: null,
      status: 'published'
    };

    // Visibility filter
    if (visibility === 'mine') {
      query.owner = req.user._id;
    } else if (visibility === 'organization') {
      query.organization = req.user.organization;
      query.visibility = { $in: ['organization', 'public', 'marketplace'] };
    } else if (visibility === 'public') {
      query.visibility = { $in: ['public', 'marketplace'] };
    } else if (visibility === 'marketplace') {
      query['marketplace.listed'] = true;
      query['marketplace.approved'] = true;
    }

    if (category) query.category = category;
    if (type) query.type = type;
    if (industry) query.industry = { $in: Array.isArray(industry) ? industry : [industry] };

    if (search) {
      query.$text = { $search: search };
    }

    // Execute query
    const templates = await Template
      .find(query)
      .populate('owner', 'firstName lastName avatar')
      .sort({ [sortBy]: order === 'desc' ? -1 : 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Template.countDocuments(query);

    res.json({
      success: true,
      data: {
        templates,
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          page: parseInt(page),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get templates error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch templates' 
    });
  }
});

/**
 * @route   GET /api/templates/:id
 * @desc    Get single template
 * @access  Private
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const template = await Template
      .findById(req.params.id)
      .populate('owner', 'firstName lastName email avatar')
      .populate('basedOn', 'name')
      .populate('relatedTemplates.template', 'name category');

    if (!template || template.deletedAt) {
      return res.status(404).json({ 
        success: false,
        message: 'Template not found' 
      });
    }

    // Check access
    if (!template.canBeUsedBy(req.user._id)) {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied' 
      });
    }

    res.json({
      success: true,
      data: { template }
    });
  } catch (error) {
    logger.error('Get template error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch template' 
    });
  }
});

/**
 * @route   POST /api/templates
 * @desc    Create new template
 * @access  Private
 */
router.post('/', authMiddleware, validateTemplate.create, async (req, res) => {
  try {
    const template = new Template({
      ...req.body,
      owner: req.user._id,
      organization: req.user.organization
    });

    await template.save();

    // Log activity
    await Activity.track({
      user: req.user._id,
      action: 'template.created',
      resource: { type: 'template', id: template._id, name: template.name },
      details: {
        category: template.category,
        visibility: template.visibility
      }
    });

    res.status(201).json({
      success: true,
      message: 'Template created successfully',
      data: { template }
    });
  } catch (error) {
    logger.error('Create template error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to create template' 
    });
  }
});

/**
 * @route   PUT /api/templates/:id
 * @desc    Update template
 * @access  Private
 */
router.put('/:id', authMiddleware, validateTemplate.update, async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);

    if (!template || template.deletedAt) {
      return res.status(404).json({ 
        success: false,
        message: 'Template not found' 
      });
    }

    // Check ownership
    if (!template.owner.equals(req.user._id)) {
      return res.status(403).json({ 
        success: false,
        message: 'Only template owner can update' 
      });
    }

    // Handle version update if content or variables changed
    if (req.body.content || req.body.variables) {
      await template.addVersion(
        req.body.content || template.content,
        req.body.variables || template.variables,
        req.body.changeLog || 'Updated template',
        req.user._id
      );
    } else {
      // Update other fields
      const allowedUpdates = [
        'name', 'description', 'category', 'subcategory', 'type',
        'industry', 'jurisdiction', 'language', 'visibility',
        'sections', 'tags', 'metadata'
      ];

      allowedUpdates.forEach(field => {
        if (req.body[field] !== undefined) {
          template[field] = req.body[field];
        }
      });

      await template.save();
    }

    // Log activity
    await Activity.track({
      user: req.user._id,
      action: 'template.updated',
      resource: { type: 'template', id: template._id, name: template.name },
      details: {
        updatedFields: Object.keys(req.body)
      }
    });

    res.json({
      success: true,
      message: 'Template updated successfully',
      data: { template }
    });
  } catch (error) {
    logger.error('Update template error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update template' 
    });
  }
});

/**
 * @route   DELETE /api/templates/:id
 * @desc    Delete template
 * @access  Private
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);

    if (!template || template.deletedAt) {
      return res.status(404).json({ 
        success: false,
        message: 'Template not found' 
      });
    }

    // Check ownership
    if (!template.owner.equals(req.user._id)) {
      return res.status(403).json({ 
        success: false,
        message: 'Only template owner can delete' 
      });
    }

    // Soft delete
    template.deletedAt = new Date();
    template.deletedBy = req.user._id;
    template.status = 'archived';
    await template.save();

    // Log activity
    await Activity.track({
      user: req.user._id,
      action: 'template.deleted',
      resource: { type: 'template', id: template._id, name: template.name }
    });

    res.json({
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (error) {
    logger.error('Delete template error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to delete template' 
    });
  }
});

/**
 * @route   POST /api/templates/:id/use
 * @desc    Use template to create contract
 * @access  Private
 */
router.post('/:id/use', authMiddleware, validateTemplate.use, async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);

    if (!template || template.deletedAt) {
      return res.status(404).json({ 
        success: false,
        message: 'Template not found' 
      });
    }

    // Check access
    if (!template.canBeUsedBy(req.user._id)) {
      return res.status(403).json({ 
        success: false,
        message: 'You do not have permission to use this template' 
      });
    }

    // Apply variables to content
    let content = template.content;
    const variables = req.body.variables || {};

    // Replace variables in content
    template.variables.forEach(variable => {
      const value = variables[variable.key] || variable.defaultValue || '';
      const regex = new RegExp(`{{${variable.key}}}`, 'g');
      content = content.replace(regex, value);
    });

    // Create contract from template
    const contractData = {
      title: req.body.title || `Contract from ${template.name}`,
      content: content,
      type: template.type,
      category: template.category,
      owner: req.user._id,
      template: {
        id: template._id,
        version: template.versionString,
        variables: variables
      },
      status: 'draft',
      metadata: {
        source: 'template',
        templateId: template._id
      }
    };

    const contract = new Contract(contractData);
    await contract.save();

    // Record template usage
    await template.recordUsage(req.user._id, contract._id);

    // Log activity
    await Activity.track({
      user: req.user._id,
      action: 'template.used',
      resource: { type: 'template', id: template._id, name: template.name },
      details: {
        contractId: contract._id
      }
    });

    res.json({
      success: true,
      message: 'Contract created from template',
      data: {
        contractId: contract._id,
        contract: contract
      }
    });
  } catch (error) {
    logger.error('Use template error:', error);
    res.status(500).json({