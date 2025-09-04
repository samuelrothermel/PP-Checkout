// Global variable to store customer ID when returning user is detected
let globalCustomerId = null;
let hasPaymentMethods = false;

async function setupApplepay() {
  const applepay = paypal.Applepay();
  const {
    isEligible,
    countryCode,
    currencyCode,
    merchantCapabilities,
    supportedNetworks,
  } = await applepay.config();

  if (!isEligible) {
    throw new Error('applepay is not eligible');
  }

  document.getElementById('applepay-container').innerHTML =
    '<apple-pay-button id="btn-appl" buttonstyle="black" type="buy" locale="en">';

  document.getElementById('btn-appl').addEventListener('click', onClick);

  async function onClick() {
    console.log({ merchantCapabilities, currencyCode, supportedNetworks });

    const paymentRequest = {
      countryCode,
      currencyCode: 'USD',
      merchantCapabilities,
      supportedNetworks,
      requiredBillingContactFields: ['name', 'phone', 'email', 'postalAddress'],
      requiredShippingContactFields: [],
      total: {
        label: 'Demo (Card is not charged)',
        amount: '10.00',
        type: 'final',
      },
    };

    // eslint-disable-next-line no-undef
    let session = new ApplePaySession(4, paymentRequest);

    session.onvalidatemerchant = event => {
      applepay
        .validateMerchant({
          validationUrl: event.validationURL,
        })
        .then(payload => {
          session.completeMerchantValidation(payload.merchantSession);
        })
        .catch(err => {
          console.error(err);
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
        const orderResponse = await fetch(`/api/orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        if (!orderResponse.ok) {
          throw new Error('error creating order');
        }

        const { id } = await orderResponse.json();
        console.log({ id });
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
        console.error(err);
        session.completePayment({
          status: window.ApplePaySession.STATUS_FAILURE,
        });
      }
    };

    session.oncancel = () => {
      console.log('Apple Pay Cancelled !!');
    };

    session.begin();
  }
}

document.addEventListener('DOMContentLoaded', function () {
  // eslint-disable-next-line no-undef
  if (
    ApplePaySession?.supportsVersion(4) &&
    ApplePaySession?.canMakePayments()
  ) {
    setupApplepay().catch(console.error);
  }

  const customerIdForm = document.getElementById('customer-id-form');
  const customerIdInput = document.getElementById('customer-id');
  const toggleCustomerIdCheckbox =
    document.getElementById('toggle-customer-id');

  // Load PayPal components initially
  loadPayPalComponents();

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
  const scriptUrl = `https://www.paypal.com/sdk/js?commit=false&components=buttons,card-fields,messages,applepay&intent=authorize&client-id=${clientId}&enable-funding=venmo`;
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
