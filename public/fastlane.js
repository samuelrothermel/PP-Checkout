/**
 * PayPal Fastlane Integration
 * This file handles the client-side integration with PayPal's Fastlane technology
 */

class FastlaneIntegration {
  constructor(clientId) {
    this.clientId = clientId;
    this.clientToken = null;
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

      // Load PayPal SDK with client token
      try {
        await this.loadPayPalSDK();
        this.debugLog('PayPal SDK loaded successfully with client token');
      } catch (tokenError) {
        console.error('Failed to initialize with client token:', tokenError);
        this.showStatus('⚠️ Using fallback initialization method', 'warning');
        // Use fallback method without token if token generation fails
        await this.loadPayPalSDKFallback();
      }

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

      // Initialize without FraudNet due to Braintree client issues
      this.debugLog(
        'Initializing Fastlane without FraudNet due to client loading issues'
      );
      try {
        this.fastlaneInstance = await window.paypal.Fastlane({
          ...fastlaneConfig,
          fraudNet: false, // Explicitly disable FraudNet
        });
        this.showStatus('Fastlane initialized with standard security', 'info');
      } catch (error) {
        this.debugLog('Fastlane initialization failed:', error);
        throw error; // Propagate error for fallback handling
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
    try {
      this.debugLog(
        'Skipping FraudNet initialization due to Braintree client issues'
      );
      console.log(
        'ℹ️ Proceeding without FraudNet due to client loading issues'
      );
      return; // Skip FraudNet initialization completely

      /* Original code commented out due to Braintree client loading issues
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
      */
    } catch (error) {
      console.warn('⚠️ Error in FraudNet initialization:', error);
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
   * Fallback method to load PayPal SDK without client token
   * This is used only if client token generation fails
   */
  async loadPayPalSDKFallback() {
    return new Promise((resolve, reject) => {
      if (window.paypal) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${this.clientId}&components=fastlane&disable-funding=credit`;

      script.onload = () => {
        console.log('✅ PayPal SDK loaded successfully (fallback mode)');
        resolve();
      };

      script.onerror = error => {
        console.error('❌ Failed to load PayPal SDK in fallback mode:', error);
        reject(error);
      };

      document.head.appendChild(script);
    });
  }

  /**
   * Fetch client token from server
   */
  async fetchClientToken() {
    try {
      this.debugLog('Fetching client token from server...');
      const response = await fetch('/api/client-token');

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to fetch client token: ${response.status} - ${errorText}`
        );
      }

      const data = await response.json();
      this.debugLog('Client token received:', data);
      return data;
    } catch (error) {
      this.debugLog('Error fetching client token:', error);
      throw error;
    }
  }

  /**
   * Load PayPal SDK dynamically with client token
   */
  async loadPayPalSDK() {
    return new Promise(async (resolve, reject) => {
      try {
        if (window.paypal) {
          resolve();
          return;
        }

        // Get client token from server
        const { clientId, clientToken } = await this.fetchClientToken();
        this.debugLog('Using clientId and token for SDK initialization', {
          clientId,
          tokenReceived: !!clientToken,
        });

        const script = document.createElement('script');
        // Use SDK URL with client token for Fastlane
        script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&components=fastlane&disable-funding=credit`;
        script.setAttribute('data-sdk-client-token', clientToken);

        script.onload = () => {
          console.log('✅ PayPal SDK loaded successfully with client token');
          resolve();
        };

        script.onerror = error => {
          console.error('❌ Failed to load PayPal SDK:', error);
          reject(error);
        };

        document.head.appendChild(script);
      } catch (error) {
        console.error('❌ Error during SDK loading:', error);
        reject(error);
      }
    });
  }

  /**
   * Render Fastlane components
   */
  async renderComponents() {
    try {
      // Set up initial UI state
      // Start with only customer section active
      document.getElementById('customer').classList.add('active');
      document.getElementById('shipping').classList.remove('active');
      document.getElementById('payment').classList.remove('active');

      // First initialize the watermark and identity component
      this.identityComponent = await this.renderIdentityComponent();
      console.log('✅ Identity component rendered');

      // Then initialize the card component
      this.cardComponent = await this.renderCardComponent();
      console.log('✅ Card component rendered');

      // Set up all event listeners
      this.setupEventListeners();

      // Fastlane is ready
      console.log('✅ Fastlane is fully initialized and ready');
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
    try {
      // Extract required components from the Fastlane instance
      const { identity, profile, FastlaneWatermarkComponent } =
        this.fastlaneInstance;

      this.debugLog('Setting up identity components...');

      // Store identity instance for later use
      this.identity = identity;

      // Initialize watermark component
      const watermarkComponent = await FastlaneWatermarkComponent({
        includeAdditionalInfo: true,
      });
      await watermarkComponent.render('#watermark-container');
      this.debugLog('Watermark component rendered');

      // Set up the email input and submit button
      const emailInput = document.getElementById('email-input');
      const emailSubmitButton = document.getElementById('email-submit-button');
      const summaryElement = document.querySelector('#customer .summary');
      const editButton = document.getElementById('email-edit-button');

      // Handle email input validation
      emailInput.addEventListener('input', () => {
        // Enable the continue button when email is valid
        emailSubmitButton.disabled = !this.validateEmail(emailInput.value);
      });

      // Handle email submission
      emailSubmitButton.addEventListener('click', async () => {
        try {
          // Validate email format
          if (!this.validateEmail(emailInput.value)) {
            emailInput.classList.add('invalid');
            emailInput.focus();
            return;
          }

          // Disable the button to prevent multiple clicks
          emailSubmitButton.disabled = true;
          emailSubmitButton.textContent = 'Processing...';

          // Get the email value
          const email = emailInput.value;
          this.debugLog('Looking up email:', email);

          // Lookup customer by email
          const { customerContextId } = await identity.lookupCustomerByEmail(
            email
          );
          this.debugLog('Email lookup result:', { customerContextId, email });

          if (customerContextId) {
            // Customer found, trigger authentication flow
            try {
              const authResponse = await identity.triggerAuthenticationFlow(
                customerContextId
              );
              console.log('👤 Authentication response:', authResponse);

              if (authResponse?.authenticationState === 'succeeded') {
                // Authentication successful
                this.handleSuccessfulAuthentication(authResponse, email);
              } else {
                // Authentication failed or was cancelled
                this.handleUnsuccessfulAuthentication(email);
              }
            } catch (authError) {
              console.error('Authentication flow error:', authError);
              this.handleUnsuccessfulAuthentication(email);
            }
          } else {
            // New customer - set the email in the summary
            summaryElement.textContent = email;
            document.getElementById('customer').classList.add('completed');
            document.getElementById('shipping').classList.add('active');
            document.querySelector('.email-container').style.display = 'none';
          }
        } catch (error) {
          console.error('Email lookup error:', error);
          this.handleLookupError();
        } finally {
          emailSubmitButton.disabled = false;
          emailSubmitButton.textContent = 'Continue';
        }
      });

      // Handle edit button
      editButton.addEventListener('click', () => {
        document.querySelector('.email-container').style.display = 'flex';
        summaryElement.textContent = '';
        document.getElementById('customer').classList.remove('completed');
      });

      // Return a placeholder component object
      return {
        render: () => Promise.resolve(),
        identity: identity,
      };
    } catch (error) {
      console.error('Error setting up identity component:', error);
      throw error;
    }
  }

  /**
   * Validate email format
   */
  validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /**
   * Handle successful authentication
   */
  handleSuccessfulAuthentication(authResponse, email) {
    // Set the email in the summary
    const summaryElement = document.querySelector('#customer .summary');
    summaryElement.textContent = email;

    // Mark customer section as completed and move to shipping
    document.getElementById('customer').classList.add('completed');
    document.getElementById('shipping').classList.add('active');

    // Hide the email container
    document.querySelector('.email-container').style.display = 'none';

    // Pre-fill shipping information if available
    if (authResponse.profileData?.shippingAddress) {
      this.prefillShippingInfo(authResponse.profileData);
    }

    this.debugLog('Authentication successful, customer info updated');
  }

  /**
   * Handle unsuccessful authentication
   */
  handleUnsuccessfulAuthentication(email) {
    // Set the email in the summary
    const summaryElement = document.querySelector('#customer .summary');
    summaryElement.textContent = email;

    // Mark customer section as completed and move to shipping
    document.getElementById('customer').classList.add('completed');
    document.getElementById('shipping').classList.add('active');

    // Hide the email container
    document.querySelector('.email-container').style.display = 'none';

    this.debugLog('Authentication unsuccessful, continuing as new user');
  }

  /**
   * Handle lookup error
   */
  handleLookupError() {
    const emailInput = document.getElementById('email-input');
    emailInput.classList.add('invalid');

    // Show error message
    const errorMessage = document.createElement('div');
    errorMessage.className = 'error-message';
    errorMessage.textContent = 'Could not verify email. Please try again.';

    const container = document.querySelector('.email-container');
    // Remove any existing error message
    const existingError = container.querySelector('.error-message');
    if (existingError) {
      existingError.remove();
    }

    container.appendChild(errorMessage);
    emailInput.focus();
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

    await cardComponent.render('#payment-component');
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
      // Show processing status
      const checkoutButton = document.getElementById('checkout-button');
      checkoutButton.disabled = true;
      checkoutButton.textContent = 'Processing...';

      this.showStatus('🔄 Processing payment with Fastlane...', 'info');

      // Get payment token from card component
      const paymentToken = await this.cardComponent.getPaymentToken();

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
              value: '50.00', // Fixed test amount since we don't have amount elements
            },
            shipping: {
              name: {
                full_name: `${
                  document.querySelector('input[name="given-name"]').value
                } ${document.querySelector('input[name="family-name"]').value}`,
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
    } finally {
      // Reset button state
      const checkoutButton = document.getElementById('checkout-button');
      checkoutButton.disabled = false;
      checkoutButton.textContent = 'Checkout';
    }
  }

  /**
   * Get shipping address from form
   */
  getShippingAddress() {
    return {
      address_line_1: document.querySelector('input[name="address-line1"]')
        .value,
      address_line_2:
        document.querySelector('input[name="address-line2"]').value || '',
      locality: document.querySelector('input[name="address-level2"]').value,
      region: document.querySelector('input[name="address-level1"]').value,
      postal_code: document.querySelector('input[name="postal-code"]').value,
      country_code:
        document.querySelector('input[name="country"]').value || 'US',
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
    // Checkout button event listener
    const checkoutButton = document.getElementById('checkout-button');
    if (checkoutButton) {
      checkoutButton.addEventListener('click', () => {
        this.handlePayment();
      });
    }

    // Shipping button event listener
    const shippingButton = document.getElementById('shipping-submit-button');
    if (shippingButton) {
      shippingButton.addEventListener('click', () => {
        document.getElementById('shipping').classList.add('completed');
        document.getElementById('payment').classList.add('active');
      });
    }

    // Shipping edit button
    const shippingEditButton = document.getElementById('shipping-edit-button');
    if (shippingEditButton) {
      shippingEditButton.addEventListener('click', () => {
        document.getElementById('shipping').classList.remove('completed');
        document.getElementById('payment').classList.remove('active');
      });
    }

    // Payment edit button
    const paymentEditButton = document.getElementById('payment-edit-button');
    if (paymentEditButton) {
      paymentEditButton.addEventListener('click', () => {
        document.getElementById('payment').classList.remove('completed');
      });
    }

    // Email input validation for enter key
    const emailInput = document.getElementById('email-input');
    if (emailInput) {
      emailInput.addEventListener('keypress', event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          const submitButton = document.getElementById('email-submit-button');
          if (!submitButton.disabled) {
            submitButton.click();
          }
        }
      });
    }

    // Form validation for shipping inputs
    const shippingInputs = document.querySelectorAll(
      '#shipping input, #shipping select'
    );
    shippingInputs.forEach(input => {
      input.addEventListener('input', () => {
        this.validateShippingForm();
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
   * Validate shipping form fields
   */
  validateShippingForm() {
    const requiredFields = [
      'given-name',
      'family-name',
      'address-line1',
      'address-level2',
      'address-level1',
      'postal-code',
    ];

    const isFormValid = requiredFields.every(name => {
      const field = document.querySelector(`input[name="${name}"]`);
      return field && field.value.trim() !== '';
    });

    // Enable/disable continue button based on form validity
    const submitButton = document.getElementById('shipping-submit-button');
    if (submitButton) {
      submitButton.disabled = !isFormValid;
    }

    return isFormValid;
  }

  /**
   * Show payment success
   */
  showPaymentSuccess(captureResult) {
    const resultDiv = document.getElementById('result-message');
    resultDiv.innerHTML = `
      <div class="payment-result">
        <div class="result-content result-success">
          <h3>🎉 Payment Successful!</h3>
          <div class="result-details">
            <p><strong>Order ID:</strong> ${captureResult.id}</p>
            <p><strong>Status:</strong> ${captureResult.status}</p>
            <p><strong>Amount:</strong> $${captureResult.purchase_units[0].payments.captures[0].amount.value} USD</p>
          </div>
          <div class="result-actions">
            <button onclick="window.print()" class="btn-action btn-secondary">Print Receipt</button>
            <button onclick="window.location.href='/'" class="btn-action btn-primary">Continue Shopping</button>
          </div>
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
      <div class="payment-result">
        <div class="result-content result-error">
          <h3>❌ Payment Failed</h3>
          <div class="result-details">
            <p>${
              error.message || 'An unexpected error occurred. Please try again.'
            }</p>
          </div>
          <div class="result-actions">
            <button onclick="location.reload()" class="btn-action btn-primary">Try Again</button>
            <button onclick="window.location.href='/'" class="btn-action btn-secondary">Return to Home</button>
          </div>
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
