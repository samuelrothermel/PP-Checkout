import fetch from 'node-fetch';
import paypal from '@paypal/checkout-server-sdk';
import {
  generateAccessToken,
  generateAccessTokenForMerchant,
} from './authApi.js';

// PayPal SDK configuration (reuse from authApi if available, otherwise define here)
const CLIENT_ID = process.env.CLIENT_ID || 'YOUR_PAYPAL_CLIENT_ID';
const CLIENT_SECRET = process.env.CLIENT_SECRET || 'YOUR_PAYPAL_CLIENT_SECRET';

// Create a PayPal environment
const environment = new paypal.core.SandboxEnvironment(
  CLIENT_ID,
  CLIENT_SECRET
);
const client = new paypal.core.PayPalHttpClient(environment);

// set some important variables
const base = 'https://api-m.sandbox.paypal.com';
const CALLBACK_URL = 'https://pp-checkout.onrender.com/api/shipping-callback';

// handle response from PayPal API
const handleResponse = async response => {
  if (response.status === 200 || response.status === 201) {
    return response.json();
  }
  console.log('Error Response: ', response);
  const error = new Error(await response.text());
  error.status = response.status;
  throw error;
};

// create order request
export const createCheckoutOrder = async orderData => {
  console.log(
    'creating order from Checkout Page with data:',
    JSON.stringify(orderData)
  );
  const {
    shippingInfo,
    billingInfo,
    totalAmount,
    paymentSource,
    customerId,
    vault,
  } = orderData;
  const purchaseAmount = totalAmount || '100.00'; // Use provided amount or default to 100.00 (minimum $30 for Pay Later)
  const accessToken = await generateAccessToken();

  let shippingPreference = 'GET_FROM_FILE';
  let shippingDetails = {};

  if (shippingInfo) {
    shippingPreference = 'SET_PROVIDED_ADDRESS';
    shippingDetails = {
      name: {
        full_name: `${shippingInfo.firstName} ${shippingInfo.lastName}`,
      },
      address: {
        address_line_1: shippingInfo.address.addressLine1,
        admin_area_2: shippingInfo.address.adminArea2,
        admin_area_1: shippingInfo.address.adminArea1,
        postal_code: shippingInfo.address.postalCode,
        country_code: shippingInfo.address.countryCode,
      },
    };
  }

  console.log('Shipping Address: ', shippingDetails);

  // Log customer ID if provided
  if (customerId) {
    console.log('Customer ID provided for returning user:', customerId);
  }

  // Build payment_source object dynamically
  let payment_source = {};
  if (paymentSource === 'paypal') {
    payment_source.paypal = {
      experience_context: {
        return_url: 'http://localhost:8888/',
        cancel_url: 'https://example.com/cancel',
        user_action: 'PAY_NOW',
        shipping_preference: shippingPreference,
        brand_name: 'Your Store Name',
        locale: 'en-US',
        landing_page: 'LOGIN',
      },
    };

    // Add vault attributes if requested
    if (vault) {
      payment_source.paypal.attributes = {
        vault: {
          store_in_vault: 'ON_SUCCESS',
          usage_type: 'MERCHANT',
          customer_type: 'CONSUMER',
        },
      };
    }

    // Add customer ID if provided for returning users with payment methods
    if (customerId) {
      if (!payment_source.paypal.attributes) {
        payment_source.paypal.attributes = {};
      }
      payment_source.paypal.attributes.customer = {
        id: customerId,
      };
    }
  } else if (paymentSource === 'venmo') {
    payment_source.venmo = {
      experience_context: {
        return_url: 'http://localhost:8888/',
        cancel_url: 'https://example.com/cancel',
        shipping_preference: shippingPreference,
      },
    };

    // Add vault attributes if requested
    if (vault) {
      payment_source.venmo.attributes = {
        vault: {
          store_in_vault: 'ON_SUCCESS',
          usage_type: 'MERCHANT',
          customer_type: 'CONSUMER',
        },
      };
    }

    // Add customer ID if provided for returning users with payment methods
    if (customerId) {
      if (!payment_source.venmo.attributes) {
        payment_source.venmo.attributes = {};
      }
      payment_source.venmo.attributes.customer = {
        id: customerId,
      };
    }
  } else if (paymentSource === 'card') {
    payment_source.card = {
      attributes: {
        vault: {
          store_in_vault: 'ON_SUCCESS',
          usage_type: 'MERCHANT',
          customer_type: 'CONSUMER',
        },
      },
    };

    // Add customer name from billing or shipping info
    const nameInfo = billingInfo || shippingInfo;
    if (nameInfo) {
      payment_source.card.name = `${nameInfo.firstName} ${nameInfo.lastName}`;
    }

    // Add billing address if provided, otherwise use shipping address
    const addressInfo = billingInfo || shippingInfo;
    if (addressInfo) {
      payment_source.card.billing_address = {
        address_line_1: addressInfo.address.addressLine1,
        admin_area_2: addressInfo.address.adminArea2,
        admin_area_1: addressInfo.address.adminArea1,
        postal_code: addressInfo.address.postalCode,
        country_code: addressInfo.address.countryCode,
      };
    }

    // Add customer ID if provided for returning users with payment methods
    if (customerId) {
      payment_source.card.attributes.customer = {
        id: customerId,
      };
    }
  } else if (paymentSource === 'apple_pay') {
    payment_source.apple_pay = {};

    // Add vault attributes if requested
    if (vault) {
      payment_source.apple_pay.attributes = {
        vault: {
          store_in_vault: 'ON_SUCCESS',
          usage_type: 'MERCHANT',
          customer_type: 'CONSUMER',
        },
      };

      // Add customer ID if provided for returning users with payment methods
      if (customerId) {
        payment_source.apple_pay.attributes.customer = {
          id: customerId,
        };
      }
    } else if (customerId) {
      // Add customer ID even without vault if provided
      payment_source.apple_pay.attributes = {
        customer: {
          id: customerId,
        },
      };
    }
  } else if (paymentSource === 'google_pay') {
    payment_source.google_pay = {};

    // Add vault attributes if requested
    if (vault) {
      payment_source.google_pay.attributes = {
        vault: {
          store_in_vault: 'ON_SUCCESS',
          usage_type: 'MERCHANT',
          customer_type: 'CONSUMER',
        },
      };

      // Add customer ID if provided for returning users with payment methods
      if (customerId) {
        payment_source.google_pay.attributes.customer = {
          id: customerId,
        };
      }
    } else if (customerId) {
      // Add customer ID even without vault if provided
      payment_source.google_pay.attributes = {
        customer: {
          id: customerId,
        },
      };
    }
  }

  // Debug: Log the final payment_source object
  console.log(
    'Final payment_source object:',
    JSON.stringify(payment_source, null, 2)
  );

  // Build purchase unit with shipping details if provided
  const purchaseUnit = {
    amount: {
      currency_code: 'USD',
      value: purchaseAmount,
    },
  };

  // Add shipping details to purchase unit if provided
  if (shippingInfo && Object.keys(shippingDetails).length > 0) {
    purchaseUnit.shipping = shippingDetails;
  }

  // Always use AUTHORIZE intent for all checkout orders
  const intent = 'AUTHORIZE';
  console.log(`Using intent: ${intent} (vault requested: ${vault})`);

  const url = `${base}/v2/checkout/orders`;
  const response = await fetch(url, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      'PayPal-Request-Id': Date.now().toString(),
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      intent,
      purchase_units: [purchaseUnit],
      payment_source,
    }),
  });

  return handleResponse(response);
};

