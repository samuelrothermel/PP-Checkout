import express from 'express';
import {
  renderIndex,
  renderCheckout,
  renderSaveWoPurchase,
  renderOneTimePaymentsCart,
  renderOneTimePaymentsCartQl,
  renderOneTimePaymentsCheckout,
  renderSubscriptionsApi,
  renderMixedCheckout,
  renderQlTest,
  renderBaReference,
  renderProductCart,
} from '../controllers/pageController.js';

const router = express.Router();

// Page routes
router.get('/', renderIndex);
router.get('/checkout', renderCheckout);
router.get('/save-wo-purchase', renderSaveWoPurchase);
router.get('/one-time-payments-cart', renderOneTimePaymentsCart);
router.get('/one-time-payments-cart-ql', renderOneTimePaymentsCartQl);
router.get('/one-time-payments-checkout', renderOneTimePaymentsCheckout);
router.get('/subscriptions-api', renderSubscriptionsApi);
router.get('/mixed-checkout', renderMixedCheckout);
router.get('/ql-test', renderQlTest);
router.get('/ba_reference', renderBaReference);
router.get('/product-cart', renderProductCart);

export default router;
