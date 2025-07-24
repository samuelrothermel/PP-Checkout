const createOrder = (data, actions) => {
  console.log('Client-Side Create Order Raw Request: ', data);

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
  };

  return fetch('/api/upstream-ql-orders', {
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

document.addEventListener('DOMContentLoaded', function () {
  // Load PayPal components initially
  loadPayPalComponents();
});

function loadPayPalComponents() {
  loadPayPalSDK();
}

function loadPayPalSDK() {
  const scriptUrl = `https://www.paypal.com/sdk/js?commit=true&components=buttons,messages&client-id=${clientId}&enable-funding=venmo&disable-funding=card`;
  const scriptElement = document.createElement('script');
  scriptElement.src = scriptUrl;
  scriptElement.onload = () => {
    const buttons = paypal.Buttons({
      style: {
        layout: 'vertical',
      },
      appSwitchWhenAvailable: true,
      createOrder,
      onApprove,
      onCancel,
      onError,
    });

    if (buttons.hasReturned()) {
      buttons.resume();
    } else {
      buttons.render('#paypal-button-container');
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
      if (orderData.error && orderData.error === 'INSTRUMENT_DECLINED') {
        console.error('Instrument Declined. Restarting checkout.');
        document.getElementById('capture-order-info').textContent =
          'Payment declined. Please try again.';
        paypal.Buttons().render('#paypal-button-container'); // Re-render buttons
        return;
      }

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

document
  .getElementById('returning-user-checkbox')
  .addEventListener('change', function () {
    const customerIdInput = document.getElementById('customer-id-input');
    if (this.checked) {
      customerIdInput.style.display = 'block';
    } else {
      customerIdInput.style.display = 'none';
      customerIdInput.value = '';
    }
  });

document
  .getElementById('customer-id-input')
  .addEventListener('change', function () {
    const newTotal = parseFloat(this.value).toFixed(2);
    if (!isNaN(newTotal) && newTotal > 0) {
      document.getElementById('cart-total').textContent = newTotal;
      updateAmountTotal();
      console.log('New Total:', newTotal);
      updatePayPalMessages(newTotal);
    }
  });

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
        appSwitchWhenAvailable: true,
        createOrder,
        onApprove,
        onCancel,
        onError,
      })
      .render('#paypal-button-container');
  };

  document.head.appendChild(scriptElement);

  if (buttons.hasReturned()) {
    buttons.resume();
  } else {
    buttons.render('#paypal-button-container');
  }
}

function updatePayPalMessages(amount) {
  console.log('updatePayPalMessages amount:', amount);
  const messageContainer = document.querySelector('[data-pp-message]');
  messageContainer.setAttribute('data-pp-amount', amount);
  paypal.Messages().render(messageContainer);
}

updateAmountTotal();
