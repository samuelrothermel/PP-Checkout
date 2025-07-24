import {
  createCheckoutOrder as createCheckoutOrderApi,
  createUpstreamQlOrder as createUpstreamQlOrderApi,
  authorizePayment as authorizePaymentApi,
} from '../services/ordersApi.js';

// Create order request
export const createOrder = async (req, res, next) => {
  console.log('Checkout Create Order Request');
  console.log('');
  try {
    const order = await paypal.createOrder();
    res.json(order);
  } catch (err) {
    next(err);
  }
};

// Create order request from Checkout page
export const createCheckoutOrder = async (req, res, next) => {
  console.log('Checkout Create Order Request');
  console.log('');
  try {
    // Map 'source' field from frontend to 'paymentSource' for backend
    const orderData = {
      ...req.body,
      paymentSource: req.body.source || req.body.paymentSource || 'paypal',
    };
    const order = await createCheckoutOrderApi(orderData);
    res.json(order);
  } catch (err) {
    next(err);
  }
};

// Create upstream order request (client-side callbacks only)
export const createUpstreamOrder = async (req, res, next) => {
  console.log('Upstream Client-Side Callback Create Order Request');
  console.log('');
  const { totalAmount } = req.body;
  try {
    const order = await paypal.createUpstreamOrder(totalAmount);
    res.json(order);
  } catch (err) {
    next(err);
  }
};

// Create upstream order request (server-side callbacks only)
export const createUpstreamQlOrder = async (req, res, next) => {
  console.log('Upstream Server-Side Callback Create Order Request');
  console.log('');
  const { totalAmount, paymentSource } = req.body;
  try {
    const order = await paypal.createUpstreamQlOrderApi(
      totalAmount,
      paymentSource
    );
    res.json(order);
  } catch (err) {
    next(err);
  }
};

// Create quantum test order
export const createQuantumOrder = async (req, res, next) => {
  console.log('Upstream Server-Side Callback Create Order Request');
  console.log('');
  const { totalAmount, paymentSource } = req.body;
  try {
    const order = await paypal.createQuantumOrder(totalAmount, paymentSource);
    res.json(order);
  } catch (err) {
    next(err);
  }
};

// Capture payment
export const capturePayment = async (req, res, next) => {
  console.log('capture order request triggered');
  console.log('');
  const { orderID } = req.params;
  try {
    const captureData = await paypal.capturePayment(orderID);
    const vaultResponse = JSON.stringify(captureData.payment_source);
    res.json(captureData);
  } catch (err) {
    next(err);
  }
};

// Authorize payment
export const authorizePayment = async (req, res, next) => {
  console.log('authorize order request triggered');
  console.log('');
  const { orderID } = req.params;
  try {
    const authorizeData = await authorizePaymentApi(orderID);
    res.json(authorizeData);
  } catch (err) {
    next(err);
  }
};
