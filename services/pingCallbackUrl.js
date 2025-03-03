import fetch from 'node-fetch';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8888';
const CALLBACK_URL = `${BASE_URL}/api/shipping-callback`;

export const pingCallbackUrl = async () => {
  try {
    const response = await fetch(CALLBACK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: 'test',
        shipping_address: {
          country_code: 'US',
          admin_area_1: 'CA',
          admin_area_2: 'San Francisco',
          postal_code: '94107',
        },
        shipping_option: {
          id: '1',
          amount: {
            currency_code: 'USD',
            value: '0.00',
          },
          type: 'SHIPPING',
          label: 'Free Shipping',
        },
        purchase_units: [
          {
            reference_id: 'test',
            amount: {
              currency_code: 'USD',
              value: '100.00',
            },
          },
        ],
      }),
    });

    const contentType = response.headers.get('content-type');
    let data;
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }
    console.log('Ping callback URL response:', data);
  } catch (error) {
    console.error('Error pinging callback URL:', error);
  }
};
