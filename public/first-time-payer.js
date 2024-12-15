const createOrder = (data, actions) => {
  console.log('createOrder data:', data);
  return fetch('/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source: data.paymentSource, //paypal / venmo / etc.
      cart: [
        {
          sku: '<YOUR_PRODUCT_STOCK_KEEPING_UNIT>',
          quantity: '<YOUR_PRODUCT_QUANTITY>',
        },
      ],
    }),
  })
    .then(response => response.json())
    .then(orderData => {
      console.log('Order data in response:', orderData);
      const orderId = orderData.id;
      document.getElementById(
        'create-order-info'
      ).textContent = `SUCCESS: ${orderId}`;
      return orderId;
    })
    .catch(error => {
      document.getElementById(
        'create-order-info'
      ).textContent = `ERROR: ${error}`;
    });
};

const onApprove = (data, actions) => {
  console.log('onApprove capture triggered');

  return fetch(`/api/orders/${data.orderID}/capture`, {
    method: 'POST',
  })
    .then(response => response.json())
    .then(orderData => {
      console.log('Capture result', orderData);
      const paymentSource = orderData.payment_source;
      document.getElementById(
        'create-payment-info'
      ).textContent = `SUCCESS: ${JSON.stringify(paymentSource)}`;
    })
    .catch(error => {
      document.getElementById(
        'create-payment-info'
      ).textContent = `ERROR: ${error}`;
    });
};

const onCancel = (data, actions) => {
  console.log(`Order Canceled - ID: ${data.orderID}`);
};

const onError = err => {
  console.error(err);
};

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

// Create the Card Fields Component and define callbacks
const cardField = paypal.CardFields({
  createOrder,
  onApprove,
  onError,
});

// Render each field after checking for eligibility
if (cardField.isEligible()) {
  const nameField = cardField.NameField();
  nameField.render('#card-name-field-container');

  const numberField = cardField.NumberField();
  numberField.render('#card-number-field-container');

  const cvvField = cardField.CVVField();
  cvvField.render('#card-cvv-field-container');

  const expiryField = cardField.ExpiryField();
  expiryField.render('#card-expiry-field-container');

  // Add click listener to submit button and call the submit function on the CardField component
  document
    .getElementById('multi-card-field-button')
    .addEventListener('click', () => {
      cardField.submit();
    });
}

// // Add event listeners for returning user checkbox and submit button
// document
//   .getElementById('returning-user')
//   .addEventListener('change', function () {
//     var customerIdField = document.getElementById('customer-id');
//     var submitButton = document.getElementById('submit-customer-id');
//     if (this.checked) {
//       customerIdField.style.display = 'inline-block';
//       submitButton.style.display = 'inline-block';
//       customerIdField.value = 'vLOMLitZuN'; // Auto-fill with a value
//     } else {
//       customerIdField.style.display = 'none';
//       submitButton.style.display = 'none';
//       customerIdField.value = ''; // Clear the value
//     }
//   });

// document
//   .getElementById('submit-customer-id')
//   .addEventListener('click', function () {
//     var customerId = document.getElementById('customer-id').value;
//     fetch('/api/returning-user-token', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify({ customerId }),
//     })
//       .then(response => response.json())
//       .then(data => {
//         console.log('idToken:', data.idToken);
//         // Handle the idToken as needed
//         reloadPayPalButtonContainer(data.idToken);
//       })
//       .catch(error => {
//         console.error('Error:', error);
//       });
//   });

// function reloadPayPalButtonContainer(idToken) {
//   const scriptUrl = `https://www.paypal.com/sdk/js?components=buttons,card-fields&client-id=${clientId}&enable-funding=venmo`;
//   const scriptElement = document.createElement('script');
//   scriptElement.src = scriptUrl;
//   scriptElement.setAttribute('data-user-id-token', idToken);
//   scriptElement.onload = () => {
//     paypal
//       .Buttons({
//         style: {
//           layout: 'vertical',
//         },
//         createOrder,
//         onApprove,
//         onCancel,
//         onError,
//       })
//       .render('#paypal-button-container');

//     // Reinitialize the card fields
//     const cardField = paypal.CardFields({
//       createOrder,
//       onApprove,
//       onError,
//     });

//     if (cardField.isEligible()) {
//       const nameField = cardField.NameField();
//       nameField.render('#card-name-field-container');

//       const numberField = cardField.NumberField();
//       numberField.render('#card-number-field-container');

//       const cvvField = cardField.CVVField();
//       cvvField.render('#card-cvv-field-container');

//       const expiryField = cardField.ExpiryField();
//       expiryField.render('#card-expiry-field-container');

//       document
//         .getElementById('multi-card-field-button')
//         .addEventListener('click', () => {
//           cardField.submit();
//         });
//     }
//   };

//   // Remove the existing script and PayPal button container
//   const existingScript = document.querySelector(
//     'script[src^="https://www.paypal.com/sdk/js"]'
//   );
//   if (existingScript) {
//     existingScript.remove();
//   }
//   document.getElementById('paypal-button-container').innerHTML = '';

//   // Append the new script to the document
//   document.head.appendChild(scriptElement);
// }
