import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { pingCallbackUrl } from './services/pingCallbackUrl.js'; // Import the function
import * as paypal from './paypal-api.js';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8888';
const NGROK_URL = process.env.NGROK_URL;
const PORT = process.env.PORT || 8888;
// const CALLBACK_URL = `${NGROK_URL}/api/shipping-callback`
const CALLBACK_URL =
  'https://pp-ql-best-practices.onrender.com/api/shipping-callback';

console.log('Callback URL:', CALLBACK_URL);

const handleError = (res, error) => {
  console.error(error);
  res.status(error.status || 500).send(error.message);
};

const app = express();

const corsOptions = {
  credentials: true,
  origin: [BASE_URL],
};

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(cors(corsOptions));

// Set Content Security Policy
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://www.sandbox.paypal.com https://www.paypal.com"
  );
  next();
});

// Routes
app.get('/', async (req, res) => {
  const clientId = process.env.CLIENT_ID;
  try {
    res.render('index', { clientId });
  } catch (err) {
    handleError(res, err);
  }
});

app.get('/checkout', async (req, res) => {
  const clientId = process.env.CLIENT_ID;
  // const hardCodedCustomerId = 'vLOMLitZuN';
  try {
    res.render('checkout', {
      clientId,
    });
  } catch (err) {
    handleError(res, err);
  }
});

app.get('/save-wo-purchase', async (req, res) => {
  const clientId = process.env.CLIENT_ID;
  try {
    res.render('save-wo-purchase', { clientId });
  } catch (err) {
    handleError(res, err);
  }
});

app.get('/one-time-payments-cart', async (req, res) => {
  const clientId = process.env.CLIENT_ID;
  try {
    res.render('one-time-payments-cart', {
      clientId,
    });
  } catch (err) {
    handleError(res, err);
  }
});

app.get('/one-time-payments-cart-ql', async (req, res) => {
  const clientId = process.env.CLIENT_ID;
  try {
    res.render('one-time-payments-cart-ql', {
      clientId,
    });
  } catch (err) {
    handleError(res, err);
  }
});

app.get('/one-time-payments-checkout', async (req, res) => {
  const clientId = process.env.CLIENT_ID;
  try {
    res.render('one-time-payments-checkout', {
      clientId,
    });
  } catch (err) {
    handleError(res, err);
  }
});

// create order request
app.post('/api/orders', async (req, res) => {
  console.log('Checkout Create Order Request');
  console.log('');
  try {
    const order = await paypal.createOrder();
    res.json(order);
  } catch (err) {
    handleError(res, err);
  }
});

// create order request from Checkout page
app.post('/api/checkout-orders', async (req, res) => {
  console.log('Checkout Create Order Request');
  console.log('');
  try {
    const order = await paypal.createCheckoutOrder(req.body);
    res.json(order);
  } catch (err) {
    handleError(res, err);
  }
});

// create upstream order request (client-side callbacks only)
app.post('/api/upstream-orders', async (req, res) => {
  console.log('Upstream Client-Side Callback Create Order Request');
  console.log('');
  const { totalAmount } = req.body;
  try {
    const order = await paypal.createUpstreamOrder(totalAmount);
    res.json(order);
  } catch (err) {
    handleError(res, err);
  }
});

// create upstream order request (server-side callbacks only)
app.post('/api/upstream-ql-orders', async (req, res) => {
  console.log('Upstream Server-Side Callback Create Order Request');
  console.log('');
  const { totalAmount, paymentSource } = req.body;
  try {
    const order = await paypal.createUpstreamQlOrder(
      totalAmount,
      paymentSource
    );
    res.json(order);
  } catch (err) {
    handleError(res, err);
  }
});

// vault setup token request
app.post('/api/vault/setup-token', async (req, res) => {
  console.log('create vault setup token triggered');
  console.log('');
  try {
    const { paymentSource } = req.body;
    const vaultSetupToken = await paypal.createVaultSetupToken({
      paymentSource,
    });
    res.json(vaultSetupToken);
  } catch (err) {
    handleError(res, err);
  }
});

// create vault payment token
app.post('/api/vault/payment-token/:vaultSetupToken', async (req, res) => {
  console.log('create vault payment token triggered');
  console.log('');
  try {
    const { vaultSetupToken } = req.params;
    const paymentToken = await paypal.createVaultPaymentToken(vaultSetupToken);
    res.json(paymentToken);
  } catch (err) {
    handleError(res, err);
  }
});

// returning payer access token request
app.post('/api/returning-user-token', async (req, res) => {
  console.log('create returning user access token triggered');
  console.log('');
  try {
    const { customerId } = req.body;
    const idToken = await paypal.returningAccessToken(customerId);
    res.json({ idToken });
  } catch (err) {
    handleError(res, err);
  }
});

// create payment token from customer ID
app.post('/api/vault/payment-token', async (req, res) => {
  console.log('create vault payment token from customer ID triggered');
  console.log('');
  const { customerId } = req.body;
  try {
    const paymentToken = await paypal.createPaymentTokenFromCustomerId(
      customerId
    );
    res.json(paymentToken);
  } catch (err) {
    handleError(res, err);
  }
});

// get payment tokens from customer ID
app.get('/api/payment-tokens', async (req, res) => {
  console.log('get payment tokens request triggered');
  console.log('');
  const customerId = req.query.customer_id;
  try {
    const paymentTokens = await paypal.fetchPaymentTokens(customerId);
    res.json(paymentTokens);
  } catch (err) {
    handleError(res, err);
  }
});

// capture payment
app.post('/api/orders/:orderID/capture', async (req, res) => {
  console.log('capture order request triggered');
  console.log('');
  const { orderID } = req.params;
  try {
    const captureData = await paypal.capturePayment(orderID);
    const vaultResponse = JSON.stringify(captureData.payment_source);
    res.json(captureData);
  } catch (err) {
    handleError(res, err);
  }
});

// Shipping callback endpoint
app.post('/api/shipping-callback', async (req, res) => {
  console.log('Shipping callback received');
  const { id, shipping_address, shipping_option, purchase_units } = req.body;

  try {
    // Process the shipping callback data
    console.log('Order ID:', id);
    console.log('Shipping Address:', shipping_address);
    console.log('Shipping Option:', shipping_option);
    console.log('Purchase Units:', purchase_units);

    // Respond with a success status
    res.status(200).send('Shipping callback processed successfully');
  } catch (err) {
    handleError(res, err);
  }
});

app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}/`);
  console.log('');
  pingCallbackUrl(); // Ping the callback URL when the server starts
});
