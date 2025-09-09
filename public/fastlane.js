/**
 * PayPal Fastlane Integration
 * This file handles the client-side integration with PayPal's Fastlane technology
 */

class FastlaneIntegration {
  constructor(clientId) {
    this.clientId = clientId;
    this.fastlaneInstance = null;
    this.cardComponent = null;
    this.identityComponent = null;
    this.debugMode = true; // Enable debug mode to track FraudNet issues
  }

  /**
   * Debug helper to log detailed information
   */
  debugLog(message, data = null) {
    if (this.debugMode) {
      console.log(`[Fastlane Debug] ${message}`, data || '');
    }
  }

  /**
   * Check PayPal SDK and environment compatibility
   */
  checkEnvironment() {
    this.debugLog('Checking environment...');

    const checks = {
      paypalSDK: !!window.paypal,
      fastlaneAvailable: !!(window.paypal && window.paypal.Fastlane),
      fraudNetAvailable: !!(window.paypal && window.paypal.FraudNet),
      userAgent: navigator.userAgent,
      location: window.location.href,
      protocol: window.location.protocol,
    };

    this.debugLog('Environment check results:', checks);
    return checks;
  }

  /**
   * Initialize the Fastlane integration
   */
  async init() {
    try {
      console.log('🚀 Initializing PayPal Fastlane...');
      this.debugLog('Starting Fastlane initialization');

      // Check environment first
      const envCheck = this.checkEnvironment();
      this.showDebugInfo('Initial Environment Check', envCheck);

      // Load PayPal SDK with Fastlane component
      await this.loadPayPalSDK();
      this.debugLog('PayPal SDK loaded successfully');

      // Wait for PayPal SDK to be fully loaded
      await this.waitForPayPalReady();
      this.debugLog('PayPal SDK is ready');

      // Check environment after SDK load
      const envCheckAfter = this.checkEnvironment();
      this.debugLog('Environment after SDK load:', envCheckAfter);
      this.showDebugInfo('Environment After SDK Load', envCheckAfter);

      // Initialize FraudNet first with multiple attempts
      await this.initializeFraudNetWithRetry();

      // Initialize Fastlane instance with proper configuration
      const fastlaneConfig = {
        styles: {
          root: {
            backgroundColor: '#ffffff',
            fontFamily: 'Arial, sans-serif',
            fontSize: '16px',
          },
          input: {
            backgroundColor: '#f8f9fa',
            borderColor: '#dee2e6',
            borderRadius: '4px',
            padding: '12px',
          },
          button: {
            backgroundColor: '#0070ba',
            borderRadius: '4px',
            color: '#ffffff',
          },
        },
        locale: 'en_US',
      };

      // Try with FraudNet first, then fallback without it
      try {
        this.debugLog('Attempting Fastlane initialization with FraudNet...');
        this.fastlaneInstance = await window.paypal.Fastlane({
          ...fastlaneConfig,
          fraudNet: { sandbox: true },
        });
      } catch (fraudNetError) {
        this.debugLog(
          'FraudNet initialization failed, trying without it:',
          fraudNetError
        );
        this.fastlaneInstance = await window.paypal.Fastlane({
          ...fastlaneConfig,
          fraudNet: false,
        });
        this.showStatus(
          '⚠️ Advanced fraud protection unavailable, using standard security',
          'warning'
        );
      }

      console.log('✅ Fastlane initialized successfully');
      this.debugLog('Fastlane instance created successfully');

      await this.renderComponents();
      this.setupEventListeners();
    } catch (error) {
      console.error('❌ Fastlane initialization failed:', error);
      this.debugLog('Initialization failed with error:', error);

      // Specific handling for different error types
      if (
        error.message &&
        (error.message.includes('fraudnet') ||
          error.message.includes('ppcp_axo_init_fraudnet_failed'))
      ) {
        console.error(
          '🚨 FraudNet initialization failed - implementing complete fallback'
        );
        this.showStatus(
          '⚠️ Advanced checkout unavailable, using standard checkout form',
          'warning'
        );
      }

      this.showFallbackPaymentForm();
    }
  }

