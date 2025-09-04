// Apple Pay setup function
async function setupApplepay() {
  try {
    console.log('Starting Apple Pay setup...');

    // Check if PayPal SDK is loaded
    if (!window.paypal || !window.paypal.Applepay) {
      throw new Error('PayPal SDK or Apple Pay component not loaded');
    }

    // Check if Apple Pay is available
    if (typeof ApplePaySession === 'undefined') {
      throw new Error(
        'ApplePaySession is not available - script may be blocked by CSP'
      );
    }

    const applepay = paypal.Applepay();
    const config = await applepay.config();

    console.log('Apple Pay config:', config);

    const {
      isEligible,
      countryCode,
      currencyCode,
      merchantCapabilities,
      supportedNetworks,
    } = config;

    if (!isEligible) {
      console.warn('Apple Pay is not eligible on this device/browser');
      throw new Error('Apple Pay is not eligible');
    }

    console.log('Apple Pay is eligible, setting up button...');

    document.getElementById('applepay-container').innerHTML =
      '<apple-pay-button id="btn-appl" buttonstyle="black" type="buy" locale="en">';

    document
      .getElementById('btn-appl')
      .addEventListener('click', async function () {
        console.log({ merchantCapabilities, currencyCode, supportedNetworks });

        const paymentRequest = {
          countryCode,
          currencyCode: 'USD',
          merchantCapabilities,
          supportedNetworks,
          requiredBillingContactFields: [
            'name',
            'phone',
            'email',
            'postalAddress',
          ],
          requiredShippingContactFields: [],
          total: {
            label: 'Demo (Card is not charged)',
            amount: '10.00',
            type: 'final',
          },
        };

        const session = new ApplePaySession(4, paymentRequest);

        session.onvalidatemerchant = event => {
          applepay
            .validateMerchant({
              validationUrl: event.validationURL,
            })
            .then(payload => {
              session.completeMerchantValidation(payload.merchantSession);
            })
            .catch(err => {
              console.error('Merchant validation failed:', err);
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
              body: JSON.stringify({
                source: 'applepay',
                totalAmount: '10.00',
                paymentSource: 'applepay',
              }),
            });

            if (!orderResponse.ok) {
              const errorText = await orderResponse.text();
              console.error('Order creation failed:', errorText);
              throw new Error(
                `Error creating order: ${orderResponse.status} - ${errorText}`
              );
            }

            const orderData = await orderResponse.json();
            if (!orderData.id) {
              throw new Error('Order ID not received from server');
            }

            console.log('Order created successfully:', orderData);
            const { id } = orderData;

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
            console.error('Payment processing failed:', err);
            session.completePayment({
              status: window.ApplePaySession.STATUS_FAILURE,
            });
          }
        };

        session.oncancel = () => {
          console.log('Apple Pay Cancelled !!');
        };

        session.begin();
      });
  } catch (error) {
    console.error('Apple Pay setup failed:', error);
    // Hide the Apple Pay container if setup fails
    const container = document.getElementById('applepay-container');
    if (container) {
      container.style.display = 'none';
    }
  }
}
