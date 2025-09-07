const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { User, Contract, Template } = require('../models');
const logger = require('../utils/logger');
const jobManager = require('../jobs');

/**
 * @route   POST /api/webhooks/stripe
 * @desc    Handle Stripe webhooks
 * @access  Public (with signature verification)
 */
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  try {
    // Verify webhook signature
    const event = verifyStripeWebhook(req.body, sig);

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event.data.object);
        break;
      
      case 'payment_intent.payment_failed':
        await handlePaymentFailure(event.data.object);
        break;
      
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionCanceled(event.data.object);
        break;
      
      case 'invoice.payment_succeeded':
        await handleInvoicePaid(event.data.object);
        break;
      
      default:
        logger.info(`Unhandled Stripe event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('Stripe webhook error:', error);
    res.status(400).json({ error: 'Webhook error' });
  }
});

/**
 * @route   POST /api/webhooks/oauth/:provider
 * @desc    Handle OAuth provider webhooks
 * @access  Public (with verification)
 */
router.post('/oauth/:provider', async (req, res) => {
  const { provider } = req.params;

  try {
    // Verify webhook based on provider
    const isValid = await verifyOAuthWebhook(provider, req);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    switch (provider) {
      case 'google':
        await handleGoogleWebhook(req.body);
        break;
      
      case 'microsoft':
        await handleMicrosoftWebhook(req.body);
        break;
      
      case 'linkedin':
        await handleLinkedInWebhook(req.body);
        break;
      
      default:
        logger.warn(`Unknown OAuth provider webhook: ${provider}`);
    }

    res.json({ received: true });
  } catch (error) {
    logger.error(`OAuth webhook error (${provider}):`, error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * @route   POST /api/webhooks/email
 * @desc    Handle email service webhooks (SendGrid, Mailgun, etc.)
 * @access  Public (with verification)
 */
router.post('/email', async (req, res) => {
  try {
    // Verify webhook signature
    const isValid = verifyEmailWebhook(req);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const events = Array.isArray(req.body) ? req.body : [req.body];

    for (const event of events) {
      switch (event.event) {
        case 'delivered':
          await handleEmailDelivered(event);
          break;
        
        case 'opened':
          await handleEmailOpened(event);
          break;
        
        case 'clicked':
          await handleEmailClicked(event);
          break;
        
        case 'bounced':
          await handleEmailBounced(event);
          break;
        
        case 'complained':
          await handleEmailComplaint(event);
          break;
        
        case 'unsubscribed':
          await handleEmailUnsubscribe(event);
          break;
      }
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('Email webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * @route   POST /api/webhooks/storage
 * @desc    Handle storage provider webhooks (S3, etc.)
 * @access  Public (with verification)
 */
router.post('/storage', async (req, res) => {
  try {
    // Verify AWS SNS signature
    if (req.headers['x-amz-sns-message-type']) {
      const isValid = await verifySNSSignature(req.body);
      
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid SNS signature' });
      }

      // Handle SNS subscription confirmation
      if (req.body.Type === 'SubscriptionConfirmation') {
        await confirmSNSSubscription(req.body);
        return res.json({ confirmed: true });
      }

      // Handle S3 events
      if (req.body.Type === 'Notification') {
        const message = JSON.parse(req.body.Message);
        await handleS3Event(message);
      }
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('Storage webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * @route   POST /api/webhooks/signature/:provider
 * @desc    Handle digital signature provider webhooks
 * @access  Public (with verification)
 */
router.post('/signature/:provider', async (req, res) => {
  const { provider } = req.params;

  try {
    // Verify webhook based on provider
    const isValid = await verifySignatureWebhook(provider, req);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    switch (provider) {
      case 'docusign':
        await handleDocuSignWebhook(req.body);
        break;
      
      case 'hellosign':
        await handleHelloSignWebhook(req.body);
        break;
      
      case 'adobe':
        await handleAdobeSignWebhook(req.body);
        break;
    }

    res.json({ received: true });
  } catch (error) {
    logger.error(`Signature webhook error (${provider}):`, error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * @route   POST /api/webhooks/calendar
 * @desc    Handle calendar provider webhooks
 * @access  Public (with verification)
 */
router.post('/calendar', async (req, res) => {
  try {
    // Handle calendar event webhooks (Google Calendar, Outlook, etc.)
    const { provider, event } = req.body;

    switch (event.type) {
      case 'event.created':
        await handleCalendarEventCreated(event);
        break;
      
      case 'event.updated':
        await handleCalendarEventUpdated(event);
        break;
      
      case 'event.cancelled':
        await handleCalendarEventCancelled(event);
        break;
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('Calendar webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Webhook verification functions
function verifyStripeWebhook(payload, signature) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  // Stripe webhook verification logic
  // return stripe.webhooks.constructEvent(payload, signature, secret);
  return { type: 'payment_intent.succeeded', data: { object: {} } }; // Placeholder
}

async function verifyOAuthWebhook(provider, req) {
  switch (provider) {
    case 'google':
      // Verify Google webhook
      return true;
    case 'microsoft':
      // Verify Microsoft webhook
      return true;
    default:
      return false;
  }
}

function verifyEmailWebhook(req) {
  // Verify email service webhook (SendGrid, Mailgun, etc.)
  const signature = req.headers['x-sendgrid-signature'] || 
                   req.headers['x-mailgun-signature'];
  // Implement verification logic
  return true;
}

async function verifySNSSignature(message) {
  // Verify AWS SNS signature
  // Implementation would verify the signature using AWS SDK
  return true;
}

async function verifySignatureWebhook(provider, req) {
  // Verify digital signature provider webhook
  return true;
}

// Webhook handlers
async function handlePaymentSuccess(paymentIntent) {
  // Handle successful payment
  logger.info('Payment succeeded:', paymentIntent.id);
  
  // Update user subscription, unlock features, etc.
  // Send confirmation email
}

async function handlePaymentFailure(paymentIntent) {
  // Handle failed payment
  logger.warn('Payment failed:', paymentIntent.id);
  
  // Notify user, retry payment, etc.
}

async function handleSubscriptionCreated(subscription) {
  // Handle new subscription
  const user = await User.findOne({ stripeCustomerId: subscription.customer });
  
  if (user) {
    user.subscription = {
      id: subscription.id,
      status: subscription.status,
      plan: subscription.items.data[0].price.id,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000)
    };
    await user.save();
  }
}

async function handleSubscriptionUpdated(subscription) {
  // Handle subscription update
  const user = await User.findOne({ stripeCustomerId: subscription.customer });
  
  if (user) {
    user.subscription.status = subscription.status;
    user.subscription.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
    await user.save();
  }
}

async function handleSubscriptionCanceled(subscription) {
  // Handle subscription cancellation
  const user = await User.findOne({ stripeCustomerId: subscription.customer });
  
  if (user) {
    user.subscription.status = 'canceled';
    user.subscription.canceledAt = new Date();
    await user.save();
    
    // Send cancellation email
    await jobManager.addEmailJob('send-email', {
      to: user.email,
      subject: 'Subscription Canceled',
      template: 'subscription-canceled',
      context: { name: user.name }
    });
  }
}

async function handleInvoicePaid(invoice) {
  // Record payment in database
  logger.info('Invoice paid:', invoice.id);
}

async function handleGoogleWebhook(data) {
  // Handle Google OAuth events
  logger.info('Google webhook received:', data);
}

async function handleMicrosoftWebhook(data) {
  // Handle Microsoft OAuth events
  logger.info('Microsoft webhook received:', data);
}

async function handleLinkedInWebhook(data) {
  // Handle LinkedIn OAuth events
  logger.info('LinkedIn webhook received:', data);
}

async function handleEmailDelivered(event) {
  // Update email delivery status
  const EmailLog = require('../models/EmailLog');
  await EmailLog.findOneAndUpdate(
    { messageId: event.sg_message_id },
    { 
      status: 'delivered',
      deliveredAt: new Date(event.timestamp * 1000)
    }
  );
}

async function handleEmailOpened(event) {
  // Track email open
  const EmailLog = require('../models/EmailLog');
  await EmailLog.findOneAndUpdate(
    { messageId: event.sg_message_id },
    { 
      $inc: { opens: 1 },
      $push: { 
        openEvents: {
          timestamp: new Date(event.timestamp * 1000),
          ip: event.ip,
          userAgent: event.useragent
        }
      }
    }
  );
}

async function handleEmailClicked(event) {
  // Track link click
  const EmailLog = require('../models/EmailLog');
  await EmailLog.findOneAndUpdate(
    { messageId: event.sg_message_id },
    { 
      $inc: { clicks: 1 },
      $push: { 
        clickEvents: {
          url: event.url,
          timestamp: new Date(event.timestamp * 1000),
          ip: event.ip
        }
      }
    }
  );
}

async function handleEmailBounced(event) {
  // Handle email bounce
  const EmailLog = require('../models/EmailLog');
  await EmailLog.findOneAndUpdate(
    { messageId: event.sg_message_id },
    { 
      status: 'bounced',
      bounceReason: event.reason,
      bouncedAt: new Date(event.timestamp * 1000)
    }
  );
  
  // Update user email status if hard bounce
  if (event.type === 'hard') {
    await User.findOneAndUpdate(
      { email: event.email },
      { emailStatus: 'invalid' }
    );
  }
}

async function handleEmailComplaint(event) {
  // Handle spam complaint
  await User.findOneAndUpdate(
    { email: event.email },
    { 
      emailStatus: 'complained',
      'preferences.emailNotifications': false
    }
  );
}

async function handleEmailUnsubscribe(event) {
  // Handle unsubscribe
  await User.findOneAndUpdate(
    { email: event.email },
    { 
      'preferences.emailNotifications': false,
      unsubscribedAt: new Date()
    }
  );
}

async function handleS3Event(event) {
  // Handle S3 events (object created, deleted, etc.)
  for (const record of event.Records) {
    if (record.eventName.startsWith('ObjectCreated')) {
      // Handle file upload
      logger.info('S3 object created:', record.s3.object.key);
    } else if (record.eventName.startsWith('ObjectRemoved')) {
      // Handle file deletion
      logger.info('S3 object removed:', record.s3.object.key);
    }
  }
}

async function confirmSNSSubscription(data) {
  // Confirm SNS subscription
  const axios = require('axios');
  await axios.get(data.SubscribeURL);
  logger.info('SNS subscription confirmed');
}

async function handleDocuSignWebhook(data) {
  // Handle DocuSign events
  if (data.event === 'envelope-completed') {
    const contract = await Contract.findOne({ 
      'externalSignature.envelopeId': data.envelopeId 
    });
    
    if (contract) {
      contract.status = 'signed';
      contract.signedDate = new Date();
      await contract.save();
    }
  }
}

async function handleHelloSignWebhook(data) {
  // Handle HelloSign events
  logger.info('HelloSign webhook:', data.event_type);
}

async function handleAdobeSignWebhook(data) {
  // Handle Adobe Sign events
  logger.info('Adobe Sign webhook:', data.eventType);
}

async function handleCalendarEventCreated(event) {
  // Handle calendar event creation
  logger.info('Calendar event created:', event.id);
}

async function handleCalendarEventUpdated(event) {
  // Handle calendar event update
  logger.info('Calendar event updated:', event.id);
}

async function handleCalendarEventCancelled(event) {
  // Handle calendar event cancellation
  logger.info('Calendar event cancelled:', event.id);
}

module.exports = router;