// create upstream order request (server-side shipping callbacks)
export const createUpstreamQlOrder = async totalAmount => {
  const accessToken = await generateAccessToken();
  const payload = {
    intent: 'CAPTURE',
    payment_source: {
      paypal: {
        experience_context: {
          user_action: 'PAY_NOW',
          shipping_preference: 'GET_FROM_FILE',
          // contact_preference: 'UPDATE_CONTACT_INFO',
          return_url: 'https://pp-checkout.onrender.com/product-cart',
          cancel_url: 'https://pp-checkout.onrender.com/product-cart',
          app_switch_preference: {
            launch_paypal_app: true,
          },
          order_update_callback_config: {
            callback_events: ['SHIPPING_ADDRESS'],
            // callback_events: ['SHIPPING_ADDRESS', 'SHIPPING_OPTIONS'],
            callback_url: CALLBACK_URL,
          },
        },
      },
    },
    purchase_units: [
      {
        amount: {
          currency_code: 'USD',
          value: totalAmount,
          breakdown: {
            item_total: {
              currency_code: 'USD',
              value: totalAmount,
            },
            shipping: {
              currency_code: 'USD',
              value: '0.00',
            },
          },
        },
        shipping: {
          options: [
            {
              id: '1',
              amount: {
                currency_code: 'USD',
                value: '0.00',
              },
              type: 'SHIPPING',
              label: 'Free Shipping',
              selected: true,
            },
            {
              id: '2',
              amount: {
                currency_code: 'USD',
                value: '10.00',
              },
              type: 'SHIPPING',
              label: 'Express Shipping',
              selected: false,
            },
          ],
        },
      },
    ],
  };

  const response = await fetch(`${base}/v2/checkout/orders`, {
    method: 'post',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  console.log('Create Order Response: ', await response.clone().json());
  return await handleResponse(response);
};

// capture payment request
export const capturePayment = async orderId => {
  // console.log('capturing payment with order ID:', orderId);
  const accessToken = await generateAccessToken();
  const url = `${base}/v2/checkout/orders/${orderId}/capture`;
  const response = await fetch(url, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return handleResponse(response);
};

// authorize payment request
export const authorizePayment = async orderId => {
  console.log('authorizing payment with order ID:', orderId);
  const accessToken = await generateAccessToken();
  const url = `${base}/v2/checkout/orders/${orderId}/authorize`;
  const response = await fetch(url, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return handleResponse(response);
};

// Create order with Billing Agreement ID
export async function createOrderWithBillingAgreement(
  billingAgreementId,
  amount = '10.00'
) {
  const accessToken = await generateAccessToken();
  console.log('billingAgreementId: ', billingAgreementId);
  const payload = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        amount: {
          currency_code: 'USD',
          value: amount,
        },
      },
    ],
    payment_source: {
      token: {
        id: billingAgreementId,
        type: 'BILLING_AGREEMENT',
      },
    },
  };
  console.log('Order payload:', JSON.stringify(payload, null, 2));
  const response = await fetch(
    'https://api-m.sandbox.paypal.com/v2/checkout/orders',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    }
  );
  console.log('Create Order with Billing Agreement Response: ', response);
  return handleResponse(response);
}

