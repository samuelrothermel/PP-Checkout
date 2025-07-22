document.addEventListener('DOMContentLoaded', function () {
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
    }
  });

  // Event listener for the customer ID form submission
  customerIdForm.addEventListener('submit', function (event) {
    event.preventDefault();
    const customerId = customerIdInput.value;

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
    container.textContent = 'No saved payment methods found';
    return;
  } else {
    container.textContent = 'Saved payment methods found';
  }

  // Create a list of radio buttons for each saved payment method
  // DISABLED: This is for demonstration purposes only
  // const list = document.createElement('ul');
  // paymentTokens.forEach(token => {
  //   const listItem = document.createElement('li');
  //   const radioInput = document.createElement('input');
  //   radioInput.type = 'radio';
  //   radioInput.name = 'paymentToken';
  //   radioInput.value = token.id;
  //   listItem.appendChild(radioInput);

  //   const label = document.createElement('label');
  //   const card = token.payment_source.card || {};
  //   const brand = card.brand || 'N/A';
  //   const expiration = card.expiry || 'N/A';
  //   const name = card.name || 'N/A';
  //   const lastDigits = card.last_digits || 'N/A';
  //   label.textContent = `Brand: ${brand}, Expiry: ${expiration}, Name: ${name}, Last 4: ${lastDigits}`;
  //   listItem.appendChild(label);

  //   list.appendChild(listItem);
  // });

  // container.appendChild(list);
}

function loadPayPalSDK(idToken) {
  const scriptUrl = `https://www.paypal.com/sdk/js?components=buttons,card-fields,messages&client-id=${clientId}&enable-funding=venmo`;
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
      const nameField = cardField.NameField();
      nameField.render('#card-name-field-container');

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

  return fetch(`/api/orders/${data.orderID}/capture`, {
    method: 'POST',
  })
    .then(response => response.json())
    .then(orderData => {
      console.log(
        'Capture Order Response: ',
        JSON.stringify(orderData, null, 2)
      );
      const captureId = orderData.purchase_units[0].payments.captures[0].id;
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
      ).textContent = `Capture ID: ${captureId}`;
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
      ).textContent = `Capture Order ERROR: ${error}`;
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
