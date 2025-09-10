import express from 'express';
import {
  createOrder,
  createCheckoutOrder,
  createUpstreamOrder,
  createUpstreamQlOrder,
  createQuantumOrder,
  capturePayment,
  authorizePayment,
} from '../controllers/orderController.js';
import {
  createVaultSetupToken,
  createVaultPaymentToken,
  createPaymentTokenFromCustomerId,
  getPaymentTokens,
  createReturningUserToken,
} from '../controllers/vaultController.js';
import {
  createBillingToken,
  createBillingAgreement,
  captureOrderWithBillingAgreement,
} from '../controllers/billingController.js';
import {
  handleWebhook,
  getWebhookInfo,
  getWebhookEvents,
  testWebhook,
} from '../controllers/webhookController.js';
import { createPlan, getPlan } from '../controllers/subscriptionController.js';
import { handleShippingCallback } from '../services/shippingCallback.js';

const router = express.Router();

// Order routes
router.post('/orders', createOrder);
router.post('/checkout-orders', createCheckoutOrder);
router.post('/upstream-orders', createUpstreamOrder);
router.post('/upstream-ql-orders', createUpstreamQlOrder);
router.post('/quantum-test', createQuantumOrder);
router.post('/orders/:orderID/capture', capturePayment);
router.post('/orders/:orderID/authorize', authorizePayment);

// Vault routes
router.post('/vault/setup-token', createVaultSetupToken);
router.post('/vault/payment-token/:vaultSetupToken', createVaultPaymentToken);
router.post('/vault/payment-token', createPaymentTokenFromCustomerId);
router.get('/payment-tokens', getPaymentTokens);
router.post('/returning-user-token', createReturningUserToken);

// Billing Agreement routes
router.post('/ba/create-billing-token', createBillingToken);
router.post('/ba/create-agreement', createBillingAgreement);
router.post('/ba/capture-order', captureOrderWithBillingAgreement);

// Subscription routes
router.post('/subscriptions/create-plan', createPlan);
router.get('/subscriptions/plan/:planId', getPlan);

// Diagnostic route
router.get('/diagnostics', (req, res) => {
  res.json({
    CLIENT_ID: process.env.CLIENT_ID ? 'Set (hidden)' : 'Not set',
    APP_SECRET: process.env.APP_SECRET ? 'Set (hidden)' : 'Not set',
    BASE_URL: process.env.BASE_URL || 'Not set',
    PORT: process.env.PORT || 'Not set',
    NODE_ENV: process.env.NODE_ENV || 'Not set',
  });
});

// Shipping callback route
router.post('/shipping-callback', handleShippingCallback);

// Webhook routes
router.post('/webhooks', handleWebhook);
router.get('/webhooks/info', getWebhookInfo);
router.get('/webhooks/events', getWebhookEvents);
router.post('/webhooks/test', testWebhook);

export default router;
