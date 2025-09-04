// Suppress non-critical PayPal postMessage errors
const originalConsoleError = console.error;
console.error = function (...args) {
  const message = args[0] && args[0].toString ? args[0].toString() : '';
  // Suppress specific PayPal cross-origin postMessage errors that don't affect functionality
  if (
    message.includes('unable to post message to') &&
    (message.includes('sandbox.paypal.com') || message.includes('paypal.com'))
  ) {
    return; // Suppress these specific errors
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
    console.warn('Could not find amount-total element, defaulting to 10.00');
    return '10.00';
  }
  const amount = parseFloat(totalElement.textContent).toFixed(2);
  console.log('Apple Pay using dynamic total amount:', amount);
  return amount;
}

async function setupApplepay() {
  try {
    console.log('Starting Apple Pay setup...');

    // Check if we're on HTTPS (required for Apple Pay)
    if (
      location.protocol !== 'https:' &&
      location.hostname !== 'localhost' &&
      location.hostname !== '127.0.0.1'
    ) {
      console.warn('Apple Pay requires HTTPS in production environments');
      throw new Error('Apple Pay requires HTTPS connection');
    }

    // Check if PayPal SDK is loaded
    if (!window.paypal || !window.paypal.Applepay) {
      throw new Error('PayPal SDK or Apple Pay component not loaded');
    }

    // Check if Apple Pay is available
    if (typeof ApplePaySession === 'undefined') {
      throw new Error(
        'ApplePaySession is not available - script may be blocked by CSP or device not supported'
      );
    }

    // Check if we're on a supported platform (wrap in try-catch to prevent crashes)
    try {
      if (!ApplePaySession.canMakePayments()) {
        console.warn(
          'Apple Pay is not available on this device/browser - likely testing on PC'
        );
        throw new Error('Apple Pay is not supported on this device');
      }
    } catch (canMakePaymentsError) {
      console.warn(
        'ApplePaySession.canMakePayments() failed:',
        canMakePaymentsError
      );
      throw new Error(
        'Apple Pay availability check failed - likely not on Apple device'
      );
    }

    const applepay = paypal.Applepay();
    let config;

    try {
      config = await applepay.config();
    } catch (configError) {
      console.error('Failed to get Apple Pay configuration:', configError);
      throw new Error(
        'Failed to configure Apple Pay - this is expected on PC/Windows'
      );
    }

    console.log('Apple Pay config:', config);

    const {
      isEligible,
      countryCode,
      currencyCode,
      merchantCapabilities,
      supportedNetworks,
    } = config;

    if (!isEligible) {
      console.warn('Apple Pay is not eligible on this device/browser');
      throw new Error('Apple Pay is not eligible');
    }

    console.log('Apple Pay is eligible, setting up button...');

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
          console.log({
            merchantCapabilities,
            currencyCode,
            supportedNetworks,
          });

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
                console.error('Merchant validation failed:', err);
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
              /* Create Order on the Server Side */
              const orderResponse = await fetch(`/api/checkout-orders`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  source: 'applepay',
                  totalAmount: getCurrentTotalAmount(),
                  paymentSource: 'applepay',
                }),
              });

              if (!orderResponse.ok) {
                const errorText = await orderResponse.text();
                console.error('Order creation failed:', errorText);
                throw new Error(
                  `Error creating order: ${orderResponse.status} - ${errorText}`
                );
              }

              const orderData = await orderResponse.json();
              if (!orderData.id) {
                throw new Error('Order ID not received from server');
              }

              console.log('Order created successfully:', orderData);
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
              await fetch(`/api/orders/${id}/capture`, {
                method: 'POST',
              });

              session.completePayment({
                status: window.ApplePaySession.STATUS_SUCCESS,
              });
            } catch (err) {
              console.error('Payment processing failed:', err);
              session.completePayment({
                status: window.ApplePaySession.STATUS_FAILURE,
              });
            }
          };

          session.oncancel = () => {
            console.log('Apple Pay Cancelled !!');
          };

          session.begin();
        } catch (clickError) {
          console.error('Apple Pay session error:', clickError);
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
    console.error('Apple Pay setup failed:', error);
    // Hide the Apple Pay container if setup fails
    const container = document.getElementById('applepay-container');
    if (container) {
      container.style.display = 'none';
    }
  }
}

