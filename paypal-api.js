import fetch from 'node-fetch';

// set some important variables
const { CLIENT_ID, APP_SECRET } = process.env;
const base = 'https://api-m.sandbox.paypal.com';

// handle response from PayPal API
const handleResponse = async response => {
  if (response.status === 200 || response.status === 201) {
    return response.json();
  }

  const error = new Error(await response.text());
  error.status = response.status;
  throw error;
};

// generate access token for first-time payer
export const generateAccessToken = async () => {
  console.log('generating access token for first-time payer');

  const auth = Buffer.from(CLIENT_ID + ':' + APP_SECRET).toString('base64');
  const response = await fetch(`${base}/v1/oauth2/token`, {
    method: 'post',
    body: 'grant_type=client_credentials',
    headers: {
      Authorization: `Basic ${auth}`,
    },
  });
  const jsonData = await handleResponse(response);
  return jsonData.access_token;
};

// generate access token for returning payer
export const returningAccessToken = async customerId => {
  console.log('generating access token for returning payer with customer id ');
  const auth = Buffer.from(CLIENT_ID + ':' + APP_SECRET).toString('base64');
  const response = await fetch(`${base}/v1/oauth2/token`, {
    method: 'post',
    body: `grant_type=client_credentials&response_type=id_token&target_customer_id=${customerId}`,
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  const jsonData = await handleResponse(response);
  // console.log('Returning User Access Token Response: ', jsonData);
  // console.log('ID Token Returned: ', jsonData.id_token);

  return jsonData.id_token;
};

// create order request
export const createOrder = async () => {
  // console.log('creating order');
  const purchaseAmount = '100.00'; // TODO: pull prices from a database
  const accessToken = await generateAccessToken();
  const url = `${base}/v2/checkout/orders`;
  const response = await fetch(url, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: 'USD',
            value: purchaseAmount,
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
            return_url: 'http://example.com',
            cancel_url: 'http://example.com',
            shipping_preference: 'NO_SHIPPING',
          },
        },
      },
    }),
  });

  return handleResponse(response);
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

// create vault setup token
export const createVaultSetupToken = async ({ paymentSource }) => {
  // console.log('creating vault setup token for payment source:', paymentSource);
  const paymentSources = {
    paypal: {
      description: 'Description for PayPal to be shown to PayPal payer',
      usage_pattern: 'IMMEDIATE',
      usage_type: 'MERCHANT',
      customer_type: 'CONSUMER',
      experience_context: {
        shipping_preference: 'NO_SHIPPING',
        payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
        brand_name: 'EXAMPLE INC',
        locale: 'en-US',
        return_url: 'https://example.com/returnUrl',
        cancel_url: 'https://example.com/cancelUrl',
      },
    },
    card: {
      experience_context: {
        shipping_preference: 'NO_SHIPPING',
      },
    },
  };

  const response = await fetch(`${base}/v3/vault/setup-tokens`, {
    method: 'post',
    headers: {
      'PayPal-Request-Id': Date.now().toString(),
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await generateAccessToken()}`,
    },
    body: JSON.stringify({
      payment_source: {
        [paymentSource]: paymentSources[paymentSource],
      },
    }),
  });

  return handleResponse(response);
};

// create vault payment token
export const createVaultPaymentToken = async vaultSetupToken => {
  const response = await fetch(`${base}/v3/vault/payment-tokens`, {
    method: 'post',
    headers: {
      'PayPal-Request-Id': Date.now().toString(),
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await generateAccessToken()}`,
    },
    body: JSON.stringify({
      payment_source: {
        token: {
          id: vaultSetupToken,
          type: 'SETUP_TOKEN',
        },
      },
    }),
  });

  return handleResponse(response);
};

// create payment token from customer ID
export const createPaymentTokenFromCustomerId = async customerId => {
  const accessToken = await generateAccessToken();
  const response = await fetch(`${base}/v3/vault/payment-tokens`, {
    method: 'post',
    headers: {
      'PayPal-Request-Id': Date.now().toString(),
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      payment_source: {
        customer: {
          id: customerId,
          type: 'CUSTOMER_ID',
        },
      },
    }),
  });

  return handleResponse(response);
};

// get payment tokens from customer ID
export const fetchPaymentTokens = async customerId => {
  const accessToken = await generateAccessToken();
  const response = await fetch(
    `https://api-m.sandbox.paypal.com/v3/vault/payment-tokens?customer_id=${customerId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  const data = await response.json();
  return data.payment_tokens || [];
};
