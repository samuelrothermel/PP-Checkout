import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { BASE_URL, PORT } from './src/config/constants.js';
import { handleError } from './src/config/errorHandler.js';
import pageRoutes from './src/routes/pages.js';
import apiRoutes from './src/routes/api.js';

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
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://www.sandbox.paypal.com https://www.paypal.com"
  );
  next();
});

// Routes
app.use('/', pageRoutes);
app.use('/api', apiRoutes);

// Error handling middleware (must be last)
app.use(handleError);

// Start server
app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}/`);
  console.log('');
  // pingCallbackUrl(); // Ping the callback URL when the server starts
});

export default app;
