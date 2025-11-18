// Simplified Checkout JavaScript - Modular Approach

// Use StorageManager from window.paypalStorageManager (loaded via storage-manager.js)
// No need to declare storageManager here as it's already available globally

// Global callback for Google Pay SDK loading
window.onGooglePayLoaded = function () {
  console.log('💳 Google Pay SDK loaded via callback');

  // If our checkout components aren't ready yet, queue the initialization
  if (!window.GooglePayButtons || !window.Utils) {
    console.log(
      '💳 Checkout components not ready yet, queuing Google Pay initialization'
    );
    window.googlePayPendingInit = true;
    return;
  }

  // Initialize Google Pay
  window.GooglePayButtons.initialize()
    .then(() => {
      window.Utils.showElement('googlepay-option');
      // Ensure button container is hidden initially
      window.Utils.hideElement('googlepay-button-container');
    })
    .catch(error => {
      console.warn('Google Pay initialization failed:', error);
      window.Utils.hideElement('googlepay-option');
    });
};

// Configuration and State
const CheckoutConfig = {
  currentCustomerId: null,
  hasPaymentMethods: false,
  totalAmount: '100.00',
};

// Utility Functions
const Utils = {
  getCurrentTotal() {
    const totalElement = document.getElementById('amount-total');
    return totalElement
      ? parseFloat(totalElement.textContent).toFixed(2)
      : '100.00';
  },

  updateTotal() {
    const cartTotal = parseFloat(
      document.getElementById('cart-total').textContent
    );
    const shippingAmount = parseFloat(
      document.getElementById('shipping-amount').textContent
    );
    const total = (cartTotal + shippingAmount).toFixed(2);
    document.getElementById('amount-total').textContent = total;
    CheckoutConfig.totalAmount = total;

    // Update PayPal messages with new total
    if (window.PayPalMessages) {
      PayPalMessages.updateAmount(total);
    }
  },

  showElement(id) {
    const element = document.getElementById(id);
    if (element) {
      // Use !important for Google Pay button container to override previous hiding
      if (id === 'googlepay-button-container') {
        element.style.setProperty('display', 'block', 'important');
      } else {
        element.style.display = 'block';
      }
    }
  },

  hideElement(id) {
    const element = document.getElementById(id);
    if (element) {
      // Use !important for Google Pay button container to ensure it stays hidden
      if (id === 'googlepay-button-container') {
        element.style.setProperty('display', 'none', 'important');
      } else {
        element.style.display = 'none';
      }
    }
  },

  showPaymentMethodButton(paymentMethod) {
    // Hide all payment method buttons
    this.hideElement('paypal-button-container');
    this.hideElement('venmo-button-container');
    this.hideElement('paylater-button-container');
    this.hideElement('applepay-button-container');
    this.hideElement('googlepay-button-container');
    this.hideElement('card-button-container');
    this.hideElement('submit-order-button');

    // Show the appropriate button based on selected payment method
    if (paymentMethod === 'paypal') {
      this.showElement('paypal-button-container');
    } else if (paymentMethod === 'venmo') {
      this.showElement('venmo-button-container');
    } else if (paymentMethod === 'paylater') {
      this.showElement('paylater-button-container');
    } else if (paymentMethod === 'applepay') {
      this.showElement('applepay-button-container');
    } else if (paymentMethod === 'googlepay') {
      this.showElement('googlepay-button-container');
    } else if (paymentMethod === 'card') {
      this.showElement('card-button-container');
      this.showElement('submit-order-button');
    } else if (paymentMethod.startsWith('saved-')) {
      this.showElement('submit-order-button');
    }
  },
};

