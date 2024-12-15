import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import * as paypal from './paypal-api.js';

const { PORT = 8888 } = process.env;

const handleError = (res, error) => {
  console.error(error);
  res.status(error.status || 500).send(error.message);
};

const app = express();

const corsOptions = {
  credentials: true,
  origin: ['http://localhost:8888'],
};

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(cors(corsOptions));

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
  const hardCodedCustomerId = 'vLOMLitZuN';
  try {
    // const idToken = await paypal.returningAccessToken(hardCodedCustomerId);
    res.render('checkout', {
      clientId,
      // idToken,
    });
  } catch (err) {
    handleError(res, err);
  }
});

app.get('/save-wo-purchase', async (req, res) => {
  const clientId = process.env.CLIENT_ID;
  // const idToken = req.query['data-user-id-token'];
  try {
    res.render('save-wo-purchase', { clientId });
  } catch (err) {
    handleError(res, err);
  }
});

// create order request
app.post('/api/orders', async (req, res) => {
  try {
    const order = await paypal.createOrder();
    res.json(order);
  } catch (err) {
    handleError(res, err);
  }
});

// vault setup token request
app.post('/api/vault/setup-token', async (req, res) => {
  console.log('create vault setup token req.body: ', req.body);
  try {
    const { paymentSource } = req.body;
    const vaultSetupToken = await paypal.createVaultSetupToken({
      paymentSource,
    });
    res.json(vaultSetupToken);
    // console.log('vaultSetupToken', vaultSetupToken);
  } catch (err) {
    handleError(res, err);
  }
});

// create vault payment token
app.post('/api/vault/payment-token/:vaultSetupToken', async (req, res) => {
  console.log('create vault payment token req.body: ', req.body);
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
  console.log('create returning user access token req.body: ', req.body);
  try {
    const { customerId } = req.body; // Changed from req.params to req.body
    const idToken = await paypal.returningAccessToken(customerId);
    // console.log('returning user access token id: ', idToken);
    res.json({ idToken }); // Ensure the response is in the correct format
  } catch (err) {
    handleError(res, err);
  }
});

// create payment token from customer ID
app.post('/api/vault/payment-token', async (req, res) => {
  console.log('create vault payment token from customer ID req.body: ', req);
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
  console.log('get payment tokens req.body: ', req.body);
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
  console.log('capture order payment req.body: ', req.body);
  const { orderID } = req.params;
  try {
    const captureData = await paypal.capturePayment(orderID);
    const vaultResponse = JSON.stringify(captureData.payment_source);
    console.log('captureData: ', captureData);
    console.log('vaultResponse: ', vaultResponse);

    // const vaultResponse = JSON.stringify(captureData.paymentSource);
    res.json(captureData);
  } catch (err) {
    handleError(res, err);
  }
});

app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}/`);
});
