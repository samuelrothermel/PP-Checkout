// Suppress non-critical PayPal postMessage errors
const originalConsoleError = console.error;
console.error = function (...args) {
  const message = args[0] && args[0].toString ? args[0].toString() : '';

  if (message.includes('Content Security Policy') || message.includes('CSP')) {
    console.warn('CSP Issue detected:', ...args);
  }

  if (
    message.includes('unable to post message to') &&
    (message.includes('sandbox.paypal.com') ||
      message.includes('paypal.com') ||
      message.includes('google.com') ||
      message.includes('pay.google.com')) &&
    !message.includes('CSP') &&
    !message.includes('Content Security Policy')
  ) {
    return;
  }

  originalConsoleError.apply(console, args);
};

// Global variable to store customer ID when returning user is detected
let globalCustomerId = null;
let hasPaymentMethods = false;

// Helper functions for localStorage management
function saveOrderId(orderId) {
  try {
    const recentOrders = JSON.parse(
      localStorage.getItem('recentOrderIds') || '[]'
    );
    // Add new order ID at the beginning and limit to 20 most recent
    const updatedOrders = [
      { id: orderId, timestamp: new Date().toISOString() },
      ...recentOrders.slice(0, 19),
    ];
    localStorage.setItem('recentOrderIds', JSON.stringify(updatedOrders));
    console.log('Saved order ID to localStorage:', orderId);
  } catch (error) {
    console.error('Error saving order ID to localStorage:', error);
  }
}

function saveCustomerId(customerId) {
  try {
    const recentCustomers = JSON.parse(
      localStorage.getItem('recentCustomerIds') || '[]'
    );
    // Check if customer already exists to avoid duplicates
    if (!recentCustomers.find(customer => customer.id === customerId)) {
      // Add new customer ID at the beginning and limit to 10 most recent
      const updatedCustomers = [
        { id: customerId, timestamp: new Date().toISOString() },
        ...recentCustomers.slice(0, 9),
      ];
      localStorage.setItem(
        'recentCustomerIds',
        JSON.stringify(updatedCustomers)
      );
      console.log('Saved customer ID to localStorage:', customerId);
    }
  } catch (error) {
    console.error('Error saving customer ID to localStorage:', error);
  }
}

function getRecentOrderIds() {
  try {
    return JSON.parse(localStorage.getItem('recentOrderIds') || '[]');
  } catch (error) {
    console.error('Error reading order IDs from localStorage:', error);
    return [];
  }
}

function getRecentCustomerIds() {
  try {
    return JSON.parse(localStorage.getItem('recentCustomerIds') || '[]');
  } catch (error) {
    console.error('Error reading customer IDs from localStorage:', error);
    return [];
  }
}

// Helper function to get current total amount from the DOM
function getCurrentTotalAmount() {
  const totalElement = document.getElementById('amount-total');
  if (!totalElement) {
    return '10.00';
  }
  return parseFloat(totalElement.textContent).toFixed(2);
}

// Google Pay configuration
let googlePayConfig = null;

function onGooglePayLoaded() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () =>
      waitForPayPalAndSetupGooglePay()
    );
  } else {
    waitForPayPalAndSetupGooglePay();
  }
}

function waitForPayPalAndSetupGooglePay() {
  // Check if PayPal SDK is already loaded
  if (window.paypal && window.paypal.Googlepay) {
    setupGooglePay();
    return;
  }

  // Poll for PayPal SDK to load
  let attempts = 0;
  const maxAttempts = 50; // 5 seconds max wait time

  const checkPayPal = setInterval(() => {
    attempts++;

    if (window.paypal && window.paypal.Googlepay) {
      console.log(
        '[Google Pay Debug] PayPal SDK loaded, setting up Google Pay'
      );
      clearInterval(checkPayPal);
      setupGooglePay();
    } else if (attempts >= maxAttempts) {
      console.log(
        '[Google Pay Debug] Timeout waiting for PayPal SDK, giving up'
      );
      clearInterval(checkPayPal);

      // Show fallback message
      const container = document.getElementById('googlepay-container');
      if (container) {
        container.innerHTML = `
          <div style="
            padding: 12px;
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 4px;
            margin: 8px 0;
            font-size: 14px;
            color: #856404;
            text-align: center;
          ">
            <strong>Google Pay</strong><br>
            <small>PayPal SDK loading timeout</small>
          </div>
        `;
      }
    }
  }, 100); // Check every 100ms
}

async function setupGooglePay() {
  try {
    // Check SDK availability

    if (typeof google === 'undefined' || !google.payments) {
      return;
    }

    if (!window.paypal || !window.paypal.Googlepay) {
      return;
    }

    // Get Google Pay configuration from PayPal - more explicit configuration
    try {
      const googlepayComponent = paypal.Googlepay();
      googlePayConfig = await googlepayComponent.config();

      if (!googlePayConfig.isEligible) {
        throw new Error('Google Pay is not eligible');
      }

      // Create payments client with explicit environment from config and required callbacks
      const paymentsClient = new google.payments.api.PaymentsClient({
        environment: googlePayConfig.environment || 'TEST',
        paymentDataCallbacks: {
          onPaymentDataChanged: onPaymentDataChanged,
          onPaymentAuthorized: onPaymentAuthorized, // Required for PAYMENT_AUTHORIZATION intent
        },
      });

      // Check readiness with proper structure per PayPal docs
      const isReadyToPayRequest = {
        apiVersion: googlePayConfig.apiVersion || 2,
        apiVersionMinor: googlePayConfig.apiVersionMinor || 0,
        allowedPaymentMethods: googlePayConfig.allowedPaymentMethods,
        existingPaymentMethodRequired: false, // Per PayPal docs
      };

      const isReadyToPay = await paymentsClient.isReadyToPay(
        isReadyToPayRequest
      );

      if (isReadyToPay.result) {
        console.log(
          '[Google Pay Debug] Google Pay is ready, creating button...'
        );

        // Show Google Pay option
        document.getElementById('googlepay-option').style.display = 'block';

        // Clear and render Google Pay mark (individual funding source)
        const markContainer = document.getElementById(
          'googlepay-mark-container'
        );
        if (markContainer) {
          markContainer.innerHTML = ''; // Clear any existing marks

          // Create a simple Google Pay image instead of PayPal marks
          const googlePayImg = document.createElement('img');
          googlePayImg.src =
            'https://www.gstatic.com/wallet/buy/googlepay_button_black_color.svg';
          googlePayImg.alt = 'Google Pay';
          googlePayImg.style.height = '30px';
          googlePayImg.style.marginRight = '8px';
          googlePayImg.onerror = function () {
            // Fallback to text if image fails to load
            markContainer.innerHTML =
              '<span style="font-weight: bold; color: #000;">Google Pay</span>';
          };
          markContainer.appendChild(googlePayImg);
        }
        const button = paymentsClient.createButton({
          onClick: onGooglePayButtonClicked,
          allowedPaymentMethods: googlePayConfig.allowedPaymentMethods,
          buttonColor: 'default',
          buttonType: 'buy',
          buttonSizeMode: 'fill', // Use 'fill' to make button fill container width
        });

        const container = document.getElementById('googlepay-button-container');
        if (container) {
          container.innerHTML = '';
          container.appendChild(button);

          // Apply additional styling to ensure full width
          const googlePayButton = container.querySelector('button');
          if (googlePayButton) {
            googlePayButton.style.width = '100%';
            googlePayButton.style.maxWidth = '100%';
            googlePayButton.style.boxSizing = 'border-box';
            googlePayButton.style.height = '40px';
            googlePayButton.style.margin = '0';
            googlePayButton.style.borderRadius = '4px';
          }
        } else {
          console.log(
            '[Google Pay Debug] ERROR: googlepay-container not found'
          );
        }
      } else {
        console.log(
          '[Google Pay Debug] Google Pay is not ready on this device/browser'
        );
        throw new Error('Google Pay is not ready');
      }
    } catch (configError) {
      console.log('[Google Pay Debug] Configuration error:', configError);
      console.log('[Google Pay Debug] Showing fallback placeholder...');

      // Fallback to placeholder for unsupported environments
      const container = document.getElementById('googlepay-container');
      if (container) {
        container.innerHTML = `
          <div style="
            padding: 12px;
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            margin: 8px 0;
            font-size: 14px;
            color: #495057;
            text-align: center;
          ">
            <strong>Google Pay</strong><br>
            <small>Requires HTTPS and compatible browser</small>
          </div>
        `;
        console.log('[Google Pay Debug] Fallback placeholder shown');
      }
    }
  } catch (error) {
    console.log('[Google Pay Debug] Setup failed with error:', error);
    const container = document.getElementById('googlepay-container');
    if (container) {
      container.style.display = 'none';
      console.log('[Google Pay Debug] Container hidden due to error');
    }
  }
}

