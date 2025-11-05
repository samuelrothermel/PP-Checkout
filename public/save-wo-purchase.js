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
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
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

      // Handle different payment sources (Apple Pay vs Card)
      if (vaultPaymentResponse.payment_source.card) {
        document.getElementById(
          'card-verification-status-info'
        ).textContent = `Card Verification Status: ${vaultPaymentResponse.payment_source.card.verification_status}`;
        document.getElementById(
          'card-verification-auth-info'
        ).textContent = `Card Verification Auth Amount: $${vaultPaymentResponse.payment_source.card.verification.amount.value}`;
        document.getElementById(
          'card-verification-processor-info'
        ).textContent = `Processor Response Code: ${vaultPaymentResponse.payment_source.card.verification.processor_response.response_code}`;
        document.getElementById(
          'card-verification-cvv-info'
        ).textContent = `CVV Response Code: ${vaultPaymentResponse.payment_source.card.verification.processor_response.cvv_code}`;
        document.getElementById(
          'card-verification-avs-info'
        ).textContent = `AVS Response Code: ${vaultPaymentResponse.payment_source.card.verification.processor_response.avs_code}`;
      } else if (vaultPaymentResponse.payment_source.apple_pay) {
        document.getElementById(
          'card-verification-status-info'
        ).textContent = `Apple Pay Payment Source Verified`;
        document.getElementById(
          'card-verification-auth-info'
        ).textContent = `Payment Method: Apple Pay`;
        document.getElementById(
          'card-verification-processor-info'
        ).textContent = `Apple Pay Token Stored Successfully`;
        document.getElementById(
          'card-verification-cvv-info'
        ).textContent = `Apple Pay Security: Touch ID / Face ID`;
        document.getElementById(
          'card-verification-avs-info'
        ).textContent = `Apple Pay Vault ID: Ready for Use`;
      } else if (vaultPaymentResponse.payment_source.paypal) {
        document.getElementById(
          'card-verification-status-info'
        ).textContent = `PayPal Payment Source Verified`;
        document.getElementById(
          'card-verification-auth-info'
        ).textContent = `Payment Method: PayPal`;
        document.getElementById(
          'card-verification-processor-info'
        ).textContent = `PayPal Account Linked Successfully`;
        document.getElementById(
          'card-verification-cvv-info'
        ).textContent = `PayPal Security: Account Authentication`;
        document.getElementById(
          'card-verification-avs-info'
        ).textContent = `PayPal Vault ID: Ready for Use`;
      }

      // Show vault testing section and populate vault ID
      document.getElementById('vault-testing-section').style.display = 'block';
      document.getElementById('vault-id-input').value = vaultPaymentResponse.id;
    })
    .catch(error => {
      console.error('Error during vault payment:', error);
      document.getElementById('payment-source-section').style.display = 'block';
      document.getElementById(
        'create-payment-info'
      ).textContent = `ERROR: ${error.message}`;
    });

const onError = console.error;

const onCancel = (data, actions) => {
  console.log(`Order Canceled Data: ${data}`);
};

loadPayPalSDK();

