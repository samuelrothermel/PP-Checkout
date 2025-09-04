import https from 'https';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import app from './app.js';
import { PORT } from './src/config/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// For development, you can create self-signed certificates:
// openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

const HTTPS_PORT = 8443;

try {
  // Try to load SSL certificates if they exist
  const privateKey = fs.readFileSync(path.join(__dirname, 'key.pem'), 'utf8');
  const certificate = fs.readFileSync(path.join(__dirname, 'cert.pem'), 'utf8');

  const credentials = { key: privateKey, cert: certificate };
  const httpsServer = https.createServer(credentials, app);

  httpsServer.listen(HTTPS_PORT, () => {
    console.log(`HTTPS Server listening at https://localhost:${HTTPS_PORT}/`);
    console.log('Use this HTTPS URL to test Apple Pay properly');
  });
} catch (error) {
  console.log(
    'HTTPS certificates not found. To test Apple Pay properly, please:'
  );
  console.log('1. Generate self-signed certificates with:');
  console.log(
    '   openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes'
  );
  console.log('2. Run this HTTPS server');
  console.log('3. Accept the security warning in your browser');
  console.log('');
  console.log('For now, running HTTP server only (Apple Pay will not work)');

  // Fallback to HTTP
  app.listen(PORT, () => {
    console.log(`HTTP Server listening at http://localhost:${PORT}/`);
    console.log('Note: Apple Pay requires HTTPS and will not work over HTTP');
  });
}
