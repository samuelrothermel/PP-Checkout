import express from 'express';
import {
  createOrder,
  createCheckoutOrder,
  createUpstreamOrder,
  createUpstreamQlOrder,
  createQuantumOrder,
  capturePayment,
  authorizePayment,
  getOrdersByIds,
  captureAuthorizedPayment,
  deleteOrder,
} from '../controllers/orderController.js';
import {
  createVaultSetupToken,
  createVaultPaymentToken,
  createPaymentTokenFromCustomerId,
  getPaymentTokens,
  createReturningUserToken,
  createFirstTimeUserToken,
  createRecurringSetupToken,
  createRecurringOrder,
  createOrderWithVaultId,
  getPaymentTokensByCustomerIds,
} from '../controllers/vaultController.js';
import { generateClientToken } from '../controllers/tokenController.js';
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
import {
  testOneTimePayee,
  testVaultedPayee,
  testVaultedSameMerchantDifferentPayee,
  captureOneTimePayee,
  testVaultV3,
  testVaultV3WithPayee,
  testLegacyVsV3,
  createCaptureOrderWithPayee,
} from '../controllers/payeeTestController.js';
import {
  createPayoutBatch,
  getPayout,
  getPayoutItem,
  handleOAuthCallback,
  getPayPalUserInfo,
  getOAuthConfig,
} from '../controllers/payoutsController.js';

const router = express.Router();

// Order routes
router.post('/orders/fetch', getOrdersByIds); // New route for fetching orders by ID array
router.post('/orders', createOrder);
router.post('/checkout-orders', createCheckoutOrder);
router.post('/upstream-orders', createUpstreamOrder);
router.post('/upstream-ql-orders', createUpstreamQlOrder);
router.post('/quantum-test', createQuantumOrder);
router.post('/orders/:orderID/capture', capturePayment);
router.post('/orders/:orderID/capture-authorized', captureAuthorizedPayment); // New route for capturing authorized payments
router.post('/orders/:orderID/authorize', authorizePayment);
router.delete('/orders/:orderID/delete', deleteOrder); // New route for deleting orders from localStorage

// Vault routes
router.post('/vault/customers', getPaymentTokensByCustomerIds); // New route for fetching customers by ID array
router.post('/vault/setup-token', createVaultSetupToken);
router.post('/vault/recurring-setup-token', createRecurringSetupToken);
router.post('/vault/payment-token/:vaultSetupToken', createVaultPaymentToken);
router.post('/vault/payment-token', createPaymentTokenFromCustomerId);
router.post('/vault/recurring-order', createRecurringOrder);
router.post('/vault/create-order', createOrderWithVaultId);
router.get('/payment-tokens', getPaymentTokens);
router.post('/returning-user-token', createReturningUserToken);
router.post('/first-time-user-token', createFirstTimeUserToken);

// Client Token route for SDK initialization
router.get('/client-token', generateClientToken);

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

// Payee testing routes (legacy)
router.post('/test-onetime-payee', testOneTimePayee);
router.post('/capture-onetime-payee', captureOneTimePayee);
router.post('/test-vaulted-payee', testVaultedPayee);
router.post(
  '/test-vaulted-same-merchant-different-payee',
  testVaultedSameMerchantDifferentPayee
);

// Vault v3 testing routes
router.post('/test-vault-v3', testVaultV3);
router.post('/test-vault-v3-payee', testVaultV3WithPayee);
router.post('/test-legacy-vs-v3', testLegacyVsV3);

// Create capture order with payee
router.post('/create-capture-order-with-payee', createCaptureOrderWithPayee);

// Payouts API routes
router.post('/payouts/create', createPayoutBatch);
router.get('/payouts/:payoutBatchId', getPayout);
router.get('/payouts/items/:payoutItemId', getPayoutItem);
router.post('/payouts/user-info', getPayPalUserInfo);
router.get('/payouts/oauth/config', getOAuthConfig);

export default router;
