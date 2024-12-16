const createVaultSetupToken = data => {
  let paymentSource;
  console.log('Client-Side Create Vault Setup Token Raw Request: ', data);

  if (!data) {
    paymentSource = 'card';
  } else {
    paymentSource = data.paymentSource;
  }

  return fetch('/api/vault/setup-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      paymentSource,
    }),
  })
    .then(response => response.json())
    .then(setupTokenResponse => {
      console.log(
        'Create Setup Token Raw Response: ',
        JSON.stringify({ setupTokenResponse })
      );
      const vaultSetupToken = setupTokenResponse.id;
      document.getElementById('vault-info-section').style.display = 'block';
      document.getElementById(
        'vault-setup-info'
      ).textContent = `Vault Setup Token ID: ${vaultSetupToken}`;
      document.getElementById(
        'vault-setup-status'
      ).textContent = `Status: ${setupTokenResponse.status}`;
      document.getElementById(
        'customer-id-info'
      ).textContent = `Customer ID: ${setupTokenResponse.customer.id}`;

      return vaultSetupToken;
    })
    .catch(error => {
      document.getElementById('vault-info-section').style.display = 'block';
      document.getElementById(
        'vault-setup-info'
      ).textContent = `ERROR: ${error}`;
    });
};

const onApprove = ({ vaultSetupToken }) =>
  fetch(`/api/vault/payment-token/${vaultSetupToken}`, {
    method: 'post',
  })
    .then(response => response.json())
    .then(vaultPaymentResponse => {
      // Successful capture! For dev/demo purposes:
      console.log(
        'Vault Payment result',
        vaultPaymentResponse,
        JSON.stringify(vaultPaymentResponse, null, 2)
      );

      document.getElementById('payment-source-section').style.display = 'block';
      document.getElementById(
        'payment-source-type-info'
      ).textContent = `Payment Method Token ID: ${vaultPaymentResponse.id}`;
      document.getElementById(
        'customer-id-info'
      ).textContent = `Customer ID: ${vaultPaymentResponse.customer.id}`;
    })
    .catch(error => {
      document.getElementById('payment-source-section').style.display = 'block';
      document.getElementById(
        'create-payment-info'
      ).textContent = `ERROR: ${error}`;
    });

const onError = console.error;

const onCancel = (data, actions) => {
  console.log(`Order Canceled Data: ${data}`);
};

loadPayPalSDK();

function loadPayPalSDK() {
  const scriptUrl = `https://www.paypal.com/sdk/js?components=buttons,card-fields&client-id=${clientId}&enable-funding=venmo`;
  const scriptElement = document.createElement('script');
  scriptElement.src = scriptUrl;
  scriptElement.onload = () => {
    paypal
      .Buttons({
        style: {
          layout: 'vertical',
        },
        createVaultSetupToken,
        onApprove,
        onCancel,
        onError,
      })
      .render('#paypal-button-container');

    // Initialize the card fields
    const cardField = paypal.CardFields({
      createVaultSetupToken,
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
