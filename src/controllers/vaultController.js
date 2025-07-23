import {
  createVaultSetupToken as createVaultSetupTokenApi,
  createVaultPaymentToken as createVaultPaymentTokenApi,
  createPaymentTokenFromCustomerId as createPaymentTokenFromCustomerIdApi,
  fetchPaymentTokens,
} from '../services/tokensApi.js';

// Create vault setup token
export const createVaultSetupToken = async (req, res, next) => {
  console.log('create vault setup token triggered');
  console.log('');
  try {
    const { paymentSource } = req.body;
    const vaultSetupToken = await createVaultSetupTokenApi({
      paymentSource,
    });
    res.json(vaultSetupToken);
  } catch (err) {
    next(err);
  }
};

// Create vault payment token from setup token
export const createVaultPaymentToken = async (req, res, next) => {
  console.log('create vault payment token triggered');
  console.log('');
  try {
    const { vaultSetupToken } = req.params;
    const paymentToken = await createVaultPaymentTokenApi(vaultSetupToken);
    res.json(paymentToken);
  } catch (err) {
    next(err);
  }
};

// Create vault payment token from customer ID
export const createPaymentTokenFromCustomerId = async (req, res, next) => {
  console.log('create vault payment token from customer ID triggered');
  console.log('');
  const { customerId } = req.body;
  try {
    const paymentToken = await createPaymentTokenFromCustomerIdApi(customerId);
    res.json(paymentToken);
  } catch (err) {
    next(err);
  }
};

// Get payment tokens from customer ID
export const getPaymentTokens = async (req, res, next) => {
  console.log('get payment tokens request triggered');
  console.log('');
  const customerId = req.query.customer_id;
  try {
    const paymentTokens = await fetchPaymentTokens(customerId);
    res.json(paymentTokens);
  } catch (err) {
    next(err);
  }
};

// Create returning user access token
export const createReturningUserToken = async (req, res, next) => {
  console.log('create returning user access token triggered');
  console.log('');
  try {
    const { customerId } = req.body;
    const idToken = await paypal.returningAccessToken(customerId);
    res.json({ idToken });
  } catch (err) {
    next(err);
  }
};