// Add payment authorization callback required for PAYMENT_AUTHORIZATION intent
function onPaymentAuthorized(paymentData) {
  return new Promise(async (resolve, reject) => {
    try {
      console.log(
        '[Google Pay Debug] Payment authorized, processing...',
        paymentData
      );

      // Process the payment with PayPal
      await processGooglePayPayment(paymentData);

      resolve({
        transactionState: 'SUCCESS',
      });
    } catch (error) {
      console.error('[Google Pay Debug] Payment authorization failed:', error);
      resolve({
        transactionState: 'ERROR',
        error: {
          reason: 'PAYMENT_DATA_INVALID',
          message: 'Payment processing failed',
          intent: 'PAYMENT_AUTHORIZATION',
        },
      });
    }
  });
}

// Add payment data changed callback per PayPal docs
function onPaymentDataChanged(intermediatePaymentData) {
  return new Promise((resolve, reject) => {
    let shippingAddress = intermediatePaymentData.shippingAddress;
    let shippingOptionData = intermediatePaymentData.shippingOptionData;
    let paymentDataRequestUpdate = {};

    if (
      intermediatePaymentData.callbackTrigger === 'INITIALIZE' ||
      intermediatePaymentData.callbackTrigger === 'SHIPPING_ADDRESS'
    ) {
      if (shippingAddress.administrativeArea === 'NJ') {
        paymentDataRequestUpdate.error = getGoogleUnserviceableAddressError();
      } else {
        paymentDataRequestUpdate.newShippingOptionParameters =
          getGoogleDefaultShippingOptions();
        paymentDataRequestUpdate.newTransactionInfo =
          getGoogleTransactionInfo();
      }
    } else if (intermediatePaymentData.callbackTrigger === 'SHIPPING_OPTION') {
      paymentDataRequestUpdate.newTransactionInfo = getGoogleTransactionInfo(
        shippingOptionData.id
      );
    }

    resolve(paymentDataRequestUpdate);
  });
}

// Helper functions per PayPal docs
function getGoogleUnserviceableAddressError() {
  return {
    reason: 'SHIPPING_ADDRESS_UNSERVICEABLE',
    message: 'Cannot ship to the selected address',
    intent: 'SHIPPING_ADDRESS',
  };
}

function getGoogleDefaultShippingOptions() {
  return {
    defaultSelectedOptionId: 'shipping-001',
    shippingOptions: [
      {
        id: 'shipping-001',
        label: 'Free: Standard shipping',
        description: 'Free Shipping delivered in 5 business days.',
      },
      {
        id: 'shipping-002',
        label: '$1.99: Standard shipping',
        description: 'Standard shipping delivered in 3 business days.',
      },
    ],
  };
}

function getGoogleTransactionInfo(shippingOptionId) {
  let selectedShippingOption = getSelectedShippingOption(shippingOptionId);
  return {
    displayItems: [
      {
        label: 'Subtotal',
        type: 'SUBTOTAL',
        price: getCurrentTotalAmount(),
      },
      {
        label: selectedShippingOption.label,
        type: 'LINE_ITEM',
        price: selectedShippingOption.price,
      },
    ],
    countryCode: 'US',
    currencyCode: 'USD',
    totalPriceStatus: 'FINAL',
    totalPrice: (
      parseFloat(getCurrentTotalAmount()) +
      parseFloat(selectedShippingOption.price)
    ).toFixed(2),
    totalPriceLabel: 'Total',
  };
}

function getSelectedShippingOption(shippingOptionId) {
  const shippingOptions = {
    'shipping-001': { label: 'Free shipping', price: '0.00' },
    'shipping-002': { label: 'Standard shipping', price: '1.99' },
  };
  return shippingOptions[shippingOptionId] || shippingOptions['shipping-001'];
}

async function onGooglePayButtonClicked() {
  console.log('[Google Pay Debug] Google Pay button clicked');

  try {
    console.log('[Google Pay Debug] Creating payment data request...');

    // Structure payment request per PayPal docs
    const paymentDataRequest = {
      apiVersion: googlePayConfig.apiVersion || 2,
      apiVersionMinor: googlePayConfig.apiVersionMinor || 0,
      allowedPaymentMethods: googlePayConfig.allowedPaymentMethods,
      transactionInfo: {
        totalPriceStatus: 'FINAL',
        totalPrice: getCurrentTotalAmount(),
        currencyCode: 'USD',
        countryCode: 'US', // Add country code per docs
      },
      merchantInfo: {
        merchantName: 'Example Merchant', // Should be your actual merchant name
        merchantId: googlePayConfig.merchantId, // Use from config
      },
      callbackIntents: [
        'PAYMENT_AUTHORIZATION', // This requires onPaymentAuthorized callback
        'SHIPPING_ADDRESS',
        'SHIPPING_OPTION',
      ],
      shippingAddressRequired: true,
      shippingOptionRequired: true,
      emailRequired: true,
    };

    console.log('[Google Pay Debug] Payment data request:', paymentDataRequest);

    const paymentsClient = new google.payments.api.PaymentsClient({
      environment: googlePayConfig.environment || 'TEST',
      paymentDataCallbacks: {
        onPaymentDataChanged: onPaymentDataChanged,
        onPaymentAuthorized: onPaymentAuthorized, // Required callback
      },
    });

    console.log('[Google Pay Debug] Loading payment data...');
    const paymentData = await paymentsClient.loadPaymentData(
      paymentDataRequest
    );
    console.log(
      '[Google Pay Debug] Payment data loaded successfully:',
      paymentData
    );

    // Note: With PAYMENT_AUTHORIZATION intent, the payment processing
    // will be handled by the onPaymentAuthorized callback above
    // No need to call processGooglePayPayment here
  } catch (error) {
    console.log('[Google Pay Debug] Button click error:', error);
    // Better error handling per docs
    if (error.statusCode === 'CANCELED') {
      console.log('[Google Pay Debug] User canceled the payment');
    } else {
      console.error('[Google Pay Debug] Payment failed:', error);
    }
  }
}

async function processGooglePayPayment(paymentData) {
  try {
    // Collect shipping information - use Google Pay shipping if available
    const googleShipping = paymentData.shippingAddress;
    const shippingInfo = googleShipping
      ? {
          firstName:
            googleShipping.name?.split(' ')[0] ||
            document.getElementById('shipping-first-name').value,
          lastName:
            googleShipping.name?.split(' ').slice(1).join(' ') ||
            document.getElementById('shipping-last-name').value,
          email:
            paymentData.email ||
            document.getElementById('shipping-email').value,
          phone:
            googleShipping.phoneNumber ||
            document.getElementById('shipping-phone').value,
          address: {
            addressLine1:
              googleShipping.address1 ||
              document.getElementById('shipping-address-line1').value,
            adminArea2:
              googleShipping.locality ||
              document.getElementById('shipping-admin-area2').value,
            adminArea1:
              googleShipping.administrativeArea ||
              document.getElementById('shipping-admin-area1').value,
            postalCode:
              googleShipping.postalCode ||
              document.getElementById('shipping-postal-code').value,
            countryCode:
              googleShipping.countryCode ||
              document.getElementById('shipping-country-code').value,
          },
        }
      : {
          firstName: document.getElementById('shipping-first-name').value,
          lastName: document.getElementById('shipping-last-name').value,
          email: document.getElementById('shipping-email').value,
          phone: document.getElementById('shipping-phone').value,
          address: {
            addressLine1: document.getElementById('shipping-address-line1')
              .value,
            adminArea2: document.getElementById('shipping-admin-area2').value,
            adminArea1: document.getElementById('shipping-admin-area1').value,
            postalCode: document.getElementById('shipping-postal-code').value,
            countryCode: document.getElementById('shipping-country-code').value,
          },
        };

    // Check if user wants to save payment method
    const vaultToggle = document.getElementById('save-payment-method');
    const savePaymentMethod = vaultToggle && vaultToggle.checked;

    const requestBody = {
      source: 'google_pay',
      totalAmount: getCurrentTotalAmount(),
      paymentSource: 'google_pay',
      shippingInfo: shippingInfo,
      googlePayData: paymentData,
    };

    if (savePaymentMethod) {
      requestBody.vault = true; // Keep for backward compatibility
      requestBody.savePaymentMethod = true; // New parameter
    }

    // Create Order on the Server Side
    const orderResponse = await fetch('/api/checkout-orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!orderResponse.ok) {
      throw new Error('Order creation failed');
    }

    const orderData = await orderResponse.json();
    const { id } = orderData;

    // Confirm the order with PayPal - structure per docs
    const googlepayComponent = paypal.Googlepay();
    await googlepayComponent.confirmOrder({
      orderId: id,
      paymentMethodData: paymentData.paymentMethodData,
    });

    // Authorize the payment (not capture)
    const authorizeResponse = await fetch(`/api/orders/${id}/authorize`, {
      method: 'POST',
    });

    if (authorizeResponse.ok) {
      const authorizeData = await authorizeResponse.json();

      // Update UI with success info
      document.getElementById(
        'create-order-info'
      ).textContent = `Created Order ID: ${id}`;
      document.getElementById(
        'capture-order-info'
      ).textContent = `Google Pay Payment Authorized: ${id}`;
      document.getElementById('payment-source-type-info').textContent =
        'Payment Source: Google Pay';
      document.getElementById('order-info-section').style.display = 'block';
      document.getElementById('capture-info-section').style.display = 'block';
      document.getElementById('payment-source-section').style.display = 'block';
    }
  } catch (error) {
    console.error('[Google Pay Debug] Payment processing error:', error);
    // Handle payment processing errors
    throw error;
  }
}