// PayPal Integration
const PayPalIntegration = {
  async createOrder(data) {
    try {
      console.log('PayPal SDK data passed to createOrder:', data);

      // Determine the payment source based on the funding source
      let paymentSource = 'paypal'; // default
      if (data?.fundingSource === 'venmo') {
        paymentSource = 'venmo';
      } else if (data?.paymentSource) {
        paymentSource = data.paymentSource;
      }
      // Note: Pay Later uses 'paypal' as payment source, fundingSource just affects UI

      const requestBody = {
        source: paymentSource,
        totalAmount: Utils.getCurrentTotal(),
        shippingInfo: this.getShippingInfo(),
        cart: [
          {
            sku: '123456789',
            quantity: '1',
          },
        ],
      };

      // Set paymentSource for API compatibility
      requestBody.paymentSource = paymentSource;

      // Include billing info if different from shipping
      const billingInfo = this.getBillingInfo();
      if (billingInfo) {
        requestBody.billingInfo = billingInfo;
      }

      // Include customer ID if available
      if (CheckoutConfig.currentCustomerId) {
        requestBody.customerId = CheckoutConfig.currentCustomerId;
      }

      // Check if user wants to save payment method
      const savePaymentMethod = document.getElementById('save-payment-method');
      if (savePaymentMethod && savePaymentMethod.checked) {
        requestBody.vault = true;
        console.log('Vault requested: payment method will be saved');
      }

      console.log('Sending request to server:', requestBody);

      const response = await fetch('/api/checkout-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error response:', response.status, errorText);
        throw new Error(
          `Order creation failed: ${response.status} - ${errorText}`
        );
      }

      const orderData = await response.json();
      console.log('Order created:', orderData.id);
      return orderData.id;
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  },

  async approveOrder(data) {
    try {
      // Always authorize only - no capture during checkout
      const response = await fetch(`/api/orders/${data.orderID}/authorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) throw new Error('Order authorization failed');
      const orderData = await response.json();

      this.displayResults(orderData);
      return orderData;
    } catch (error) {
      console.error('Error authorizing order:', error);
      throw error;
    }
  },

  getShippingInfo() {
    return {
      firstName: document.getElementById('shipping-first-name')?.value,
      lastName: document.getElementById('shipping-last-name')?.value,
      email: document.getElementById('shipping-email')?.value,
      phone: document.getElementById('shipping-phone')?.value,
      address: {
        addressLine1: document.getElementById('shipping-address-line1')?.value,
        adminArea2: document.getElementById('shipping-admin-area2')?.value,
        adminArea1: document.getElementById('shipping-admin-area1')?.value,
        postalCode: document.getElementById('shipping-postal-code')?.value,
        countryCode: document.getElementById('shipping-country-code')?.value,
      },
    };
  },

  getBillingInfo() {
    const isDifferent = document.getElementById('billing-info-toggle')?.checked;
    if (!isDifferent) return null;

    return {
      firstName: document.getElementById('billing-first-name')?.value,
      lastName: document.getElementById('billing-last-name')?.value,
      email: document.getElementById('billing-email')?.value,
      phone: document.getElementById('billing-phone')?.value,
      address: {
        addressLine1: document.getElementById('billing-address-line1')?.value,
        adminArea2: document.getElementById('billing-admin-area2')?.value,
        adminArea1: document.getElementById('billing-admin-area1')?.value,
        postalCode: document.getElementById('billing-postal-code')?.value,
        countryCode: document.getElementById('billing-country-code')?.value,
      },
    };
  },

  displayResults(orderData) {
    // Save order to localStorage with enhanced metadata
    if (orderData?.id) {
      const paymentSource = orderData.payment_source;
      let paymentMethod = 'unknown';

      if (paymentSource?.card) {
        paymentMethod = 'card';
      } else if (paymentSource?.paypal) {
        paymentMethod = 'paypal';
      } else if (paymentSource?.venmo) {
        paymentMethod = 'venmo';
      } else if (paymentSource?.apple_pay) {
        paymentMethod = 'apple_pay';
      } else if (paymentSource?.google_pay) {
        paymentMethod = 'google_pay';
      }

      const orderMetadata = {
        amount: CheckoutConfig.totalAmount,
        paymentMethod: paymentMethod,
        status: 'authorized',
        authorizationId:
          orderData.purchase_units?.[0]?.payments?.authorizations?.[0]?.id ||
          null,
      };

      console.log(
        '💾 Saving order to StorageManager:',
        orderData.id,
        orderMetadata
      );
      const saveResult = window.paypalStorageManager.saveOrder(
        orderData.id,
        orderMetadata
      );
      console.log('💾 Save result:', saveResult);

      // Debug: Check what's actually in storage
      const savedOrders = window.paypalStorageManager.getOrders();
      console.log('💾 All orders in storage:', savedOrders);
    }

    // Show order results
    const orderInfoSection = document.getElementById('order-info-section');
    const captureInfoSection = document.getElementById('capture-info-section');
    const paymentSourceSection = document.getElementById(
      'payment-source-section'
    );

    if (orderInfoSection) {
      orderInfoSection.style.display = 'block';
      orderInfoSection.innerHTML = `<pre>${JSON.stringify(
        orderData,
        null,
        2
      )}</pre>`;
    }

    if (captureInfoSection) {
      captureInfoSection.style.display = 'block';

      // Update authorization info based on order data
      const authId =
        orderData.purchase_units?.[0]?.payments?.authorizations?.[0]?.id;
      const captureId =
        orderData.purchase_units?.[0]?.payments?.captures?.[0]?.id;

      const captureOrderInfo = document.getElementById('capture-order-info');
      if (captureOrderInfo) {
        if (authId) {
          captureOrderInfo.textContent = `Authorization ID: ${authId}`;
        } else if (captureId) {
          captureOrderInfo.textContent = `Payment Captured: ${captureId}`;
        } else {
          captureOrderInfo.textContent = `Order ID: ${orderData.id}`;
        }
      }
    }

    if (paymentSourceSection) {
      paymentSourceSection.style.display = 'block';

      // Determine payment source type
      const paymentSource = orderData.payment_source;
      let paymentSourceType = 'unknown';

      if (paymentSource?.card) {
        paymentSourceType = 'card';
      } else if (paymentSource?.paypal) {
        paymentSourceType = 'paypal';
      } else if (paymentSource?.venmo) {
        paymentSourceType = 'venmo';
      } else if (paymentSource?.apple_pay) {
        paymentSourceType = 'apple_pay';
      } else if (paymentSource?.google_pay) {
        paymentSourceType = 'google_pay';
      }

      const paymentSourceTypeInfo = document.getElementById(
        'payment-source-type-info'
      );
      if (paymentSourceTypeInfo) {
        paymentSourceTypeInfo.textContent = `Payment Source: ${paymentSourceType}`;
      }

      // Display vault information if available
      const vaultStatus =
        paymentSource?.[paymentSourceType]?.attributes?.vault?.status;
      const customerId =
        paymentSource?.[paymentSourceType]?.attributes?.vault?.customer?.id;
      const paymentTokenId =
        paymentSource?.[paymentSourceType]?.attributes?.vault?.id;

      const vaultStatusInfo = document.getElementById('vault-status-info');
      const customerIdInfo = document.getElementById('customer-id-info');
      const paymentTokenIdInfo = document.getElementById(
        'payment-token-id-info'
      );

      if (vaultStatusInfo && vaultStatus) {
        vaultStatusInfo.textContent = `Vault Status: ${vaultStatus}`;
      }
      if (customerIdInfo && customerId) {
        customerIdInfo.textContent = `Customer ID: ${customerId}`;
        // Save customer ID to localStorage when vaulting occurs with enhanced metadata
        const customerMetadata = {
          paymentMethods: [paymentSourceType],
          vaultStatus: vaultStatus,
          paymentTokenId: paymentTokenId,
        };
        window.paypalStorageManager.saveCustomer(customerId, customerMetadata);
      }
      if (paymentTokenIdInfo && paymentTokenId) {
        paymentTokenIdInfo.textContent = `Payment Token ID: ${paymentTokenId}`;
      }
    }
  },
};

// Card Fields Integration
const CardFields = {
  cardFieldsComponent: null,

  async initialize() {
    if (!window.paypal?.CardFields) {
      console.error('PayPal CardFields not available');
      return;
    }

    try {
      this.cardFieldsComponent = window.paypal.CardFields({
        createOrder: data => PayPalIntegration.createOrder(data),
        onApprove: data => PayPalIntegration.approveOrder(data),
        onError: err => {
          console.error('Card fields error:', err);
          alert('Payment failed. Please try again.');
        },
      });

      // Render card fields
      if (this.cardFieldsComponent.isEligible()) {
        await this.renderCardFields();
      } else {
        console.warn('Card fields not eligible');
        Utils.hideElement('card-button-container');
      }
    } catch (error) {
      console.error('Error initializing card fields:', error);
      Utils.hideElement('card-button-container');
    }
  },

  async renderCardFields() {
    try {
      const nameField = this.cardFieldsComponent.NameField();
      const numberField = this.cardFieldsComponent.NumberField();
      const cvvField = this.cardFieldsComponent.CVVField();
      const expiryField = this.cardFieldsComponent.ExpiryField();

      await nameField.render('#card-name-field-container');
      await numberField.render('#card-number-field-container');
      await cvvField.render('#card-cvv-field-container');
      await expiryField.render('#card-expiry-field-container');

      console.log('Card fields rendered successfully');
    } catch (error) {
      console.error('Error rendering card fields:', error);
    }
  },
};

// PayPal Buttons
const PayPalButtons = {
  async initialize() {
    if (!window.paypal?.Buttons) {
      console.error('PayPal Buttons not available');
      return;
    }

    try {
      const buttonsComponent = window.paypal.Buttons({
        fundingSource: window.paypal.FUNDING.PAYPAL,
        createOrder: data => PayPalIntegration.createOrder(data),
        onApprove: data => PayPalIntegration.approveOrder(data),
        onError: err => {
          console.error('PayPal button error:', err);
          alert('Payment failed. Please try again.');
        },
        style: {
          layout: 'vertical',
          color: 'blue',
          shape: 'rect',
          label: 'paypal',
        },
      });

      if (buttonsComponent.isEligible()) {
        await buttonsComponent.render('#paypal-button-container');
        console.log('PayPal buttons rendered successfully');
      }
    } catch (error) {
      console.error('Error initializing PayPal buttons:', error);
    }
  },
};

// Venmo Buttons
const VenmoButtons = {
  async initialize() {
    if (!window.paypal?.Buttons) {
      console.error('PayPal Buttons not available for Venmo');
      return;
    }

    try {
      const venmoComponent = window.paypal.Buttons({
        fundingSource: window.paypal.FUNDING.VENMO,
        createOrder: data => PayPalIntegration.createOrder(data),
        onApprove: data => PayPalIntegration.approveOrder(data),
        onError: err => {
          console.error('Venmo button error:', err);
          alert('Payment failed. Please try again.');
        },
        style: {
          layout: 'vertical',
          color: 'blue',
          shape: 'rect',
        },
      });

      if (venmoComponent.isEligible()) {
        await venmoComponent.render('#venmo-button-container');
        console.log('Venmo buttons rendered successfully');
      } else {
        console.warn('Venmo not eligible');
        Utils.hideElement('venmo-option');
      }
    } catch (error) {
      console.error('Error initializing Venmo buttons:', error);
      Utils.hideElement('venmo-option');
    }
  },
};

// Pay Later Buttons
const PayLaterButtons = {
  async initialize() {
    if (!window.paypal?.Buttons) {
      console.error('PayPal Buttons not available for Pay Later');
      return;
    }

    try {
      const payLaterComponent = window.paypal.Buttons({
        fundingSource: window.paypal.FUNDING.PAYLATER,
        createOrder: data => PayPalIntegration.createOrder(data),
        onApprove: data => PayPalIntegration.approveOrder(data),
        onError: err => {
          console.error('Pay Later button error:', err);
          alert('Payment failed. Please try again.');
        },
        style: {
          layout: 'vertical',
          color: 'gold',
          shape: 'rect',
        },
      });

      if (payLaterComponent.isEligible()) {
        await payLaterComponent.render('#paylater-button-container');
        console.log('Pay Later buttons rendered successfully');
      } else {
        console.warn('Pay Later not eligible');
        Utils.hideElement('paylater-option');
      }
    } catch (error) {
      console.error('Error initializing Pay Later buttons:', error);
      Utils.hideElement('paylater-option');
    }
  },
};

// Apple Pay Integration
const ApplePayButtons = {
  async initialize() {
    try {
      console.log('🍎 Starting Apple Pay setup...');
      console.log('🌐 Current protocol:', location.protocol);
      console.log('🏠 Current hostname:', location.hostname);

      // Check if we're on HTTPS (required for Apple Pay)
      if (
        location.protocol !== 'https:' &&
        location.hostname !== 'localhost' &&
        location.hostname !== '127.0.0.1'
      ) {
        console.warn('⚠️ Apple Pay requires HTTPS in production environments');
        throw new Error('Apple Pay requires HTTPS connection');
      }

      // Check if PayPal SDK is loaded
      console.log('🔍 Checking PayPal SDK availability...');
      if (!window.paypal?.Applepay) {
        throw new Error('PayPal SDK or Apple Pay component not loaded');
      }

      // Check if Apple Pay is available
      console.log('🔍 Checking ApplePaySession availability...');
      if (typeof ApplePaySession === 'undefined') {
        throw new Error(
          'ApplePaySession is not available - script may be blocked by CSP or device not supported'
        );
      }

      // Check if we're on a supported platform
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

      const applepay = window.paypal.Applepay();
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

      // Create Apple Pay button
      const container = document.getElementById('applepay-button-container');
      if (container) {
        container.innerHTML =
          '<apple-pay-button id="btn-appl" buttonstyle="black" type="buy" locale="en"></apple-pay-button>';

        // Ensure the Apple Pay button gets proper styling
        const applePayButton = document.getElementById('btn-appl');
        if (applePayButton) {
          applePayButton.style.width = '100%';
          applePayButton.style.height = '40px';
          applePayButton.style.borderRadius = '4px';
          applePayButton.style.margin = '0';
          applePayButton.style.display = 'block';

          applePayButton.addEventListener('click', async () => {
            await this.handleApplePayClick(applepay, config);
          });
        }

        // Hide the button initially - it will be shown when radio button is selected
        container.style.display = 'none';
      }

      console.log('Apple Pay button rendered successfully');
    } catch (error) {
      console.error('Apple Pay setup failed:', error);
      // Re-throw error so the parent can handle showing/hiding the option
      throw error;
    }
  },

  async handleApplePayClick(applepay, config) {
    try {
      const { countryCode, merchantCapabilities, supportedNetworks } = config;

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
          amount: Utils.getCurrentTotal(),
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
          // Create order with Apple Pay source
          const orderId = await PayPalIntegration.createOrder({
            paymentSource: 'apple_pay',
          });

          // Confirm payment with Apple Pay
          await applepay.confirmOrder({
            orderId: orderId,
            token: event.payment.token,
            billingContact: event.payment.billingContact,
            shippingContact: event.payment.shippingContact,
          });

          // Authorize the order (no capture during checkout)
          const result = await PayPalIntegration.approveOrder({
            orderID: orderId,
          });

          session.completePayment({
            status: window.ApplePaySession.STATUS_SUCCESS,
          });

          console.log('Apple Pay payment authorized:', result);
        } catch (err) {
          console.error('Payment processing failed:', err);
          session.completePayment({
            status: window.ApplePaySession.STATUS_FAILURE,
          });
        }
      };

      session.oncancel = () => {
        console.log('Apple Pay Cancelled');
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
  },
};

// Google Pay Integration
const GooglePayButtons = {
  paymentsClient: null,
  googlePayConfig: null,

  async initialize() {
    try {
      console.log('💳 Starting Google Pay setup...');

      // Check if we're on HTTPS (required for Google Pay in production)
      const isLocalhost =
        location.hostname === 'localhost' || location.hostname === '127.0.0.1';
      const isHTTPS = location.protocol === 'https:';

      if (!isHTTPS && !isLocalhost) {
        console.warn('⚠️ Google Pay requires HTTPS for full functionality');
      }

      // Check if required SDKs are loaded
      if (typeof google === 'undefined' || !google.payments) {
        throw new Error('Google Pay SDK not loaded');
      }

      if (!window.paypal?.Googlepay) {
        throw new Error('PayPal SDK or Google Pay component not loaded');
      }

      // Get Google Pay configuration from PayPal
      try {
        this.googlePayConfig = await window.paypal.Googlepay().config();
        console.log('Google Pay config:', this.googlePayConfig);
      } catch (configError) {
        console.error('Google Pay config error:', configError);
        throw new Error('Google Pay requires HTTPS for testing');
      }

      if (!this.googlePayConfig.isEligible) {
        console.warn('Google Pay is not eligible on this device/browser');
        throw new Error('Google Pay is not eligible');
      }

      // Initialize payments client
      this.paymentsClient = new google.payments.api.PaymentsClient({
        environment: 'TEST', // Change to 'PRODUCTION' for live
        paymentDataCallbacks: {
          onPaymentAuthorized: this.onPaymentAuthorized.bind(this),
        },
      });

      // Check if Google Pay is ready
      const baseRequest = {
        apiVersion: 2,
        apiVersionMinor: 0,
      };

      const isReadyToPayRequest = {
        ...baseRequest,
        allowedPaymentMethods: this.googlePayConfig.allowedPaymentMethods,
      };

      const isReadyToPay = await this.paymentsClient.isReadyToPay(
        isReadyToPayRequest
      );

      if (isReadyToPay.result) {
        console.log('Google Pay is ready, adding button...');
        this.addGooglePayButton();
      } else {
        throw new Error('Google Pay is not available on this device/browser');
      }
    } catch (error) {
      console.error('Google Pay setup failed:', error);
      this.handleSetupError(error);
    }
  },

  addGooglePayButton() {
    const button = this.paymentsClient.createButton({
      onClick: this.onGooglePaymentButtonClicked.bind(this),
      buttonColor: 'black',
      buttonType: 'buy',
      buttonSizeMode: 'fill',
    });

    const container = document.getElementById('googlepay-button-container');
    if (container) {
      container.innerHTML = ''; // Clear any existing content
      container.appendChild(button);
      // Force hide the button container with !important to override any other styles
      container.style.setProperty('display', 'none', 'important');
      console.log(
        'Google Pay button rendered and explicitly hidden until selected'
      );
    }
  },

  async onGooglePaymentButtonClicked() {
    try {
      const paymentDataRequest = await this.getGooglePaymentDataRequest();

      // This will trigger the onPaymentAuthorized callback when the user approves
      this.paymentsClient.loadPaymentData(paymentDataRequest);
    } catch (error) {
      console.error('Google Pay button click failed:', error);
      alert('Google Pay payment failed: ' + error.message);
    }
  },

  async getGooglePaymentDataRequest() {
    if (!this.googlePayConfig) {
      throw new Error('Google Pay configuration not loaded');
    }

    const baseRequest = {
      apiVersion: 2,
      apiVersionMinor: 0,
    };

    const paymentDataRequest = Object.assign({}, baseRequest);
    paymentDataRequest.allowedPaymentMethods =
      this.googlePayConfig.allowedPaymentMethods;
    paymentDataRequest.transactionInfo = {
      currencyCode: 'USD',
      totalPriceStatus: 'FINAL',
      totalPrice: Utils.getCurrentTotal(),
    };
    paymentDataRequest.merchantInfo = this.googlePayConfig.merchantInfo;
    paymentDataRequest.callbackIntents = ['PAYMENT_AUTHORIZATION'];

    return paymentDataRequest;
  },

  async onPaymentAuthorized(paymentData) {
    console.log('Google Pay payment authorized:', paymentData);

    try {
      const result = await this.processGooglePayPayment(paymentData);
      return result;
    } catch (error) {
      console.error('Payment processing failed:', error);
      return {
        transactionState: 'ERROR',
        error: {
          intent: 'PAYMENT_AUTHORIZATION',
          message: error.message,
          reason: 'PAYMENT_DATA_INVALID',
        },
      };
    }
  },

  async processGooglePayPayment(paymentData) {
    try {
      // Create order with Google Pay source
      const orderId = await PayPalIntegration.createOrder({
        paymentSource: 'google_pay',
      });

      // Confirm the order with PayPal
      const confirmOrderResponse = await window.paypal
        .Googlepay()
        .confirmOrder({
          orderId: orderId,
          paymentMethodData: paymentData.paymentMethodData,
        });

      console.log('Confirm order response:', confirmOrderResponse);

      if (confirmOrderResponse.status === 'APPROVED') {
        // Authorize the order (no capture during checkout)
        const result = await PayPalIntegration.approveOrder({
          orderID: orderId,
        });

        console.log('Google Pay payment authorized:', result);
        return { transactionState: 'SUCCESS' };
      } else {
        throw new Error(
          `Order confirmation failed with status: ${confirmOrderResponse.status}`
        );
      }
    } catch (error) {
      console.error('Google Pay payment processing failed:', error);
      throw error;
    }
  },

  handleSetupError(error) {
    const container = document.getElementById('googlepay-button-container');
    if (container) {
      if (
        error.message.includes('HTTPS') ||
        error.message.includes('CORS') ||
        error.message.includes('Failed to fetch')
      ) {
        // Show informative message for HTTPS requirement
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
            line-height: 1.4;
          ">
            <strong>🔒 Google Pay</strong><br>
            <small>Requires HTTPS for sandbox testing.<br>
            Deploy to staging/production with SSL to test Google Pay functionality.</small>
          </div>
        `;
        // Show the Google Pay option but keep the button container hidden initially
        Utils.showElement('googlepay-option');
        // Important: Keep the button container hidden - only showPaymentMethodButton should show it
        Utils.hideElement('googlepay-button-container');
      } else {
        // Hide the container for other errors
        container.style.display = 'none';
      }
    }

    // Re-throw error so the parent can handle showing/hiding the option
    throw error;
  },
};

