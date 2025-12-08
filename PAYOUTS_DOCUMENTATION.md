# PayPal Payouts API Integration

This integration demonstrates how to use PayPal's Payouts API along with the Login with PayPal Identity API to send payments to PayPal account holders.

## Features

### 1. Login with PayPal (Identity API)

- OAuth 2.0 authentication flow
- Retrieve user's PayPal account information
- Get PayPal ID (payer_id) for sending payouts
- Access user profile data (name, email, verified status)

### 2. Create Payouts

- Send money to multiple recipients in a single batch
- Support for both email addresses and PayPal IDs
- Custom messages and notes for each payout
- Batch tracking with unique sender batch IDs

### 3. Query Payout Status

- Check status of payout batches
- View individual payout item details
- Track payment delivery and status changes

## Prerequisites

Before using this integration, ensure you have:

1. **PayPal Developer Account**: Sign up at [developer.paypal.com](https://developer.paypal.com)
2. **PayPal App Credentials**: Create an app in the PayPal Developer Dashboard
3. **Environment Variables**: Configure your `.env` file with:
   ```
   CLIENT_ID=your_client_id_here
   APP_SECRET=your_app_secret_here
   BASE_URL=http://localhost:8888
   ```

## PayPal App Configuration

### Required Settings in PayPal Developer Dashboard

#### Step 1: Enable Payouts

1. **Go to your PayPal App Settings** at [developer.paypal.com/dashboard](https://developer.paypal.com/dashboard)
2. Select your app (or create a new one)
3. Navigate to **"App Settings" → "Features"**
4. Enable **"Payouts"**
5. Accept the Payouts Terms & Conditions

#### Step 2: Configure Login with PayPal (Critical!)

1. In **"App Settings" → "Features"**
2. Enable **"Log In with PayPal"**
3. Click **"Advanced options"** under Log In with PayPal
4. Under **"Return URL"**, add your redirect URI:

   - For local development: `http://localhost:8888/api/payouts/oauth/callback`
   - For production: `https://your-domain.com/api/payouts/oauth/callback`
   - **IMPORTANT**: The URL must match EXACTLY (including protocol, port, and path)
   - **NOTE**: If you're using Railway or another hosting service, use your deployment URL

5. Ensure these **scopes** are enabled:

   - ✅ `openid`
   - ✅ `profile`
   - ✅ `email`
   - ✅ `https://uri.paypal.com/services/paypalattributes`

6. Click **"Save"**

#### Step 3: Get Your Credentials

1. Copy your **Client ID** (shown at the top of the app settings)
2. Click **"Show"** under **Secret** to reveal your App Secret
3. Add these to your `.env` file:
   ```
   CLIENT_ID=your_actual_client_id_here
   APP_SECRET=your_actual_app_secret_here
   BASE_URL=http://localhost:8888  # or your production URL
   ```

#### Common Configuration Issues

**"Invalid client_id or redirect_uri" Error:**

- ✅ Verify the redirect URI in PayPal Dashboard matches your BASE_URL exactly
- ✅ Check that the protocol (http/https) matches
- ✅ Ensure the port number is included if not default (80/443)
- ✅ Make sure "Log In with PayPal" is enabled
- ✅ Verify the Client ID in your `.env` file is correct
- ✅ After changing redirect URIs, wait a few minutes for changes to propagate

**Example Redirect URI Configurations:**

- Local: `http://localhost:8888/api/payouts/oauth/callback`
- Railway: `https://yourapp.up.railway.app/api/payouts/oauth/callback`
- Custom domain: `https://yourdomain.com/api/payouts/oauth/callback`

### App Capabilities Required

- ✅ **Payouts** - To send money to recipients
- ✅ **Log In with PayPal** - To authenticate users and get their PayPal ID

## OAuth Flow

The Login with PayPal integration follows this flow:

1. User clicks "Login with PayPal" button
2. User is redirected to PayPal's OAuth authorization page
3. User logs in and authorizes the app
4. PayPal redirects back with an authorization code
5. App exchanges code for access token
6. App retrieves user information including PayPal ID
7. User can use their PayPal ID as a recipient

## API Endpoints

### Page Routes

- `GET /payouts` - Payouts testing page

### API Routes

- `POST /api/payouts/create` - Create a new payout batch
- `GET /api/payouts/:payoutBatchId` - Get payout batch details
- `GET /api/payouts/items/:payoutItemId` - Get payout item details
- `POST /api/payouts/user-info` - Exchange OAuth code for user info

## Usage Examples

### Create a Payout

```javascript
const response = await fetch('/api/payouts/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    sender_batch_id: 'batch_12345',
    email_subject: 'You have a payment!',
    email_message: 'Thank you for your service',
    recipients: [
      {
        receiver: 'recipient@example.com',
        amount: '10.00',
        note: 'Payment for services',
        sender_item_id: 'item_1',
      },
    ],
  }),
});

const result = await response.json();
console.log('Payout Batch ID:', result.batch_header.payout_batch_id);
```

### Query Payout Status

```javascript
const response = await fetch(`/api/payouts/${payoutBatchId}`);
const payout = await response.json();
console.log('Status:', payout.batch_header.batch_status);
```

## Payout Statuses

- **PENDING**: Payout is being processed
- **PROCESSING**: Payout is in progress
- **SUCCESS**: Payout completed successfully
- **DENIED**: Payout was denied
- **BLOCKED**: Payout was blocked
- **FAILED**: Payout failed
- **UNCLAIMED**: Recipient hasn't claimed the payout yet
- **RETURNED**: Payout was returned
- **ONHOLD**: Payout is on hold
- **REFUNDED**: Payout was refunded
- **REVERSED**: Payout was reversed

## Use Cases

1. **Marketplace Payments**: Pay sellers or vendors automatically
2. **Affiliate Programs**: Distribute commission payments to affiliates
3. **Rebates & Rewards**: Send customer rebates or loyalty rewards
4. **Gig Economy**: Pay freelancers, contractors, or service providers
5. **Claims Processing**: Handle insurance claims or refund settlements
6. **Employee Reimbursements**: Process expense reimbursements
7. **Contest Prizes**: Distribute prizes to winners

## Testing in Sandbox

1. Use sandbox credentials from your PayPal Developer Dashboard
2. Create test accounts in the sandbox for recipients
3. Send payouts to sandbox account email addresses
4. Log into sandbox accounts to verify receipt of payouts

## Important Notes

- **Minimum Amount**: $1.00 USD per payout item
- **Maximum Recipients**: 15,000 recipients per batch
- **Currencies**: Multiple currencies supported (USD, EUR, GBP, etc.)
- **Fees**: PayPal charges a fee per payout (varies by region)
- **Processing Time**: Typically within minutes, but can take up to 30 minutes
- **Email Notifications**: Recipients receive email notifications about payouts

## Security Considerations

1. **Never expose your APP_SECRET** in client-side code
2. **Validate recipient information** before sending payouts
3. **Implement fraud detection** for suspicious payout patterns
4. **Use HTTPS** in production environments
5. **Store OAuth tokens securely** and never log them
6. **Validate redirect URIs** to prevent OAuth hijacking

## Troubleshooting

### "Login with PayPal" not working

- Verify Return URL is configured correctly in PayPal Dashboard
- Ensure all required scopes are enabled
- Check that CLIENT_ID matches your app credentials

### Payout creation fails

- Verify Payouts feature is enabled in your PayPal app
- Check that your account has sufficient funds (sandbox or live)
- Ensure recipient email or PayPal ID is valid
- Verify amounts meet minimum requirements

### OAuth callback errors

- Check BASE_URL environment variable matches your server
- Verify redirect URI matches exactly what's in PayPal Dashboard
- Ensure popup blockers aren't preventing the OAuth window

## Resources

- [PayPal Payouts API Documentation](https://developer.paypal.com/docs/api/payments.payouts-batch/v1/)
- [Login with PayPal Documentation](https://developer.paypal.com/docs/log-in-with-paypal/)
- [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)
- [PayPal Sandbox Testing](https://developer.paypal.com/tools/sandbox/)

## Support

For issues or questions:

1. Check PayPal Developer Documentation
2. Review PayPal Developer Forums
3. Contact PayPal Developer Support