async function setupApplepay() {
  try {
    if (
      location.protocol !== 'https:' &&
      location.hostname !== 'localhost' &&
      location.hostname !== '127.0.0.1'
    ) {
      throw new Error('Apple Pay requires HTTPS connection');
    }

    if (!window.paypal || !window.paypal.Applepay) {
      throw new Error('PayPal SDK or Apple Pay component not loaded');
    }

    if (typeof ApplePaySession === 'undefined') {
      throw new Error('ApplePaySession is not available');
    }

    try {
      if (!ApplePaySession.canMakePayments()) {
        throw new Error('Apple Pay is not supported on this device');
      }
    } catch (canMakePaymentsError) {
      throw new Error('Apple Pay availability check failed');
    }

    const applepay = paypal.Applepay();
    let config;

    try {
      config = await applepay.config();
    } catch (configError) {
      throw new Error('Failed to configure Apple Pay');
    }

    const {
      isEligible,
      countryCode,
      currencyCode,
      merchantCapabilities,
      supportedNetworks,
    } = config;

    if (!isEligible) {
      throw new Error('Apple Pay is not eligible');
    }

    // Show Apple Pay option
    document.getElementById('applepay-option').style.display = 'block';

    // Clear and render Apple Pay mark (individual funding source)
    const markContainer = document.getElementById('applepay-mark-container');
    if (markContainer) {
      markContainer.innerHTML = ''; // Clear any existing marks

      // Create a simple Apple Pay image instead of PayPal marks
      const applePayImg = document.createElement('img');
      applePayImg.src =
        'https://developer.apple.com/assets/elements/badges/apple-pay-mark-black.svg';
      applePayImg.alt = 'Apple Pay';
      applePayImg.style.height = '30px';
      applePayImg.style.marginRight = '8px';
      applePayImg.onerror = function () {
        // Fallback to text if image fails to load
        markContainer.innerHTML =
          '<span style="font-weight: bold; color: #000;">Apple Pay</span>';
      };
      markContainer.appendChild(applePayImg);
    }

    document.getElementById('applepay-button-container').innerHTML =
      '<apple-pay-button id="btn-appl" buttonstyle="black" type="buy" locale="en"></apple-pay-button>';

    // Ensure the Apple Pay button gets proper styling
    const applePayButton = document.getElementById('btn-appl');
    if (applePayButton) {
      applePayButton.style.width = '100%';
      applePayButton.style.height = '40px';
      applePayButton.style.borderRadius = '4px';
      applePayButton.style.margin = '0';
      applePayButton.style.display = 'block';
    }

    document
      .getElementById('btn-appl')
      .addEventListener('click', async function () {
        try {
          const paymentRequest = {
            countryCode,
            currencyCode: 'USD',
            merchantCapabilities,
            supportedNetworks,
            requiredBillingContactFields: [
              'name',
              'phone',
              'email',
              'postalAddress',
            ],
            requiredShippingContactFields: [],
            total: {
              label: 'Demo (Card is not charged)',
              amount: getCurrentTotalAmount(),
              type: 'final',
            },
          };

          const session = new ApplePaySession(4, paymentRequest);

          session.onvalidatemerchant = event => {
            applepay
              .validateMerchant({
                validationUrl: event.validationURL,
              })
              .then(payload => {
                session.completeMerchantValidation(payload.merchantSession);
              })
              .catch(err => {
                session.abort();
              });
          };

          session.onpaymentmethodselected = () => {
            session.completePaymentMethodSelection({
              newTotal: paymentRequest.total,
            });
          };

          session.onpaymentauthorized = async event => {
            try {
              // Collect shipping and billing information (similar to createOrder function)
              const shippingInfo = {
                firstName: document.getElementById('shipping-first-name').value,
                lastName: document.getElementById('shipping-last-name').value,
                email: document.getElementById('shipping-email').value,
                phone: document.getElementById('shipping-phone').value,
                address: {
                  addressLine1: document.getElementById(
                    'shipping-address-line1'
                  ).value,
                  adminArea2: document.getElementById('shipping-admin-area2')
                    .value,
                  adminArea1: document.getElementById('shipping-admin-area1')
                    .value,
                  postalCode: document.getElementById('shipping-postal-code')
                    .value,
                  countryCode: document.getElementById('shipping-country-code')
                    .value,
                },
              };

              // Check if user wants to save payment method
              const vaultToggle = document.getElementById(
                'save-payment-method'
              );
              const savePaymentMethod = vaultToggle && vaultToggle.checked;

              const requestBody = {
                source: 'apple_pay',
                totalAmount: getCurrentTotalAmount(),
                paymentSource: 'apple_pay',
                shippingInfo: shippingInfo,
              };

              if (savePaymentMethod) {
                requestBody.vault = true; // Keep for backward compatibility
                requestBody.savePaymentMethod = true; // New parameter
              }

              if (globalCustomerId && hasPaymentMethods) {
                requestBody.customerId = globalCustomerId;
              }

              /* Create Order on the Server Side */
              const orderResponse = await fetch(`/api/checkout-orders`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
              });

              if (!orderResponse.ok) {
                const errorText = await orderResponse.text();
                throw new Error(
                  `Error creating order: ${orderResponse.status} - ${errorText}`
                );
              }

              const orderData = await orderResponse.json();
              if (!orderData.id) {
                throw new Error('Order ID not received from server');
              }

              const { id } = orderData;

              /**
               * Confirm Payment
               */
              await applepay.confirmOrder({
                orderId: id,
                token: event.payment.token,
                billingContact: event.payment.billingContact,
                shippingContact: event.payment.shippingContact,
              });

              /*
               * Authorize order (must currently be made on server)
               */
              const authorizeResponse = await fetch(
                `/api/orders/${id}/authorize`,
                {
                  method: 'POST',
                }
              );

              if (authorizeResponse.ok) {
                const authorizeData = await authorizeResponse.json();
                const paymentSource = authorizeData.payment_source;
                if (paymentSource && paymentSource.apple_pay) {
                  const vaultStatus =
                    paymentSource.apple_pay.attributes?.vault?.status;
                  const customerId =
                    paymentSource.apple_pay.attributes?.vault?.customer?.id;
                  const paymentTokenId =
                    paymentSource.apple_pay.attributes?.vault?.id;

                  // Update UI with Apple Pay specific information
                  document.getElementById(
                    'capture-order-info'
                  ).textContent = `Apple Pay Payment Authorized: ${id}`;
                  document.getElementById(
                    'payment-source-type-info'
                  ).textContent = 'Payment Source: Apple Pay';

                  if (vaultStatus) {
                    document.getElementById(
                      'vault-status-info'
                    ).textContent = `Vault Status: ${vaultStatus}`;
                  }
                  if (customerId) {
                    document.getElementById(
                      'customer-id-info'
                    ).textContent = `Customer ID: ${customerId}`;
                  }
                  if (paymentTokenId) {
                    document.getElementById(
                      'payment-token-id-info'
                    ).textContent = `Payment Token ID: ${paymentTokenId}`;
                  }

                  document.getElementById('order-info-section').style.display =
                    'block';
                }
              }

              session.completePayment({
                status: window.ApplePaySession.STATUS_SUCCESS,
              });
            } catch (err) {
              session.completePayment({
                status: window.ApplePaySession.STATUS_FAILURE,
              });
            }
          };

          session.oncancel = () => {};

          session.begin();
        } catch (clickError) {
          if (clickError.message.includes('insecure document')) {
            alert(
              'Apple Pay requires HTTPS. Please test on a Mac with Safari over HTTPS, or deploy to a secure server.'
            );
          } else {
            alert(
              'Apple Pay failed to start. This is expected when testing on PC/Windows.'
            );
          }
        }
      });
  } catch (error) {
    const container = document.getElementById('applepay-container');
    if (container) {
      container.style.display = 'none';
    }
  }
}

