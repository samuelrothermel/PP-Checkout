import { CLIENT_ID } from '../config/constants.js';

// Helper function to handle page rendering with clientId
const renderPage = view => async (req, res, next) => {
  try {
    res.render(view, { clientId: CLIENT_ID });
  } catch (err) {
    next(err);
  }
};

// Page Controllers
export const renderIndex = renderPage('index');
export const renderCheckout = renderPage('checkout');
export const renderSaveWoPurchase = renderPage('save-wo-purchase');
export const renderOneTimePaymentsCart = renderPage('one-time-payments-cart');
export const renderOneTimePaymentsCartQl = renderPage(
  'one-time-payments-cart-ql'
);
export const renderOneTimePaymentsCheckout = renderPage(
  'one-time-payments-checkout'
);
export const renderSubscriptionsApi = renderPage('subscriptions-api');
export const renderMixedCheckout = renderPage('mixed-checkout');
export const renderQlTest = renderPage('ql-test');
export const renderBaReference = renderPage('ba_reference');
export const renderProductCart = renderPage('product-cart');
