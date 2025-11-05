# Apple Pay Vault Integration Documentation

## Overview

This implementation adds Apple Pay support to the "Save Without Purchase" functionality, allowing users to save their Apple Pay payment method and receive a `vault_id` that can be used to create and capture orders later.

## How It Works

### 1. Apple Pay Vault Setup

- **Apple Pay Button**: Added to the save-wo-purchase page alongside PayPal and Card options
- **Vault Setup Token**: When Apple Pay is selected, creates a vault setup token with `apple_pay` as the payment source
- **Payment Method Storage**: After Apple Pay authorization, the payment method is stored and returns a `vault_id`

### 2. Key Components

#### Frontend Changes

- **save-wo-purchase.ejs**: Added Apple Pay container and vault testing UI
- **save-wo-purchase.js**:
  - Updated PayPal SDK to include `applepay` component
  - Added Apple Pay button with vault setup token creation
  - Enhanced onApprove handler to support Apple Pay payment sources
  - Added vault testing functionality

#### Backend Changes

- **tokensApi.js**: Added `apple_pay` payment source support
- **ordersApi.js**: Added `createOrderWithVaultIdAndCapture()` function
- **vaultController.js**: Added `createOrderWithVaultId()` controller
- **api.js**: Added `/api/vault/create-order` route

## Usage Flow

### Step 1: Save Apple Pay Payment Method

1. Navigate to `http://localhost:8888/save-wo-purchase`
2. Click the Apple Pay button (only visible on compatible devices/browsers)
3. Complete Apple Pay authorization (Touch ID/Face ID)
4. Receive a `vault_id` for future use

### Step 2: Use Vault_ID for Orders

1. After successful vault setup, the testing section appears
2. The `vault_id` is automatically populated in the input field
3. Set the desired amount (default: $10.00)
4. Click "Create & Capture Order with Vault ID"
5. Order is created and immediately captured using the stored payment method

## API Endpoints

### Create Vault Setup Token

```
POST /api/vault/setup-token
Content-Type: application/json

{
  "paymentSource": "apple_pay"
}
```

### Create Payment Token from Setup Token

```
POST /api/vault/payment-token/:vaultSetupToken
```

### Create Order with Vault ID

```
POST /api/vault/create-order
Content-Type: application/json

{
  "vaultId": "vault_id_here",
  "amount": "10.00",
  "merchantNumber": 1
}
```

## Payment Source Support

The vault system now supports three payment sources:

1. **PayPal**: Traditional PayPal account vaulting
2. **Card**: Credit card vaulting with verification
3. **Apple Pay**: Apple Pay payment method vaulting

Each payment source has different verification and display properties:

- **Apple Pay**: Shows Touch ID/Face ID security confirmation
- **PayPal**: Shows PayPal account authentication
- **Card**: Shows detailed verification codes (CVV, AVS, etc.)

## Apple Pay Requirements

### Browser Compatibility

- **Safari**: Full support on macOS and MothershipOS
- **Chrome/Edge**: Limited support, requires HTTPS in production
- **Firefox**: Not supported

### Device Requirements

- **macOS**: Touch ID or Apple Watch
- **MothershipOS**: Touch ID or Face ID
- **Apple Watch**: Digital Crown confirmation

### Domain Requirements (Production)

- Must serve over HTTPS
- Domain must be registered with Apple Pay
- Apple Developer merchant ID configuration required

## Testing

### Development Testing

1. Use Safari on macOS/MothershipOS for best compatibility
2. Apple Pay buttons will show eligibility status
3. Use test Apple Pay cards in sandbox environment

### Expected Results

- **Vault Creation**: Returns `vault_id` (e.g., `2mp35823rf123456n`)
- **Order Creation**: Returns completed order with capture details
- **Status**: `COMPLETED` status indicates successful payment

### Error Handling

- Ineligible devices show message: "Apple Pay is not eligible on this device/browser"
- Network errors display in the result section with error details
- Console logs provide detailed debugging information

## Security Considerations

### Apple Pay Security

- Payment credentials never touch merchant servers
- Apple Pay uses device-specific tokens
- Requires biometric or passcode authentication

### Vault Security

- `vault_id` tokens are securely stored by PayPal
- Each vault token is merchant-specific
- Tokens can be revoked or expired

## Integration Benefits

1. **Frictionless Payments**: Touch ID/Face ID authentication
2. **Secure Storage**: Apple Pay credentials stored securely
3. **Recurring Payments**: Use vault_id for subscription/recurring scenarios
4. **Cross-Platform**: Works on Apple devices and Safari browsers
5. **PCI Compliance**: No sensitive data touches merchant servers

## Future Enhancements

- **Google Pay**: Similar vault integration for Android devices
- **Multi-Merchant**: Support for different merchant vault_ids
- **Subscription Plans**: Automatic recurring billing with Apple Pay vaults
- **Analytics**: Track vault creation and usage rates

## Troubleshooting

### Common Issues

1. **Apple Pay not showing**: Check browser/device compatibility
2. **Vault creation fails**: Verify PayPal sandbox credentials
3. **Order creation fails**: Ensure vault_id is valid and not expired

### Debug Tools

- Browser console shows detailed API responses
- Network tab shows vault setup and order creation requests
- Server logs display PayPal API interactions

## Conclusion

This Apple Pay vault integration provides a seamless way to save Apple Pay payment methods and create orders on-demand, perfect for subscription services, quick checkouts, and recurring payments scenarios.