document.addEventListener('DOMContentLoaded', function () {
  // PayPal SDK will be loaded by generateUserIdTokenForFirstTime() with proper user ID token

  const isAppleDevice = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
  const isSafari =
    /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);

  if (!isAppleDevice || !isSafari) {
    const applePayContainer = document.getElementById('applepay-container');
    if (applePayContainer) {
      applePayContainer.style.display = 'none';
    }
    // Don't return early - still need to set up customer ID form logic
  }

  // Only run Apple Pay setup on Apple devices with Safari
  if (isAppleDevice && isSafari) {
    try {
      if (typeof ApplePaySession !== 'undefined') {
        if (
          ApplePaySession?.supportsVersion(4) &&
          ApplePaySession?.canMakePayments()
        ) {
          if (typeof paypal !== 'undefined' && paypal.Applepay) {
            setupApplepay().catch(() => {});
          } else {
            const checkPayPalLoaded = setInterval(() => {
              if (typeof paypal !== 'undefined' && paypal.Applepay) {
                clearInterval(checkPayPalLoaded);
                setupApplepay().catch(() => {});
              }
            }, 100);
            setTimeout(() => clearInterval(checkPayPalLoaded), 10000);
          }
        } else {
          const applePayContainer =
            document.getElementById('applepay-container');
          if (applePayContainer) {
            applePayContainer.style.display = 'none';
          }
        }
      } else {
        const applePayContainer = document.getElementById('applepay-container');
        if (applePayContainer) {
          applePayContainer.style.display = 'none';
        }
      }
    } catch (applePaySetupError) {
      const applePayContainer = document.getElementById('applepay-container');
      if (applePayContainer) {
        applePayContainer.style.display = 'none';
      }
    }
  }

  // Customer ID form setup - runs on all devices
  const customerIdForm = document.getElementById('customer-id-form');
  const customerIdInput = document.getElementById('customer-id');
  const toggleCustomerIdCheckbox =
    document.getElementById('toggle-customer-id');

  // Event listener for the checkbox to toggle customer ID form visibility
  if (toggleCustomerIdCheckbox && customerIdForm) {
    toggleCustomerIdCheckbox.addEventListener('change', function () {
      console.log('Checkbox toggled:', this.checked);
      if (this.checked) {
        customerIdForm.style.display = 'block';
        customerIdForm.style.visibility = 'visible';
        // Focus on the customer ID input when the form becomes visible
        if (customerIdInput) {
          setTimeout(() => customerIdInput.focus(), 100);
        }
      } else {
        customerIdForm.style.display = 'none';
        customerIdForm.style.visibility = 'hidden';
        // Clear the customer ID input
        if (customerIdInput) {
          customerIdInput.value = '';
        }
        // Hide saved payment methods when unchecking returning user
        const container = document.getElementById(
          'saved-payment-methods-container'
        );
        if (container) {
          container.style.display = 'none';
        }
        globalCustomerId = null;
        hasPaymentMethods = false;
      }
    });
  } else {
    console.error('Missing elements:', {
      toggleCustomerIdCheckbox: !!toggleCustomerIdCheckbox,
      customerIdForm: !!customerIdForm,
      customerIdInput: !!customerIdInput,
    });
  }

  // Clear saved payment methods when customer ID input is cleared
  if (customerIdInput) {
    customerIdInput.addEventListener('input', function () {
      const customerId = this.value.trim();

      // If customer ID is empty, clear saved payment methods
      if (!customerId) {
        const container = document.getElementById(
          'saved-payment-methods-container'
        );
        if (container) {
          container.style.display = 'none';
        }
        globalCustomerId = null;
        hasPaymentMethods = false;
      }
    });
  }

  // Event listener for the customer ID form submission
  if (customerIdForm) {
    customerIdForm.addEventListener('submit', function (event) {
      event.preventDefault();
      const customerId = customerIdInput.value.trim();
      if (customerId) {
        fetchPaymentMethodsForCustomer(customerId);
      }
    });
  }

  // Add event listeners to shipping options
  document.querySelectorAll('input[name="shipping-option"]').forEach(option => {
    option.addEventListener('change', function () {
      const shippingAmount = parseFloat(this.value).toFixed(2);
      document.getElementById('shipping-amount').textContent = shippingAmount;
      updateAmountTotal();
      updatePayPalMessages();
    });
  });

  // Add event listeners to handle submit button visibility for all payment methods
  document.addEventListener('change', function (event) {
    if (event.target.name === 'payment-method') {
      const submitOrderButton = document.getElementById('submit-order-button');

      if (submitOrderButton) {
        // Show submit button for saved payment methods OR new credit card
        if (
          event.target.id.startsWith('saved-') ||
          event.target.id === 'card-radio'
        ) {
          submitOrderButton.style.display = 'block';
        } else {
          submitOrderButton.style.display = 'none';
        }
      }

      // Card fields are now always visible - no need to show/hide them

      // Show/hide Apple Pay button based on selected payment method
      const applePayButtonContainer = document.getElementById(
        'applepay-button-container'
      );
      if (applePayButtonContainer) {
        if (event.target.id === 'applepay-radio') {
          // Show Apple Pay button when Apple Pay is selected
          applePayButtonContainer.style.display = 'block';
          // Initialize Apple Pay if it hasn't been initialized yet
          if (!window.applePayInitialized) {
            initializeApplePay();
          }
        } else {
          // Hide Apple Pay button when other payment methods are selected
          applePayButtonContainer.style.display = 'none';
        }
      }

      // Show/hide Google Pay button based on selected payment method
      const googlePayButtonContainer = document.getElementById(
        'googlepay-button-container'
      );
      if (googlePayButtonContainer) {
        if (event.target.id === 'googlepay-radio') {
          // Show Google Pay button when Google Pay is selected
          googlePayButtonContainer.style.display = 'block';
          // Initialize Google Pay if it hasn't been initialized yet
          if (!window.googlePayInitialized) {
            initializeGooglePay();
          }
        } else {
          // Hide Google Pay button when other payment methods are selected
          googlePayButtonContainer.style.display = 'none';
        }
      }
    }
  });

  // Handle save payment method checkbox changes
  const savePaymentToggle = document.getElementById('save-payment-method');
  if (savePaymentToggle) {
    savePaymentToggle.addEventListener('change', function () {
      const isVaultingEnabled = this.checked;

      // Show/hide vaulting limitations notice
      const vaultingNotice = document.getElementById('vaulting-notice');
      if (vaultingNotice) {
        vaultingNotice.style.display = isVaultingEnabled ? 'block' : 'none';
      }

      // Hide Google Pay when vaulting is enabled (not available in sandbox or production)
      const googlePayOption = document.getElementById('googlepay-option');
      if (googlePayOption) {
        if (isVaultingEnabled) {
          googlePayOption.style.display = 'none';
          // Uncheck Google Pay radio if it was selected
          const googlePayRadio = document.getElementById('googlepay-radio');
          if (googlePayRadio && googlePayRadio.checked) {
            googlePayRadio.checked = false;
          }
        } else {
          // Show Google Pay again if it was previously shown
          const isReadyToPayElement =
            googlePayOption.querySelector('.google-pay-ready');
          if (isReadyToPayElement || window.googlePayConfig) {
            googlePayOption.style.display = 'block';
          }
        }
      }

      // Handle Venmo sandbox notification
      updateVenmoSandboxNotification(isVaultingEnabled);
    });
  }
});

