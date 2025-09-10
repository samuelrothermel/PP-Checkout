document.addEventListener('DOMContentLoaded', function () {
  loadPayPalComponents();
});

let currentPlanId = null;

async function getOrCreatePlan() {
  try {
    // First, try to use the existing plan ID
    const existingPlanId = 'P-3AE601370M1075509M7VM2RQ';

    try {
      const response = await fetch(`/api/subscriptions/plan/${existingPlanId}`);
      if (response.ok) {
        const plan = await response.json();
        console.log('Using existing plan:', plan);
        return existingPlanId;
      }
    } catch (error) {
      console.log('Existing plan not found, creating new one...');
    }

    // If existing plan doesn't exist, create a new one
    const createResponse = await fetch('/api/subscriptions/create-plan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!createResponse.ok) {
      throw new Error('Failed to create subscription plan');
    }

    const newPlan = await createResponse.json();
    console.log('Created new plan:', newPlan);
    return newPlan.id;
  } catch (error) {
    console.error('Error with subscription plan:', error);
    // Fall back to the original plan ID as last resort
    return 'P-3AE601370M1075509M7VM2RQ';
  }
}

function loadPayPalComponents() {
  getOrCreatePlan().then(planId => {
    currentPlanId = planId;
    loadPayPalSDK();
  });
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
            plan_id: currentPlanId || 'P-3AE601370M1075509M7VM2RQ', // Use dynamic plan ID
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
