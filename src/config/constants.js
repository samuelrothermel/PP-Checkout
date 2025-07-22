export const BASE_URL = process.env.BASE_URL || 'http://localhost:8888';
export const PORT = process.env.PORT || 8888;
export const CLIENT_ID = process.env.CLIENT_ID;

export const CALLBACK_URL =
  'https://pp-checkout.onrender.com/api/shipping-callback';

console.log('Callback URL:', CALLBACK_URL);