// Update Venmo sandbox notification based on vaulting state
function updateVenmoSandboxNotification(isVaultingEnabled) {
  // Remove any existing notification
  const existingNotification = document.getElementById(
    'venmo-sandbox-notification'
  );
  if (existingNotification) {
    existingNotification.remove();
  }

  if (isVaultingEnabled) {
    // Find Venmo payment option (look for paypal funding source with venmo)
    const paypalFundingList = document.getElementById(
      'paypal-funding-sources-list'
    );
    if (paypalFundingList) {
      const venmoOption = paypalFundingList.querySelector(
        '[id*="venmo"], [class*="venmo"]'
      );
      if (venmoOption) {
        // Create sandbox notification
        const notification = document.createElement('div');
        notification.id = 'venmo-sandbox-notification';
        notification.style.cssText = `
          background-color: #fff3cd;
          border: 1px solid #ffeaa7;
          border-radius: 4px;
          padding: 8px 12px;
          margin-top: 8px;
          font-size: 0.85em;
          color: #856404;
        `;
        notification.innerHTML =
          '⚠️ <strong>Note:</strong> Venmo vaulting is not available in PayPal Sandbox environment';

        // Insert notification after Venmo option
        venmoOption.parentNode.insertBefore(
          notification,
          venmoOption.nextSibling
        );
      }
    }
  }
}

const createOrder = async (data, actions) => {
  // Check if this is Venmo with vaulting for first-time users
  if (data.paymentSource === 'venmo') {
    const vaultToggle = document.getElementById('save-payment-method');
    const savePaymentMethod = vaultToggle && vaultToggle.checked;

    if (savePaymentMethod) {
      await ensureVenmoVaultingReady();
    }
  }

  const shippingInfo = {
    firstName: document.getElementById('shipping-first-name').value,
    lastName: document.getElementById('shipping-last-name').value,
    email: document.getElementById('shipping-email').value,
    phone: document.getElementById('shipping-phone').value,
    address: {
      addressLine1: document.getElementById('shipping-address-line1').value,
      adminArea2: document.getElementById('shipping-admin-area2').value,
      adminArea1: document.getElementById('shipping-admin-area1').value,
      postalCode: document.getElementById('shipping-postal-code').value,
      countryCode: document.getElementById('shipping-country-code').value,
    },
  };

  // Collect billing information if different from shipping
  let billingInfo = null;
  const billingToggle = document.getElementById('billing-info-toggle');
  if (billingToggle.checked) {
    billingInfo = {
      firstName: document.getElementById('billing-first-name').value,
      lastName: document.getElementById('billing-last-name').value,
      email: document.getElementById('billing-email').value,
      phone: document.getElementById('billing-phone').value,
      address: {
        addressLine1: document.getElementById('billing-address-line1').value,
        adminArea2: document.getElementById('billing-admin-area2').value,
        adminArea1: document.getElementById('billing-admin-area1').value,
        postalCode: document.getElementById('billing-postal-code').value,
        countryCode: document.getElementById('billing-country-code').value,
      },
    };
  }

  const requestBody = {
    paymentSource: data.paymentSource, //paypal / venmo / etc.
    cart: [
      {
        sku: '123456789',
        quantity: '1',
      },
    ],
    totalAmount: parseFloat(
      document.getElementById('amount-total').textContent
    ).toFixed(2),
    shippingInfo: shippingInfo,
  };

  // Include billing info if different from shipping
  if (billingInfo) {
    requestBody.billingInfo = billingInfo;
  }

  const vaultToggle = document.getElementById('save-payment-method');
  const savePaymentMethod = vaultToggle && vaultToggle.checked;

  if (savePaymentMethod) {
    requestBody.vault = true; // Keep for backward compatibility
    requestBody.savePaymentMethod = true; // New parameter
  }

  if (globalCustomerId && hasPaymentMethods) {
    requestBody.customerId = globalCustomerId;
  }

  return fetch('/api/checkout-orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })
    .then(response => response.json())
    .then(orderData => {
      const orderId = orderData.id;

      // Save order ID to localStorage
      saveOrderId(orderId);

      document.getElementById(
        'create-order-info'
      ).textContent = `Created Order ID: ${orderId}`;
      document.getElementById('order-info-section').style.display = 'block';
      return orderId;
    })
    .catch(error => {
      document.getElementById(
        'create-order-info'
      ).textContent = `Error: ${error}`;
      document.getElementById('order-info-section').style.display = 'block';
    });
};

function loadPayPalComponents(idToken = null, customerId = null) {
  // This function is now only used for initial page load
  // Saved payment methods are handled separately by fetchPaymentMethodsForCustomer
  loadPayPalSDK(idToken);
}

// Function to fetch payment methods for a specific customer
async function fetchPaymentMethodsForCustomer(customerId) {
  try {
    globalCustomerId = customerId; // Store globally

    // Show loading state
    const container = document.getElementById(
      'saved-payment-methods-container'
    );
    container.innerHTML =
      '<div class="checkout-section"><h4>Loading saved payment methods...</h4></div>';
    container.style.display = 'block';

    // Fetch payment tokens
    const response = await fetch(
      `/api/payment-tokens?customer_id=${customerId}`
    );
    if (!response.ok) {
      throw new Error('Failed to fetch payment methods');
    }

    const paymentTokens = await response.json();

    // Hide the separate container since we're adding to main payment methods
    const separateContainer = document.getElementById(
      'saved-payment-methods-container'
    );
    if (separateContainer) {
      separateContainer.style.display = 'none';
    }

    // Display the payment methods
    displaySavedPaymentMethods(paymentTokens);

    // Fetch returning user token and reload PayPal components
    // Use PayPal customer ID if available, otherwise use merchant customer ID
    const targetCustomerId = window.savedPayPalCustomerId || customerId;
    console.log('Requesting token for customer ID:', targetCustomerId);

    const tokenResponse = await fetch('/api/returning-user-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ customerId: targetCustomerId }),
    });

    const tokenData = await tokenResponse.json();
    if (tokenData.idToken) {
      // Store the customer token for use with saved payment methods, but don't reload SDK
      // This prevents destroying existing components and losing radio button selections
      window.customerIdToken = tokenData.idToken;
      console.log('Customer token stored for saved payment methods');
    }
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    const container = document.getElementById(
      'saved-payment-methods-container'
    );
    container.innerHTML = `
      <div class="checkout-section">
        <h4>Error Loading Payment Methods</h4>
        <p style="color: #dc3545; font-size: 0.9em;">
          Could not load saved payment methods for this customer ID. Please check the ID and try again.
        </p>
      </div>
    `;
    container.style.display = 'block';
    hasPaymentMethods = false;
  }
}

function displaySavedPaymentMethods(paymentTokens) {
  const fundingSourcesList = document.getElementById(
    'paypal-funding-sources-list'
  );

  if (paymentTokens.length === 0) {
    hasPaymentMethods = false;
    return;
  }

  hasPaymentMethods = true;

  // Sort payment tokens by creation date (most recent first)
  const sortedTokens = paymentTokens.sort((a, b) => {
    const dateA = new Date(a.create_time || 0);
    const dateB = new Date(b.create_time || 0);
    return dateB - dateA;
  });

  console.log(
    `Creating radio buttons for ${sortedTokens.length} saved payment methods`
  );

  // Create radio button for each saved payment method (reverse order since we're inserting at top)
  sortedTokens.reverse().forEach((token, index) => {
    createSavedPaymentMethodRadio(
      token,
      sortedTokens.length - 1 - index,
      fundingSourcesList
    );
  });

  // Setup saved payment method functionality
  setupSavedPaymentMethods();
}

