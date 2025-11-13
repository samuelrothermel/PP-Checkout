# Advanced Integration Example

## Instructions

1. Rename `.env.example` to `.env` and update `CLIENT_ID` and `APP_SECRET`.
2. Run `npm install`
3. Run `npm start`
4. Open http://localhost:8888
5. Enter the credit card number provided from one of your [sandbox accounts](https://developer.paypal.com/dashboard/accounts) or [generate a new credit card](https://developer.paypal.com/dashboard/creditCardGenerator)

## Payment Methods

### PayPal & Card Payments

- Available on both HTTP localhost and HTTPS
- Full functionality including vaulting and saved payment methods

### Apple Pay

- Requires Apple device (Mac/iOS) with Safari browser
- Works on HTTP localhost for development
- Requires HTTPS for production

### Google Pay

- **Requires HTTPS for sandbox testing** due to CORS policies
- HTTP localhost will show informational message
- Deploy to staging/production with SSL certificate to test Google Pay
- Supports same features as other payment methods when available
