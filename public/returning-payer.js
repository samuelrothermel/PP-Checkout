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

// Global variables
let globalCustomerId = null;
let hasPaymentMethods = false;
let currentIdToken = null;

// Helper functions for localStorage management
function saveOrderId(orderId) {
  try {
    const recentOrders = JSON.parse(
      localStorage.getItem('recentOrderIds') || '[]'
    );
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
    const updatedCustomers = [
      { id: customerId, timestamp: new Date().toISOString() },
      ...recentCustomers.slice(0, 9),
    ];
    localStorage.setItem('recentCustomerIds', JSON.stringify(updatedCustomers));
    console.log('Saved customer ID to localStorage:', customerId);
  } catch (error) {
    console.error('Error saving customer ID to localStorage:', error);
  }
}

// Create order function
const createOrder = (data, actions) => {
  console.log('🛒 Creating order for returning payer...');

  const requestBody = {
    source: data.paymentSource, // paypal / venmo / etc.
    cart: [
      {
        sku: '123456789',
        quantity: '1',
      },
    ],
    totalAmount: parseFloat(
      document.getElementById('amount-total').textContent
    ).toFixed(2),
  };

  if (globalCustomerId && hasPaymentMethods) {
    requestBody.customerId = globalCustomerId;
    console.log('🎯 Using customer ID for returning payer:', globalCustomerId);
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
      saveOrderId(orderId);

      document.getElementById(
        'create-order-info'
      ).textContent = `Created Order ID: ${orderId}`;
      document.getElementById('order-info-section').style.display = 'block';

      console.log('✅ Order created:', orderId);
      return orderId;
    })
    .catch(error => {
      console.error('❌ Error creating order:', error);
      document.getElementById(
        'create-order-info'
      ).textContent = `Error: ${error}`;
      document.getElementById('order-info-section').style.display = 'block';
    });
};

// OnApprove function
const onApprove = (data, actions) => {
  console.log('✅ Payment approved, authorizing...');

  return fetch(`/api/orders/${data.orderID}/authorize`, {
    method: 'POST',
  })
    .then(response => response.json())
    .then(orderData => {
      console.log('Order processed:', orderData);
      const paymentSource = orderData.payment_source;

      let paymentSourceType = 'unknown';
      if (paymentSource.card) {
        paymentSourceType = 'card';
      } else if (paymentSource.paypal) {
        paymentSourceType = 'paypal';
      } else if (paymentSource.venmo) {
        paymentSourceType = 'venmo';
      }

      // Display results
      document.getElementById(
        'capture-order-info'
      ).textContent = `Payment authorized successfully! Order ID: ${data.orderID}`;
      document.getElementById(
        'payment-source-type-info'
      ).textContent = `Payment Source: ${paymentSourceType.toUpperCase()}`;

      if (orderData.payment_source.paypal?.attributes?.vault?.id) {
        document.getElementById(
          'vault-payment-info'
        ).textContent = `Vault Payment Token: ${orderData.payment_source.paypal.attributes.vault.id}`;
      }

      if (orderData.payment_source.paypal?.attributes?.vault?.customer?.id) {
        const customerId =
          orderData.payment_source.paypal.attributes.vault.customer.id;
        document.getElementById(
          'customer-id-info'
        ).textContent = `PayPal Customer ID: ${customerId}`;
        saveCustomerId(customerId);
      }

      document.getElementById('capture-info-section').style.display = 'block';
      document.getElementById('payment-source-section').style.display = 'block';

      console.log('💰 Payment processing completed');
    })
    .catch(error => {
      console.error('❌ Error processing payment:', error);
      document.getElementById('capture-order-info').textContent =
        'Payment failed - please try again';
    });
};

// Error handler
const onError = err => {
  console.error('PayPal payment error:', err);
};

// Cancel handler
const onCancel = data => {
  console.log('Payment cancelled:', data);
};

// Load PayPal SDK
function loadPayPalSDK(idToken = null) {
  console.log('🔧 Loading PayPal SDK for returning payer...');

  // Remove any existing PayPal scripts
  const existingScripts = document.querySelectorAll(
    'script[src*="paypal.com/sdk/js"]'
  );
  existingScripts.forEach(script => {
    console.log('🗑️ Removing existing PayPal script');
    script.parentNode.removeChild(script);
  });

  // Clear existing PayPal object
  if (window.paypal) {
    delete window.paypal;
  }

  const components = 'buttons,messages,funding-eligibility';
  let scriptUrl = `https://www.paypal.com/sdk/js?commit=false&components=${components}&intent=authorize&client-id=${clientId}&enable-funding=venmo&integration-date=2023-01-01&debug=false`;

  console.log('📍 SDK URL:', scriptUrl);

  const scriptElement = document.createElement('script');
  scriptElement.src = scriptUrl;

  if (idToken) {
    scriptElement.setAttribute('data-user-id-token', idToken);
    console.log('🎫 Added user ID token to script');
  }

  if (globalCustomerId) {
    scriptElement.setAttribute('data-customer-id', globalCustomerId);
    console.log('👤 Added customer ID to script:', globalCustomerId);
  }

  scriptElement.onload = () => {
    console.log('🎉 PayPal SDK loaded successfully!');

    if (idToken && globalCustomerId) {
      console.log('🔍 SDK loaded with returning customer context');
      console.log('   Customer ID:', globalCustomerId);
      console.log('   ID Token present:', !!idToken);
    }

    renderPayPalButtons();
  };

  scriptElement.onerror = error => {
    console.error('❌ Failed to load PayPal SDK:', error);
  };

  document.head.appendChild(scriptElement);
}

