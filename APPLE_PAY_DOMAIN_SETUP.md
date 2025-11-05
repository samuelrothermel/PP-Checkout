# Apple Pay Domain Association Setup for pp-checkout.onrender.com

## Overview

This document outlines the Apple Pay domain verification setup for hosting on `pp-checkout.onrender.com`. Apple Pay requires domain verification through a special association file to ensure security and prevent unauthorized usage.

## What's Configured

### 1. Domain Association File Location

✅ **File Path**: `public/.well-known/apple-developer-merchantid-domain-association`
✅ **Content**: Valid Apple-signed domain association file (binary format)
✅ **Size**: ~3KB of encrypted certificate data

### 2. Express.js Route Configuration

```javascript
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

    res.sendFile(filePath);
  }
);
```

### 3. Security Headers

- **Content-Type**: `application/octet-stream` (binary file)
- **Cache-Control**: Long-term caching (1 year)
- **CORS**: Allow cross-origin requests for Apple's validation

### 4. Content Security Policy Updates

Enhanced CSP to allow Apple Pay domains:

```javascript
"script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://applepay.cdn-apple.com https://appleid.cdn-apple.com";
"connect-src 'self' https://applepay.cdn-apple.com https://appleid.apple.com";
'frame-src https://appleid.apple.com';
```

## Deployment Steps

### Step 1: Deploy to Render.com

1. Push your code to GitHub repository
2. Deploy to `pp-checkout.onrender.com`
3. Ensure the app starts successfully

### Step 2: Verify Domain Association

Test the domain association endpoint:

```bash
curl -I https://pp-checkout.onrender.com/.well-known/apple-developer-merchantid-domain-association
```

Expected response:

```
HTTP/1.1 200 OK
Content-Type: application/octet-stream
Cache-Control: public, max-age=31536000
Content-Length: ~3000
```

### Step 3: Test Apple Pay Eligibility

1. Visit: `https://pp-checkout.onrender.com/test-apple-pay-setup`
2. Verify the setup status shows success
3. Test the domain association URL directly

### Step 4: Apple Pay Configuration

Once deployed, Apple Pay will automatically:

1. Validate the domain association file
2. Enable Apple Pay for Safari on macOS/iOS
3. Show Apple Pay buttons on compatible devices

## Testing Endpoints

### Local Testing

- **Setup Test**: `http://localhost:8888/test-apple-pay-setup`
- **Domain Association**: `http://localhost:8888/.well-known/apple-developer-merchantid-domain-association`

### Production Testing

- **Setup Test**: `https://pp-checkout.onrender.com/test-apple-pay-setup`
- **Domain Association**: `https://pp-checkout.onrender.com/.well-known/apple-developer-merchantid-domain-association`

## Verification Checklist

### ✅ Pre-Deployment

- [x] Apple domain association file exists in correct location
- [x] Express route properly configured with correct headers
- [x] ES modules compatibility fixed (`__dirname` issue resolved)
- [x] CSP updated to allow Apple Pay domains
- [x] Test endpoint created for verification

### ✅ Post-Deployment

- [ ] Domain association accessible at correct URL
- [ ] File returns binary content (not 404 or text)
- [ ] Apple Pay buttons show on compatible devices
- [ ] Apple Pay vault functionality works end-to-end

### ✅ Apple Pay Functionality

- [ ] Apple Pay button appears on save-wo-purchase page
- [ ] Touch ID/Face ID authentication works
- [ ] Vault tokens created successfully with Apple Pay
- [ ] Orders can be created using Apple Pay vault_ids

## Common Issues & Solutions

### Issue 1: 404 on Domain Association

**Problem**: Apple domain association returns 404
**Solution**: Verify file exists in `public/.well-known/` directory

### Issue 2: Apple Pay Not Showing

**Problem**: Apple Pay buttons don't appear
**Cause**: Domain not validated or not using HTTPS
**Solution**: Ensure domain association works and use HTTPS

### Issue 3: CSP Blocking Apple Pay

**Problem**: Console errors about blocked scripts/connections
**Solution**: Verify CSP includes all Apple Pay domains

### Issue 4: Binary File Issues

**Problem**: Domain association served as text instead of binary
**Solution**: Ensure `Content-Type: application/octet-stream` header

## File Structure

```
public/
├── .well-known/
│   └── apple-developer-merchantid-domain-association  # Apple Pay domain verification
├── save-wo-purchase.js                                # Client-side Apple Pay integration
└── styles/
    └── custom.css                                     # Apple Pay button styling

src/
├── services/
│   ├── ordersApi.js                                   # Apple Pay vault order creation
│   └── tokensApi.js                                   # Apple Pay vault token management
└── controllers/
    └── vaultController.js                             # Apple Pay vault endpoints

app.js                                                 # Domain association route
```

## Production URLs

- **Main App**: `https://pp-checkout.onrender.com`
- **Save w/o Purchase**: `https://pp-checkout.onrender.com/save-wo-purchase`
- **Apple Domain Association**: `https://pp-checkout.onrender.com/.well-known/apple-developer-merchantid-domain-association`
- **Setup Verification**: `https://pp-checkout.onrender.com/test-apple-pay-setup`

## Security Notes

- Domain association file is cryptographically signed by Apple
- File must be served exactly as provided (no modifications)
- HTTPS required for production Apple Pay functionality
- Domain must match exactly (pp-checkout.onrender.com)

## Next Steps

1. **Deploy to Render.com**
2. **Test domain association URL**
3. **Verify Apple Pay shows on iOS Safari**
4. **Test complete vault workflow**
5. **Monitor for any Apple Pay-related errors**

Your app is now fully configured for Apple Pay domain verification! 🍎💳
