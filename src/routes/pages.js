import express from 'express';
import {
  renderIndex,
  renderCheckout,
  renderSubscriptions,
  renderSaveWoPurchase,
  renderBaReference,
  renderProductCart,
  renderWebhookTesting,
} from '../controllers/pageController.js';

const router = express.Router();

// Page routes
router.get('/', renderIndex);
router.get('/product-cart', renderProductCart);
router.get('/checkout', renderCheckout);
router.get('/save-wo-purchase', renderSaveWoPurchase);
router.get('/subscriptions', renderSubscriptions);
router.get('/ba_reference', renderBaReference);
router.get('/webhook-testing', renderWebhookTesting);

export default router;