// Test function: Create one-time order with different payee
export const createOneTimeOrderWithPayee = async (
  payeeMerchantId,
  amount = '10.00'
) => {
  const accessToken = await generateAccessToken();

  const payload = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        amount: {
          currency_code: 'USD',
          value: amount,
        },
        payee: {
          merchant_id: payeeMerchantId,
        },
      },
    ],
    payment_source: {
      paypal: {
        experience_context: {
          return_url: 'http://localhost:8888/success',
          cancel_url: 'http://localhost:8888/cancel',
          user_action: 'CONTINUE',
          shipping_preference: 'NO_SHIPPING',
        },
      },
    },
  };

  console.log(
    'Creating one-time order with payee:',
    JSON.stringify(payload, null, 2)
  );

  const response = await fetch(`${base}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'PayPal-Request-Id': Date.now().toString(),
    },
    body: JSON.stringify(payload),
  });

  return handleResponse(response);
};

// Test function: Create vaulted order with different payee
export const createVaultedOrderWithPayee = async (
  vaultedToken,
  payeeMerchantId,
  amount = '10.00'
) => {
  const accessToken = await generateAccessToken();

  const payload = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        amount: {
          currency_code: 'USD',
          value: amount,
        },
        payee: {
          merchant_id: payeeMerchantId,
        },
      },
    ],
    payment_source: {
      paypal: {
        vault_id: vaultedToken,
      },
    },
  };

  console.log(
    'Creating vaulted order with payee:',
    JSON.stringify(payload, null, 2)
  );

  const response = await fetch(`${base}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'PayPal-Request-Id': Date.now().toString(),
    },
    body: JSON.stringify(payload),
  });

  return handleResponse(response);
};