document.addEventListener('DOMContentLoaded', function () {
  // Detect if we're likely on a PC/Windows for better user messaging
  const isPC =
    !navigator.userAgent.includes('Mac') &&
    !navigator.userAgent.includes('iPhone');

  console.log('Device detection:', {
    isPC,
    userAgent: navigator.userAgent,
    protocol: location.protocol,
    hostname: location.hostname,
  });

  // Always load PayPal components first - Apple Pay is optional
  loadPayPalComponents();

  // Early device check - completely skip Apple Pay setup on non-Apple devices
  const isAppleDevice = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
  const isSafari =
    /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);

  if (!isAppleDevice || !isSafari) {
    console.log(
      'Non-Apple device or non-Safari browser detected - hiding Apple Pay container'
    );
    const applePayContainer = document.getElementById('applepay-container');
    if (applePayContainer) {
      applePayContainer.style.display = 'none';
    }
    return; // Skip all Apple Pay setup
  }

  // Try to set up Apple Pay but don't let it break other functionality
  try {
    // Check if Apple Pay is available before trying to set it up
    if (typeof ApplePaySession !== 'undefined') {
      if (
        ApplePaySession?.supportsVersion(4) &&
        ApplePaySession?.canMakePayments()
      ) {
        // Wait for PayPal SDK to be loaded before setting up Apple Pay
        if (typeof paypal !== 'undefined' && paypal.Applepay) {
          setupApplepay().catch(console.error);
        } else {
          // If PayPal SDK isn't loaded yet, wait for it
          const checkPayPalLoaded = setInterval(() => {
            if (typeof paypal !== 'undefined' && paypal.Applepay) {
              clearInterval(checkPayPalLoaded);
              setupApplepay().catch(console.error);
            }
          }, 100);

          // Clear interval after 10 seconds to avoid infinite checking
          setTimeout(() => clearInterval(checkPayPalLoaded), 10000);
        }
      } else {
        console.log(
          'Apple Pay is not available on this device/browser - canMakePayments returned false'
        );
        // Hide the Apple Pay container if not available
        const applePayContainer = document.getElementById('applepay-container');
        if (applePayContainer) {
          applePayContainer.style.display = 'none';
        }
      }
    } else {
      console.log(
        'Apple Pay is not available on this device/browser - likely PC/Windows'
      );
      // Hide the Apple Pay container completely on non-Apple devices
      const applePayContainer = document.getElementById('applepay-container');
      if (applePayContainer) {
        applePayContainer.style.display = 'none';
        // Optionally show a message for debugging (comment out for production)
        // applePayContainer.innerHTML = '<p style="padding: 10px; background: #f0f0f0; border-radius: 4px; margin: 10px 0;">Apple Pay is only available on Mac/iOS devices with Safari over HTTPS</p>';
      }
    }
  } catch (applePaySetupError) {
    console.warn(
      'Apple Pay setup failed, but continuing with other payment methods:',
      applePaySetupError
    );
    // Hide the Apple Pay container on any error
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
  console.log('Client-Side Create Order Raw Request: ', data);

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

  // Include customer ID if returning user has payment methods
  if (globalCustomerId && hasPaymentMethods) {
    requestBody.customerId = globalCustomerId;
    console.log(
      'Including customer ID for returning user with payment methods:',
      globalCustomerId
    );
  }

  console.log('Final request body:', requestBody);

  return fetch('/api/checkout-orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })
    .then(response => response.json())
    .then(orderData => {
      console.log('Create Order Raw Response: ', orderData);
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
  console.log('idToken:', idToken);

  // Fetch and display saved payment methods
  if (customerId) {
    fetch(`/api/payment-tokens?customer_id=${customerId}`)
      .then(response => response.json())
      .then(paymentTokens => {
        displaySavedPaymentMethods(paymentTokens);
        loadPayPalSDK(idToken);
      })
      .catch(error => {
        console.error('Error fetching payment tokens:', error);
      });
  } else {
    loadPayPalSDK(idToken);
  }
}

function displaySavedPaymentMethods(paymentTokens) {
  console.log('paymentTokens:', paymentTokens);

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
  // Only include Apple Pay component on devices that support it
  const isAppleDevice =
    /Mac|iPhone|iPad|iPod/.test(navigator.userAgent) &&
    /Safari/.test(navigator.userAgent) &&
    typeof ApplePaySession !== 'undefined';

  const components = isAppleDevice
    ? 'buttons,card-fields,messages,applepay'
    : 'buttons,card-fields,messages';

  console.log(
    'Loading PayPal SDK with components:',
    components,
    '(Apple device detected:',
    isAppleDevice,
    ')'
  );

  // Use PayPal SDK with conditional Apple Pay component
  const scriptUrl = `https://www.paypal.com/sdk/js?commit=false&components=${components}&intent=authorize&client-id=${clientId}&enable-funding=venmo&integration-date=2023-01-01&debug=false`;
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
  console.log('onApprove callback triggered');

  return fetch(`/api/orders/${data.orderID}/authorize`, {
    method: 'POST',
  })
    .then(response => response.json())
    .then(orderData => {
      console.log(
        'Authorize Order Response: ',
        JSON.stringify(orderData, null, 2)
      );
      const authorizationId =
        orderData.purchase_units[0].payments.authorizations[0].id;
      const paymentSource = orderData.payment_source;
      const paymentSourceType = paymentSource.card ? 'card' : 'paypal';
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

const onCancel = (data, actions) => {
  console.log(`Order Canceled - ID: ${data.orderID}`);
};

const onError = err => {
  console.error(err);
};

const onShippingOptionsChange = (data, actions) => {
  console.log('Shipping Options Change:', data);
};

const onShippingAddressChange = (data, actions) => {
  console.log('Shipping Address Change:', data);
};

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
  console.log('updatePayPalMessages amount:', amount);
  const messageContainer = document.querySelector('[data-pp-message]');
  messageContainer.setAttribute('data-pp-amount', amount);
  paypal.Messages().render(messageContainer);
}

updateAmountTotal();