// PayPal Messages (Pay Later)
const PayPalMessages = {
  async initialize() {
    if (!window.paypal?.Messages) {
      console.warn('PayPal Messages not available');
      return;
    }

    try {
      const messagesComponent = window.paypal.Messages({
        amount: Utils.getCurrentTotal(),
        placement: 'payment',
        style: {
          layout: 'text',
          logo: {
            type: 'inline',
          },
        },
      });

      // Messages component doesn't have isEligible method, just render directly
      await messagesComponent.render('[data-pp-message]');
      console.log('PayPal messages rendered successfully');
    } catch (error) {
      console.error('Error initializing PayPal messages:', error);
    }
  },

  // Update messages when total changes
  updateAmount(newAmount) {
    const messageElement = document.querySelector('[data-pp-message]');
    if (messageElement) {
      messageElement.setAttribute('data-pp-amount', newAmount);
      // Re-render messages with new amount
      this.initialize();
    }
  },
};

// Customer Management
const CustomerManagement = {
  async loadPaymentMethods(customerId) {
    try {
      const response = await fetch(
        `/api/customers/${customerId}/payment-methods`
      );
      if (!response.ok) throw new Error('Failed to load payment methods');

      const data = await response.json();
      this.displaySavedPaymentMethods(data.paymentMethods);

      CheckoutConfig.currentCustomerId = customerId;
      CheckoutConfig.hasPaymentMethods = data.paymentMethods.length > 0;
    } catch (error) {
      console.error('Error loading payment methods:', error);
      Utils.hideElement('saved-payment-methods-container');
    }
  },

  displaySavedPaymentMethods(paymentMethods) {
    const container = document.getElementById('saved-payment-methods-list');
    if (!container || paymentMethods.length === 0) {
      Utils.hideElement('saved-payment-methods-container');
      return;
    }

    container.innerHTML = paymentMethods
      .map(
        (pm, index) => `
      <div class="payment-method-option saved-payment-method-option">
        <input type="radio" name="payment-method" id="saved-${index}" value="saved-${pm.id}">
        <label for="saved-${index}" class="payment-method-label">
          <div>
            <span class="saved-payment-badge">SAVED</span>
            <span class="saved-payment-details">
              ${pm.brand} •••• ${pm.lastFourDigits}
              <br><small>Expires ${pm.expiryMonth}/${pm.expiryYear}</small>
            </span>
          </div>
        </label>
      </div>
    `
      )
      .join('');

    Utils.showElement('saved-payment-methods-container');
  },
};

