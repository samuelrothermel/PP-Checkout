import {
  verifyWebhookSignature,
  processWebhookEvent,
  getWebhookDetails,
  listWebhookEvents,
} from '../services/webhookService.js';

/**
 * Handle incoming PayPal webhook events
 */
export const handleWebhook = async (req, res, next) => {
  console.log('Webhook received');
  console.log('Headers:', req.headers);

  try {
    // Get raw body for signature verification
    const rawBody = JSON.stringify(req.body);

    // Verify webhook signature
    const isValid = await verifyWebhookSignature(rawBody, req.headers);

    if (!isValid) {
      console.error('Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    console.log('Webhook signature verified successfully');

    // Process the webhook event
    const result = await processWebhookEvent(req.body);

    if (result.success) {
      console.log('Webhook processed successfully:', result.message);
      res.status(200).json({
        message: 'Webhook processed successfully',
        result: result.message,
      });
    } else {
      console.error('Error processing webhook:', result.error);
      res.status(500).json({
        error: 'Error processing webhook',
        details: result.error,
      });
    }
  } catch (error) {
    console.error('Webhook processing error:', error);
    next(error);
  }
};

/**
 * Get webhook configuration details
 */
export const getWebhookInfo = async (req, res, next) => {
  console.log('Get webhook info request');

  try {
    const webhookDetails = await getWebhookDetails();

    if (webhookDetails) {
      res.json(webhookDetails);
    } else {
      res.status(404).json({ error: 'Webhook not found' });
    }
  } catch (error) {
    console.error('Error getting webhook info:', error);
    next(error);
  }
};

/**
 * List available webhook events
 */
export const getWebhookEvents = async (req, res, next) => {
  console.log('Get webhook events request');

  try {
    const events = await listWebhookEvents();

    if (events) {
      res.json(events);
    } else {
      res.status(500).json({ error: 'Failed to fetch webhook events' });
    }
  } catch (error) {
    console.error('Error getting webhook events:', error);
    next(error);
  }
};

/**
 * Test webhook endpoint - for development/testing purposes
 */
export const testWebhook = async (req, res, next) => {
  console.log('Test webhook endpoint called');

  try {
    // Sample webhook event for testing
    const testEvent = {
      event_type: 'VAULT.PAYMENT-TOKEN.CREATED',
      resource: {
        id: 'test-token-123',
        customer: {
          id: 'test-customer-456',
        },
        payment_source: {
          card: {
            brand: 'VISA',
            last_digits: '1234',
            expiry: '2025-12',
          },
        },
      },
    };

    const result = await processWebhookEvent(testEvent);

    res.json({
      message: 'Test webhook processed',
      result: result,
    });
  } catch (error) {
    console.error('Error testing webhook:', error);
    next(error);
  }
};
