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
export const renderProductCart = renderPage('product-cart');
export const renderSaveWoPurchase = renderPage('save-wo-purchase');
export const renderSubscriptions = renderPage('subscriptions');
export const renderBaReference = renderPage('ba_reference');

export const renderWebhookTesting = renderPage('webhook-testing');
