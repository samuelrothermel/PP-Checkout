# PayPal Checkout - Refactored Structure

## Project Structure

The application has been refactored from a monolithic `server.js` file into a modular structure:

```
├── app.js                          # Main application entry point
├── server.js                       # Original file (kept for reference)
├── src/
│   ├── config/
│   │   ├── constants.js            # Environment variables and constants
│   │   └── errorHandler.js         # Centralized error handling middleware
│   ├── controllers/
│   │   ├── pageController.js       # EJS page rendering controllers
│   │   ├── orderController.js      # Order-related API endpoints
│   │   ├── vaultController.js      # Vault and payment token endpoints
│   │   └── billingController.js    # Billing agreement endpoints
│   └── routes/
│       ├── pages.js                # Page routes (EJS views)
│       └── api.js                  # API routes (/api/*)
```

## Key Improvements

### 1. **Separation of Concerns**

- **Controllers**: Business logic separated by domain (orders, vault, billing, pages)
- **Routes**: Clean route definitions with imported controllers
- **Config**: Centralized configuration and error handling

### 2. **Code Reduction & DRY Principles**

- **Page Controller**: Single `renderPage` helper eliminates repetitive EJS rendering code
- **Error Handling**: Centralized error middleware replaces inline error handling
- **Constants**: Environment variables extracted to single location

### 3. **Maintainability**

- **Modular**: Easy to find and modify specific functionality
- **Testable**: Controllers can be unit tested independently
- **Scalable**: New features can be added without cluttering main files

## Running the Application

```bash
# New modular structure
npm start

# Original structure (for comparison)
npm run start:old
```

## Route Organization

### Page Routes (/)

- `/` → Index page
- `/checkout` → Checkout page
- `/save-wo-purchase` → Save without purchase
- `/one-time-payments-*` → Various payment demos
- `/subscriptions-api` → Subscriptions demo
- `/mixed-checkout` → Mixed checkout demo
- `/ql-test` → QL test page
- `/ba_reference` → Billing agreement reference

### API Routes (/api)

- `/api/orders/*` → Order creation and capture
- `/api/vault/*` → Vault setup and payment tokens
- `/api/ba/*` → Billing agreement operations
- `/api/payment-tokens` → Payment token management
- `/api/returning-user-token` → Returning user authentication

## Next Steps

This refactoring provides a solid foundation for further improvements:

1. **Add input validation middleware**
2. **Implement proper logging**
3. **Add API documentation (OpenAPI/Swagger)**
4. **Create unit tests for controllers**
5. **Add request/response models**
6. **Implement rate limiting**
