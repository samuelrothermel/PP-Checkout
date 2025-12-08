import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { BASE_URL, PORT } from './src/config/constants.js';
import { handleError } from './src/config/errorHandler.js';
import pageRoutes from './src/routes/pages.js';
import apiRoutes from './src/routes/api.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Debug: Check if CLIENT_ID is loaded
console.log('=== ENVIRONMENT CHECK ===');
console.log(
  'CLIENT_ID:',
  process.env.CLIENT_ID
    ? `${process.env.CLIENT_ID.substring(0, 20)}...`
    : 'NOT LOADED'
);
console.log('BASE_URL:', process.env.BASE_URL);
console.log('========================');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// CORS configuration
const corsOptions = {
  credentials: true,
  origin: [BASE_URL],
};

// Express configuration
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(cors(corsOptions));

// Security middleware - Content Security Policy
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://www.sandbox.paypal.com https://www.paypal.com https://sandbox.paypal.com https://paypal.com https://js.paypal.com https://js.sandbox.paypal.com https://applepay.cdn-apple.com https://appleid.cdn-apple.com https://pay.google.com https://*.google.com https://google.com https://www.gstatic.com; " +
      "connect-src 'self' https://www.sandbox.paypal.com https://www.paypal.com https://sandbox.paypal.com https://paypal.com https://api-m.sandbox.paypal.com https://api-m.paypal.com https://cn-geo1.uber.com https://applepay.cdn-apple.com https://appleid.apple.com https://api.sandbox.paypal.com https://api.paypal.com https://pay.google.com https://*.google.com https://google.com https://www.gstatic.com; " +
      'frame-src https://www.sandbox.paypal.com https://www.paypal.com https://sandbox.paypal.com https://paypal.com https://appleid.apple.com https://pay.google.com https://*.google.com https://google.com; ' +
      "frame-ancestors 'self' https://www.paypal.com https://www.sandbox.paypal.com https://sandbox.paypal.com https://paypal.com; " +
      'child-src https://www.sandbox.paypal.com https://www.paypal.com https://sandbox.paypal.com https://paypal.com https://pay.google.com https://*.google.com; ' +
      "img-src 'self' data: https://www.paypalobjects.com https://t.paypal.com https://www.paypal.com https://sandbox.paypal.com https://paypal.com https://www.gstatic.com https://*.gstatic.com https://pay.google.com https://*.google.com; " +
      "manifest-src 'self' https://pay.google.com https://*.google.com https://google.com; " +
      "style-src 'self' 'unsafe-inline' https://www.paypalobjects.com;"
  );
  next();
});

// Routes
app.use('/', pageRoutes);
app.use('/api', apiRoutes);
// Apple Domain Association File for Apple Pay
app.get(
  '/.well-known/apple-developer-merchantid-domain-association',
  (req, res) => {
    const filePath = path.join(
      __dirname,
      'public',
      '.well-known',
      'apple-developer-merchantid-domain-association'
    );

    // Set correct headers for Apple domain association
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    res.setHeader('Access-Control-Allow-Origin', '*');

    console.log(`Serving Apple domain association file from: ${filePath}`);

    res.sendFile(filePath, err => {
      if (err) {
        console.error('Error serving Apple domain association file:', err);
        res.status(404).send('Apple domain association file not found');
      } else {
        console.log('Apple domain association file served successfully');
      }
    });
  }
);

// Test endpoint to verify Apple domain association setup
app.get('/test-apple-pay-setup', (req, res) => {
  const filePath = path.join(
    __dirname,
    'public',
    '.well-known',
    'apple-developer-merchantid-domain-association'
  );

  // Check if file exists and get its size
  try {
    const stats = fs.statSync(filePath);
    res.json({
      status: 'success',
      message: 'Apple domain association file is properly configured',
      file: {
        path: filePath,
        size: stats.size,
        exists: true,
      },
      url: `${req.protocol}://${req.get(
        'host'
      )}/.well-known/apple-developer-merchantid-domain-association`,
      instructions: [
        '1. Deploy this app to pp-checkout.onrender.com',
        '2. Test the domain association at: https://pp-checkout.onrender.com/.well-known/apple-developer-merchantid-domain-association',
        '3. The file should return binary content (not 404)',
        '4. Apple Pay will validate this file automatically',
      ],
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Apple domain association file not found',
      error: error.message,
      filePath: filePath,
    });
  }
});

// Error handling middleware (must be last)
app.use(handleError);

// Start server
app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}/`);
  console.log('');
  // pingCallbackUrl(); // Ping the callback URL when the server starts
});

export default app;
