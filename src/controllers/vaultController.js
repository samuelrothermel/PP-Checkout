import {
  createVaultSetupToken as createVaultSetupTokenApi,
  createVaultPaymentToken as createVaultPaymentTokenApi,
  createPaymentTokenFromCustomerId as createPaymentTokenFromCustomerIdApi,
  createRecurringSetupToken as createRecurringSetupTokenApi,
  createRecurringOrder as createRecurringOrderApi,
  fetchPaymentTokens,
  getPaymentTokensByCustomerIds as getPaymentTokensByCustomerIdsApi,
} from '../services/tokensApi.js';
import {
  returningAccessToken,
  generateUserIdToken,
} from '../services/authApi.js';

// Create vault setup token
export const createVaultSetupToken = async (req, res, next) => {
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
  try {
    const { customerId } = req.body;
    const idToken = await returningAccessToken(customerId);
    res.json({ idToken });
  } catch (err) {
    next(err);
  }
};

// Create user ID token for first-time payer (required for Venmo vaulting)
export const createFirstTimeUserToken = async (req, res, next) => {
  try {
    const idToken = await generateUserIdToken();
    res.json({ idToken });
  } catch (err) {
    next(err);
  }
};

// Create recurring payment setup token
export const createRecurringSetupToken = async (req, res, next) => {
  try {
    const { paymentSource } = req.body;
    const vaultSetupToken = await createRecurringSetupTokenApi({
      paymentSource,
    });
    res.json(vaultSetupToken);
  } catch (err) {
    next(err);
  }
};

// Create order with payment token for recurring billing
export const createRecurringOrder = async (req, res, next) => {
  try {
    const { paymentTokenId } = req.body;
    const order = await createRecurringOrderApi(paymentTokenId);
    res.json(order);
  } catch (err) {
    next(err);
  }
};

// Create and capture order using vault_id (for testing Apple Pay vaults)
export const createOrderWithVaultId = async (req, res, next) => {
  try {
    const { vaultId, amount, merchantNumber = 1 } = req.body;
    const { createOrderWithVaultIdAndCapture } = await import(
      '../services/ordersApi.js'
    );
    const order = await createOrderWithVaultIdAndCapture(
      vaultId,
      amount,
      merchantNumber
    );
    res.json(order);
  } catch (err) {
    next(err);
  }
};

// Get payment tokens by customer ID array (for localStorage integration)
export const getPaymentTokensByCustomerIds = async (req, res, next) => {
  try {
    const { customerIds } = req.body;
    const result = await getPaymentTokensByCustomerIdsApi(customerIds);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
