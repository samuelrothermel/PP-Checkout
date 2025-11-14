import fetch from 'node-fetch';

// set some important variables
const { CLIENT_ID, APP_SECRET, CLIENT_ID_2, APP_SECRET_2 } = process.env;
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

// generate access token for first-time payer
export const generateAccessToken = async () => {
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

// generate access token for specific merchant (1 or 2)
export const generateAccessTokenForMerchant = async (merchantNumber = 1) => {
  let clientId, appSecret;

  if (merchantNumber === 2) {
    clientId = CLIENT_ID_2;
    appSecret = APP_SECRET_2;

    if (!clientId || !appSecret) {
      throw new Error(
        'Second merchant credentials (CLIENT_ID_2, APP_SECRET_2) not configured in .env'
      );
    }
  } else {
    clientId = CLIENT_ID;
    appSecret = APP_SECRET;
  }

  const auth = Buffer.from(clientId + ':' + appSecret).toString('base64');
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
  console.log('API Request: POST /v1/oauth2/token (returning payer)');
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
  return jsonData.id_token;
};

// generate user ID token for first-time payer (required for Venmo vaulting)
export const generateUserIdToken = async () => {
  console.log('API Request: POST /v1/oauth2/token (first-time payer ID token)');
  const auth = Buffer.from(CLIENT_ID + ':' + APP_SECRET).toString('base64');
  const response = await fetch(`${base}/v1/oauth2/token`, {
    method: 'post',
    body: 'grant_type=client_credentials&response_type=id_token',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  const jsonData = await handleResponse(response);
  return jsonData.id_token;
};
