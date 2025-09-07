const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { User, Activity } = require('../models');
const { authMiddleware } = require('../middleware/auth');
const { validateAuth } = require('../middleware/validation');
const EmailService = require('../services/EmailService');
const logger = require('../utils/logger');

/**
 * @route   POST /api/auth/register
 * @desc    Register new user
 * @access  Public
 */
router.post('/register', validateAuth.register, async (req, res) => {
  try {
    const { email, password, firstName, lastName, company } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        message: 'User already exists' 
      });
    }

    // Create user
    const user = new User({
      email,
      password,
      firstName,
      lastName,
      company
    });

    // Generate email verification token
    const verificationToken = user.createEmailVerificationToken();
    await user.save();

    // Send verification email
    await EmailService.sendEmail({
      to: email,
      template: 'email-verification',
      data: {
        firstName,
        verificationUrl: `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`
      }
    });

    // Generate tokens
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const refreshToken = jwt.sign(
      { userId: user._id, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '30d' }
    );

    // Create session
    user.createSession(refreshToken, req.ip, req.get('user-agent'));
    await user.save();

    // Log activity
    await Activity.track({
      user: user._id,
      action: 'user.registered',
      resource: { type: 'user', id: user._id },
      metadata: {
        ip: req.ip,
        userAgent: req.get('user-agent')
      }
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email to verify your account.',
      data: {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName
        },
        tokens: {
          access: token,
          refresh: refreshToken
        }
      }
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to use template' 
    });
  }
});

/**
 * @route   POST /api/templates/:id/clone
 * @desc    Clone template
 * @access  Private
 */
router.post('/:id/clone', authMiddleware, async (req, res) => {
  try {
    const originalTemplate = await Template.findById(req.params.id);

    if (!originalTemplate || originalTemplate.deletedAt) {
      return res.status(404).json({ 
        success: false,
        message: 'Template not found' 
      });
    }

    // Check access
    if (!originalTemplate.canBeUsedBy(req.user._id)) {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied' 
      });
    }

    // Create clone
    const clonedData = originalTemplate.toObject();
    delete clonedData._id;
    delete clonedData.createdAt;
    delete clonedData.updatedAt;

    const template = new Template({
      ...clonedData,
      name: req.body.name || `${originalTemplate.name} (Copy)`,
      owner: req.user._id,
      organization: req.user.organization,
      visibility: 'private',
      status: 'draft',
      basedOn: originalTemplate._id,
      marketplace: {
        listed: false,
        approved: false
      },
      usage: {
        count: 0,
        popularityScore: 0
      },
      versionHistory: [],
      reviews: []
    });

    await template.save();

    // Log activity
    await Activity.track({
      user: req.user._id,
      action: 'template.cloned',
      resource: { type: 'template', id: template._id, name: template.name },
      details: {
        originalTemplateId: originalTemplate._id
      }
    });

    res.json({
      success: true,
      message: 'Template cloned successfully',
      data: { template }
    });
  } catch (error) {
    logger.error('Clone template error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to clone template' 
    });
  }
});

/**
 * @route   POST /api/templates/:id/publish
 * @desc    Publish template to marketplace
 * @access  Private
 */
router.post('/:id/publish', authMiddleware, validateTemplate.publish, async (req, res) => {
  try {
    const { pricing, tags, seo } = req.body;

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
        message: 'Only template owner can publish' 
      });
    }

    // Check quality score
    if (template.qualityScore < 80) {
      return res.status(400).json({ 
        success: false,
        message: 'Template quality score must be at least 80% to publish' 
      });
    }

    // Publish to marketplace
    await template.publishToMarketplace(pricing, tags);
    
    if (seo) {
      template.marketplace.seo = seo;
      await template.save();
    }

    // Log activity
    await Activity.track({
      user: req.user._id,
      action: 'template.published',
      resource: { type: 'template', id: template._id, name: template.name },
      details: {
        pricing: pricing.model,
        amount: pricing.amount
      }
    });

    res.json({
      success: true,
      message: 'Template published to marketplace',
      data: { template }
    });
  } catch (error) {
    logger.error('Publish template error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to publish template' 
    });
  }
});

/**
 * @route   POST /api/templates/:id/review
 * @desc    Add review to template
 * @access  Private
 */
router.post('/:id/review', authMiddleware, validateTemplate.review, async (req, res) => {
  try {
    const { rating, comment } = req.body;

    const template = await Template.findById(req.params.id);

    if (!template || template.deletedAt) {
      return res.status(404).json({ 
        success: false,
        message: 'Template not found' 
      });
    }

    // Check if template is in marketplace
    if (!template.isMarketplaceListed) {
      return res.status(400).json({ 
        success: false,
        message: 'Can only review marketplace templates' 
      });
    }

    // Check if user has used the template
    const hasUsed = template.usage.usedBy.some(
      usage => usage.user.equals(req.user._id)
    );

    if (!hasUsed) {
      return res.status(403).json({ 
        success: false,
        message: 'You must use the template before reviewing' 
      });
    }

    // Add review
    await template.addReview(req.user._id, rating, comment);

    // Log activity
    await Activity.track({
      user: req.user._id,
      action: 'template.reviewed',
      resource: { type: 'template', id: template._id, name: template.name },
      details: { rating }
    });

    res.json({
      success: true,
      message: 'Review added successfully',
      data: { template }
    });
  } catch (error) {
    logger.error('Add review error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to add review' 
    });
  }
});

/**
 * @route   GET /api/templates/marketplace
 * @desc    Search marketplace templates
 * @access  Private
 */
router.get('/marketplace', authMiddleware, async (req, res) => {
  try {
    const {
      search,
      category,
      industry,
      priceMin,
      priceMax,
      rating,
      sortBy = 'usage.popularityScore',
      page = 1,
      limit = 20
    } = req.query;

    // Build filters
    const filters = {};
    
    if (category) filters.category = category;
    if (industry) filters.industry = Array.isArray(industry) ? industry : [industry];
    if (priceMin || priceMax) {
      filters.priceRange = {};
      if (priceMin) filters.priceRange.min = parseFloat(priceMin);
      if (priceMax) filters.priceRange.max = parseFloat(priceMax);
    }
    if (rating) filters.rating = parseFloat(rating);

    // Search marketplace
    let templates;
    if (search) {
      templates = await Template.searchMarketplace(search, filters);
    } else {
      const query = {
        'marketplace.listed': true,
        'marketplace.approved': true,
        status: 'published',
        deletedAt: null,
        ...filters
      };

      templates = await Template
        .find(query)
        .populate('owner', 'firstName lastName avatar')
        .sort({ [sortBy]: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);
    }

    const total = await Template.countDocuments({
      'marketplace.listed': true,
      'marketplace.approved': true,
      status: 'published',
      deletedAt: null
    });

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
    logger.error('Search marketplace error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to search marketplace' 
    });
  }
});

module.exports = router;