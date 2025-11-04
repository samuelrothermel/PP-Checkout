const createVaultSetupToken = data => {
  let paymentSource;
  console.log(
    'Client-Side Create Recurring Payment Setup Token Raw Request: ',
    data
  );

  if (!data) {
    paymentSource = 'card';
  } else {
    paymentSource = data.paymentSource;
  }

  return fetch('/api/vault/recurring-setup-token', {
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
        'Create Recurring Setup Token Raw Response: ',
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

      return vaultSetupToken;
    })
    .catch(error => {
      document.getElementById('vault-info-section').style.display = 'block';
      document.getElementById(
        'vault-setup-info'
      ).textContent = `ERROR: ${error}`;
    });
};

const onApprove = ({ vaultSetupToken }) => {
  // Step 2: Get buyer approval (already completed when onApprove is called)
  console.log('Buyer approval received for setup token:', vaultSetupToken);

  // Step 3: Create payment token from the setup token
  return fetch(`/api/vault/payment-token/${vaultSetupToken}`, {
    method: 'post',
  })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(vaultPaymentResponse => {
      // Successful payment token creation
      console.log(
        'Vault Payment Token Created:',
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

      // Now we can use this token for recurring payments
      // Step 4: Simulate a recurring payment with the token (this would typically happen later)
      simulateRecurringPayment(vaultPaymentResponse.id);
    })
    .catch(error => {
      console.error('Error during payment token creation:', error);
      document.getElementById('payment-source-section').style.display = 'block';
      document.getElementById(
        'payment-source-type-info'
      ).textContent = `ERROR: ${error.message}`;
    });
};

// Function to simulate a recurring payment with the stored payment token
const simulateRecurringPayment = paymentTokenId => {
  // In a real implementation, this would be called at regular intervals
  // or triggered by your subscription billing system
  console.log(`Ready to bill customer using payment token: ${paymentTokenId}`);

  // Add UI element to show processing status
  const paymentSourceSection = document.getElementById(
    'payment-source-section'
  );
  const recurringExample = document.createElement('div');
  recurringExample.id = 'recurring-example';
  recurringExample.innerHTML = `
    <div class="info-section" style="margin-top: 20px; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">
      <h4>Simulating Recurring Payment</h4>
      <p>Processing a monthly payment of $100 using token: ${paymentTokenId}</p>
      <p id="recurring-status">Processing...</p>
    </div>
  `;
  paymentSourceSection.appendChild(recurringExample);

  // Demonstrate creating an order with the payment token
  fetch('/api/vault/recurring-order', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ paymentTokenId }),
  })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(orderResponse => {
      console.log('Recurring Order Created:', orderResponse);

      // Update the UI with the result
      document.getElementById('recurring-status').innerHTML = `
        <strong>Success!</strong> Order ID: ${orderResponse.id}<br>
        Status: ${orderResponse.status}<br>
        <p>This demonstrates how the payment token can be used for recurring billing.</p>
      `;
    })
    .catch(error => {
      console.error('Error creating recurring order:', error);
      document.getElementById('recurring-status').innerHTML = `
        <strong>Simulation Only:</strong> This is a demonstration of how the token would be used.<br>
        <small>(In production, this would process a real payment using the stored payment method.)</small>
      `;
    });
};

const onError = console.error;

const onCancel = (data, actions) => {
  console.log(`Setup Token Canceled Data: ${data}`);
};

// Calculate totals
document.addEventListener('DOMContentLoaded', function () {
  const oneTimeCharge = parseFloat(
    document.getElementById('one-time-charge').textContent
  );
  const monthlyFee = parseFloat(
    document.getElementById('monthly-fee').textContent
  );
  const billingDuration = parseInt(
    document.getElementById('billing-duration').textContent
  );

  // Calculate the total commitment (one-time charge + monthly fee * duration)
  const totalCommitment = oneTimeCharge + monthlyFee * billingDuration;
  document.getElementById('total-commitment').textContent =
    totalCommitment.toString();
});

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