// Render PayPal Smart Payment Buttons
function renderPayPalButtons() {
  console.log('🔘 Rendering PayPal Smart Payment Buttons...');

  const container = document.getElementById('paypal-buttons-container');
  container.innerHTML = ''; // Clear loading message

  const buttonConfig = {
    style: {
      layout: 'vertical',
      shape: 'rect',
      color: 'gold',
      label: 'paypal',
    },
    createOrder,
    onApprove,
    onCancel,
    onError,
  };

  console.log('🔧 Button configuration:', buttonConfig);

  paypal
    .Buttons(buttonConfig)
    .render('#paypal-buttons-container')
    .then(() => {
      console.log('✅ PayPal Smart Payment Buttons rendered successfully');

      if (globalCustomerId && hasPaymentMethods) {
        console.log('🎯 Buttons rendered with returning customer context');
      }
    })
    .catch(error => {
      console.error('❌ Error rendering PayPal buttons:', error);
      container.innerHTML =
        '<p style="color: red;">Error loading PayPal buttons. Please refresh and try again.</p>';
    });

  // Also render PayPal messages
  if (window.paypal.Messages) {
    paypal
      .Messages({
        amount: 50,
        placement: 'payment',
        style: {
          layout: 'text',
          logo: {
            type: 'inline',
          },
        },
      })
      .render('[data-pp-message]');
  }
}

// Fetch payment methods for customer
async function fetchPaymentMethodsForCustomer(customerId) {
  try {
    console.log('🔍 Fetching payment methods for customer:', customerId);

    globalCustomerId = customerId;
    hasPaymentMethods = false;

    // Show loading state
    const container = document.getElementById(
      'saved-payment-methods-container'
    );
    container.style.display = 'block';
    document.getElementById('saved-methods-info').textContent =
      'Loading saved payment methods...';

    const response = await fetch(
      `/api/payment-tokens?customer_id=${customerId}`
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const paymentTokens = await response.json();

    if (paymentTokens && paymentTokens.length > 0) {
      hasPaymentMethods = true;

      // Filter for PayPal tokens to get customer ID
      const paypalTokens = paymentTokens.filter(
        token => token.payment_source && token.payment_source.paypal
      );

      console.log('💳 Found payment methods:', paymentTokens.length);
      console.log('💰 PayPal payment methods:', paypalTokens.length);

      // Update info display
      document.getElementById(
        'saved-methods-info'
      ).textContent = `Found ${paymentTokens.length} saved payment method(s). PayPal buttons will show your saved options.`;

      // Get user ID token and reload SDK
      if (paypalTokens.length > 0) {
        await fetchUserIdTokenAndReloadSDK();
      } else {
        console.log('ℹ️ No PayPal payment methods found, using standard flow');
        loadPayPalSDK();
      }
    } else {
      console.log('ℹ️ No saved payment methods found');
      document.getElementById('saved-methods-info').textContent =
        'No saved payment methods found. PayPal buttons will show standard options.';
      hasPaymentMethods = false;
      loadPayPalSDK();
    }
  } catch (error) {
    console.error('❌ Error fetching payment methods:', error);
    document.getElementById('saved-methods-info').textContent =
      'Error loading payment methods. Using standard checkout.';
    hasPaymentMethods = false;
    loadPayPalSDK();
  }
}

// Fetch user ID token and reload SDK
async function fetchUserIdTokenAndReloadSDK() {
  try {
    console.log('🎫 Fetching user ID token for customer:', globalCustomerId);

    const response = await fetch('/api/returning-user-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerId: globalCustomerId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user ID token: ${response.status}`);
    }

    const data = await response.json();
    currentIdToken = data.idToken;

    console.log('✅ Successfully fetched user ID token');
    console.log('🔄 Reloading SDK with customer context...');

    loadPayPalSDK(currentIdToken);
  } catch (error) {
    console.error('❌ Error fetching user ID token:', error);
    console.log('⚠️ Loading PayPal SDK without user ID token');
    loadPayPalSDK();
  }
}

// Initialize page
document.addEventListener('DOMContentLoaded', function () {
  console.log('📄 Returning Payer checkout page loaded');

  // Load PayPal SDK initially
  loadPayPalSDK();

  // Handle customer ID form
  const customerIdForm = document.getElementById('customer-id-form');
  const customerIdToggle = document.getElementById('toggle-customer-id');

  customerIdToggle.addEventListener('change', function () {
    const form = document.getElementById('customer-id-form');
    const container = document.getElementById(
      'saved-payment-methods-container'
    );

    if (this.checked) {
      form.style.display = 'block';
    } else {
      form.style.display = 'none';
      container.style.display = 'none';
      globalCustomerId = null;
      hasPaymentMethods = false;
      currentIdToken = null;
      loadPayPalSDK(); // Reload without customer context
    }
  });

  customerIdForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const customerId = document.getElementById('customer-id').value.trim();
    if (customerId) {
      console.log('🎯 Loading payment methods for customer:', customerId);
      await fetchPaymentMethodsForCustomer(customerId);
    }
  });

  console.log('✅ Returning Payer page initialization complete');
});
