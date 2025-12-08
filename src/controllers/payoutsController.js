import {
  createPayout,
  getPayoutDetails,
  getPayoutItemDetails,
  getUserInfo,
} from '../services/payoutsApi.js';

// Create a payout
export const createPayoutBatch = async (req, res, next) => {
  try {
    const { sender_batch_id, email_subject, email_message, recipients } =
      req.body;

    const payoutData = {
      sender_batch_header: {
        sender_batch_id,
        email_subject,
        email_message,
      },
      items: recipients.map(recipient => ({
        recipient_type: 'PAYPAL_ID',
        amount: {
          value: recipient.amount,
          currency: 'USD',
        },
        receiver: recipient.receiver,
        note: recipient.note || 'Thank you for your service!',
        sender_item_id: recipient.sender_item_id || `item_${Date.now()}`,
      })),
    };

    const payout = await createPayout(payoutData);
    res.json(payout);
  } catch (err) {
    console.error('Error creating payout:', err);
    next(err);
  }
};

// Get payout details
export const getPayout = async (req, res, next) => {
  try {
    const { payoutBatchId } = req.params;
    const payout = await getPayoutDetails(payoutBatchId);
    res.json(payout);
  } catch (err) {
    console.error('Error getting payout:', err);
    next(err);
  }
};

// Get payout item details
export const getPayoutItem = async (req, res, next) => {
  try {
    const { payoutItemId } = req.params;
    const payoutItem = await getPayoutItemDetails(payoutItemId);
    res.json(payoutItem);
  } catch (err) {
    console.error('Error getting payout item:', err);
    next(err);
  }
};

// Handle OAuth callback and get user info
export const handleOAuthCallback = async (req, res, next) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code not provided' });
    }

    const userInfo = await getUserInfo(code);
    res.json(userInfo);
  } catch (err) {
    console.error('Error handling OAuth callback:', err);
    next(err);
  }
};

// Get PayPal user info from authorization code
export const getPayPalUserInfo = async (req, res, next) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code not provided' });
    }

    const userInfo = await getUserInfo(code);
    res.json(userInfo);
  } catch (err) {
    console.error('Error getting user info:', err);
    next(err);
  }
};

// Diagnostic endpoint to check OAuth configuration
export const getOAuthConfig = async (req, res) => {
  const { CLIENT_ID, BASE_URL } = process.env;

  res.json({
    clientId: CLIENT_ID ? `${CLIENT_ID.substring(0, 10)}...` : 'NOT SET',
    redirectUri: `${BASE_URL}/api/payouts/oauth/callback`,
    requiredScopes: [
      'openid',
      'profile',
      'email',
      'https://uri.paypal.com/services/paypalattributes',
    ],
    instructions:
      'Make sure this redirect URI is configured exactly in your PayPal App settings under "Log In with PayPal" → "Return URL"',
  });
};
