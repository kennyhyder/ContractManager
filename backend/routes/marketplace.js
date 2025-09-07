const express = require('express');
const router = express.Router();
const { Template, User, Contract } = require('../models');
const { authMiddleware } = require('../middleware/auth');
const { validateTemplate } = require('../middleware/validation');
const { uploadMiddleware } = require('../middleware/upload');
const { cacheMiddleware } = require('../middleware/cache');
const logger = require('../utils/logger');

/**
 * @route   GET /api/marketplace
 * @desc    Browse marketplace templates
 * @access  Public
 */
router.get('/', cacheMiddleware(300), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      search,
      sortBy = 'popular',
      minRating,
      maxPrice,
      tags
    } = req.query;

    // Build query
    const query = {
      isPublic: true,
      isActive: true,
      status: 'approved'
    };

    if (category && category !== 'all') {
      query.category = category;
    }

    if (search) {
      query.$text = { $search: search };
    }

    if (minRating) {
      query.rating = { $gte: parseFloat(minRating) };
    }

    if (maxPrice !== undefined) {
      query.price = { $lte: parseFloat(maxPrice) };
    }

    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : tags.split(',');
      query.tags = { $in: tagArray };
    }

    // Sorting options
    let sort = {};
    switch (sortBy) {
      case 'popular':
        sort = { usageCount: -1, rating: -1 };
        break;
      case 'newest':
        sort = { publishedAt: -1 };
        break;
      case 'rating':
        sort = { rating: -1, reviewCount: -1 };
        break;
      case 'price-low':
        sort = { price: 1 };
        break;
      case 'price-high':
        sort = { price: -1 };
        break;
      default:
        sort = { featured: -1, usageCount: -1 };
    }

    // Execute query with pagination
    const templates = await Template
      .find(query)
      .populate('owner', 'name email profilePicture isVerified')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Template.countDocuments(query);

    // Get usage statistics
    const templateIds = templates.map(t => t._id);
    const usageStats = await Contract.aggregate([
      { $match: { template: { $in: templateIds } } },
      { $group: { _id: '$template', count: { $sum: 1 } } }
    ]);

    const usageMap = usageStats.reduce((acc, stat) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {});

    // Enhance templates with usage data
    const enhancedTemplates = templates.map(template => ({
      ...template,
      usageCount: usageMap[template._id] || 0,
      isFree: template.price === 0,
      isPremium: template.price > 0
    }));

    res.json({
      success: true,
      data: {
        templates: enhancedTemplates,
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          current: page,
          perPage: limit
        }
      }
    });
  } catch (error) {
    logger.error('Marketplace browse error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch marketplace templates'
    });
  }
});

/**
 * @route   GET /api/marketplace/categories
 * @desc    Get marketplace categories with counts
 * @access  Public
 */
router.get('/categories', cacheMiddleware(3600), async (req, res) => {
  try {
    const categories = await Template.aggregate([
      { $match: { isPublic: true, isActive: true, status: 'approved' } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          avgRating: { $avg: '$rating' },
          avgPrice: { $avg: '$price' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const categoryInfo = categories.map(cat => ({
      name: cat._id,
      count: cat.count,
      avgRating: cat.avgRating?.toFixed(1) || 0,
      avgPrice: cat.avgPrice?.toFixed(2) || 0,
      icon: getCategoryIcon(cat._id)
    }));

    res.json({
      success: true,
      data: { categories: categoryInfo }
    });
  } catch (error) {
    logger.error('Categories fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories'
    });
  }
});

/**
 * @route   GET /api/marketplace/featured
 * @desc    Get featured templates
 * @access  Public
 */
router.get('/featured', cacheMiddleware(600), async (req, res) => {
  try {
    const featured = await Template
      .find({
        isPublic: true,
        isActive: true,
        status: 'approved',
        featured: true
      })
      .populate('owner', 'name email profilePicture isVerified')
      .sort({ featuredOrder: 1, rating: -1 })
      .limit(8)
      .lean();

    res.json({
      success: true,
      data: { templates: featured }
    });
  } catch (error) {
    logger.error('Featured templates error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch featured templates'
    });
  }
});

/**
 * @route   GET /api/marketplace/template/:id
 * @desc    Get marketplace template details
 * @access  Public
 */
router.get('/template/:id', async (req, res) => {
  try {
    const template = await Template
      .findOne({
        _id: req.params.id,
        isPublic: true,
        isActive: true,
        status: 'approved'
      })
      .populate('owner', 'name email profilePicture bio isVerified')
      .populate({
        path: 'reviews.user',
        select: 'name profilePicture'
      });

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found in marketplace'
      });
    }

    // Increment view count
    template.viewCount = (template.viewCount || 0) + 1;
    await template.save();

    // Get related templates
    const related = await Template
      .find({
        _id: { $ne: template._id },
        category: template.category,
        isPublic: true,
        isActive: true,
        status: 'approved'
      })
      .select('name description price rating reviewCount previewImage')
      .limit(4)
      .sort({ rating: -1 });

    res.json({
      success: true,
      data: {
        template,
        related
      }
    });
  } catch (error) {
    logger.error('Template detail error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch template details'
    });
  }
});

/**
 * @route   POST /api/marketplace/template/:id/purchase
 * @desc    Purchase a marketplace template
 * @access  Private
 */
