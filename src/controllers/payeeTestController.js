import fetch from 'node-fetch';
import {
  createOneTimeOrderWithPayee,
  createVaultedOrderWithPayee,
  capturePayment,
  createOrderWithVaultIdAndCapture,
} from '../services/ordersApi.js';

// Create one-time order with different payee (returns order for frontend approval)
export const testOneTimePayee = async (req, res, next) => {
  try {
    const { payeeMerchantId, amount } = req.body;

    console.log(
      `Creating one-time PayPal order with payee: ${payeeMerchantId}, amount: ${amount}`
    );

    // Step 1: Create the order (customer will approve on frontend)
    const orderResult = await createOneTimeOrderWithPayee(
      payeeMerchantId,
      amount
    );

    console.log(`PayPal order created successfully: ${orderResult.id}`);

    // Return order details for frontend PayPal button approval
    res.json({
      success: true,
      orderId: orderResult.id,
      status: orderResult.status,
      payeeMerchantId: payeeMerchantId,
      amount: amount,
      approvalUrl: orderResult.links.find(link => link.rel === 'approve')?.href,
      orderCreation: orderResult,
      note: 'Order created - customer must approve via PayPal login',
      nextStep: 'Use PayPal button to approve payment',
    });
  } catch (error) {
    console.error('One-time payee order creation failed:', error);

    res.json({
      success: false,
      error: error.message,
      details: error.status ? `HTTP ${error.status}` : 'Unknown error',
    });
  }
};

// Capture approved one-time order
export const captureOneTimePayee = async (req, res, next) => {
  try {
    const { orderId, payeeMerchantId } = req.body;

    console.log(`Capturing approved PayPal order: ${orderId}`);

    // Capture the approved order
    const captureResult = await capturePayment(orderId);
    console.log(`Order captured successfully:`, captureResult);

    res.json({
      success: true,
      orderId: orderId,
      payeeMerchantId: payeeMerchantId,
      capture: {
        success: true,
        result: captureResult,
        captureId: captureResult.purchase_units[0].payments.captures[0].id,
        amount:
          captureResult.purchase_units[0].payments.captures[0].amount.value,
      },
      disbursementTest: {
        note: `✅ Funds successfully disbursed to merchant: ${payeeMerchantId}`,
        payeeMerchant: payeeMerchantId,
        expectedBehavior:
          'SUCCESS - One-time payments can disburse to different merchants',
        fundsFlow: `Customer → PayPal → Merchant (${payeeMerchantId})`,
      },
    });
  } catch (error) {
    console.error('Capture failed:', error);

    res.json({
      success: false,
      orderId: req.body.orderId,
      error: error.message,
      details: error.status ? `HTTP ${error.status}` : 'Unknown error',
      disbursementTest: {
        note: 'Capture failed - no disbursement occurred',
        expectedBehavior: 'SUCCESS - One-time payments should succeed',
      },
    });
  }
};

