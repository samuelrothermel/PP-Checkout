import fetch from 'node-fetch';
import { generateAccessToken } from './authApi.js';

// create billing agreement token
export async function createBillingAgreementToken() {
  const accessToken = await generateAccessToken();
  const res = await fetch(
    'https://api-m.sandbox.paypal.com/v1/billing-agreements/agreement-tokens',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        description: 'Billing Agreement',
        shipping_address: {
          line1: '123 Main St.',
          line2: 'Suite #4',
          city: 'New York',
          state: 'NY',
          postal_code: '12345',
          country_code: 'US',
          recipient_name: 'John Doe',
        },
        payer: {
          payment_method: 'PAYPAL',
        },
        plan: {
          type: 'MERCHANT_INITIATED_BILLING',
          merchant_preferences: {
            return_url: 'https://example.com/return',
            cancel_url: 'https://example.com/cancel',
            notify_url: 'https://example.com/notify',
            accepted_pymt_type: 'INSTANT',
            skip_shipping_address: false,
            immutable_shipping_address: true,
          },
        },
      }),
    }
  );
  return await res.json();
}

// create billing agreement with token
export async function createBillingAgreement(token) {
  const accessToken = await generateAccessToken();
  const res = await fetch(
    'https://api-m.sandbox.paypal.com/v1/billing-agreements/agreements',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token_id: token }),
    }
  );
  return await res.json();
}
