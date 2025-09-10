import { generateAccessToken } from './authApi.js';

const base = 'https://api-m.sandbox.paypal.com';

// Create a subscription plan
export const createSubscriptionPlan = async () => {
  try {
    const accessToken = await generateAccessToken();

    const planData = {
      product_id: null, // Will be created first
      name: 'Monthly Subscription Plan',
      description: 'Monthly subscription for $3.99',
      status: 'ACTIVE',
      billing_cycles: [
        {
          frequency: {
            interval_unit: 'MONTH',
            interval_count: 1,
          },
          tenure_type: 'REGULAR',
          sequence: 1,
          total_cycles: 0, // 0 means infinite
          pricing_scheme: {
            fixed_price: {
              value: '3.99',
              currency_code: 'USD',
            },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee: {
          value: '0',
          currency_code: 'USD',
        },
        setup_fee_failure_action: 'CONTINUE',
        payment_failure_threshold: 3,
      },
      taxes: {
        percentage: '0',
        inclusive: false,
      },
    };

    // First, create a product
    const productResponse = await fetch(`${base}/v1/catalogs/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'PayPal-Request-Id': `product-${Date.now()}`,
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        name: 'Monthly Subscription Service',
        description: 'Monthly subscription service for $3.99',
        type: 'SERVICE',
        category: 'SOFTWARE',
      }),
    });

    if (!productResponse.ok) {
      throw new Error(
        `Failed to create product: ${await productResponse.text()}`
      );
    }

    const productData = await productResponse.json();
    console.log('Product created:', productData);

    // Now create the plan with the product ID
    planData.product_id = productData.id;

    const planResponse = await fetch(`${base}/v1/billing/plans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'PayPal-Request-Id': `plan-${Date.now()}`,
        Prefer: 'return=representation',
      },
      body: JSON.stringify(planData),
    });

    if (!planResponse.ok) {
      throw new Error(`Failed to create plan: ${await planResponse.text()}`);
    }

    const plan = await planResponse.json();
    console.log('Subscription plan created:', plan);
    return plan;
  } catch (error) {
    console.error('Error creating subscription plan:', error);
    throw error;
  }
};

// Get an existing plan by ID
export const getSubscriptionPlan = async planId => {
  try {
    const accessToken = await generateAccessToken();

    const response = await fetch(`${base}/v1/billing/plans/${planId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get plan: ${await response.text()}`);
    }

    const plan = await response.json();
    return plan;
  } catch (error) {
    console.error('Error getting subscription plan:', error);
    throw error;
  }
};