// Test 2A: Create order with vaulting enabled and return order for approval
export const createOrderWithVaulting = async (
  amount = '10.00',
  merchantNumber = 1
) => {
  const accessToken = await generateAccessTokenForMerchant(merchantNumber);

  const createPayload = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        amount: {
          currency_code: 'USD',
          value: amount,
        },
      },
    ],
    payment_source: {
      paypal: {
        attributes: {
          vault: {
            store_in_vault: 'ON_SUCCESS',
            usage_type: 'MERCHANT',
            customer_type: 'CONSUMER',
          },
        },
        experience_context: {
          return_url: 'http://localhost:8888/success',
          cancel_url: 'http://localhost:8888/cancel',
          user_action: 'CONTINUE',
          shipping_preference: 'NO_SHIPPING',
        },
      },
    },
  };

  console.log(
    `Creating order with vaulting for merchant ${merchantNumber}:`,
    JSON.stringify(createPayload, null, 2)
  );

  const createResponse = await fetch(`${base}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'PayPal-Request-Id': Date.now().toString(),
    },
    body: JSON.stringify(createPayload),
  });

  const orderResult = await handleResponse(createResponse);
  console.log(
    `Order created: ${orderResult.id}, status: ${orderResult.status}`
  );

  return {
    orderId: orderResult.id,
    status: orderResult.status,
    approvalUrl: orderResult.links.find(link => link.rel === 'approve')?.href,
    merchantNumber: merchantNumber,
    orderDetails: orderResult,
  };
};

// Test 2B & 2C: Create order using vault_id with different payee/merchant
export const createOrderWithVaultId = async (
  vaultId,
  payeeMerchantId,
  amount = '10.00',
  merchantNumber = 1
) => {
  const accessToken = await generateAccessTokenForMerchant(merchantNumber);

  // Import the function to get payment token details
  const { getPaymentTokenDetails } = await import('./tokensApi.js');

  // Get the payment token details to determine the correct payment source
  let tokenDetails;
  try {
    tokenDetails = await getPaymentTokenDetails(vaultId);
    console.log(
      'Token details for vault_id:',
      JSON.stringify(tokenDetails, null, 2)
    );
  } catch (error) {
    console.error('Error fetching token details:', error);
    throw new Error(
      `Unable to retrieve payment token details for vault_id: ${vaultId}`
    );
  }

  // Determine the payment source based on the token details
  let payment_source = {};

  if (tokenDetails.payment_source?.apple_pay) {
    payment_source = {
      apple_pay: {
        vault_id: vaultId,
      },
    };
  } else if (tokenDetails.payment_source?.google_pay) {
    payment_source = {
      google_pay: {
        vault_id: vaultId,
      },
    };
  } else if (tokenDetails.payment_source?.card) {
    payment_source = {
      card: {
        vault_id: vaultId,
      },
    };
  } else if (tokenDetails.payment_source?.paypal) {
    payment_source = {
      paypal: {
        vault_id: vaultId,
      },
    };
  } else {
    // Fallback to paypal if we can't determine the source
    console.warn(
      'Unable to determine payment source from token details, defaulting to paypal'
    );
    payment_source = {
      paypal: {
        vault_id: vaultId,
      },
    };
  }

  const payload = {
    intent: 'AUTHORIZE',
    purchase_units: [
      {
        amount: {
          currency_code: 'USD',
          value: amount,
        },
        payee: {
          merchant_id: payeeMerchantId,
        },
      },
    ],
    payment_source: payment_source,
  };

  console.log(
    `Creating order with vault_id for merchant ${merchantNumber}:`,
    JSON.stringify(payload, null, 2)
  );

  const response = await fetch(`${base}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'PayPal-Request-Id': Date.now().toString(),
    },
    body: JSON.stringify(payload),
  });

  return handleResponse(response);
};

