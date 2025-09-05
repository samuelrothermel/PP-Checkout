import fetch from 'node-fetch';
import { generateAccessToken } from './authApi.js';

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
    paymentSource = 'paypal',
    customerId,
  } = orderData;
  const purchaseAmount = totalAmount || '100.00'; // Use provided amount or default to 100.00
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
      attributes: {
        vault: {
          store_in_vault: 'ON_SUCCESS',
          usage_type: 'MERCHANT',
          customer_type: 'CONSUMER',
        },
      },
      experience_context: {
        return_url: 'http://localhost:8888/',
        cancel_url: 'https://example.com/cancel',
        user_action: 'CONTINUE',
        shipping_preference: shippingPreference,
      },
    };

    // Add customer ID if provided for returning users with payment methods
    if (customerId) {
      payment_source.paypal.attributes.customer = {
        id: customerId,
      };
    }
  } else if (paymentSource === 'venmo') {
    payment_source.venmo = {
      // attributes: {
      //   vault: {
      //     store_in_vault: 'ON_SUCCESS',
      //     usage_type: 'MERCHANT',
      //     customer_type: 'CONSUMER',
      //   },
      // },
      experience_context: {
        return_url: 'http://localhost:8888/',
        cancel_url: 'https://example.com/cancel',

        shipping_preference: shippingPreference,
      },
    };

    // Add customer ID if provided for returning users with payment methods
    if (customerId) {
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

  const url = `${base}/v2/checkout/orders`;
  const response = await fetch(url, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      'PayPal-Request-Id': Date.now().toString(),
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      intent: 'AUTHORIZE',
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