  /**
   * Initialize FraudNet with retry mechanism
   */
  async initializeFraudNetWithRetry(maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.debugLog(
          `FraudNet initialization attempt ${attempt}/${maxRetries}`
        );

        if (window.paypal && window.paypal.FraudNet) {
          await window.paypal.FraudNet();
          console.log('✅ FraudNet initialized successfully');
          this.debugLog('FraudNet initialized on attempt', attempt);
          return;
        } else {
          this.debugLog('FraudNet not available in SDK');
          return; // FraudNet not available, continue without error
        }
      } catch (error) {
        this.debugLog(`FraudNet attempt ${attempt} failed:`, error);

        if (attempt === maxRetries) {
          console.warn(
            '⚠️ FraudNet initialization failed after all retries, continuing without it:',
            error
          );
        } else {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
  }

  /**
   * Wait for PayPal SDK to be fully ready
   */
  async waitForPayPalReady() {
    return new Promise(resolve => {
      const checkPayPal = () => {
        if (window.paypal && window.paypal.Fastlane) {
          resolve();
        } else {
          setTimeout(checkPayPal, 100);
        }
      };
      checkPayPal();
    });
  }

  /**
   * Load PayPal SDK dynamically
   */
  async loadPayPalSDK() {
    return new Promise((resolve, reject) => {
      if (window.paypal) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      // Correct PayPal SDK URL for Fastlane - simplified and clean
      script.src = `https://www.paypal.com/sdk/js?client-id=${this.clientId}&components=fastlane`;
      script.onload = () => {
        console.log('✅ PayPal SDK loaded successfully');
        resolve();
      };
      script.onerror = error => {
        console.error('❌ Failed to load PayPal SDK:', error);
        reject(error);
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Render Fastlane components
   */
  async renderComponents() {
    try {
      // Render Identity Component with error handling
      this.identityComponent = await this.renderIdentityComponent();
      console.log('✅ Identity component rendered');

      // Render Card Component with error handling
      this.cardComponent = await this.renderCardComponent();
      console.log('✅ Card component rendered');
    } catch (error) {
      console.error('❌ Error rendering Fastlane components:', error);

      // If component rendering fails due to FraudNet, try alternative approach
      if (error.message && error.message.includes('fraudnet')) {
        console.log('🔄 Attempting to render components without FraudNet...');
        await this.renderComponentsWithoutFraudNet();
      } else {
        this.showFallbackPaymentForm();
      }
    }
  }

  /**
   * Render Identity Component with proper error handling
   */
  async renderIdentityComponent() {
    const identityComponent = await this.fastlaneInstance.Identity({
      onLookupComplete: lookupResult => {
        console.log('👤 Identity lookup complete:', lookupResult);
        this.handleIdentityLookup(lookupResult);
      },
      onError: error => {
        console.error('🚨 Identity component error:', error);
        this.showStatus(
          '⚠️ Identity lookup temporarily unavailable',
          'warning'
        );
      },
    });

    await identityComponent.render('#fastlane-identity-container');
    return identityComponent;
  }

  /**
   * Render Card Component with proper error handling
   */
  async renderCardComponent() {
    const cardComponent = await this.fastlaneInstance.CardComponent({
      onChange: cardComponentState => {
        console.log('💳 Card component state changed:', cardComponentState);
        this.updatePayButtonState(cardComponentState);
      },
      onError: error => {
        console.error('🚨 Card component error:', error);
        this.showStatus(
          '⚠️ Card processing temporarily unavailable',
          'warning'
        );
      },
    });

    await cardComponent.render('#fastlane-card-container');
    return cardComponent;
  }

  /**
   * Alternative rendering without FraudNet
   */
  async renderComponentsWithoutFraudNet() {
    try {
      console.log('🔄 Rendering components in fallback mode...');

      // Try to reinitialize Fastlane without FraudNet
      this.fastlaneInstance = await window.paypal.Fastlane({
        styles: {
          root: {
            backgroundColor: '#ffffff',
            fontFamily: 'Arial, sans-serif',
            fontSize: '16px',
          },
          input: {
            backgroundColor: '#f8f9fa',
            borderColor: '#dee2e6',
            borderRadius: '4px',
            padding: '12px',
          },
          button: {
            backgroundColor: '#0070ba',
            borderRadius: '4px',
            color: '#ffffff',
          },
        },
        locale: 'en_US',
        // Disable FraudNet explicitly
        fraudNet: false,
      });

      this.identityComponent = await this.renderIdentityComponent();
      this.cardComponent = await this.renderCardComponent();

      console.log('✅ Components rendered successfully in fallback mode');
      this.showStatus('✅ Fastlane loaded successfully', 'success');
    } catch (error) {
      console.error('❌ Fallback rendering failed:', error);
      this.showFallbackPaymentForm();
    }
  }

  /**
   * Handle identity lookup results
   */
  handleIdentityLookup(lookupResult) {
    const emailLookupResult = document.getElementById('email-lookup-result');

    if (lookupResult.profileData) {
      emailLookupResult.innerHTML = `
                <div class="fastlane-profile-found">
                    <span class="checkmark">✓</span>
                    <span>Welcome back! We found your saved information.</span>
                </div>
            `;

      // Pre-fill shipping information if available
      this.prefillShippingInfo(lookupResult.profileData);
    } else {
      emailLookupResult.innerHTML = `
                <div class="fastlane-new-customer">
                    <span class="info-icon">ℹ️</span>
                    <span>New customer - we'll save your info for faster checkout next time!</span>
                </div>
            `;
    }

    // Show welcome animation
    this.showWelcomeAnimation();
  }

  /**
   * Pre-fill shipping information from profile data
   */
  prefillShippingInfo(profileData) {
    if (profileData.shippingAddress) {
      const shipping = profileData.shippingAddress;
      const fields = {
        'shipping-first-name': shipping.firstName,
        'shipping-last-name': shipping.lastName,
        'shipping-address': shipping.addressLine1,
        'shipping-city': shipping.locality,
        'shipping-state': shipping.region,
        'shipping-zip': shipping.postalCode,
      };

      Object.entries(fields).forEach(([fieldId, value]) => {
        const field = document.getElementById(fieldId);
        if (field && value) {
          field.value = value;
          field.classList.add('prefilled');
        }
      });
    }
  }

  /**
   * Show welcome animation for returning customers
   */
  showWelcomeAnimation() {
    const identitySection = document.getElementById(
      'fastlane-identity-section'
    );
    identitySection.classList.add('fastlane-welcome-animation');

    setTimeout(() => {
      identitySection.classList.remove('fastlane-welcome-animation');
    }, 1000);
  }

  /**
   * Update pay button state based on form validation
   */
  updatePayButtonState(cardState) {
    const payButton = document.getElementById('fastlane-pay-button');
    const isFormValid = this.validateCheckoutForm();
    const isCardValid = cardState && cardState.isValid;
    const isComplete = isFormValid && isCardValid;

    payButton.disabled = !isComplete;

    if (isComplete) {
      payButton.textContent = '🚀 Complete Purchase with Fastlane';
      payButton.classList.add('ready-to-pay');
    } else if (!isFormValid) {
      payButton.textContent = '📝 Complete Form to Continue';
      payButton.classList.remove('ready-to-pay');
    } else if (!isCardValid) {
      payButton.textContent = '💳 Complete Payment Information';
      payButton.classList.remove('ready-to-pay');
    }
  }

  /**
   * Validate checkout form
   */
  validateCheckoutForm() {
    const requiredFields = [
      'email',
      'shipping-first-name',
      'shipping-last-name',
      'shipping-address',
      'shipping-city',
      'shipping-state',
      'shipping-zip',
    ];

    return requiredFields.every(fieldId => {
      const field = document.getElementById(fieldId);
      const isValid = field && field.value.trim() !== '';

      // Visual feedback for validation
      if (field) {
        field.classList.toggle('valid', isValid);
        field.classList.toggle('invalid', !isValid);
      }

      return isValid;
    });
  }

  /**
   * Handle Fastlane payment
   */
  async handlePayment() {
    try {
      this.showStatus('🔄 Processing payment with Fastlane...', 'info');

      // Get payment token from card component
      const paymentToken = await this.cardComponent.getPaymentToken({
        billingAddress: this.getBillingAddress(),
      });

      console.log('🔐 Payment token generated:', paymentToken);

      // Create order with payment token
      const orderData = {
        intent: 'CAPTURE',
        payment_source: {
          card: {
            single_use_token: paymentToken.id,
          },
        },
        purchase_units: [
          {
            amount: {
              currency_code: 'USD',
              value: document.getElementById('amount-total').textContent,
              breakdown: {
                item_total: {
                  currency_code: 'USD',
                  value: document.getElementById('cart-total').textContent,
                },
                shipping: {
                  currency_code: 'USD',
                  value: document.getElementById('shipping-amount').textContent,
                },
                tax_total: {
                  currency_code: 'USD',
                  value: document.getElementById('tax-amount').textContent,
                },
              },
            },
            shipping: {
              name: {
                full_name: `${
                  document.getElementById('shipping-first-name').value
                } ${document.getElementById('shipping-last-name').value}`,
              },
              address: this.getShippingAddress(),
            },
          },
        ],
      };

      const order = await this.createOrder(orderData);
      const captureResult = await this.captureOrder(order.id);

      this.showStatus('✅ Payment successful!', 'success');
      this.showPaymentSuccess(captureResult);
    } catch (error) {
      console.error('❌ Fastlane payment error:', error);
      this.showStatus('❌ Payment failed. Please try again.', 'error');
      this.showPaymentError(error);
    }
  }

  /**
   * Get shipping address from form
   */
  getShippingAddress() {
    return {
      address_line_1: document.getElementById('shipping-address').value,
      locality: document.getElementById('shipping-city').value,
      region: document.getElementById('shipping-state').value,
      postal_code: document.getElementById('shipping-zip').value,
      country_code: 'US',
    };
  }

  /**
   * Get billing address (same as shipping for this example)
   */
  getBillingAddress() {
    return this.getShippingAddress();
  }

  /**
   * Create order via API
   */
  async createOrder(orderData) {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create order');
    }

    return response.json();
  }

  /**
   * Capture order via API
   */
  async captureOrder(orderId) {
    const response = await fetch(`/api/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to capture order');
    }

    return response.json();
  }

  /**
   * Show fallback payment form when Fastlane is not available
   */
  showFallbackPaymentForm() {
    document.getElementById('fastlane-card-container').style.display = 'none';
    document.getElementById('fastlane-identity-container').style.display =
      'none';
    document.getElementById('manual-payment-form').style.display = 'block';
    document.getElementById('fastlane-pay-button').style.display = 'none';
    document.getElementById('manual-pay-button').style.display = 'block';

    this.showStatus('ℹ️ Loading standard payment form...', 'info');
    this.loadCardFieldsSDK();
  }

  /**
   * Load PayPal SDK with Card Fields component for fallback
   */
  async loadCardFieldsSDK() {
    try {
      // Load Card Fields SDK if not already loaded
      if (!window.paypal || !window.paypal.CardFields) {
        const script = document.createElement('script');
        script.src = `https://www.paypal.com/sdk/js?client-id=${this.clientId}&components=card-fields`;

        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });

        console.log('✅ Card Fields SDK loaded successfully');
      }

      await this.initializeCardFields();
    } catch (error) {
      console.error('❌ Failed to load Card Fields SDK:', error);
      this.showStatus(
        '❌ Payment form unavailable. Please refresh the page.',
        'error'
      );
    }
  }

  /**
   * Initialize PayPal Card Fields (fallback)
   */
  async initializeCardFields() {
    try {
      this.showStatus('✅ Standard payment form ready', 'success');

      const cardFields = paypal.CardFields({
        createOrder: async () => {
          const orderData = {
            intent: 'CAPTURE',
            purchase_units: [
              {
                amount: {
                  currency_code: 'USD',
                  value: document.getElementById('amount-total').textContent,
                },
              },
            ],
          };

          const order = await this.createOrder(orderData);
          return order.id;
        },
        onApprove: async data => {
          const captureResult = await this.captureOrder(data.orderID);
          this.showStatus('✅ Payment successful!', 'success');
          this.showPaymentSuccess(captureResult);
        },
        onError: error => {
          console.error('Card Fields error:', error);
          this.showStatus('❌ Payment failed. Please try again.', 'error');
        },
      });

      if (cardFields.isEligible()) {
        const numberField = cardFields.NumberField();
        const expiryField = cardFields.ExpiryField();
        const cvvField = cardFields.CVVField();

        await numberField.render('#card-number-field');
        await expiryField.render('#expiry-date-field');
        await cvvField.render('#cvv-field');

        // Enable manual pay button
        document
          .getElementById('manual-pay-button')
          .addEventListener('click', () => {
            cardFields.submit();
          });
      }
    } catch (error) {
      console.error('Card Fields initialization failed:', error);
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Pay button event listener
    document
      .getElementById('fastlane-pay-button')
      .addEventListener('click', () => {
        this.handlePayment();
      });

    // Form validation listeners
    const formFields = document.querySelectorAll('input, select');
    formFields.forEach(field => {
      field.addEventListener('input', () => {
        this.updatePayButtonState({
          isValid: this.cardComponent ? true : false,
        });
      });

      field.addEventListener('blur', () => {
        this.validateField(field);
      });
    });
  }

  /**
   * Validate individual field
   */
  validateField(field) {
    const isValid = field.value.trim() !== '';
    field.classList.toggle('valid', isValid);
    field.classList.toggle('invalid', !isValid);

    // Email validation
    if (field.type === 'email' && field.value) {
      const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value);
      field.classList.toggle('valid', emailValid);
      field.classList.toggle('invalid', !emailValid);
    }
  }

  /**
   * Show payment success
   */
  showPaymentSuccess(captureResult) {
    const resultDiv = document.getElementById('result-message');
    resultDiv.innerHTML = `
            <div class="payment-success">
                <h3>🎉 Payment Successful!</h3>
                <p><strong>Order ID:</strong> ${captureResult.id}</p>
                <p><strong>Status:</strong> ${captureResult.status}</p>
                <p><strong>Amount:</strong> $${captureResult.purchase_units[0].payments.captures[0].amount.value} USD</p>
                <div class="success-actions">
                    <button onclick="window.print()" class="btn btn-secondary">Print Receipt</button>
                    <button onclick="window.location.href='/'" class="btn btn-primary">Continue Shopping</button>
                </div>
            </div>
        `;
    resultDiv.style.display = 'block';
  }

  /**
   * Show payment error
   */
  showPaymentError(error) {
    const resultDiv = document.getElementById('result-message');
    resultDiv.innerHTML = `
            <div class="payment-error">
                <h3>❌ Payment Failed</h3>
                <p>${
                  error.message ||
                  'An unexpected error occurred. Please try again.'
                }</p>
                <div class="error-actions">
                    <button onclick="location.reload()" class="btn btn-primary">Try Again</button>
                    <button onclick="window.location.href='/'" class="btn btn-secondary">Return to Home</button>
                </div>
            </div>
        `;
    resultDiv.style.display = 'block';
  }

  /**
   * Show status messages
   */
  showStatus(message, type) {
    const statusDiv = document.getElementById('payment-status');
    statusDiv.textContent = message;
    statusDiv.className = `status-message ${type}`;
    statusDiv.style.display = 'block';

    // Auto-hide info and warning messages after 7 seconds
    if (type === 'info' || type === 'warning') {
      setTimeout(() => {
        statusDiv.style.display = 'none';
      }, 7000);
    }
  }

  /**
   * Show debug information in the UI (only in debug mode)
   */
  showDebugInfo(title, data) {
    if (!this.debugMode) return;

    const debugDiv = document.getElementById('debug-info');
    debugDiv.innerHTML = `
      <h4>${title}</h4>
      <pre>${
        typeof data === 'string' ? data : JSON.stringify(data, null, 2)
      }</pre>
    `;
    debugDiv.style.display = 'block';
  }

  /**
   * Toggle debug mode
   */
  toggleDebugMode() {
    this.debugMode = !this.debugMode;
    console.log(`Debug mode ${this.debugMode ? 'enabled' : 'disabled'}`);

    if (!this.debugMode) {
      const debugDiv = document.getElementById('debug-info');
      if (debugDiv) debugDiv.style.display = 'none';
    }
  }
}

// Export for use in other files
window.FastlaneIntegration = FastlaneIntegration;
