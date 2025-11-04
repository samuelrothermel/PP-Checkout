import { generateAccessToken } from '../services/authApi.js';
import fetch from 'node-fetch';
import { CLIENT_ID } from '../config/constants.js';

// Create client token for SDK initialization
export const generateClientToken = async (req, res, next) => {
  try {
    console.log('Generating client token for SDK initialization');

    // Get access token first
    const accessToken = await generateAccessToken();

    // Generate client token
    const response = await fetch(
      'https://api-m.sandbox.paypal.com/v1/identity/generate-token',
      {
        method: 'post',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();

    if (response.status !== 200) {
      console.error('Failed to generate client token:', data);
      return res.status(response.status).json({
        error: 'Failed to generate client token',
        details: data,
      });
    }

    // Return both the token and clientId for convenient frontend usage
    res.json({
      clientId: CLIENT_ID,
      clientToken: data.client_token,
    });
  } catch (err) {
    console.error('Error generating client token:', err);
    next(err);
  }
};
