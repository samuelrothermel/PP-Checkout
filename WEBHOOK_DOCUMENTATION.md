# PayPal Webhook Service Documentation

## Overview

This webhook service handles PayPal webhook events for vault operations, specifically:

- `VAULT.PAYMENT-TOKEN.CREATED` - Triggered when a new payment token is created
- `VAULT.CREDIT-CARD.CREATED` - Triggered when a new credit card is vaulted

## Configuration

### Environment Variables

```
WEBHOOK_ID=20L575036K977523R
WEBHOOK_URL=https://www.pp-checkout.onrender.com/api/webhooks
```

### PayPal Webhook Setup

- **Webhook URL**: `https://www.pp-checkout.onrender.com/api/webhooks`
- **Webhook ID**: `20L575036K977523R`
- **Events Subscribed**:
  - VAULT.PAYMENT-TOKEN.CREATED
  - VAULT.CREDIT-CARD.CREATED

## API Endpoints

### Webhook Handler

- **URL**: `POST /api/webhooks`
- **Description**: Main webhook endpoint that receives PayPal webhook events
- **Headers Required**:
  - `paypal-auth-algo`
  - `paypal-transmission-id`
  - `paypal-cert-id`
  - `paypal-transmission-sig`
  - `paypal-transmission-time`

### Development/Testing Endpoints

- **URL**: `POST /api/webhooks/test`
- **Description**: Test webhook processing with sample data

- **URL**: `GET /api/webhooks/info`
- **Description**: Get webhook configuration details

- **URL**: `GET /api/webhooks/events`
- **Description**: List available webhook events

- **URL**: `GET /webhook-testing`
- **Description**: Webhook testing interface (development only)

## Service Components

### webhookService.js

Contains the main webhook processing logic:

- `verifyWebhookSignature()` - Verifies PayPal webhook signature
- `handlePaymentTokenCreated()` - Processes VAULT.PAYMENT-TOKEN.CREATED events
- `handleCreditCardCreated()` - Processes VAULT.CREDIT-CARD.CREATED events
- `processWebhookEvent()` - Main event router
- `getWebhookDetails()` - Fetches webhook configuration
- `listWebhookEvents()` - Lists available webhook events

### webhookController.js

HTTP request handlers:

- `handleWebhook()` - Main webhook endpoint handler
- `getWebhookInfo()` - Webhook info endpoint
- `getWebhookEvents()` - Webhook events endpoint
- `testWebhook()` - Test webhook endpoint

## Event Processing

### VAULT.PAYMENT-TOKEN.CREATED

When a payment token is created, the webhook receives:

```json
{
  "event_type": "VAULT.PAYMENT-TOKEN.CREATED",
  "resource": {
    "id": "payment_token_id",
    "customer": {
      "id": "customer_id"
    },
    "payment_source": {
      "card": {
        "brand": "VISA",
        "last_digits": "1234",
        "expiry": "2025-12"
      }
    }
  }
}
```

### VAULT.CREDIT-CARD.CREATED

When a credit card is vaulted, the webhook receives:

```json
{
  "event_type": "VAULT.CREDIT-CARD.CREATED",
  "resource": {
    "id": "credit_card_id",
    "customer_id": "customer_id",
    "number": "****1234",
    "type": "visa",
    "expire_month": "12",
    "expire_year": "2025"
  }
}
```

## Security

### Signature Verification

All webhook events are verified using PayPal's signature verification process:

1. Extract verification headers from the request
2. Construct verification payload
3. Send verification request to PayPal
4. Process event only if verification succeeds

### Required Headers

- `paypal-auth-algo`: Authentication algorithm
- `paypal-transmission-id`: Transmission ID
- `paypal-cert-id`: Certificate ID
- `paypal-transmission-sig`: Transmission signature
- `paypal-transmission-time`: Transmission timestamp

## Development & Testing

### Local Testing

1. Start the application: `npm start`
2. Visit: `http://localhost:8888/webhook-testing`
3. Use the testing interface to:
   - Test webhook processing
   - Get webhook configuration
   - List available events

### Testing with PayPal Simulator

You can use PayPal's webhook simulator in the developer dashboard to send test events to your webhook URL.

### Manual Testing

```bash
# Test webhook processing
curl -X POST http://localhost:8888/api/webhooks/test

# Get webhook info
curl -X GET http://localhost:8888/api/webhooks/info

# List webhook events
curl -X GET http://localhost:8888/api/webhooks/events
```

## Implementation Notes

### Current Implementation

- Logs all webhook events with detailed information
- Extracts and displays payment method details
- Provides structured response for successful/failed processing
- Includes comprehensive error handling

### Future Enhancements

You may want to add:

- Database storage for webhook events
- User notifications for new payment methods
- Integration with your application's user management system
- Advanced analytics and monitoring
- Retry logic for failed processing

## Error Handling

The service includes comprehensive error handling:

- Invalid webhook signatures are rejected with 401 status
- Processing errors are logged and return 500 status
- Unhandled event types are acknowledged but not processed
- All errors include detailed logging for debugging

## Monitoring

All webhook events are logged with:

- Event type and timestamp
- Payment method details
- Customer information
- Processing results
- Error details (if any)

Monitor the application logs to track webhook activity and identify any issues.

## Deployment

When deploying to production:

1. Ensure the webhook URL is accessible from PayPal's servers
2. Update the WEBHOOK_URL environment variable
3. Verify SSL certificate is valid
4. Test webhook functionality using PayPal's webhook simulator
5. Monitor logs for successful event processing

## Troubleshooting

### Common Issues

1. **Signature verification fails**: Check webhook ID and ensure all required headers are present
2. **Events not received**: Verify webhook URL is accessible and webhook is active in PayPal dashboard
3. **Processing errors**: Check application logs for detailed error information

### Debug Steps

1. Check webhook configuration in PayPal developer dashboard
2. Verify environment variables are set correctly
3. Use the webhook testing interface to test processing logic
4. Monitor application logs during webhook events
5. Test with PayPal's webhook simulator
