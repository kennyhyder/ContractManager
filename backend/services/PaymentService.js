const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { User, Contract } = require('../models');
const ActivityService = require('./ActivityService');
const NotificationService = require('./NotificationService');
const logger = require('../utils/logger');

class PaymentService {
  constructor() {
    this.plans = {
      FREE: {
        id: 'free',
        name: 'Free',
        price: 0,
        features: {
          contracts: 10,
          users: 1,
          storage: 1024 * 1024 * 100, // 100MB
          templates: 5,
          apiAccess: false,
          advancedFeatures: false
        }
      },
      STARTER: {
        id: 'starter',
        name: 'Starter',
        price: 29,
        priceId: process.env.STRIPE_STARTER_PRICE_ID,
        features: {
          contracts: 100,
          users: 5,
          storage: 1024 * 1024 * 1024 * 5, // 5GB
          templates: 20,
          apiAccess: false,
          advancedFeatures: false
        }
      },
      PROFESSIONAL: {
        id: 'professional',
        name: 'Professional',
        price: 99,
        priceId: process.env.STRIPE_PROFESSIONAL_PRICE_ID,
        features: {
          contracts: 1000,
          users: 20,
          storage: 1024 * 1024 * 1024 * 50, // 50GB
          templates: 100,
          apiAccess: true,
          advancedFeatures: true
        }
      },
      ENTERPRISE: {
        id: 'enterprise',
        name: 'Enterprise',
        price: 299,
        priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID,
        features: {
          contracts: -1, // Unlimited
          users: -1, // Unlimited
          storage: -1, // Unlimited
          templates: -1, // Unlimited
          apiAccess: true,
          advancedFeatures: true,
          customIntegrations: true,
          dedicatedSupport: true
        }
      }
    };
  }