// Event Handlers
const EventHandlers = {
  setupEventListeners() {
    // Shipping options
    document
      .querySelectorAll('input[name="shipping-option"]')
      .forEach(option => {
        option.addEventListener('change', () => {
          const shippingAmount = parseFloat(option.value).toFixed(2);
          document.getElementById('shipping-amount').textContent =
            shippingAmount;
          Utils.updateTotal();
        });
      });

    // Payment method selection
    document.addEventListener('change', event => {
      if (event.target.name === 'payment-method') {
        Utils.showPaymentMethodButton(event.target.value);
      }
    });

    // Customer ID form
    const customerForm = document.getElementById('customer-id-form');
    if (customerForm) {
      customerForm.addEventListener('submit', event => {
        event.preventDefault();
        const customerId = document.getElementById('customer-id').value.trim();
        if (customerId) {
          CustomerManagement.loadPaymentMethods(customerId);
        }
      });
    }

    // Toggle customer ID form
    const toggle = document.getElementById('toggle-customer-id');
    if (toggle) {
      toggle.addEventListener('change', () => {
        if (toggle.checked) {
          Utils.showElement('customer-id-form');
        } else {
          Utils.hideElement('customer-id-form');
          Utils.hideElement('saved-payment-methods-container');
          CheckoutConfig.currentCustomerId = null;
          CheckoutConfig.hasPaymentMethods = false;
        }
      });
    }

    // Billing address toggle
    const billingToggle = document.getElementById('billing-info-toggle');
    if (billingToggle) {
      billingToggle.addEventListener('change', () => {
        if (billingToggle.checked) {
          Utils.showElement('billing-info');
        } else {
          Utils.hideElement('billing-info');
        }
      });
    }

    // Submit button for saved payment methods and card payments
    const submitButton = document.getElementById('submit-order-button');
    if (submitButton) {
      submitButton.addEventListener('click', async () => {
        const selectedPaymentMethod = document.querySelector(
          'input[name="payment-method"]:checked'
        );

        if (selectedPaymentMethod?.value.startsWith('saved-')) {
          try {
            const orderId = await PayPalIntegration.createOrder();
            const result = await PayPalIntegration.approveOrder({
              orderID: orderId,
            });
            console.log('Saved payment method order completed:', result);
          } catch (error) {
            console.error('Error processing saved payment method:', error);
            alert('Payment failed. Please try again.');
          }
        } else if (selectedPaymentMethod?.value === 'card') {
          // For card payments, the card fields component handles the submission
          if (CardFields.cardFieldsComponent) {
            try {
              await CardFields.cardFieldsComponent.submit();
            } catch (error) {
              console.error('Error submitting card payment:', error);
              alert('Payment failed. Please try again.');
            }
          }
        }
      });
    }
  },
};

