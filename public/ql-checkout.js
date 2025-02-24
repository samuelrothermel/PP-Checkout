const createOrder = (data, actions) => {
  console.log('Client-Side Create Order Raw Request: ', data);

  let shippingInfo = null;
  if (document.getElementById('toggle-shipping-info').checked) {
    shippingInfo = {
      firstName: document.getElementById('shipping-first-name').value,
      lastName: document.getElementById('shipping-last-name').value,
      email: document.getElementById('shipping-email').value,
      phone_number: {
        countryCode: '1',
        nationalNumber: document.getElementById('shipping-phone').value,
      },
      address: {
        addressLine1: document.getElementById('shipping-address-line1').value,
        adminArea2: document.getElementById('shipping-admin-area2').value,
        adminArea1: document.getElementById('shipping-admin-area1').value,
        postalCode: document.getElementById('shipping-postal-code').value,
        countryCode: document.getElementById('shipping-country-code').value,
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
  };

  if (shippingInfo) {
    requestBody.shippingInfo = shippingInfo;
  }

  return fetch('/api/ql-orders', {
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
      ).textContent = `Order ID: ${orderId}`;
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

document.addEventListener('DOMContentLoaded', function () {
  const customerIdForm = document.getElementById('customer-id-form');
  const customerIdInput = document.getElementById('customer-id');
  const toggleCustomerIdCheckbox =
    document.getElementById('toggle-customer-id');
  const toggleShippingInfoCheckbox = document.getElementById(
    'toggle-shipping-info'
  );
  const shippingInfoSection = document.querySelector('.shipping-info');

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

  // Event listener for the checkbox to toggle shipping info section visibility
  toggleShippingInfoCheckbox.addEventListener('change', function () {
    if (this.checked) {
      shippingInfoSection.style.display = 'block';
    } else {
      shippingInfoSection.style.display = 'none';
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
});

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
  const scriptUrl = `https://www.paypal.com/sdk/js?components=buttons,card-fields&client-id=${clientId}&enable-funding=venmo`;
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
        onShippingOptionsChange,
        onShippingAddressChange,
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
  console.log('onApprove capture triggered');

  return fetch(`/api/orders/${data.orderID}/capture`, {
    method: 'POST',
  })
    .then(response => response.json())
    .then(orderData => {
      console.log('Capture Order Raw Response: ', orderData);
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
      ).textContent = `ERROR: ${error}`;
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
