const { Template, User } = require('../models');
const TemplateService = require('../services/TemplateService');
const PaymentService = require('../services/PaymentService');
const ActivityService = require('../services/ActivityService');
const logger = require('../utils/logger');
class MarketplaceController {
  /**
   * Get marketplace templates
   */
  async getMarketplaceTemplates(req, res, next) {
    try {
      const {
        page = 1,
        limit = 20,
        category,
        search,
        sortBy = 'popular',
        priceRange
      } = req.query;

      const query = {
        isPublic: true,
        marketplaceListed: true
      };

      if (category) {
        query.category = category;
      }

      if (search) {
        query.$text = { $search: search };
      }

      if (priceRange) {
        const [min, max] = priceRange.split('-').map(Number);
        query.marketplacePrice = { $gte: min, $lte: max };
      }

      // Determine sort options
      let sort = {};
      switch (sortBy) {
        case 'popular':
          sort = { purchaseCount: -1, rating: -1 };
          break;
        case 'newest':
          sort = { publishedAt: -1 };
          break;
        case 'price-low':
          sort = { marketplacePrice: 1 };
          break;
        case 'price-high':
          sort = { marketplacePrice: -1 };
          break;
        case 'rating':
          sort = { rating: -1, ratingCount: -1 };
          break;
        default:
          sort = { purchaseCount: -1 };
      }

      const templates = await Template
        .find(query)
        .populate('createdBy', 'firstName lastName avatar')
        .sort(sort)
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit))
        .lean();

      const total = await Template.countDocuments(query);

      // Add user purchase status
      const userId = req.user?._id;
      if (userId) {
        const user = await User.findById(userId).select('purchasedTemplates');
        templates.forEach(template => {
          template.isPurchased = user.purchasedTemplates?.includes(template._id);
        });
      }

