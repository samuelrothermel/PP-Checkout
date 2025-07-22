import fetch from 'node-fetch';
import { generateAccessToken } from './paypal-api.js';

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
        return_url: 'https://example.com/return',
        cancel_url: 'https://example.com/cancel',
        user_action: 'PAY_NOW',
        shipping_preference: shippingPreference,
      },
    };

    // Add customer ID if provided for returning users with payment methods
    if (customerId) {
      payment_source.paypal.attributes.customer = {
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
      intent: 'CAPTURE',
      purchase_units: [purchaseUnit],
      payment_source,
    }),
  });

  return handleResponse(response);
};
