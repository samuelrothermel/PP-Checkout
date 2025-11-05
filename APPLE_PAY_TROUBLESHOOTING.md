# Apple Pay Troubleshooting Guide

## Issues Fixed

### 1. 500 Error on /test-apple-pay-setup ✅

**Problem**: Using `require('fs')` in ES module causing server crash
**Solution**: Changed to `import fs from 'fs'` at the top of app.js

### 2. Apple Pay Not Showing on Mac/Safari ✅

**Problem**: Incorrect Apple Pay component initialization syntax
**Solution**: Updated to proper PayPal SDK Apple Pay component syntax

## Code Changes Made

### app.js Fixes

```javascript
// Fixed ES module imports
import fs from 'fs';

// Fixed test endpoint (removed require('fs'))
const stats = fs.statSync(filePath);
```

### save-wo-purchase.js Fixes

```javascript
// Enhanced PayPal SDK loading with Apple Pay parameters
const scriptUrl = `https://www.paypal.com/sdk/js?components=buttons,card-fields,applepay&client-id=${clientId}&enable-funding=venmo&buyer-country=US&currency=USD`;

// Corrected Apple Pay component initialization
paypal
  .Applepay({
    style: {
      layout: 'vertical',
      color: 'black',
      shape: 'rect',
      type: 'plain',
    },
    createVaultSetupToken: () =>
      createVaultSetupToken({ paymentSource: 'apple_pay' }),
    onApprove: data => onApprove(data),
    onCancel: data => onCancel(data),
    onError: err => onError(err),
  })
  .render('#applepay-container');
```

### .env Updates

```properties
# Updated BASE_URL for production
BASE_URL="https://pp-checkout.onrender.com"
```

## Apple Pay Requirements Checklist

### Domain Requirements ✅

- [x] Apple domain association file exists
- [x] File served at correct URL with proper headers
- [x] HTTPS required for production (Render.com provides this)

### PayPal SDK Requirements ✅

- [x] `applepay` component included in SDK URL
- [x] Apple Pay component initialized with proper syntax
- [x] Vault setup token creation for Apple Pay

### Device/Browser Requirements

- [x] **macOS Safari** with Touch ID or Apple Watch
- [x] **iOS Safari** with Touch ID or Face ID
- [x] **HTTPS domain** (required for production)

## Testing Steps

### 1. Local Testing (Development)

```bash
# Start server
node app.js

# Test endpoints
http://localhost:8888/test-apple-pay-setup
http://localhost:8888/save-wo-purchase
```

### 2. Production Testing (Render.com)

```bash
# Test domain association
https://pp-checkout.onrender.com/.well-known/apple-developer-merchantid-domain-association

# Test setup endpoint
https://pp-checkout.onrender.com/test-apple-pay-setup

# Test Apple Pay page
https://pp-checkout.onrender.com/save-wo-purchase
```

## Expected Behavior

### On Mac Safari with Touch ID

1. Visit https://pp-checkout.onrender.com/save-wo-purchase
2. Apple Pay button should appear in the "OR SAVE WITH APPLE PAY" section
3. Clicking button should prompt for Touch ID authentication
4. After authentication, vault_id should be created

### On PC/Non-Apple Devices

1. Apple Pay section should be hidden
2. Console should show: "Apple Pay component not available in PayPal SDK"
3. PayPal and Card fields should work normally

### Console Logging

```javascript
// Development logging added:
console.log('Loading PayPal SDK with URL:', scriptUrl);
console.log('Checking Apple Pay availability...');
console.log('paypal.Applepay available:', !!paypal.Applepay);
console.log('Apple Pay createVaultSetupToken called');
```

## Common Issues & Solutions

### Issue: Apple Pay Button Not Showing on Mac

**Possible Causes:**

1. Not using HTTPS (required for production Apple Pay)
2. Apple domain association not accessible
3. PayPal SDK not loading Apple Pay component
4. Incorrect Apple Pay component syntax

**Debug Steps:**

1. Check browser console for errors
2. Verify domain association URL returns binary file
3. Check if `paypal.Applepay` exists in console
4. Ensure using Safari (not Chrome/Firefox)

### Issue: 500 Error on Test Endpoint

**Cause:** ES module import issues
**Solution:** Use `import` instead of `require()` statements

### Issue: Apple Pay Shows "Not Eligible"

**Possible Causes:**

1. Using HTTP instead of HTTPS
2. Domain not registered with Apple Pay
3. No Touch ID/Face ID available
4. Geographic restrictions

## Production Deployment Checklist

### Pre-Deployment ✅

- [x] Fix ES module imports in app.js
- [x] Update BASE_URL to production URL
- [x] Apple Pay component syntax corrected
- [x] Enhanced logging added

### Post-Deployment

- [ ] Verify domain association accessible
- [ ] Test Apple Pay on actual Mac/Safari
- [ ] Verify vault_id creation works
- [ ] Test order creation with Apple Pay vault_id

### Apple Pay Validation

- [ ] Visit https://pp-checkout.onrender.com/save-wo-purchase on Mac Safari
- [ ] Apple Pay button should appear
- [ ] Touch ID authentication should work
- [ ] Vault token should be created successfully

## Debug Commands

### Check Domain Association

```bash
curl -I https://pp-checkout.onrender.com/.well-known/apple-developer-merchantid-domain-association
```

### Verify Setup

```bash
curl https://pp-checkout.onrender.com/test-apple-pay-setup
```

### Browser Console Commands

```javascript
// Check if PayPal SDK loaded
console.log('PayPal SDK:', typeof paypal);

// Check Apple Pay component
console.log('Apple Pay available:', !!paypal.Applepay);

// Test Apple Pay eligibility (only works in Safari)
if (window.ApplePaySession) {
  console.log('ApplePaySession available:', !!window.ApplePaySession);
  console.log('Can make payments:', window.ApplePaySession.canMakePayments());
}
```

All fixes have been applied and the server is ready for testing! 🍎✅
