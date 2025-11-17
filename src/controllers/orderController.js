import {
  createCheckoutOrder as createCheckoutOrderApi,
  createUpstreamQlOrder as createUpstreamQlOrderApi,
  capturePayment as capturePaymentApi,
  authorizePayment as authorizePaymentApi,
  getOrdersByIds as getOrdersByIdsApi,
  captureAuthorization as captureAuthorizationApi,
  getOrderDetails as getOrderDetailsApi,
} from '../services/ordersApi.js';

// Create order request
export const createOrder = async (req, res, next) => {
  console.log('Create Order Request');
  console.log('Request body:', JSON.stringify(req.body, null, 2));

  try {
    // Create the order only - user must approve before authorization
    const order = await createCheckoutOrderApi(req.body);
    console.log('Order created:', order.id);

    // Return the order for user approval
    res.json(order);
  } catch (err) {
    next(err);
  }
}; // Create order request from Checkout page
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

// Capture authorized payment
export const captureAuthorizedPayment = async (req, res, next) => {
  console.log('capture authorized payment request triggered');
  console.log('');
  const { orderID } = req.params;
  try {
    // First get the order details to find the authorization ID
    const orderDetails = await getOrderDetailsApi(orderID);
    console.log('Order details:', JSON.stringify(orderDetails, null, 2));

    const authorizationId =
      orderDetails.purchase_units?.[0]?.payments?.authorizations?.[0]?.id;

    if (!authorizationId) {
      throw new Error('No authorization found for this order');
    }

    console.log('Capturing authorization ID:', authorizationId);
    const captureData = await captureAuthorizationApi(authorizationId);
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

// Delete order (remove from internal tracking, not actual PayPal API call)
export const deleteOrder = async (req, res, next) => {
  console.log('Delete Order Request (Internal Only)');
  console.log('');
  const { orderID } = req.params;

  try {
    console.log('Removing order from internal tracking:', orderID);

    // Since this is internal only and doesn't actually call PayPal API,
    // we just return success. The frontend will handle removing it from localStorage.
    res.json({
      success: true,
      orderId: orderID,
      message: `Order ${orderID} removed from internal tracking`,
    });
  } catch (err) {
    next(err);
  }
};