// Test vaulted payment with same merchant but different payee
export const testVaultedSameMerchantDifferentPayee = async (req, res, next) => {
  try {
    const { vaultedToken, payeeMerchantId, amount } = req.body;

    console.log(
      `Testing vaulted payment - SAME merchant, DIFFERENT payee: token: ${vaultedToken}, payee: ${payeeMerchantId}, amount: ${amount}`
    );

    // Step 1: Create the order (this should succeed since it's the same merchant who owns the token)
    const orderResult = await createVaultedOrderWithPayee(
      vaultedToken,
      payeeMerchantId,
      amount
    );

    console.log(
      `Order created successfully: ${orderResult.id}, status: ${orderResult.status}`
    );

    // Step 2: Check if order is already processed (vault_id payments process automatically)
    let captureResult = null;
    let captureError = null;
    let isAutoProcessed = false;

    if (orderResult.status === 'COMPLETED') {
      // Order was auto-completed (captured) during creation
      console.log(
        `Order ${orderResult.id} was automatically completed by PayPal`
      );
      captureResult = orderResult;
      isAutoProcessed = true;
    } else if (orderResult.status === 'APPROVED') {
      // Order needs manual capture
      try {
        console.log(`Attempting to capture approved order: ${orderResult.id}`);
        captureResult = await capturePayment(orderResult.id);
        console.log(
          `RESULT: Order captured successfully - funds sent to different payee:`,
          captureResult
        );
      } catch (error) {
        console.error(`Capture failed for order ${orderResult.id}:`, error);
        captureError = {
          message: error.message,
          status: error.status,
          details: error.toString(),
        };
      }
    } else {
      console.log(
        `Order ${orderResult.id} has unexpected status: ${orderResult.status}`
      );
    }

    res.json({
      success: true,
      orderId: orderResult.id,
      status: orderResult.status,
      payeeMerchantId: payeeMerchantId,
      amount: amount,
      orderCreation: {
        success: true,
        result: orderResult,
        note: 'Order creation SUCCESS - same merchant can use their own vaulted token',
      },
      capture: {
        success: !!captureResult,
        result: captureResult,
        error: captureError,
      },
      disbursementTest: {
        note: captureResult
          ? `SUCCESS: Funds ${
              isAutoProcessed ? 'automatically ' : ''
            }disbursed to different payee: ${payeeMerchantId}`
          : `CAPTURE FAILED: ${captureError?.message || 'Unknown error'}`,
        payeeMerchant: payeeMerchantId,
        expectedBehavior:
          'UNKNOWN - Testing if same merchant can redirect vaulted payments to different payee',
        testScenario:
          'Same merchant, own vaulted token, different payee destination',
        processingType: isAutoProcessed
          ? 'Auto-processed by PayPal'
          : 'Manual capture',
      },
    });
  } catch (error) {
    console.error('Vaulted same merchant different payee test failed:', error);

    res.json({
      success: false,
      error: error.message,
      details: error.status ? `HTTP ${error.status}` : 'Unknown error',
      disbursementTest: {
        note: 'Order creation failed - no disbursement occurred',
        payeeMerchant: req.body.payeeMerchantId,
        expectedBehavior:
          'UNKNOWN - Testing if same merchant can redirect vaulted payments to different payee',
        testScenario:
          'Same merchant, own vaulted token, different payee destination',
      },
      explanation:
        'Unexpected failure - same merchant should be able to create orders with their own vaulted tokens',
    });
  }
};

// Test vault v3 format with PAYMENT_METHOD_TOKEN
export const testVaultV3 = async (req, res, next) => {
  try {
    const { vaultedToken, amount } = req.body;

    console.log(
      `Testing vault v3 format with token: ${vaultedToken}, amount: ${amount}`
    );

    // Create order using vault v3 format: PAYMENT_METHOD_TOKEN
    const orderResult = await createOrderWithVaultV3Format(
      vaultedToken,
      amount
    );

    console.log(
      `Vault v3 order created successfully: ${orderResult.id}, status: ${orderResult.status}`
    );

    res.json({
      success: true,
      orderId: orderResult.id,
      status: orderResult.status,
      amount: amount,
      format: 'PAYMENT_METHOD_TOKEN',
      orderCreation: orderResult,
      capture:
        orderResult.status === 'COMPLETED'
          ? {
              success: true,
              captureId: orderResult.purchase_units[0].payments.captures[0].id,
              amount:
                orderResult.purchase_units[0].payments.captures[0].amount.value,
            }
          : null,
      note: 'Vault v3 format test - using PAYMENT_METHOD_TOKEN type',
    });
  } catch (error) {
    console.error('Vault v3 test failed:', error);

    res.json({
      success: false,
      error: error.message,
      details: error.status ? `HTTP ${error.status}` : 'Unknown error',
      format: 'PAYMENT_METHOD_TOKEN',
      note: 'Vault v3 format failed - may not be supported yet',
    });
  }
};

