export const BASE_URL = process.env.BASE_URL || 'http://localhost:8888';
export const PORT = process.env.PORT || 8888;
export const CLIENT_ID = process.env.CLIENT_ID;
export const WEBHOOK_ID = process.env.WEBHOOK_ID;
export const WEBHOOK_URL = process.env.WEBHOOK_URL;

export const CALLBACK_URL =
  'https://pp-checkout.onrender.com/api/shipping-callback';

console.log('Callback URL:', CALLBACK_URL);
console.log('Webhook URL:', WEBHOOK_URL);
console.log('Webhook ID:', WEBHOOK_ID);
console.log(
  'CLIENT_ID:',
  CLIENT_ID ? `${CLIENT_ID.substring(0, 10)}...` : 'NOT SET'
);
console.log('BASE_URL:', BASE_URL);
