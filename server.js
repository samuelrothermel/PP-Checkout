// Import required modules
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import crypto from 'crypto';

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

// Get orders from PayPal API using provided order IDs
app.post('/api/orders', async (req, res) => {
  try {
    const { orderIds } = req.body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.json({
        orders: [],
        message:
          'No order IDs provided. Please provide an array of order IDs to fetch.',
      });
    }

    console.log('Fetching orders for IDs:', orderIds);
    const orders = [];

    // Fetch each order individually from PayPal's Orders API using SDK
    for (const orderIdObj of orderIds) {
      const orderId = orderIdObj.id || orderIdObj;
      try {
        console.log(`Fetching order details for: ${orderId}`);

        // Create the request using PayPal SDK
        const request = new paypal.orders.OrdersGetRequest(orderId);

        // Execute the request using the PayPal client
        const order = await client.execute(request);

        orders.push({
          ...order.result,
          client_order_timestamp: orderIdObj.timestamp || null,
        });
      } catch (orderError) {
        console.error(`Error fetching order ${orderId}:`, orderError);
        // Continue with other orders even if one fails
        orders.push({
          id: orderId,
          error: `Failed to fetch order details: ${orderError.message}`,
          client_order_timestamp: orderIdObj.timestamp || null,
        });
      }
    }

    res.json({
      orders: orders.reverse(), // Show most recent first
      totalCount: orders.length,
      message: orders.length > 0 ? null : 'No valid orders found.',
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

// Get vault customers and their payment methods using provided customer IDs
app.post('/api/vault/customers', async (req, res) => {
  try {
    const { customerIds } = req.body;

    if (
      !customerIds ||
      !Array.isArray(customerIds) ||
      customerIds.length === 0
    ) {
      return res.json({
        customers: [],
        stats: {
          totalCustomers: 0,
          totalPaymentMethods: 0,
          cardCount: 0,
          paypalCount: 0,
        },
        message:
          'No customer IDs provided. Please provide an array of customer IDs to fetch.',
      });
    }

    console.log('Fetching vault data for customer IDs:', customerIds);
    const customers = [];
    let totalPaymentMethods = 0;
    let cardCount = 0;
    let paypalCount = 0;

    // Fetch payment tokens for each customer from PayPal's Payment Method Tokens API
    for (const customerIdObj of customerIds) {
      const customerId = customerIdObj.id || customerIdObj;
      try {
        console.log(`Fetching payment tokens for customer: ${customerId}`);

        const response = await fetch(
          `${PAYPAL_API_BASE}/v3/vault/payment-tokens?customer_id=${customerId}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${await getPayPalAccessToken()}`,
              'PayPal-Request-Id': crypto.randomUUID(),
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          const paymentTokens = data.payment_tokens || [];

          if (paymentTokens.length > 0) {
            customers.push({
              id: customerId,
              created_date: customerIdObj.timestamp || null,
              payment_methods: paymentTokens,
            });

            totalPaymentMethods += paymentTokens.length;
            paymentTokens.forEach(token => {
              if (token.payment_source?.card) cardCount++;
              if (token.payment_source?.paypal) paypalCount++;
              if (token.payment_source?.venmo) paypalCount++; // Count venmo as paypal family
            });
          } else {
            // Include customer even if no payment methods found
            customers.push({
              id: customerId,
              created_date: customerIdObj.timestamp || null,
              payment_methods: [],
            });
          }
        } else {
          console.error(
            `Error fetching tokens for customer ${customerId}: ${response.status}`
          );
          // Include customer with error info
          customers.push({
            id: customerId,
            created_date: customerIdObj.timestamp || null,
            payment_methods: [],
            error: `Failed to fetch payment methods: ${response.status}`,
          });
        }
      } catch (error) {
        console.error(
          `Error fetching tokens for customer ${customerId}:`,
          error
        );
        customers.push({
          id: customerId,
          created_date: customerIdObj.timestamp || null,
          payment_methods: [],
          error: error.message,
        });
      }
    }

    const stats = {
      totalCustomers: customers.length,
      totalPaymentMethods,
      cardCount,
      paypalCount,
    };

    res.json({
      customers: customers.reverse(), // Show most recent first
      stats,
      message: customers.length > 0 ? null : 'No valid customers found.',
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
            'PayPal-Request-Id': crypto.randomUUID(),
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