// Main Initialization
class CheckoutApp {
  async initialize() {
    console.log('Initializing simplified checkout...');

    // Wait for PayPal SDK
    await this.waitForPayPalSDK();

    // Initialize components
    await Promise.all([
      PayPalButtons.initialize(),
      VenmoButtons.initialize(),
      PayLaterButtons.initialize(),
      CardFields.initialize(),
      PayPalMessages.initialize(),
      this.initializeApplePay(),
      this.initializeGooglePay(),
    ]);

    // Setup event listeners
    EventHandlers.setupEventListeners();

    // Initialize totals
    Utils.updateTotal();

    // Show default payment method (PayPal)
    Utils.showPaymentMethodButton('paypal');

    console.log('Checkout initialized successfully');
  }

  async initializeApplePay() {
    // Only initialize Apple Pay on supported devices
    const isAppleDevice = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
    const isSafari =
      /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);

    if (isAppleDevice && isSafari && typeof ApplePaySession !== 'undefined') {
      try {
        if (
          ApplePaySession?.supportsVersion(4) &&
          ApplePaySession?.canMakePayments()
        ) {
          await ApplePayButtons.initialize();
          // Show Apple Pay option if initialization succeeded
          Utils.showElement('applepay-option');
        } else {
          console.log('Apple Pay not available on this device/browser');
          Utils.hideElement('applepay-option');
        }
      } catch (error) {
        console.warn('Apple Pay initialization failed:', error);
        Utils.hideElement('applepay-option');
      }
    } else {
      console.log('Non-Apple device or non-Safari browser - hiding Apple Pay');
      Utils.hideElement('applepay-option');
    }
  }

  async initializeGooglePay() {
    // Wait for Google Pay SDK to load
    if (typeof google !== 'undefined' && google.payments) {
      try {
        await GooglePayButtons.initialize();
        // Show Google Pay option if initialization succeeded
        Utils.showElement('googlepay-option');
        // Ensure button container is hidden initially (will be shown when radio selected)
        Utils.hideElement('googlepay-button-container');
      } catch (error) {
        console.warn('Google Pay initialization failed:', error);
        Utils.hideElement('googlepay-option');
      }
    } else {
      console.log('Waiting for Google Pay SDK to load...');
      // The global onGooglePayLoaded callback will handle initialization when the SDK loads
    }
  }

  waitForPayPalSDK() {
    return new Promise(resolve => {
      if (window.paypal) {
        resolve();
        return;
      }

      let attempts = 0;
      const maxAttempts = 50;

      const checkPayPal = setInterval(() => {
        attempts++;
        if (window.paypal) {
          clearInterval(checkPayPal);
          resolve();
        } else if (attempts >= maxAttempts) {
          clearInterval(checkPayPal);
          console.error('PayPal SDK failed to load');
          resolve(); // Continue anyway
        }
      }, 100);
    });
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new CheckoutApp();

  // Initialize checkout
  app
    .initialize()
    .then(() => {
      // Integrate with optional modules if available
      if (window.paypalModuleLoader) {
        window.paypalModuleLoader.integrateWithCheckout({
          Utils,
          PayPalIntegration,
          CardFields,
          CustomerManagement,
          CheckoutConfig,
        });
      }
    })
    .catch(error => {
      console.error('Failed to initialize checkout:', error);
    });
});

