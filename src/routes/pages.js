import express from 'express';
import {
  renderIndex,
  renderCheckout,
  renderSubscriptions,
  renderSaveWoPurchase,
  renderBaReference,
  renderProductCart,
  renderWebhookTesting,
  renderFastlane,
  renderRecurringPayment,
  renderPayeeTest,
  renderOrders,
  renderVault,
  renderPayouts,
} from '../controllers/pageController.js';

const router = express.Router();

// Page routes
router.get('/', renderIndex);
router.get('/product-cart', renderProductCart);
router.get('/checkout', renderCheckout);
router.get('/test-no-applepay', (req, res) => {
  res.render('test-no-applepay', { clientId: process.env.CLIENT_ID });
});
router.get('/save-wo-purchase', renderSaveWoPurchase);
router.get('/recurring-payment', renderRecurringPayment);
router.get('/subscriptions', renderSubscriptions);
router.get('/test-plan', (req, res) => {
  res.render('test-plan');
});
router.get('/ba_reference', renderBaReference);
router.get('/fastlane', renderFastlane);
router.get('/webhook-testing', renderWebhookTesting);
router.get('/payee-test', renderPayeeTest);
router.get('/orders', renderOrders);
router.get('/vault', renderVault);
router.get('/payouts', renderPayouts);
router.get('/returning-payer', (req, res) => {
  res.render('returning-payer', { clientId: process.env.CLIENT_ID });
});
router.get('/api/payouts/oauth/callback', (req, res) => {
  res.render('paypal-oauth-callback');
});

export default router;
