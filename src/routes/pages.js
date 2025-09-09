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
router.get('/subscriptions', renderSubscriptions);
router.get('/ba_reference', renderBaReference);
router.get('/fastlane', renderFastlane);
router.get('/webhook-testing', renderWebhookTesting);

export default router;