function createSavedPaymentMethodRadio(token, index, container) {
  const paymentMethodOption = document.createElement('div');
  paymentMethodOption.className =
    'payment-method-option saved-payment-method-option';

  // Extract payment method details
  let paymentSource = 'Unknown';
  let displayInfo = '';
  let vaultId = token.id;

  // Determine payment source type from token
  if (token.payment_source.paypal) {
    paymentSource = 'PayPal';
    const paypal = token.payment_source.paypal;
    const email = paypal.email_address || paypal.payer_id || 'PayPal Account';
    displayInfo = `<strong>PayPal Account</strong><br>${email}`;
  } else if (token.payment_source.card) {
    paymentSource = 'Card';
    const card = token.payment_source.card;
    const brand = card.brand || 'Card';
    const lastDigits = card.last_digits || '****';
    const expiry = card.expiry || 'N/A';
    displayInfo = `<strong>${brand} Card</strong><br>**** **** **** ${lastDigits} | Exp: ${expiry}`;
  } else {
    paymentSource = 'Unknown';
  }

  const radioId = `saved-${vaultId}`;
  const isFirstSaved = index === 0; // First saved method is selected by default

  paymentMethodOption.innerHTML = `
    <input type="radio" name="payment-method" id="${radioId}" value="${radioId}" data-vault-id="${vaultId}" data-payment-source="${paymentSource.toLowerCase()}" ${
    isFirstSaved ? 'checked' : ''
  }>
    <label for="${radioId}" class="payment-method-label">
      <div>
        <span class="saved-payment-badge">SAVED</span>
        <div class="saved-payment-details">
          ${displayInfo}
        </div>
      </div>
    </label>
  `;

  // Insert saved payment methods at the top of the payment method stack
  container.insertBefore(paymentMethodOption, container.firstChild);

  // No button rendering for saved payment methods - they will be handled server-side
}

function setupSavedPaymentMethods() {
  // Show the submit order button since we have saved methods
  const submitOrderButton = document.getElementById('submit-order-button');
  if (submitOrderButton) {
    submitOrderButton.style.display = 'block';
  }

  // Add event listener for submit button
  if (submitOrderButton) {
    submitOrderButton.addEventListener('click', function () {
      const selectedRadio = document.querySelector(
        'input[name="payment-method"]:checked'
      );
      if (selectedRadio) {
        if (selectedRadio.id.startsWith('saved-')) {
          // Handle saved payment method
          const vaultId = selectedRadio.getAttribute('data-vault-id');
          handleSavedPaymentCheckout(vaultId);
        } else if (selectedRadio.id === 'card-radio') {
          // Handle new credit card payment
          if (window.cardFieldInstance) {
            window.cardFieldInstance.submit();
          }
        }
      }
    });
  }
}

// Handle checkout with saved payment method
function handleSavedPaymentCheckout(vaultId) {
  console.log(
    'Processing saved payment method checkout with vault_id:',
    vaultId
  );

  // Get the payment source type from the selected radio button
  const selectedRadio = document.querySelector(
    `input[name="payment-method"][data-vault-id="${vaultId}"]`
  );
  const paymentSourceType =
    selectedRadio?.getAttribute('data-payment-source') || 'paypal';

  // Show loading state
  const submitButton = document.getElementById('submit-order-button');
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Processing...';
  }

  // Check if user wants to save payment method
  const vaultToggle = document.getElementById('save-payment-method');
  const savePaymentMethod = vaultToggle && vaultToggle.checked;

  // Create order with vault_id and payment source type
  const requestBody = {
    vault_id: vaultId,
    payment_source_type: paymentSourceType,
    target_customer_id: window.customerId,
    savePaymentMethod: savePaymentMethod,
  };

  fetch('/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })
    .then(response => response.json())
    .then(data => {
      console.log('Create order result:', data);

      if (data.id) {
        // Check if the order is already completed (common with vault_id)
        if (data.status === 'COMPLETED') {
          console.log('Order already completed during creation');
          return data;
        } else if (data.status === 'APPROVED') {
          // Order is authorized, now capture it
          console.log('Order approved, capturing payment...');
          return fetch(`/api/orders/${data.id}/capture`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          }).then(response => response.json());
        } else {
          // Order created but may need additional authorization
          console.log(
            'Order status:',
            data.status,
            '- may need client-side approval'
          );
          return data;
        }
      } else {
        throw new Error('Failed to create order');
      }
    })
    .then(data => {
      console.log('Final payment result:', data);
      if (data.status === 'COMPLETED') {
        // Update UI with success info
        document.getElementById(
          'create-order-info'
        ).textContent = `Created Order ID: ${data.id}`;
        document.getElementById(
          'capture-order-info'
        ).textContent = `Payment Completed: ${data.id}`;
        document.getElementById('payment-source-type-info').textContent =
          'Payment Source: Saved Payment Method';
        document.getElementById('order-info-section').style.display = 'block';
      } else {
        throw new Error('Payment failed');
      }
    })
    .catch(error => {
      console.error('Error processing saved payment:', error);

      // Display error in the result area instead of alert
      document.getElementById(
        'create-order-info'
      ).textContent = `Error: ${error.message}`;
      document.getElementById('capture-order-info').textContent =
        'Payment failed - please try again';
      document.getElementById('payment-source-type-info').textContent =
        'Payment Source: Saved Payment Method (Failed)';
      document.getElementById('order-info-section').style.display = 'block';

      // Reset button state
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Submit Order';
      }
    });
}

// Update PayPal button to show saved account
function updatePayPalButtonForSavedAccount() {
  if (!window.savedPayPalCustomerId) return;

  // Find the PayPal radio button and update its mark
  const paypalRadio = document.querySelector(
    'input[name="payment-method"][value="paypal"]'
  );
  if (paypalRadio) {
    // Find the mark container and update it
    const markContainer = paypalRadio.parentElement.querySelector(
      '[id$="-mark-container"]'
    );
    if (markContainer) {
      markContainer.innerHTML =
        '<span class="saved-payment-badge">SAVED</span> PayPal Account';
      console.log('Updated PayPal button to show saved account');
    }

    // Select the PayPal radio button as default
    paypalRadio.checked = true;

    // Uncheck other payment methods
    const allOtherRadios = document.querySelectorAll(
      'input[name="payment-method"]:not([value="paypal"])'
    );
    allOtherRadios.forEach(radio => {
      radio.checked = false;
    });

    console.log('Selected PayPal radio button for saved account');
  } else {
    console.log('PayPal radio button not found yet, will update when created');
  }
}

function reloadPayPalSDKWithCustomerId() {
  console.log('🔄 Starting PayPal SDK reload process...');
  console.log('📋 Customer ID to use:', window.savedPayPalCustomerId);

  // Remove existing PayPal script tags
  const existingScripts = document.querySelectorAll(
    'script[src*="paypal.com/sdk/js"]'
  );
  existingScripts.forEach(script => {
    script.parentNode.removeChild(script);
  });

  // Clear existing PayPal components to avoid conflicts
  if (window.paypal) {
    try {
      // Clear any existing PayPal button containers
      const paypalContainers = document.querySelectorAll(
        '[id*="paypal-button-container"]'
      );
      paypalContainers.forEach(container => {
        container.innerHTML = '';
      });
    } catch (error) {
      console.log('Error clearing existing PayPal components:', error);
    }
  }

  // Set flag to prevent SDK from loading without customer ID
  window.paypalSDKReloading = true;

  // Remove reference to existing PayPal object
  delete window.paypal;

  // Fetch user ID token for the saved customer and then load PayPal SDK
  fetchUserIdTokenAndReloadSDK();
}

async function fetchUserIdTokenAndReloadSDK() {
  try {
    console.log(
      '🎫 Fetching user ID token for customer ID:',
      window.savedPayPalCustomerId
    );

    const response = await fetch('/api/returning-user-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerId: window.savedPayPalCustomerId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user ID token: ${response.status}`);
    }

    const data = await response.json();
    const idToken = data.idToken;

    // Now load PayPal SDK with the user ID token
    loadPayPalSDK(idToken);
  } catch (error) {
    console.error('❌ Error fetching user ID token:', error);

    // Fallback: load SDK without user ID token
    loadPayPalSDK();
  }
}

