import {
  createOneTimeOrderWithPayee,
  createVaultedOrderWithPayee,
  capturePayment,
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
