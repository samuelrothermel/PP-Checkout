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
  console.log('[Google Pay Debug] Google Pay SDK loaded callback triggered');
  console.log('[Google Pay Debug] Document ready state:', document.readyState);

  if (document.readyState === 'loading') {
    console.log(
      '[Google Pay Debug] Document still loading, adding DOMContentLoaded listener'
    );
    document.addEventListener('DOMContentLoaded', setupGooglePay);
  } else {
    console.log(
      '[Google Pay Debug] Document ready, setting up Google Pay immediately'
    );
    setupGooglePay();
  }
}

async function setupGooglePay() {
  console.log('[Google Pay Debug] Starting Google Pay setup...');

  try {
    // Check SDK availability
    console.log('[Google Pay Debug] Checking SDK availability...');
    console.log('[Google Pay Debug] - typeof google:', typeof google);
    console.log(
      '[Google Pay Debug] - google.payments exists:',
      !!(typeof google !== 'undefined' && google.payments)
    );
    console.log('[Google Pay Debug] - window.paypal exists:', !!window.paypal);
    console.log(
      '[Google Pay Debug] - window.paypal.Googlepay exists:',
      !!(window.paypal && window.paypal.Googlepay)
    );

    if (typeof google === 'undefined' || !google.payments) {
      console.log('[Google Pay Debug] Google SDK not available, exiting setup');
      return;
    }

    if (!window.paypal || !window.paypal.Googlepay) {
      console.log(
        '[Google Pay Debug] PayPal Google Pay component not available, exiting setup'
      );
      return;
    }

    // Get Google Pay configuration from PayPal
    console.log(
      '[Google Pay Debug] Getting PayPal Google Pay configuration...'
    );
    try {
      googlePayConfig = await paypal.Googlepay().config();
      console.log(
        '[Google Pay Debug] Google Pay config received:',
        googlePayConfig
      );
      console.log(
        '[Google Pay Debug] Google Pay isEligible:',
        googlePayConfig.isEligible
      );

      if (!googlePayConfig.isEligible) {
        console.log(
          '[Google Pay Debug] Google Pay is not eligible on this device/browser'
        );
        throw new Error('Google Pay is not eligible');
      }

      // Check if we can create payments client
      console.log('[Google Pay Debug] Creating Google Pay payments client...');
      const paymentsClient = new google.payments.api.PaymentsClient({
        environment: 'TEST', // Change to 'PRODUCTION' for live
      });
      console.log('[Google Pay Debug] Payments client created successfully');

      // Check readiness
      console.log('[Google Pay Debug] Checking Google Pay readiness...');
      const isReadyToPayRequest = {
        apiVersion: 2,
        apiVersionMinor: 0,
        allowedPaymentMethods: googlePayConfig.allowedPaymentMethods,
      };

      const isReadyToPay = await paymentsClient.isReadyToPay(
        isReadyToPayRequest
      );
      console.log('[Google Pay Debug] isReadyToPay response:', isReadyToPay);

      if (isReadyToPay.result) {
        console.log(
          '[Google Pay Debug] Google Pay is ready, creating button...'
        );

        const button = paymentsClient.createButton({
          onClick: onGooglePayButtonClicked,
          allowedPaymentMethods: googlePayConfig.allowedPaymentMethods,
          buttonColor: 'default',
          buttonType: 'buy',
        });
        console.log('[Google Pay Debug] Button created successfully');

        const container = document.getElementById('googlepay-container');
        if (container) {
          container.innerHTML = '';
          container.appendChild(button);
          console.log(
            '[Google Pay Debug] Button added to container successfully'
          );
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

async function onGooglePayButtonClicked() {
  console.log('[Google Pay Debug] Google Pay button clicked');

  try {
    console.log('[Google Pay Debug] Creating payment data request...');
    const paymentDataRequest = {
      ...googlePayConfig.paymentDataRequest,
      transactionInfo: {
        totalPriceStatus: 'FINAL',
        totalPrice: getCurrentTotalAmount(),
        currencyCode: 'USD',
      },
    };
    console.log('[Google Pay Debug] Payment data request:', paymentDataRequest);

    const paymentsClient = new google.payments.api.PaymentsClient({
      environment: 'TEST',
    });

    console.log('[Google Pay Debug] Loading payment data...');
    const paymentData = await paymentsClient.loadPaymentData(
      paymentDataRequest
    );
    console.log(
      '[Google Pay Debug] Payment data loaded successfully:',
      paymentData
    );

    // Process the payment with PayPal
    console.log('[Google Pay Debug] Processing payment with PayPal...');
    await processGooglePayPayment(paymentData);
  } catch (error) {
    console.log('[Google Pay Debug] Button click error:', error);
  }
}

async function processGooglePayPayment(paymentData) {
  try {
    // Collect shipping information
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

    const requestBody = {
      source: 'google_pay',
      totalAmount: getCurrentTotalAmount(),
      paymentSource: 'google_pay',
      shippingInfo: shippingInfo,
      googlePayData: paymentData,
    };

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

    // Confirm the order with PayPal
    await paypal.Googlepay().confirmOrder({
      orderId: id,
      paymentMethodData: paymentData.paymentMethodData,
    });

    // Capture the payment
    const captureResponse = await fetch(`/api/orders/${id}/capture`, {
      method: 'POST',
    });

    if (captureResponse.ok) {
      const captureData = await captureResponse.json();

      // Update UI with success info
      document.getElementById(
        'create-order-info'
      ).textContent = `Created Order ID: ${id}`;
      document.getElementById(
        'capture-order-info'
      ).textContent = `Google Pay Payment Captured: ${id}`;
      document.getElementById('payment-source-type-info').textContent =
        'Payment Source: Google Pay';
      document.getElementById('order-info-section').style.display = 'block';
      document.getElementById('capture-info-section').style.display = 'block';
      document.getElementById('payment-source-section').style.display = 'block';
    }
  } catch (error) {
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

    document.getElementById('applepay-container').innerHTML =
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
              const vaultToggle = document.getElementById('vault-toggle');
              const vaultRequested = vaultToggle && vaultToggle.checked;

              const requestBody = {
                source: 'apple_pay',
                totalAmount: getCurrentTotalAmount(),
                paymentSource: 'apple_pay',
                shippingInfo: shippingInfo,
              };

              if (vaultRequested) {
                requestBody.vault = true;
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
               * Capture order (must currently be made on server)
               */
              const captureResponse = await fetch(`/api/orders/${id}/capture`, {
                method: 'POST',
              });

              if (captureResponse.ok) {
                const captureData = await captureResponse.json();
                const paymentSource = captureData.payment_source;
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
                  ).textContent = `Apple Pay Payment Captured: ${id}`;
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
  loadPayPalComponents();

  try {
    setupGooglePay();
  } catch (error) {
    // Google Pay setup failed
  }

  const isAppleDevice = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
  const isSafari =
    /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);

  if (!isAppleDevice || !isSafari) {
    const applePayContainer = document.getElementById('applepay-container');
    if (applePayContainer) {
      applePayContainer.style.display = 'none';
    }
    return;
  }

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
        const applePayContainer = document.getElementById('applepay-container');
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

  const customerIdForm = document.getElementById('customer-id-form');
  const customerIdInput = document.getElementById('customer-id');
  const toggleCustomerIdCheckbox =
    document.getElementById('toggle-customer-id');

  // Event listener for the checkbox to toggle customer ID form visibility
  toggleCustomerIdCheckbox.addEventListener('change', function () {
    if (this.checked) {
      customerIdForm.style.display = 'block';
    } else {
      customerIdForm.style.display = 'none';
      // Hide saved payment methods when unchecking returning user
      const container = document.getElementById(
        'saved-payment-methods-container'
      );
      container.style.display = 'none';
      globalCustomerId = null;
      hasPaymentMethods = false;
    }
  });

  // Event listener for the customer ID form submission
  customerIdForm.addEventListener('submit', function (event) {
    event.preventDefault();
    const customerId = customerIdInput.value;
    globalCustomerId = customerId; // Store globally

    fetch('/api/returning-user-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ customerId }),
    })
      .then(response => response.json())
      .then(data => {
        if (data.idToken) {
          // Reload PayPal components after receiving the idToken
          loadPayPalComponents(data.idToken, customerId);
        } else {
          console.error('Failed to retrieve idToken');
        }
      })
      .catch(error => {
        console.error('Error:', error);
      });
  });

  // Add event listeners to shipping options
  document.querySelectorAll('input[name="shipping-option"]').forEach(option => {
    option.addEventListener('change', function () {
      const shippingAmount = parseFloat(this.value).toFixed(2);
      document.getElementById('shipping-amount').textContent = shippingAmount;
      updateAmountTotal();
      updatePayPalMessages();
    });
  });

  document
    .getElementById('billing-info-toggle')
    .addEventListener('change', function () {
      const billingInfo = document.getElementById('billing-info');
      if (this.checked) {
        billingInfo.style.display = 'block';
      } else {
        billingInfo.style.display = 'none';
      }
    });
});

const createOrder = (data, actions) => {
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
    source: data.paymentSource, //paypal / venmo / etc.
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

  const vaultToggle = document.getElementById('vault-toggle');
  if (vaultToggle && vaultToggle.checked) {
    requestBody.vault = true;
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
  if (customerId) {
    fetch(`/api/payment-tokens?customer_id=${customerId}`)
      .then(response => response.json())
      .then(paymentTokens => {
        displaySavedPaymentMethods(paymentTokens);
        loadPayPalSDK(idToken);
      })
      .catch(error => {
        loadPayPalSDK(idToken);
      });
  } else {
    loadPayPalSDK(idToken);
  }
}

function displaySavedPaymentMethods(paymentTokens) {
  const container = document.getElementById('saved-payment-methods-container');
  container.innerHTML = ''; // Clear any existing content

  if (paymentTokens.length === 0) {
    container.style.display = 'none';
    hasPaymentMethods = false;
    return;
  } else {
    hasPaymentMethods = true;
    container.style.display = 'block';
  }

  // Create the section wrapper
  const sectionDiv = document.createElement('div');
  sectionDiv.className = 'checkout-section';

  // Create a header
  const header = document.createElement('h4');
  header.textContent = 'Your Saved Payment Methods';
  header.style.marginBottom = '15px';
  sectionDiv.appendChild(header);

  // Create a list of saved payment methods
  const list = document.createElement('div');
  list.className = 'saved-payment-methods-list';

  paymentTokens.forEach((token, index) => {
    const methodDiv = document.createElement('div');
    methodDiv.className = 'saved-payment-method';

    // Extract payment method details
    let paymentSource = 'Unknown';
    let brand = 'N/A';
    let expiration = 'N/A';
    let lastDigits = 'N/A';

    if (token.payment_source.card) {
      paymentSource = 'Card';
      const card = token.payment_source.card;
      brand = card.brand || 'N/A';
      expiration = card.expiry || 'N/A';
      lastDigits = card.last_digits || 'N/A';
    } else if (token.payment_source.paypal) {
      paymentSource = 'PayPal';
      const paypal = token.payment_source.paypal;
      brand = 'PayPal';
      // PayPal doesn't typically have expiration or last digits
      expiration = 'N/A';
      lastDigits = 'N/A';
    }

    // Create the display content
    const methodInfo = document.createElement('div');
    methodInfo.className = 'saved-payment-method-details';
    methodInfo.innerHTML = `
      <div class="saved-payment-method-brand">${paymentSource} - ${brand}</div>
      <div class="saved-payment-method-meta">
        ${
          paymentSource === 'Card'
            ? `**** **** **** ${lastDigits} | Exp: ${expiration}`
            : 'PayPal Account'
        }
      </div>
    `;

    // Create token ID display (for reference)
    const tokenId = document.createElement('div');
    tokenId.className = 'saved-payment-method-token';
    tokenId.textContent = `Token: ${token.id.substring(0, 12)}...`;

    methodDiv.appendChild(methodInfo);
    methodDiv.appendChild(tokenId);
    list.appendChild(methodDiv);
  });

  sectionDiv.appendChild(list);
  container.appendChild(sectionDiv);
}

function loadPayPalSDK(idToken) {
  const isAppleDevice =
    /Mac|iPhone|iPad|iPod/.test(navigator.userAgent) &&
    /Safari/.test(navigator.userAgent) &&
    typeof ApplePaySession !== 'undefined';

  const components = isAppleDevice
    ? 'buttons,card-fields,messages,applepay'
    : 'buttons,card-fields,messages';

  // Use PayPal SDK with conditional Apple Pay component
  const scriptUrl = `https://www.paypal.com/sdk/js?commit=false&components=${components}&intent=capture&client-id=${clientId}&enable-funding=venmo&integration-date=2023-01-01&debug=false`;
  const scriptElement = document.createElement('script');
  scriptElement.src = scriptUrl;
  if (idToken) {
    scriptElement.setAttribute('data-user-id-token', idToken);
  }
  scriptElement.onload = () => {
    paypal
      .Buttons({
        style: {
          layout: 'vertical',
        },
        createOrder,
        onApprove,
        onCancel,
        onError,
      })
      .render('#paypal-button-container');

    // Initialize the card fields
    const cardField = paypal.CardFields({
      createOrder,
      onApprove,
      onError,
    });

    if (cardField.isEligible()) {
      const numberField = cardField.NumberField();
      numberField.render('#card-number-field-container');

      const cvvField = cardField.CVVField();
      cvvField.render('#card-cvv-field-container');

      const expiryField = cardField.ExpiryField();
      expiryField.render('#card-expiry-field-container');

      document
        .getElementById('multi-card-field-button')
        .addEventListener('click', () => {
          cardField.submit();
        });
    }
  };

  document.head.appendChild(scriptElement);
}

const onApprove = (data, actions) => {
  return fetch(`/api/orders/${data.orderID}/authorize`, {
    method: 'POST',
  })
    .then(response => response.json())
    .then(orderData => {
      const authorizationId =
        orderData.purchase_units[0].payments.authorizations[0].id;
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
      }

      const vaultStatus =
        paymentSource[paymentSourceType]?.attributes?.vault?.status;
      const customerId =
        paymentSource[paymentSourceType]?.attributes?.vault?.customer?.id;
      const paymentTokenId =
        paymentSource[paymentSourceType]?.attributes?.vault?.id;

      document.getElementById(
        'capture-order-info'
      ).textContent = `Authorization ID: ${authorizationId}`;
      document.getElementById(
        'payment-source-type-info'
      ).textContent = `Payment Source: ${paymentSourceType}`;
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

      document.getElementById('capture-info-section').style.display = 'block';
      document.getElementById('payment-source-section').style.display = 'block';
    })
    .catch(error => {
      document.getElementById(
        'capture-info-section'
      ).textContent = `Authorize Order ERROR: ${error}`;
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
