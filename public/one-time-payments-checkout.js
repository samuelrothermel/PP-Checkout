document.addEventListener('DOMContentLoaded', function () {
  // Load PayPal components initially
  loadPayPalComponents();

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

  document
    .getElementById('change-total-checkbox')
    .addEventListener('change', function () {
      const newTotalInput = document.getElementById('new-total-input');
      if (this.checked) {
        newTotalInput.style.display = 'block';
      } else {
        newTotalInput.style.display = 'none';
        newTotalInput.value = '';
      }
    });

  document
    .getElementById('new-total-input')
    .addEventListener('change', function () {
      const newTotal = parseFloat(this.value).toFixed(2);
      if (!isNaN(newTotal) && newTotal > 0) {
        document.getElementById('cart-total').textContent = newTotal;
        updateAmountTotal();
        console.log('New Total:', newTotal);
        updatePayPalMessages();
      }
    });

  // Set up SSE client
  const eventSource = new EventSource('/events');

  eventSource.onmessage = event => {
    console.log('SSE message received:', event.data);
  };

  eventSource.addEventListener('callback-received', event => {
    console.log('Callback received:', JSON.parse(event.data));
  });

  eventSource.addEventListener('response-sent', event => {
    console.log('Response sent:', JSON.parse(event.data));
  });

  eventSource.onerror = error => {
    console.error('SSE error:', error);
  };
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

function loadPayPalComponents() {
  loadPayPalSDK();
}

function loadPayPalSDK() {
  const scriptUrl = `https://www.paypal.com/sdk/js?components=buttons,card-fields,messages&client-id=${clientId}&enable-funding=venmo`;
  const scriptElement = document.createElement('script');
  scriptElement.src = scriptUrl;
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

      document.getElementById(
        'capture-order-info'
      ).textContent = `Capture ID: ${captureId}`;
      document.getElementById(
        'payment-source-type-info'
      ).textContent = `Payment Source: ${paymentSourceType}`;

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

function reloadPayPalComponents(newTotal) {
  const scriptUrl = `https://www.paypal.com/sdk/js?components=buttons,card-fields,messages&client-id=${clientId}&enable-funding=venmo`;
  const scriptElement = document.createElement('script');
  scriptElement.src = scriptUrl;
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
  };

  document.head.appendChild(scriptElement);
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