// Export for debugging and module integration
window.CheckoutApp = {
  Utils,
  PayPalIntegration,
  PayPalButtons,
  VenmoButtons,
  PayLaterButtons,
  ApplePayButtons,
  GooglePayButtons,
  CardFields,
  CustomerManagement,
  CheckoutConfig,
  storageManager: window.paypalStorageManager,
};

// Export necessary objects to global scope for Google Pay callback
window.Utils = Utils;
window.GooglePayButtons = GooglePayButtons;

// Check if Google Pay initialization was queued
if (window.googlePayPendingInit) {
  console.log('💳 Processing queued Google Pay initialization');
  window.onGooglePayLoaded();
  window.googlePayPendingInit = false;
}

// Initialize StorageManager debug utilities if in debug mode
if (
  window.location.search.includes('debug=true') ||
  window.location.search.includes('storage=true')
) {
  window.paypalStorageManager.attachToWindow();
  console.log('🚀 StorageManager debug utilities enabled!');
  console.log('💾 Access storage data via window.storage methods:');
  console.log('   window.storage.orders() - View saved orders');
  console.log('   window.storage.customers() - View saved customers');
  console.log('   window.storage.stats() - View storage statistics');
  console.log('   window.storage.export() - Export all data');
  console.log('   window.storage.clear() - Clear all data');
}