      res.json({
        success: true,
        data: {
          templates,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
          }
        }
      });
    } catch (error) {
      logger.error('Get marketplace templates error:', error);
      next(error);
    }
  }

  /**
   * Get marketplace template details
   */
  async getMarketplaceTemplate(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user?._id;

      const template = await Template.findById(id)
        .populate('createdBy', 'firstName lastName avatar bio')
        .populate({
          path: 'reviews',
          populate: { path: 'user', select: 'firstName lastName avatar' },
          options: { limit: 5, sort: { createdAt: -1 } }
        })
        .lean();

      if (!template || !template.marketplaceListed) {
        return res.status(404).json({
          error: 'Template not found',
          code: 'TEMPLATE_NOT_FOUND'
        });
      }

      // Check if user has purchased
      if (userId) {
        const user = await User.findById(userId).select('purchasedTemplates');
        template.isPurchased = user.purchasedTemplates?.includes(template._id);
      }

      // Get related templates
      const relatedTemplates = await Template
        .find({
          category: template.category,
          _id: { $ne: template._id },
          marketplaceListed: true
        })
        .limit(4)
        .populate('createdBy', 'firstName lastName')
        .lean();

      res.json({
        success: true,
        data: {
          template,
          relatedTemplates
        }
      });
    } catch (error) {
      logger.error('Get marketplace template error:', error);
      next(error);
    }
  }

  /**
   * Purchase template
   */
  async purchaseTemplate(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user._id;
      const { paymentMethodId } = req.body;

      const template = await Template.findById(id);
      if (!template || !template.marketplaceListed) {
        return res.status(404).json({
          error: 'Template not found',
          code: 'TEMPLATE_NOT_FOUND'
        });
      }

      // Check if already purchased
      const user = await User.findById(userId);
      if (user.purchasedTemplates?.includes(template._id)) {
        return res.status(409).json({
          error: 'Template already purchased',
          code: 'ALREADY_PURCHASED'
        });
      }

      // Process payment if not free
      if (template.marketplacePrice > 0) {
        const payment = await stripe.paymentIntents.create({
          amount: template.marketplacePrice * 100, // Convert to cents
          currency: 'usd',
          payment_method: paymentMethodId,
          confirm: true,
          metadata: {
            templateId: template._id.toString(),
            userId: userId.toString()
          }
        });

        if (payment.status !== 'succeeded') {
          return res.status(402).json({
            error: 'Payment failed',
            code: 'PAYMENT_FAILED'
          });
        }
      }

      // Add to user's purchased templates
      user.purchasedTemplates = user.purchasedTemplates || [];
      user.purchasedTemplates.push(template._id);
      await user.save();

      // Update template purchase count
      template.purchaseCount = (template.purchaseCount || 0) + 1;
      await template.save();

      // Create commission for template creator
      if (template.marketplacePrice > 0) {
        const commission = template.marketplacePrice * 0.7; // 70% to creator
        await this.createCommissionRecord(template.createdBy, template._id, commission);
      }

      // Log activity
      await ActivityService.logActivity({
        user: userId,
        action: 'template.purchased',
        resource: { type: 'template', id: template._id },
        details: {
          price: template.marketplacePrice,
          templateName: template.name
        }
      });

      res.json({
        success: true,
        message: 'Template purchased successfully',
        data: {
          templateId: template._id,
          price: template.marketplacePrice
        }
      });
    } catch (error) {
      logger.error('Purchase template error:', error);
      next(error);
    }
  }

  /**
   * List template for sale
   */
  async listTemplate(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user._id;
      const { price, description, tags } = req.body;

      const template = await Template.findById(id);
      if (!template) {
        return res.status(404).json({
          error: 'Template not found',
          code: 'TEMPLATE_NOT_FOUND'
        });
      }

      if (template.createdBy.toString() !== userId) {
        return res.status(403).json({
          error: 'Only template owner can list on marketplace',
          code: 'NOT_OWNER'
        });
      }

      // Update template
      template.marketplaceListed = true;
      template.marketplacePrice = price || 0;
      template.marketplaceDescription = description;
      template.marketplaceTags = tags;
      template.publishedAt = new Date();
      await template.save();

      res.json({
        success: true,
        message: 'Template listed on marketplace successfully',
        data: template
      });
    } catch (error) {
      logger.error('List template error:', error);
      next(error);
    }
  }

  /**
   * Remove template from marketplace
   */
  async unlistTemplate(req, res, next) {
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
          error: 'Only template owner can unlist from marketplace',
          code: 'NOT_OWNER'
        });
      }

      template.marketplaceListed = false;
      await template.save();

      res.json({
        success: true,
        message: 'Template removed from marketplace successfully'
      });
    } catch (error) {
      logger.error('Unlist template error:', error);
      next(error);
    }
  }

  /**
   * Submit template review
   */
  async submitReview(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user._id;
      const { rating, comment } = req.body;

      const template = await Template.findById(id);
      if (!template) {
        return res.status(404).json({
          error: 'Template not found',
          code: 'TEMPLATE_NOT_FOUND'
        });
      }

      // Check if user purchased the template
      const user = await User.findById(userId);
      if (!user.purchasedTemplates?.includes(template._id)) {
        return res.status(403).json({
          error: 'You must purchase the template to review it',
          code: 'NOT_PURCHASED'
        });
      }

      // Check if already reviewed
      const existingReview = template.reviews.find(
        r => r.user.toString() === userId
      );

      if (existingReview) {
        // Update existing review
        existingReview.rating = rating;
        existingReview.comment = comment;
        existingReview.updatedAt = new Date();
      } else {
        // Add new review
        template.reviews.push({
          user: userId,
          rating,
          comment,
          createdAt: new Date()
        });
      }

      // Update average rating
      const totalRating = template.reviews.reduce((sum, r) => sum + r.rating, 0);
      template.rating = totalRating / template.reviews.length;
      template.ratingCount = template.reviews.length;

      await template.save();

      res.json({
        success: true,
        message: 'Review submitted successfully',
        data: {
          rating: template.rating,
          ratingCount: template.ratingCount
        }
      });
    } catch (error) {
      logger.error('Submit review error:', error);
      next(error);
    }
  }

  /**
   * Get creator dashboard
   */
  async getCreatorDashboard(req, res, next) {
    try {
      const userId = req.user._id;

      // Get creator's templates
      const templates = await Template.find({
        createdBy: userId,
        marketplaceListed: true
      }).lean();

      // Calculate statistics
      const stats = {
        totalTemplates: templates.length,
        totalPurchases: templates.reduce((sum, t) => sum + (t.purchaseCount || 0), 0),
        totalRevenue: templates.reduce((sum, t) => sum + ((t.purchaseCount || 0) * t.marketplacePrice), 0),
        averageRating: templates.reduce((sum, t) => sum + (t.rating || 0), 0) / templates.length || 0
      };

      // Get recent purchases
      const recentPurchases = await Activity.find({
        action: 'template.purchased',
        'resource.id': { $in: templates.map(t => t._id) }
      })
        .populate('user', 'firstName lastName')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

      // Get earnings history
      const earnings = await this.getCreatorEarnings(userId);

      res.json({
        success: true,
        data: {
          stats,
          templates,
          recentPurchases,
          earnings
        }
      });
    } catch (error) {
      logger.error('Get creator dashboard error:', error);
      next(error);
    }
  }

  /**
   * Helper methods
   */
  async createCommissionRecord(creatorId, templateId, amount) {
    // Implementation for commission tracking
    logger.info(`Commission created: Creator ${creatorId}, Template ${templateId}, Amount ${amount}`);
  }

  async getCreatorEarnings(userId) {
    // Implementation for earnings calculation
    return {
      total: 0,
      pending: 0,
      paid: 0,
      history: []
    };
  }
}

module.exports = new MarketplaceController();