  /**
   * Create customer
   */
  async createCustomer(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (user.stripeCustomerId) {
        return user.stripeCustomerId;
      }

      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        metadata: {
          userId: user._id.toString()
        }
      });

      user.stripeCustomerId = customer.id;
      await user.save();

      logger.info(`Created Stripe customer for user ${userId}`);

      return customer.id;
    } catch (error) {
      logger.error('Create customer error:', error);
      throw error;
    }
  }

  /**
   * Create subscription
   */
  async createSubscription(userId, planId, paymentMethodId) {
    try {
      const plan = this.plans[planId.toUpperCase()];
      if (!plan || !plan.priceId) {
        throw new Error('Invalid plan');
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Create or get customer
      const customerId = await this.createCustomer(userId);

      // Attach payment method
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId
      });

      // Set as default payment method
      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId
        }
      });

      // Create subscription
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: plan.priceId }],
        payment_settings: {
          payment_method_types: ['card'],
          save_default_payment_method: 'on_subscription'
        },
        expand: ['latest_invoice.payment_intent']
      });

      // Update user
      user.subscription = {
        plan: plan.id,
        stripeSubscriptionId: subscription.id,
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        features: plan.features
      };
      await user.save();

      // Log activity
      await ActivityService.logActivity({
        user: userId,
        action: 'subscription.created',
        resource: { type: 'subscription', id: subscription.id },
        details: {
          plan: plan.name,
          price: plan.price
        }
      });

      // Send notification
      await NotificationService.sendNotification({
        userId,
        type: 'subscription_created',
        title: 'Subscription Created',
        message: `You've successfully subscribed to the ${plan.name} plan`,
        channels: ['email', 'inApp']
      });

      return {
        subscription,
        clientSecret: subscription.latest_invoice.payment_intent.client_secret
      };
    } catch (error) {
      logger.error('Create subscription error:', error);
      throw error;
    }
  }

  /**
   * Update subscription
   */
  async updateSubscription(userId, newPlanId) {
    try {
      const user = await User.findById(userId);
      if (!user || !user.subscription?.stripeSubscriptionId) {
        throw new Error('No active subscription found');
      }

      const newPlan = this.plans[newPlanId.toUpperCase()];
      if (!newPlan || !newPlan.priceId) {
        throw new Error('Invalid plan');
      }

      // Get current subscription
      const subscription = await stripe.subscriptions.retrieve(
        user.subscription.stripeSubscriptionId
      );

      // Update subscription
      const updatedSubscription = await stripe.subscriptions.update(
        subscription.id,
        {
          items: [{
            id: subscription.items.data[0].id,
            price: newPlan.priceId
          }],
          proration_behavior: 'create_prorations'
        }
      );

      // Update user
      user.subscription.plan = newPlan.id;
      user.subscription.features = newPlan.features;
      await user.save();

      // Log activity
      await ActivityService.logActivity({
        user: userId,
        action: 'subscription.updated',
        resource: { type: 'subscription', id: subscription.id },
        details: {
          oldPlan: subscription.items.data[0].price.product,
          newPlan: newPlan.name
        }
      });

      return updatedSubscription;
    } catch (error) {
      logger.error('Update subscription error:', error);
      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(userId, reason) {
    try {
      const user = await User.findById(userId);
      if (!user || !user.subscription?.stripeSubscriptionId) {
        throw new Error('No active subscription found');
      }

      // Cancel at period end
      const subscription = await stripe.subscriptions.update(
        user.subscription.stripeSubscriptionId,
        {
          cancel_at_period_end: true,
          cancellation_details: {
            comment: reason
          }
        }
      );

      // Update user
      user.subscription.cancelAtPeriodEnd = true;
      user.subscription.cancelReason = reason;
      await user.save();

      // Log activity
      await ActivityService.logActivity({
        user: userId,
        action: 'subscription.cancelled',
        resource: { type: 'subscription', id: subscription.id },
        details: { reason }
      });

      // Send notification
      await NotificationService.sendNotification({
        userId,
        type: 'subscription_cancelled',
        title: 'Subscription Cancelled',
        message: `Your subscription will end on ${new Date(subscription.current_period_end * 1000).toLocaleDateString()}`,
        channels: ['email', 'inApp']
      });

      return subscription;
    } catch (error) {
      logger.error('Cancel subscription error:', error);
      throw error;
    }
  }

  /**
   * Process webhook
   */
  async processWebhook(event) {
    try {
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdate(event.data.object);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object);
          break;

        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event.data.object);
          break;

        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object);
          break;

        default:
          logger.info(`Unhandled webhook event: ${event.type}`);
      }
    } catch (error) {
      logger.error('Process webhook error:', error);
      throw error;
    }
  }

  /**
   * Handle subscription update
   */
  async handleSubscriptionUpdate(subscription) {
    try {
      const user = await User.findOne({
        stripeCustomerId: subscription.customer
      });

      if (!user) {
        logger.warn('User not found for subscription:', subscription.id);
        return;
      }

      // Find plan
      const planId = Object.keys(this.plans).find(
        key => this.plans[key].priceId === subscription.items.data[0].price.id
      );

      if (planId) {
        user.subscription = {
          plan: this.plans[planId].id,
          stripeSubscriptionId: subscription.id,
          status: subscription.status,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          features: this.plans[planId].features,
          cancelAtPeriodEnd: subscription.cancel_at_period_end
        };
        await user.save();
      }
    } catch (error) {
      logger.error('Handle subscription update error:', error);
    }
  }

  /**
   * Handle subscription deleted
   */
  async handleSubscriptionDeleted(subscription) {
    try {
      const user = await User.findOne({
        stripeCustomerId: subscription.customer
      });

      if (!user) {
        return;
      }

      // Downgrade to free plan
      user.subscription = {
        plan: 'free',
        features: this.plans.FREE.features,
        status: 'cancelled',
        cancelledAt: new Date()
      };
      await user.save();

      // Send notification
      await NotificationService.sendNotification({
        userId: user._id,
        type: 'subscription_ended',
        title: 'Subscription Ended',
        message: 'Your subscription has ended. You have been downgraded to the free plan.',
        channels: ['email', 'inApp']
      });
    } catch (error) {
      logger.error('Handle subscription deleted error:', error);
    }
  }

  /**
   * Check usage limits
   */
  async checkUsageLimit(userId, feature) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const features = user.subscription?.features || this.plans.FREE.features;
      const limit = features[feature];

      if (limit === -1) {
        return { allowed: true, unlimited: true };
      }

      // Get current usage
      let usage = 0;
      switch (feature) {
        case 'contracts':
          usage = await Contract.countDocuments({ owner: userId });
          break;
        case 'storage':
          usage = await this.getStorageUsage(userId);
          break;
        // Add other feature checks
      }

      return {
        allowed: usage < limit,
        usage,
        limit,
        remaining: Math.max(0, limit - usage),
        percentage: (usage / limit) * 100
      };
    } catch (error) {
      logger.error('Check usage limit error:', error);
      throw error;
    }
  }

  /**
   * Get billing history
   */
  async getBillingHistory(userId) {
    try {
      const user = await User.findById(userId);
      if (!user || !user.stripeCustomerId) {
        return [];
      }

      const invoices = await stripe.invoices.list({
        customer: user.stripeCustomerId,
        limit: 100
      });

      return invoices.data.map(invoice => ({
        id: invoice.id,
        date: new Date(invoice.created * 1000),
        amount: invoice.amount_paid / 100,
        currency: invoice.currency,
        status: invoice.status,
        description: invoice.description || `${user.subscription?.plan} plan`,
        invoiceUrl: invoice.hosted_invoice_url,
        pdfUrl: invoice.invoice_pdf
      }));
    } catch (error) {
      logger.error('Get billing history error:', error);
      throw error;
    }
  }

  /**
   * Helper methods
   */

  async getStorageUsage(userId) {
    const FileService = require('./FileService');
    const usage = await FileService.getStorageUsage(userId);
    return usage.totalSize;
  }

  async handlePaymentSucceeded(invoice) {
    logger.info('Payment succeeded:', invoice.id);
    // Implement payment success handling
  }

  async handlePaymentFailed(invoice) {
    logger.warn('Payment failed:', invoice.id);
    // Implement payment failure handling
  }
}

module.exports = new PaymentService();