// Capture payment with specific merchant credentials
export const capturePaymentWithMerchant = async (
  orderId,
  merchantNumber = 1
) => {
  const accessToken = await generateAccessTokenForMerchant(merchantNumber);
  const url = `${base}/v2/checkout/orders/${orderId}/capture`;

  console.log(
    `Capturing order ${orderId} with merchant ${merchantNumber} credentials`
  );

  const response = await fetch(url, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return handleResponse(response);
};

// Create and capture order using vault_id (for Apple Pay and other vaulted payment methods)
export const createOrderWithVaultIdAndCapture = async (
  vaultId,
  amount = '10.00',
  merchantNumber = 1
) => {
  const accessToken = await generateAccessTokenForMerchant(merchantNumber);

  // Import the function to get payment token details
  const { getPaymentTokenDetails } = await import('./tokensApi.js');

  // Get the payment token details to determine the correct payment source
  let tokenDetails;
  try {
    tokenDetails = await getPaymentTokenDetails(vaultId);
    console.log('Token details:', JSON.stringify(tokenDetails, null, 2));
  } catch (error) {
    console.error('Error fetching token details:', error);
    throw new Error(
      `Unable to retrieve payment token details for vault_id: ${vaultId}`
    );
  }

  // Determine the payment source based on the token details
  let payment_source = {};

  if (tokenDetails.payment_source?.apple_pay) {
    payment_source = {
      apple_pay: {
        vault_id: vaultId,
      },
    };
  } else if (tokenDetails.payment_source?.google_pay) {
    payment_source = {
      google_pay: {
        vault_id: vaultId,
      },
    };
  } else if (tokenDetails.payment_source?.card) {
    payment_source = {
      card: {
        vault_id: vaultId,
      },
    };
  } else if (tokenDetails.payment_source?.paypal) {
    payment_source = {
      paypal: {
        vault_id: vaultId,
      },
    };
  } else {
    // Fallback to paypal if we can't determine the source
    console.warn(
      'Unable to determine payment source from token details, defaulting to paypal'
    );
    payment_source = {
      paypal: {
        vault_id: vaultId,
      },
    };
  }

  const createPayload = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        amount: {
          currency_code: 'USD',
          value: amount,
        },
      },
    ],
    payment_source: payment_source,
  };

  console.log(
    `Creating and capturing order with vault_id for merchant ${merchantNumber}:`,
    JSON.stringify(createPayload, null, 2)
  );

  const response = await fetch(`${base}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'PayPal-Request-Id': Date.now().toString(),
    },
    body: JSON.stringify(createPayload),
  });

  const result = await handleResponse(response);
  console.log(
    `Order created and captured: ${result.id}, status: ${result.status}`
  );

  return result;
};

// Fetch multiple orders by ID array using PayPal SDK
export const getOrdersByIds = async orderIds => {
  console.log('Fetching orders for IDs:', orderIds);
  const orders = [];

  if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
    return {
      orders: [],
      message:
        'No order IDs provided. Please provide an array of order IDs to fetch.',
    };
  }

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

  return {
    orders: orders.reverse(), // Show most recent first
    totalCount: orders.length,
    message: orders.length > 0 ? null : 'No valid orders found.',
  };
};
