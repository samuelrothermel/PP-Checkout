// Simplified Checkout JavaScript - Modular Approach

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
    if (element) element.style.display = 'block';
  },

  hideElement(id) {
    const element = document.getElementById(id);
    if (element) element.style.display = 'none';
  },

  showPaymentMethodButton(paymentMethod) {
    this.hideElement('paypal-button-container');
    this.hideElement('venmo-button-container');
    this.hideElement('paylater-button-container');
    this.hideElement('applepay-button-container');
    this.hideElement('googlepay-button-container');
    this.hideElement('card-button-container');
    this.hideElement('submit-order-button');

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
  async createOrder() {
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Utils.getCurrentTotal(),
          customerId: CheckoutConfig.currentCustomerId,
          shippingData: this.getShippingData(),
          billingData: this.getBillingData(),
        }),
      });

      if (!response.ok) throw new Error('Order creation failed');
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
      const response = await fetch(`/api/orders/${data.orderID}/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) throw new Error('Order capture failed');
      const orderData = await response.json();

      this.displayResults(orderData);
      return orderData;
    } catch (error) {
      console.error('Error capturing order:', error);
      throw error;
    }
  },

  getShippingData() {
    return {
      firstName: document.getElementById('shipping-first-name')?.value,
      lastName: document.getElementById('shipping-last-name')?.value,
      email: document.getElementById('shipping-email')?.value,
      phone: document.getElementById('shipping-phone')?.value,
      addressLine1: document.getElementById('shipping-address-line1')?.value,
      city: document.getElementById('shipping-admin-area2')?.value,
      state: document.getElementById('shipping-admin-area1')?.value,
      postalCode: document.getElementById('shipping-postal-code')?.value,
      countryCode: document.getElementById('shipping-country-code')?.value,
    };
  },

  getBillingData() {
    const isDifferent = document.getElementById('billing-info-toggle')?.checked;
    if (!isDifferent) return this.getShippingData();

    return {
      firstName: document.getElementById('billing-first-name')?.value,
      lastName: document.getElementById('billing-last-name')?.value,
      email: document.getElementById('billing-email')?.value,
      phone: document.getElementById('billing-phone')?.value,
      addressLine1: document.getElementById('billing-address-line1')?.value,
      city: document.getElementById('billing-admin-area2')?.value,
      state: document.getElementById('billing-admin-area1')?.value,
      postalCode: document.getElementById('billing-postal-code')?.value,
      countryCode: document.getElementById('billing-country-code')?.value,
    };
  },

  displayResults(orderData) {
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
    }

    if (paymentSourceSection) {
      paymentSourceSection.style.display = 'block';
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
        createOrder: () => PayPalIntegration.createOrder(),
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
        createOrder: () => PayPalIntegration.createOrder(),
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
        createOrder: () => PayPalIntegration.createOrder(),
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
        createOrder: () => PayPalIntegration.createOrder(),
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
    ]);

    // Setup event listeners
    EventHandlers.setupEventListeners();

    // Initialize totals
    Utils.updateTotal();

    // Show default payment method (PayPal)
    Utils.showPaymentMethodButton('paypal');

    console.log('Checkout initialized successfully');
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
  CardFields,
  CustomerManagement,
  CheckoutConfig,
};