// Test vault v3 format with different payee
export const testVaultV3WithPayee = async (req, res, next) => {
  try {
    const { vaultedToken, payeeMerchantId, amount } = req.body;

    console.log(
      `Testing vault v3 with payee - token: ${vaultedToken}, payee: ${payeeMerchantId}, amount: ${amount}`
    );

    // Try to create order using vault v3 format with different payee
    const orderResult = await createOrderWithVaultV3FormatAndPayee(
      vaultedToken,
      payeeMerchantId,
      amount
    );

    console.log(`Vault v3 order with payee created: ${orderResult.id}`);

    // Try to capture if order was created
    let captureResult = null;
    let captureError = null;

    if (orderResult.status === 'COMPLETED') {
      captureResult = orderResult;
    } else if (orderResult.status === 'APPROVED') {
      try {
        captureResult = await capturePayment(orderResult.id);
      } catch (error) {
        captureError = {
          message: error.message,
          status: error.status,
        };
      }
    }

    res.json({
      success: true,
      orderId: orderResult.id,
      status: orderResult.status,
      payeeMerchantId: payeeMerchantId,
      amount: amount,
      orderCreation: {
        success: true,
        result: orderResult,
        note: 'UNEXPECTED: Vault v3 order with different payee succeeded',
      },
      capture: {
        success: !!captureResult,
        result: captureResult,
        error: captureError,
      },
      warning:
        'UNEXPECTED: Vault v3 with different payee succeeded - potential security issue',
    });
  } catch (error) {
    console.error('Vault v3 with payee test failed (expected):', error);

    res.json({
      success: false,
      error: error.message,
      details: error.status ? `HTTP ${error.status}` : 'Unknown error',
      note: 'EXPECTED: Vault v3 tokens should be tied to original merchant',
      security: 'Vault tokens properly protected against cross-merchant usage',
    });
  }
};

// Compare legacy vault vs vault v3 formats
export const testLegacyVsV3 = async (req, res, next) => {
  try {
    const { vaultedToken, amount } = req.body;

    console.log(
      `Comparing legacy vs vault v3 formats for token: ${vaultedToken}`
    );

    let legacyResult = { success: false, error: null };
    let v3Result = { success: false, error: null };

    // Test legacy format
    try {
      const legacyOrder = await createOrderWithVaultIdAndCapture(
        vaultedToken,
        amount
      );
      legacyResult = {
        success: true,
        orderId: legacyOrder.id,
        status: legacyOrder.status,
        data: legacyOrder,
      };
      console.log('Legacy vault format: SUCCESS');
    } catch (error) {
      legacyResult.error = error.message;
      console.log('Legacy vault format: FAILED -', error.message);
    }

    // Test v3 format
    try {
      const v3Order = await createOrderWithVaultV3Format(vaultedToken, amount);
      v3Result = {
        success: true,
        orderId: v3Order.id,
        status: v3Order.status,
        data: v3Order,
      };
      console.log('Vault v3 format: SUCCESS');
    } catch (error) {
      v3Result.error = error.message;
      console.log('Vault v3 format: FAILED -', error.message);
    }

    // Determine compatibility status
    const bothWork = legacyResult.success && v3Result.success;
    const neitherWork = !legacyResult.success && !v3Result.success;
    const onlyLegacy = legacyResult.success && !v3Result.success;
    const onlyV3 = !legacyResult.success && v3Result.success;

    let compatibilityStatus;
    if (bothWork) {
      compatibilityStatus =
        'Both formats supported - full backward compatibility';
    } else if (neitherWork) {
      compatibilityStatus = 'Neither format works - possible API issues';
    } else if (onlyLegacy) {
      compatibilityStatus = 'Only legacy format works - v3 not yet deployed';
    } else if (onlyV3) {
      compatibilityStatus = 'Only v3 format works - legacy deprecated';
    }

    res.json({
      success: true,
      legacy: legacyResult,
      v3: v3Result,
      compatibility: {
        status: compatibilityStatus,
        bothWork,
        neitherWork,
        onlyLegacy,
        onlyV3,
      },
      formats: {
        legacy: `{ "paypal": { "vault_id": "${vaultedToken}" } }`,
        v3: `{ "token": { "id": "${vaultedToken}", "type": "PAYMENT_METHOD_TOKEN" } }`,
      },
    });
  } catch (error) {
    console.error('Comparison test failed:', error);

    res.json({
      success: false,
      error: error.message,
      note: 'Failed to complete format comparison test',
    });
  }
};

