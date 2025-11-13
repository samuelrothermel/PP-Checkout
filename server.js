// Import required modules
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const paypal = require('@paypal/checkout-server-sdk');

// Initialize Express app
const app = express();
app.use(bodyParser.json());
app.use(cors());

// PayPal SDK configuration
const CLIENT_ID = process.env.CLIENT_ID || 'YOUR_PAYPAL_CLIENT_ID';
const CLIENT_SECRET = process.env.CLIENT_SECRET || 'YOUR_PAYPAL_CLIENT_SECRET';
const PAYPAL_API_BASE = 'https://api-m.sandbox.paypal.com'; // Use https://api-m.paypal.com for production

// Create a PayPal environment
const environment = new paypal.core.SandboxEnvironment(
  CLIENT_ID,
  CLIENT_SECRET
);
// const environment = new paypal.core.LiveEnvironment(CLIENT_ID, CLIENT_SECRET);
const client = new paypal.core.PayPalHttpClient(environment);

// Remove in-memory ordersStore and replace with PayPal API calls

// Get orders from PayPal API
app.get('/api/orders', async (req, res) => {
  try {
    // Note: PayPal doesn't have a direct "list all orders" API endpoint
    // In a real application, you would store order IDs in your database
    // and fetch individual order details as needed

    // For demonstration, we'll return an empty array with instructions
    // In production, implement proper order tracking in your database
    res.json({
      orders: [],
      message:
        "Order listing requires storing order IDs in your database. Individual orders can be fetched using PayPal's Orders API with specific order IDs.",
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get specific order details from PayPal
app.get('/api/orders/:orderID', async (req, res) => {
  try {
    const { orderID } = req.params;

    const orderDetails = await paypal.orders.get({
      id: orderID,
    });

    res.json(orderDetails);
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({ error: 'Failed to fetch order details' });
  }
});

// Get vault customers and their payment methods
app.get('/api/vault/customers', async (req, res) => {
  try {
    // PayPal doesn't have a direct API to list all customers
    // You need to track customer IDs in your database
    // For demonstration, we'll show how to work with known customer IDs

    // In production, you would:
    // 1. Query your database for customer IDs that have vaulted payment methods
    // 2. For each customer, fetch their payment tokens from PayPal

    const customers = [];
    let totalPaymentMethods = 0;
    let cardCount = 0;
    let paypalCount = 0;

    // Example: If you have customer IDs stored in your database
    // const customerIds = await getCustomerIdsFromDatabase();
    //
    // for (const customerId of customerIds) {
    //   try {
    //     const paymentTokens = await getPaymentTokensForCustomer(customerId);
    //     if (paymentTokens.length > 0) {
    //       customers.push({
    //         id: customerId,
    //         created_date: await getCustomerCreatedDate(customerId),
    //         payment_methods: paymentTokens
    //       });
    //
    //       totalPaymentMethods += paymentTokens.length;
    //       paymentTokens.forEach(token => {
    //         if (token.payment_source.card) cardCount++;
    //         if (token.payment_source.paypal) paypalCount++;
    //       });
    //     }
    //   } catch (error) {
    //     console.error(`Error fetching tokens for customer ${customerId}:`, error);
    //   }
    // }

    const stats = {
      totalCustomers: customers.length,
      totalPaymentMethods,
      cardCount,
      paypalCount,
    };

    res.json({
      customers,
      stats,
      message:
        "Customer listing requires tracking customer IDs in your database. Payment tokens are fetched from PayPal's Payment Method Tokens API.",
    });
  } catch (error) {
    console.error('Error fetching vault data:', error);
    res.status(500).json({ error: 'Failed to fetch vault data' });
  }
});

// Get payment methods for a specific customer
app.get(
  '/api/vault/customers/:customerId/payment-methods',
  async (req, res) => {
    try {
      const { customerId } = req.params;

      // Fetch payment tokens for the customer from PayPal
      const response = await fetch(
        `${PAYPAL_API_BASE}/v3/vault/payment-tokens?customer_id=${customerId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${await getPayPalAccessToken()}`,
            'PayPal-Request-Id': require('crypto').randomUUID(),
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `PayPal API error: ${response.status} - ${
            errorData.message || 'Unknown error'
          }`
        );
      }

      const data = await response.json();

      res.json({
        payment_methods: data.payment_tokens || [],
      });
    } catch (error) {
      console.error('Error fetching payment methods for customer:', error);
      res.status(500).json({ error: 'Failed to fetch payment methods' });
    }
  }
);

// Helper function to get PayPal access token
async function getPayPalAccessToken() {
  try {
    const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString(
      'base64'
    );

    const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new Error(`Token request failed: ${response.status}`);
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('Error getting PayPal access token:', error);
    throw error;
  }
}

// Update existing order creation to NOT store in memory
app.post('/api/checkout-orders', async (req, res) => {
  try {
    // ...existing order creation logic...

    const order = await paypal.orders.create(payload);

    // DO NOT store in memory - order is handled by PayPal
    // In production, you might store the order ID in your database for tracking

    res.json(order);
  } catch (error) {
    // ...existing error handling...
  }
});

// Update existing capture endpoint to NOT update stored order
app.post('/api/orders/:orderID/capture', async (req, res) => {
  try {
    const { orderID } = req.params;

    const captureData = await paypal.orders.capture({
      id: orderID,
      prefer: 'return=representation',
    });

    // DO NOT store in memory - use PayPal's Orders API to get order details

    res.json(captureData);
  } catch (error) {
    console.error('Failed to capture order:', error);
    res.status(500).json({ error: 'Failed to capture payment' });
  }
});

// Update existing authorize endpoint to NOT update stored order
app.post('/api/orders/:orderID/authorize', async (req, res) => {
  try {
    const { orderID } = req.params;

    const authData = await paypal.orders.authorize({
      id: orderID,
      prefer: 'return=representation',
    });

    // DO NOT store in memory - use PayPal's Orders API to get order details

    res.json(authData);
  } catch (error) {
    console.error('Failed to authorize order:', error);
    res.status(500).json({ error: 'Failed to authorize payment' });
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