router.post('/template/:id/purchase', authMiddleware, async (req, res) => {
  try {
    const template = await Template.findOne({
      _id: req.params.id,
      isPublic: true,
      isActive: true,
      status: 'approved'
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    // Check if already purchased
    const user = await User.findById(req.user._id);
    if (user.purchasedTemplates?.includes(template._id)) {
      return res.status(400).json({
        success: false,
        message: 'Template already purchased'
      });
    }

    // Process payment (integrate with payment service)
    if (template.price > 0) {
      // TODO: Implement payment processing
      // const payment = await PaymentService.processPayment({
      //   amount: template.price,
      //   userId: req.user._id,
      //   templateId: template._id
      // });
    }

    // Add to purchased templates
    user.purchasedTemplates = user.purchasedTemplates || [];
    user.purchasedTemplates.push(template._id);
    await user.save();

    // Update template statistics
    template.purchaseCount = (template.purchaseCount || 0) + 1;
    await template.save();

    // Create transaction record
    const transaction = {
      user: req.user._id,
      template: template._id,
      amount: template.price,
      currency: template.currency || 'USD',
      status: 'completed',
      purchasedAt: new Date()
    };

    res.json({
      success: true,
      message: 'Template purchased successfully',
      data: { transaction }
    });
  } catch (error) {
    logger.error('Template purchase error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to purchase template'
    });
  }
});

/**
 * @route   POST /api/marketplace/template/:id/review
 * @desc    Add review to template
 * @access  Private
 */
router.post('/template/:id/review', authMiddleware, async (req, res) => {
  try {
    const { rating, comment } = req.body;

    const template = await Template.findById(req.params.id);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    // Check if user has used/purchased the template
    const hasAccess = await Contract.exists({
      template: template._id,
      $or: [
        { owner: req.user._id },
        { 'collaborators.user': req.user._id }
      ]
    }) || req.user.purchasedTemplates?.includes(template._id);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You must use this template before reviewing'
      });
    }

    // Check if already reviewed
    const existingReview = template.reviews.find(
      r => r.user.toString() === req.user._id.toString()
    );

    if (existingReview) {
      // Update existing review
      existingReview.rating = rating;
      existingReview.comment = comment;
      existingReview.updatedAt = new Date();
    } else {
      // Add new review
      template.reviews.push({
        user: req.user._id,
        rating,
        comment,
        createdAt: new Date()
      });
    }

    // Update average rating
    const totalRating = template.reviews.reduce((sum, r) => sum + r.rating, 0);
    template.rating = totalRating / template.reviews.length;
    template.reviewCount = template.reviews.length;

    await template.save();

    res.json({
      success: true,
      message: 'Review added successfully',
      data: {
        rating: template.rating,
        reviewCount: template.reviewCount
      }
    });
  } catch (error) {
    logger.error('Review submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit review'
    });
  }
});

/**
 * @route   POST /api/marketplace/publish
 * @desc    Publish template to marketplace
 * @access  Private
 */
router.post('/publish', authMiddleware, validateTemplate.publish, async (req, res) => {
  try {
    const {
      templateId,
      price = 0,
      currency = 'USD',
      marketplaceDescription,
      marketplaceTags,
      previewImages
    } = req.body;

    const template = await Template.findOne({
      _id: templateId,
      owner: req.user._id
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found or unauthorized'
      });
    }

    // Update marketplace fields
    template.isPublic = true;
    template.status = 'pending'; // Requires admin approval
    template.price = price;
    template.currency = currency;
    template.marketplaceDescription = marketplaceDescription || template.description;
    template.marketplaceTags = marketplaceTags || template.tags;
    template.previewImages = previewImages;
    template.publishedAt = new Date();
    template.publishedBy = req.user._id;

    await template.save();

    // Notify admins for review
    // TODO: Send notification to admins

    res.json({
      success: true,
      message: 'Template submitted for marketplace review',
      data: { template }
    });
  } catch (error) {
    logger.error('Template publish error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish template'
    });
  }
});

/**
 * @route   GET /api/marketplace/seller/:userId
 * @desc    Get seller profile and templates
 * @access  Public
 */
router.get('/seller/:userId', async (req, res) => {
  try {
    const seller = await User
      .findById(req.params.userId)
      .select('name email profilePicture bio isVerified createdAt');

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found'
      });
    }

    const templates = await Template
      .find({
        owner: seller._id,
        isPublic: true,
        isActive: true,
        status: 'approved'
      })
      .select('name description category price rating reviewCount previewImage')
      .sort({ rating: -1 });

    const stats = await Template.aggregate([
      {
        $match: {
          owner: seller._id,
          isPublic: true,
          isActive: true,
          status: 'approved'
        }
      },
      {
        $group: {
          _id: null,
          totalTemplates: { $sum: 1 },
          totalSales: { $sum: '$purchaseCount' },
          avgRating: { $avg: '$rating' },
          totalReviews: { $sum: '$reviewCount' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        seller,
        templates,
        stats: stats[0] || {
          totalTemplates: 0,
          totalSales: 0,
          avgRating: 0,
          totalReviews: 0
        }
      }
    });
  } catch (error) {
    logger.error('Seller profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch seller profile'
    });
  }
});

// Helper function to get category icons
function getCategoryIcon(category) {
  const icons = {
    legal: 'scale',
    business: 'briefcase',
    sales: 'trending-up',
    hr: 'users',
    finance: 'dollar-sign',
    technology: 'cpu',
    healthcare: 'heart',
    education: 'book-open',
    'real-estate': 'home',
    custom: 'file-text'
  };
  return icons[category] || 'file';
}

module.exports = router;