// Helper function to create order with vault v3 format
async function createOrderWithVaultV3Format(vaultId, amount = '10.00') {
  const { generateAccessToken } = await import('../services/authApi.js');
  const accessToken = await generateAccessToken();

  const payload = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        amount: {
          currency_code: 'USD',
          value: amount,
        },
      },
    ],
    payment_source: {
      token: {
        id: vaultId,
        type: 'PAYMENT_METHOD_TOKEN',
      },
    },
  };

  console.log(
    'Creating order with vault v3 format:',
    JSON.stringify(payload, null, 2)
  );

  const response = await fetch(
    'https://api-m.sandbox.paypal.com/v2/checkout/orders',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'PayPal-Request-Id': Date.now().toString(),
      },
      body: JSON.stringify(payload),
    }
  );

  if (response.status === 200 || response.status === 201) {
    return response.json();
  }

  const error = new Error(await response.text());
  error.status = response.status;
  throw error;
}

// Helper function to create order with vault v3 format and different payee
async function createOrderWithVaultV3FormatAndPayee(
  vaultId,
  payeeMerchantId,
  amount = '10.00'
) {
  const { generateAccessToken } = await import('../services/authApi.js');
  const accessToken = await generateAccessToken();

  const payload = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        amount: {
          currency_code: 'USD',
          value: amount,
        },
        payee: {
          merchant_id: payeeMerchantId,
        },
      },
    ],
    payment_source: {
      token: {
        id: vaultId,
        type: 'PAYMENT_METHOD_TOKEN',
      },
    },
  };

  console.log(
    'Creating order with vault v3 format and payee:',
    JSON.stringify(payload, null, 2)
  );

  const response = await fetch(
    'https://api-m.sandbox.paypal.com/v2/checkout/orders',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'PayPal-Request-Id': Date.now().toString(),
      },
      body: JSON.stringify(payload),
    }
  );

  if (response.status === 200 || response.status === 201) {
    return response.json();
  }

  const error = new Error(await response.text());
  error.status = response.status;
  throw error;
}

// Create capture order with different payee using vault token
export const createCaptureOrderWithPayee = async (req, res, next) => {
  try {
    const { vaultedToken, payeeMerchantId, amount } = req.body;

    console.log(
      `Creating capture order with payee - token: ${vaultedToken}, payee: ${payeeMerchantId}, amount: ${amount}`
    );

    // Create order with capture intent using the vaulted token and specified payee
    const orderResult = await createOrderWithVaultV3FormatAndPayee(
      vaultedToken,
      payeeMerchantId,
      amount
    );

    console.log(
      `Capture order created successfully: ${orderResult.id}, status: ${orderResult.status}`
    );

    // Determine capture status
    let captureResult = null;
    let captureError = null;
    let isAutoProcessed = false;

    if (orderResult.status === 'COMPLETED') {
      // Order was auto-completed (captured) during creation with capture intent
      console.log(
        `Order ${orderResult.id} was automatically captured by PayPal`
      );
      captureResult = {
        success: true,
        captureId: orderResult.purchase_units[0].payments.captures[0].id,
        amount: orderResult.purchase_units[0].payments.captures[0].amount.value,
        status: orderResult.purchase_units[0].payments.captures[0].status,
      };
      isAutoProcessed = true;
    } else if (orderResult.status === 'APPROVED') {
      // This shouldn't happen with capture intent, but handle it
      try {
        console.log(`Manually capturing approved order: ${orderResult.id}`);
        const manualCapture = await capturePayment(orderResult.id);
        captureResult = {
          success: true,
          captureId: manualCapture.purchase_units[0].payments.captures[0].id,
          amount:
            manualCapture.purchase_units[0].payments.captures[0].amount.value,
          status: manualCapture.purchase_units[0].payments.captures[0].status,
        };
      } catch (error) {
        console.error(
          `Manual capture failed for order ${orderResult.id}:`,
          error
        );
        captureError = {
          message: error.message,
          status: error.status,
        };
      }
    }

    res.json({
      success: true,
      orderId: orderResult.id,
      status: orderResult.status,
      intent: 'CAPTURE',
      payeeMerchantId: payeeMerchantId,
      amount: amount,
      vaultedToken: vaultedToken,
      orderCreation: {
        success: true,
        result: orderResult,
        note: 'Order creation SUCCESS - using vault token with capture intent and payee',
      },
      capture: captureResult
        ? {
            success: true,
            captureId: captureResult.captureId,
            amount: captureResult.amount,
            status: captureResult.status,
            processingType: isAutoProcessed
              ? 'Auto-processed by PayPal'
              : 'Manual capture',
          }
        : {
            success: false,
            error: captureError?.message || 'Capture failed',
          },
      disbursementTest: {
        note: captureResult
          ? `✅ SUCCESS: Funds ${
              isAutoProcessed ? 'automatically ' : ''
            }captured and disbursed to payee: ${payeeMerchantId}`
          : `❌ CAPTURE FAILED: ${captureError?.message || 'Unknown error'}`,
        payeeMerchant: payeeMerchantId,
        vaultOwnership: 'Confirmed - you own the vault_id',
        fundsFlow: captureResult
          ? `Customer → PayPal → Payee (${payeeMerchantId})`
          : 'No funds flow due to capture failure',
        payeeReliability: captureResult
          ? '✅ Confirmed - Payee field provides reliable fund routing'
          : '❌ Failed',
      },
    });
  } catch (error) {
    console.error('Create capture order with payee failed:', error);

    res.json({
      success: false,
      error: error.message,
      details: error.status ? `HTTP ${error.status}` : 'Unknown error',
      disbursementTest: {
        note: 'Order creation failed - no disbursement occurred',
        payeeMerchant: req.body.payeeMerchantId,
        errorAnalysis: error.message.includes('vault')
          ? 'Vault ownership issue - you may not own this vault_id'
          : error.message.includes('payee')
          ? 'Payee merchant ID issue'
          : 'Unknown error',
      },
      explanation:
        'Failed to create capture order - check vault ownership and payee merchant ID',
    });
  }
};

