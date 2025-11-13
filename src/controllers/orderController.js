import {
  createCheckoutOrder as createCheckoutOrderApi,
  createUpstreamQlOrder as createUpstreamQlOrderApi,
  capturePayment as capturePaymentApi,
  authorizePayment as authorizePaymentApi,
  getOrdersByIds as getOrdersByIdsApi,
} from '../services/ordersApi.js';

// Create order request
export const createOrder = async (req, res, next) => {
  console.log('Checkout Create Order Request');
  console.log('');
  try {
    // Use the checkout order function as a fallback
    const order = await createCheckoutOrderApi(req.body);
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
      paymentSource: req.body.source || req.body.paymentSource,
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
    // For now, use the same upstream QL order function
    // This can be customized later if needed for client-side callbacks
    const order = await createUpstreamQlOrderApi(totalAmount);
    res.json(order);
  } catch (err) {
    next(err);
  }
};

// Create upstream order request (server-side callbacks only)
export const createUpstreamQlOrder = async (req, res, next) => {
  console.log('Upstream Server-Side Callback Create Order Request');
  console.log('');
  const { totalAmount } = req.body;
  try {
    const order = await createUpstreamQlOrderApi(totalAmount);
    res.json(order);
  } catch (err) {
    next(err);
  }
};

// Create quantum test order
export const createQuantumOrder = async (req, res, next) => {
  console.log('Upstream Server-Side Callback Create Order Request');
  console.log('');
  const { totalAmount } = req.body;
  try {
    // For now, use the upstream QL order function
    // This can be customized later if needed for quantum testing
    const order = await createUpstreamQlOrderApi(totalAmount);
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
    const captureData = await capturePaymentApi(orderID);
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

// Get orders by ID array (for localStorage integration)
export const getOrdersByIds = async (req, res, next) => {
  console.log('Get Orders by IDs Request');
  console.log('');
  try {
    const { orderIds } = req.body;
    const result = await getOrdersByIdsApi(orderIds);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