function loadPayPalSDK(idToken) {
  const isAppleDevice =
    /Mac|iPhone|iPad|iPod/.test(navigator.userAgent) &&
    /Safari/.test(navigator.userAgent) &&
    typeof ApplePaySession !== 'undefined';

  // Include googlepay, marks, and funding-eligibility components
  const components = isAppleDevice
    ? 'buttons,card-fields,messages,marks,funding-eligibility,applepay,googlepay'
    : 'buttons,card-fields,messages,marks,funding-eligibility,googlepay';

  // Use PayPal SDK with Google Pay component
  let scriptUrl = `https://www.paypal.com/sdk/js?commit=false&components=${components}&intent=authorize&client-id=${clientId}&enable-funding=venmo&integration-date=2023-01-01&debug=false`;

  const scriptElement = document.createElement('script');
  scriptElement.src = scriptUrl;

  if (idToken) {
    scriptElement.setAttribute('data-user-id-token', idToken);
    console.log('🎫 Added user ID token attribute');
    console.log('🎫 Token length:', idToken.length);
  } else {
  }

  // Add customer ID as data attribute if available (this is the correct approach per PayPal docs)
  if (window.savedPayPalCustomerId) {
    scriptElement.setAttribute(
      'data-customer-id',
      window.savedPayPalCustomerId
    );
    console.log(
      '👤 Added customer ID data attribute:',
      window.savedPayPalCustomerId
    );
  }

  console.log('   src:', scriptElement.src);

  const userIdToken = scriptElement.getAttribute('data-user-id-token');
  const customerId = scriptElement.getAttribute('data-customer-id');

  scriptElement.onload = () => {
    if (window.savedPayPalCustomerId) {
      console.log('   Customer ID used:', window.savedPayPalCustomerId);
      console.log('   User ID token present:', !!idToken);
      console.log(
        '⏳ Adding delay to allow SDK to fully initialize with customer context...'
      );

      // Add a delay to allow the SDK to fully process the customer context
      setTimeout(() => {
        console.log(
          '⏰ Creating PayPal buttons after customer context initialization delay'
        );
        createPayPalSmartButtonStack();
      }, 500); // 500ms delay for customer context processing
    } else {
      // Create individual radio buttons for each PayPal funding source
      createPayPalSmartButtonStack();
    }

    // Card fields will be initialized lazily when the card radio button is first selected
    // Google Pay and Apple Pay will be initialized lazily when their radio buttons are selected

    // Payment method radio handling is now done via CSS
  };

  // Final verification before adding to DOM

  console.log('   - src:', scriptElement.src);
  console.log(
    '   - data-user-id-token:',
    scriptElement.getAttribute('data-user-id-token') || 'NOT SET'
  );
  console.log(
    '   - data-customer-id:',
    scriptElement.getAttribute('data-customer-id') || 'NOT SET'
  );

  document.head.appendChild(scriptElement);

  // Verify the element was added correctly
  setTimeout(() => {
    const addedScript = document.querySelector(
      'script[src*="paypal.com/sdk/js"]'
    );
    if (addedScript) {
    } else {
      console.log('❌ Script element not found in DOM!');
    }
  }, 100);
}

// Create PayPal smart payment button stack (includes PayPal, Venmo, Pay Later)
function createPayPalSmartButtonStack() {
  const fundingSourcesList = document.getElementById(
    'paypal-funding-sources-list'
  );

  // Clear existing funding sources to prevent duplicates (saved payment methods are added separately)
  const existingFundingSources = fundingSourcesList.querySelectorAll(
    '.payment-method-option:not(.saved-payment-method-option)'
  );
  existingFundingSources.forEach(element => element.remove());

  // Create single PayPal payment method option with smart button stack
  const paymentMethodOption = document.createElement('div');
  paymentMethodOption.className = 'payment-method-option';

  const radioId = 'paypal-smart-buttons';
  const markContainerId = `${radioId}-mark-container`;
  const buttonContainerId = `${radioId}-button-container`;

  paymentMethodOption.innerHTML = `
    <input type="radio" name="payment-method" id="${radioId}" value="paypal" checked>
    <label for="${radioId}" class="payment-method-label">
      <div id="${markContainerId}">PayPal</div>
    </label>
    <div class="payment-method-buttons" id="${buttonContainerId}"></div>
  `;

  fundingSourcesList.appendChild(paymentMethodOption);

  // Render PayPal smart button stack (includes PayPal, Venmo, Pay Later automatically)
  const buttonConfig = {
    style: {
      layout: 'vertical',
      shape: 'rect',
      color: 'gold',
      label: 'paypal',
    },
    createOrder: (data, actions) => {
      // Pass 'paypal' as the payment source for the smart button stack
      return createOrder({ paymentSource: 'paypal' }, actions);
    },
    onApprove,
    onCancel,
    onError,
  };

  // Handle saved PayPal customer ID if available
  if (window.savedPayPalCustomerId) {
    console.log(
      'Configuring PayPal smart buttons with customer ID:',
      window.savedPayPalCustomerId
    );
    // Update the radio button label to show it's a saved PayPal account
    const markContainer = document.getElementById(markContainerId);
    if (markContainer) {
      markContainer.innerHTML =
        '<span class="saved-payment-badge">SAVED</span> PayPal Account';
    }
  }

  const buttonInstance = paypal.Buttons(buttonConfig);
  buttonInstance
    .render(`#${buttonContainerId}`)
    .then(() => {
      console.log('✅ PayPal smart button stack rendered successfully');

      // Initialize card fields alongside PayPal buttons (but keep them hidden)
      initializeCardFields();

      // Update the PayPal button for saved account if we have one
      if (window.savedPayPalCustomerId) {
        updatePayPalButtonForSavedAccount(buttonContainerId);
      }

      // Card fields are now always visible - no need to hide them initially

      // Hide Apple Pay and Google Pay buttons initially since PayPal is selected by default
      const applePayButtonContainer = document.getElementById(
        'applepay-button-container'
      );
      if (applePayButtonContainer) {
        applePayButtonContainer.style.display = 'none';
      }

      const googlePayButtonContainer = document.getElementById(
        'googlepay-button-container'
      );
      if (googlePayButtonContainer) {
        googlePayButtonContainer.style.display = 'none';
      }
    })
    .catch(error => {
      console.error('❌ Error rendering PayPal smart button stack:', error);
    });

  // If we have a saved PayPal account, select this radio button
  if (window.savedPayPalCustomerId) {
    setTimeout(() => {
      const paypalRadio = document.getElementById(radioId);
      if (paypalRadio) {
        paypalRadio.checked = true;
        // Uncheck any other payment methods
        const allOtherRadios = document.querySelectorAll(
          `input[name="payment-method"]:not(#${radioId})`
        );
        allOtherRadios.forEach(radio => {
          radio.checked = false;
        });
      }
    }, 50);
  }

  // PayPal smart button stack is configured for saved customer if available
  // (Customer ID configuration is handled in the button rendering above)
}

const onApprove = (data, actions) => {
  // Always use authorize endpoint since all orders are created with AUTHORIZE intent
  return fetch(`/api/orders/${data.orderID}/authorize`, {
    method: 'POST',
  })
    .then(response => response.json())
    .then(orderData => {
      console.log('Order processed:', orderData);
      const paymentSource = orderData.payment_source;

      // Determine payment source type by checking which property exists
      let paymentSourceType = 'unknown';
      if (paymentSource.card) {
        paymentSourceType = 'card';
      } else if (paymentSource.paypal) {
        paymentSourceType = 'paypal';
      } else if (paymentSource.venmo) {
        paymentSourceType = 'venmo';
      } else if (paymentSource.apple_pay) {
        paymentSourceType = 'apple_pay';
      } else if (paymentSource.google_pay) {
        paymentSourceType = 'google_pay';
      }

      // All orders are authorized, so always look for authorization data
      let authorizationId = '';
      if (orderData.purchase_units[0].payments.authorizations) {
        authorizationId =
          orderData.purchase_units[0].payments.authorizations[0].id;
        document.getElementById(
          'capture-order-info'
        ).textContent = `Authorization ID: ${authorizationId}`;
      }

      const vaultStatus =
        paymentSource[paymentSourceType]?.attributes?.vault?.status;
      const customerId =
        paymentSource[paymentSourceType]?.attributes?.vault?.customer?.id;
      const paymentTokenId =
        paymentSource[paymentSourceType]?.attributes?.vault?.id;

      document.getElementById(
        'payment-source-type-info'
      ).textContent = `Payment Source: ${paymentSourceType}`;

      if (vaultStatus) {
        document.getElementById(
          'vault-status-info'
        ).textContent = `Vault Status: ${vaultStatus}`;
      }
      if (customerId) {
        // Save customer ID to localStorage when vaulting occurs
        saveCustomerId(customerId);

        document.getElementById(
          'customer-id-info'
        ).textContent = `Customer ID: ${customerId}`;
      }
      if (paymentTokenId) {
        document.getElementById(
          'payment-token-id-info'
        ).textContent = `Payment Token ID: ${paymentTokenId}`;
      }

      document.getElementById('capture-info-section').style.display = 'block';
      document.getElementById('payment-source-section').style.display = 'block';
    })
    .catch(error => {
      console.error('Order authorization error:', error);
      document.getElementById(
        'capture-info-section'
      ).textContent = `Order Authorization ERROR: ${error}`;
    });
};