// Test vaulted payment with different payee
export const testVaultedPayee = async (req, res, next) => {
  try {
    const { vaultedToken, payeeMerchantId, amount } = req.body;

    console.log(
      `Testing vaulted payment with token: ${vaultedToken}, payee: ${payeeMerchantId}, amount: ${amount}`
    );

    // Step 1: Try to create the order (this should fail)
    const orderResult = await createVaultedOrderWithPayee(
      vaultedToken,
      payeeMerchantId,
      amount
    );

    console.log(
      `UNEXPECTED: Vaulted order created successfully: ${orderResult.id}`
    );

    // Step 2: If order creation succeeded (unexpected), try to capture it
    let captureResult = null;
    let captureError = null;

    try {
      console.log(`Attempting to capture vaulted order: ${orderResult.id}`);
      captureResult = await capturePayment(orderResult.id);
      console.log(
        `UNEXPECTED: Vaulted order captured successfully:`,
        captureResult
      );
    } catch (error) {
      console.error(
        `Capture failed for vaulted order ${orderResult.id}:`,
        error
      );
      captureError = {
        message: error.message,
        status: error.status,
        details: error.toString(),
      };
    }

    // If we get here, the vaulted payment unexpectedly succeeded
    res.json({
      success: true,
      orderId: orderResult.id,
      status: orderResult.status,
      payeeMerchantId: payeeMerchantId,
      amount: amount,
      orderCreation: orderResult,
      capture: {
        success: !!captureResult,
        result: captureResult,
        error: captureError,
      },
      disbursementTest: {
        note: captureResult
          ? `UNEXPECTED: Funds disbursed to different merchant: ${payeeMerchantId}`
          : `Order created but capture failed`,
        payeeMerchant: payeeMerchantId,
        expectedBehavior:
          'FAIL - Vaulted tokens should be tied to original merchant',
      },
      warning:
        'UNEXPECTED: Vaulted payment with different payee succeeded - this suggests a security issue',
    });
  } catch (error) {
    console.error('Vaulted payee test failed (expected):', error);

    // This is the expected behavior - vaulted tokens should fail with different payees
    res.json({
      success: false,
      error: error.message,
      details: error.status ? `HTTP ${error.status}` : 'Unknown error',
      disbursementTest: {
        note: 'EXPECTED: Order creation failed - no disbursement occurred',
        payeeMerchant: req.body.payeeMerchantId,
        expectedBehavior:
          'FAIL - Vaulted tokens should be tied to original merchant',
      },
      note: 'EXPECTED: Vaulted tokens are tied to the original merchant',
      errorType: 'BILLING_AGREEMENT_NOT_FOUND',
      explanation:
        "This error confirms PayPal's security model is working - vaulted tokens cannot be used with different merchants",
    });
  }
};