function loadPayPalSDK() {
  const scriptUrl = `https://www.paypal.com/sdk/js?components=buttons,card-fields,applepay&client-id=${clientId}&enable-funding=venmo&buyer-country=US&currency=USD`;
  console.log('Loading PayPal SDK with URL:', scriptUrl);
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

    // Apple Pay button - with proper error handling for PC/non-Apple devices
    try {
      console.log('Checking Apple Pay availability...');
      console.log('paypal.Applepay available:', !!paypal.Applepay);

      if (paypal.Applepay) {
        console.log('Attempting to create Apple Pay component...');

        // Check if Apple Pay is available using native Apple Pay API
        const applePayComponent = paypal.Applepay();
        console.log('Apple Pay component created:', !!applePayComponent);
        console.log(
          'Apple Pay component methods:',
          Object.getOwnPropertyNames(applePayComponent)
        );

        // Check Apple Pay eligibility using native browser API
        let isApplePayAvailable = false;
        if (window.ApplePaySession) {
          isApplePayAvailable = window.ApplePaySession.canMakePayments();
          console.log('Native Apple Pay available:', isApplePayAvailable);
        } else {
          console.log(
            'ApplePaySession not available (expected on non-Safari browsers)'
          );
        }

        if (applePayComponent && isApplePayAvailable) {
          // Use PayPal Buttons component with Apple Pay funding source
          paypal
            .Buttons({
              fundingSource: paypal.FUNDING.APPLEPAY,
              style: {
                layout: 'vertical',
                color: 'black',
                shape: 'rect',
                height: 55,
              },
              createVaultSetupToken: () => {
                console.log('Apple Pay createVaultSetupToken called');
                return createVaultSetupToken({ paymentSource: 'apple_pay' });
              },
              onApprove: data => {
                console.log('Apple Pay onApprove called with:', data);
                return onApprove(data);
              },
              onCancel: data => {
                console.log('Apple Pay onCancel called with:', data);
                return onCancel(data);
              },
              onError: err => {
                console.log('Apple Pay onError called with:', err);
                return onError(err);
              },
            })
            .render('#applepay-container')
            .then(() => {
              console.log('Apple Pay button rendered successfully');
            })
            .catch(error => {
              console.log('Apple Pay render failed:', error);
              document.getElementById('applepay-container').style.display =
                'none';
            });
        } else {
          console.log('Apple Pay not available - hiding container');
          console.log(
            'Reasons: component =',
            !!applePayComponent,
            'native =',
            isApplePayAvailable
          );
          document.getElementById('applepay-container').style.display = 'none';
        }
      } else {
        document.getElementById('applepay-container').style.display = 'none';
        console.log('Apple Pay component not available in PayPal SDK');
      }
    } catch (error) {
      console.log('Apple Pay initialization error:', error.message);
      document.getElementById('applepay-container').style.display = 'none';
      // Don't let Apple Pay errors stop the rest of the page from loading
    }

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

    // Add event listener for vault testing
    document
      .getElementById('test-vault-order-button')
      .addEventListener('click', testVaultOrder);
  };

  document.head.appendChild(scriptElement);
}

// Function to test creating an order with vault_id
const testVaultOrder = () => {
  const vaultId = document.getElementById('vault-id-input').value.trim();
  const amount = document.getElementById('amount-input').value.trim();

  if (!vaultId) {
    alert('Please enter a valid vault_id');
    return;
  }

  document.getElementById('vault-order-result').style.display = 'block';
  document.getElementById('vault-order-result').innerHTML =
    'Creating order with vault_id...';

  fetch('/api/vault/create-order', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      vaultId: vaultId,
      amount: amount || '10.00',
      merchantNumber: 1,
    }),
  })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(orderResponse => {
      console.log('Vault Order result:', orderResponse);
      document.getElementById('vault-order-result').innerHTML = `
        <strong>✅ Order Created & Captured Successfully!</strong><br>
        <strong>Order ID:</strong> ${orderResponse.id}<br>
        <strong>Status:</strong> ${orderResponse.status}<br>
        <strong>Amount:</strong> $${orderResponse.purchase_units[0].payments.captures[0].amount.value}<br>
        <strong>Capture ID:</strong> ${orderResponse.purchase_units[0].payments.captures[0].id}<br>
        <strong>Payment Method:</strong> Vault ID (${vaultId})<br>
        <em>This demonstrates using the saved Apple Pay / PayPal / Card vault_id to create and capture orders!</em>
      `;
    })
    .catch(error => {
      console.error('Error creating vault order:', error);
      document.getElementById('vault-order-result').innerHTML = `
        <strong>❌ Error:</strong> ${error.message}<br>
        <em>Check the console for more details.</em>
      `;
    });
};
