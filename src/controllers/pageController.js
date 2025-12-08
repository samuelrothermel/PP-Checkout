import { CLIENT_ID } from '../config/constants.js';

// Helper function to handle page rendering with clientId
const renderPage = view => async (req, res, next) => {
  try {
    // Use process.env directly to ensure we get the value
    const clientId = process.env.CLIENT_ID;
    console.log(
      `Rendering ${view} with CLIENT_ID:`,
      clientId ? `${clientId.substring(0, 15)}...` : 'UNDEFINED'
    );
    res.render(view, { clientId: clientId });
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
export const renderFastlane = renderPage('fastlane');
export const renderRecurringPayment = renderPage('recurring-payment');

export const renderWebhookTesting = renderPage('webhook-testing');
export const renderPayeeTest = renderPage('payee-test');
export const renderOrders = renderPage('orders');
export const renderVault = renderPage('vault');
export const renderPayouts = renderPage('payouts');