const onCancel = (data, actions) => {};

const onError = err => {};

const onShippingOptionsChange = (data, actions) => {};

const onShippingAddressChange = (data, actions) => {};

function updateAmountTotal() {
  const cartTotal = parseFloat(
    document.getElementById('cart-total').textContent
  );
  const shippingAmount = parseFloat(
    document.getElementById('shipping-amount').textContent
  );
  const amountTotal = (cartTotal + shippingAmount).toFixed(2);
  document.getElementById('amount-total').textContent = amountTotal;
}

function updatePayPalMessages() {
  const amount = parseFloat(
    document.getElementById('amount-total').textContent
  ).toFixed(2);
  const messageContainer = document.querySelector('[data-pp-message]');
  messageContainer.setAttribute('data-pp-amount', amount);
  paypal.Messages().render(messageContainer);
}

updateAmountTotal();

// Generate user ID token for first-time users (required for Venmo vaulting)
async function generateUserIdTokenForFirstTime() {
  // Only generate if save payment method is checked
  const vaultToggle = document.getElementById('save-payment-method');
  if (!vaultToggle || !vaultToggle.checked) {
    console.log(
      '🎫 Skipping user ID token generation - vaulting not requested'
    );
    return null;
  }

  try {
    console.log(
      '🎫 Generating user ID token for first-time payer (Venmo vaulting support)'
    );

    const response = await fetch('/api/first-time-user-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch first-time user ID token: ${response.status}`
      );
    }

    const data = await response.json();
    const idToken = data.idToken;

    console.log('🎫 Generated user ID token for first-time payer');
    console.log('🎫 Token length:', idToken.length);

    // Store the token globally for use in Venmo vaulting
    window.firstTimeUserIdToken = idToken;

    return idToken;
  } catch (error) {
    console.error('❌ Error generating first-time user ID token:', error);
    return null;
  }
}

// Check if Venmo vaulting is needed and reload SDK with user ID token if necessary
async function ensureVenmoVaultingReady() {
  // Check if save payment method is checked
  const vaultToggle = document.getElementById('save-payment-method');
  const savePaymentMethod = vaultToggle && vaultToggle.checked;

  // Check if user is first-time (no existing customer ID)
  const isFirstTimeUser = !globalCustomerId;

  if (savePaymentMethod && isFirstTimeUser) {
    console.log(
      '🎫 Venmo vaulting detected for first-time user - ensuring user ID token'
    );

    // Generate user ID token if not already generated
    if (!window.firstTimeUserIdToken) {
      const idToken = await generateUserIdTokenForFirstTime();
      if (idToken) {
        console.log(
          '🎫 Reloading PayPal SDK with user ID token for Venmo vaulting'
        );

        // Remove existing PayPal SDK
        const existingScript = document.querySelector(
          'script[src*="paypal.com/sdk/js"]'
        );
        if (existingScript) {
          existingScript.remove();
          delete window.paypal;
        }

        // Reload SDK with user ID token
        loadPayPalSDK(idToken);

        // Wait for SDK to load
        await new Promise(resolve => {
          const checkPayPal = setInterval(() => {
            if (window.paypal) {
              clearInterval(checkPayPal);
              resolve();
            }
          }, 100);
        });

        console.log('🎫 PayPal SDK reloaded with user ID token');
        return true;
      }
    } else {
      console.log('🎫 User ID token already available for Venmo vaulting');
      return true;
    }
  }

  return false;
}

// Debug function to inspect card field containers
function debugCardFields() {
  console.log('🔍 Debugging card field containers...');
  const containers = [
    '#card-number-field-container',
    '#card-cvv-field-container',
    '#card-expiry-field-container',
  ];

  containers.forEach(selector => {
    const container = document.querySelector(selector);
    if (container) {
      const iframes = container.querySelectorAll('iframe');
      const styles = container.querySelectorAll('style');
      console.log(`${selector}:`, {
        totalChildren: container.children.length,
        iframes: iframes.length,
        styles: styles.length,
        innerHTML:
          container.innerHTML.length > 200
            ? `${container.innerHTML.substring(0, 200)}...`
            : container.innerHTML,
      });
    }
  });
}

// Clean up any existing card fields
function cleanupCardFields() {
  console.log('🧹 Cleaning up existing card fields...');

  // Clear container contents
  const containers = [
    '#card-number-field-container',
    '#card-cvv-field-container',
    '#card-expiry-field-container',
  ];

  containers.forEach(selector => {
    const container = document.querySelector(selector);
    if (container) {
      container.innerHTML = '';
      console.log(`Cleared ${selector}`);
    }
  });

  // Reset global references
  window.cardFieldInstance = null;
  window.cardFieldsInitialized = false;

  console.log('✅ Card fields cleanup complete');
}

// Initialize card fields alongside PayPal buttons (but keep them hidden initially)
function initializeCardFields() {
  if (!window.paypal || window.cardFieldsInitialized) {
    console.log('Card fields already initialized or PayPal not ready');
    return;
  }

  console.log('Initializing PayPal card fields...');

  // Ensure PayPal SDK is fully loaded before initializing card fields
  if (!window.paypal.CardFields) {
    console.log('⏳ PayPal CardFields not yet available, retrying in 500ms...');
    setTimeout(() => initializeCardFields(), 500);
    return;
  }

  // Set flag immediately to prevent multiple initialization attempts
  window.cardFieldsInitialized = true;

  console.log('🔧 Creating CardField instance...');

  // Clear any existing card field content to prevent duplicates
  const containers = [
    '#card-number-field-container',
    '#card-cvv-field-container',
    '#card-expiry-field-container',
  ];

  containers.forEach(selector => {
    const container = document.querySelector(selector);
    if (container) {
      // Remove all existing content (iframes, styles, etc.)
      container.innerHTML = '';
      console.log(`Cleared existing content from ${selector}`);
    }
  });

  const cardField = window.paypal.CardFields({
    createOrder,
    onApprove,
    onError,
    style: {
      input: {
        'font-size': '16px',
        'font-family': 'Arial, sans-serif',
        color: '#3A3A3A',
      },
      ':focus': {
        color: '#0070ba',
      },
      '.valid': {
        color: '#28a745',
      },
      '.invalid': {
        color: '#dc3545',
      },
    },
  });

  if (cardField.isEligible()) {
    console.log('🎯 CardField is eligible, creating field instances...');

    // Simply render to the existing containers in the HTML - no dynamic HTML generation needed!
    const numberField = cardField.NumberField();
    const cvvField = cardField.CVVField();
    const expiryField = cardField.ExpiryField();

    console.log('📱 Rendering card fields to containers...');

    // Render fields to existing containers
    Promise.all([
      numberField.render('#card-number-field-container'),
      cvvField.render('#card-cvv-field-container'),
      expiryField.render('#card-expiry-field-container'),
    ])
      .then(() => {
        console.log('✅ All card fields rendered successfully');

        // Debug the containers after rendering
        debugCardFields();

        // Store cardField reference globally so the unified submit button can use it
        window.cardFieldInstance = cardField;

        // Setup billing info toggle
        const billingToggle = document.getElementById('billing-info-toggle');
        const billingInfo = document.getElementById('billing-info');

        if (billingToggle && billingInfo) {
          billingToggle.addEventListener('change', function () {
            billingInfo.style.display = this.checked ? 'block' : 'none';
          });
        }

        console.log('✅ Card fields initialization complete');
      })
      .catch(error => {
        console.error('❌ Error rendering card fields:', error);
        // Reset flag on error so it can be retried
        window.cardFieldsInitialized = false;
      });
  } else {
    console.log('❌ Card fields are not eligible in this environment');
    // Reset flag if not eligible
    window.cardFieldsInitialized = false;
  }
}

// Initialize Google Pay when first needed (when Google Pay radio button is selected)
function initializeGooglePay() {
  if (window.googlePayInitialized) {
    return;
  }

  console.log('Initializing Google Pay...');
  setupGooglePay();
  window.googlePayInitialized = true;
}

// Initialize Apple Pay when first needed (when Apple Pay radio button is selected)
function initializeApplePay() {
  if (window.applePayInitialized) {
    return;
  }

  console.log('Initializing Apple Pay...');
  setupApplepay().catch(() => {
    console.log('Apple Pay initialization failed or not available');
  });
  window.applePayInitialized = true;
}

// Initialize without user ID token initially (will be added when needed for Venmo vaulting)
loadPayPalSDK();
