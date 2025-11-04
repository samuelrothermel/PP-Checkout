import fetch from 'node-fetch';
import { generateAccessToken } from './authApi.js';

// set some important variables
const base = 'https://api-m.sandbox.paypal.com';

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
      verification_method: 'SCA_WHEN_REQUIRED',
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

  console.log(
    'Create Vault Setup Token Response: ',
    JSON.stringify(await response.clone().json(), null, 2)
  );
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

  const jsonResponse = await response.clone().json();
  console.log(
    'Create Vault Payment Token Response: ',
    JSON.stringify(jsonResponse, null, 2)
  );
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
  console.log('Fetching payment tokens for customer ID:', customerId);
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
  console.log('Payment Tokens Response: ', data);
  return data.payment_tokens || [];
};

// create order with payment token for recurring payment
export const createRecurringOrder = async paymentTokenId => {
  console.log(
    'Creating order with payment token for recurring payment:',
    paymentTokenId
  );

  const accessToken = await generateAccessToken();
  const response = await fetch(`${base}/v2/checkout/orders`, {
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
            value: '100.00', // Monthly fee
          },
        },
      ],
      payment_source: {
        token: {
          id: paymentTokenId,
          type: 'PAYMENT_METHOD_TOKEN',
        },
        stored_credential: {
          payment_initiator: 'MERCHANT',
          payment_type: 'RECURRING',
          usage: 'SUBSEQUENT',
        },
      },
    }),
  });

  console.log(
    'Create Recurring Order Response: ',
    await response.clone().text()
  );
  return handleResponse(response);
};

// create recurring payment setup token
export const createRecurringSetupToken = async ({ paymentSource }) => {
  console.log(
    'Creating recurring payment setup token for payment source:',
    paymentSource
  );

  // Current date
  const today = new Date();
  const formattedDate = today.toISOString().split('T')[0];

  const paymentSources = {
    paypal: {
      usage_type: 'MERCHANT',
      usage_pattern: 'UNSCHEDULED_POSTPAID',
      billing_plan: {
        billing_cycles: [
          {
            tenure_type: 'REGULAR',
            pricing_scheme: {
              pricing_model: 'AUTO_RELOAD',
              price: {
                value: '10',
                currency_code: 'USD',
              },
            },
            frequency: {
              interval_unit: 'MONTH',
              interval_count: '1',
            },
            total_cycles: '1',
            start_date: formattedDate,
          },
        ],
        one_time_charges: {
          product_price: {
            value: '10',
            currency_code: 'USD',
          },
          total_amount: {
            value: '10',
            currency_code: 'USD',
          },
        },
        product: {
          description: 'Monthly Membership',
          quantity: '1',
        },
        name: "Sam's Recurring Monthly Membership Plan",
      },
      experience_context: {
        return_url: 'https://example.com/returnUrl',
        cancel_url: 'https://example.com/cancelUrl',
        shipping_preference: 'NO_SHIPPING',
        payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
        brand_name: 'EXAMPLE INC',
        locale: 'en-US',
      },
    },
    card: {
      verification_method: 'SCA_WHEN_REQUIRED',
      experience_context: {
        shipping_preference: 'NO_SHIPPING',
      },
    },
  };

  const response = await fetch(`${base}/v3/vault/setup-tokens`, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await generateAccessToken()}`,
    },
    body: JSON.stringify({
      payment_source: {
        [paymentSource]: paymentSources[paymentSource],
      },
    }),
  });

  console.log(
    'Create Recurring Setup Token Response: ',
    JSON.stringify(await response.clone().json(), null, 2)
  );
  return handleResponse(response);
};
