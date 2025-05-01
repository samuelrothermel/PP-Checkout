document.addEventListener('DOMContentLoaded', function () {
  loadPayPalComponents();
});

function loadPayPalComponents() {
  loadPayPalSDK();
}

function loadPayPalSDK() {
  const scriptUrl = `https://www.paypal.com/sdk/js?components=buttons&client-id=${clientId}&vault=true&intent=subscription`;
  const scriptElement = document.createElement('script');
  scriptElement.src = scriptUrl;
  scriptElement.onload = () => {
    paypal
      .Buttons({
        createSubscription: function (data, actions) {
          return actions.subscription.create({
            plan_id: 'P-3AE601370M1075509M7VM2RQ', // Creates the subscription
          });
        },
        onApprove: function (data, actions) {
          alert('You have successfully subscribed to ' + data.subscriptionID); // Optional message given to subscriber
        },
      })
      .render('#paypal-button-container'); // Renders the PayPal button
  };

  document.head.appendChild(scriptElement);
}

const onApprove = (data, actions) => {
  console.log(
    'Successfully subscribed! Subscription ID: ',
    data.subscriptionID
  );
  document.getElementById(
    'create-order-info'
  ).textContent = `Subscription ID: ${data.subscriptionID}`;
};

const onCancel = (data, actions) => {
  console.log(`Order Canceled - ID: ${data.orderID}`);
};

const onError = err => {
  console.error(err);
};
