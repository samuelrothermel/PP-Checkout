import {
  createBillingAgreementToken as createBillingToken_,
  createBillingAgreement as createBillingAgreement_,
} from '../services/billingApi.js';
import { createOrderWithBillingAgreement as createOrderWithBillingAgreement_ } from '../services/ordersApi.js';

// Create Billing Agreement Token
export const createBillingToken = async (req, res, next) => {
  try {
    const agreementToken = await createBillingToken_();
    console.log('Billing Agreement Token:', agreementToken);
    res.json(agreementToken);
  } catch (err) {
    next(err);
  }
};

// Create the Billing Agreement
export const createBillingAgreement = async (req, res, next) => {
  try {
    const { token } = req.body;
    const agreement = await createBillingAgreement_(token);
    console.log('Billing Agreement:', agreement);
    res.json(agreement);
  } catch (err) {
    next(err);
  }
};

// Create and capture order with Billing Agreement ID
export const captureOrderWithBillingAgreement = async (req, res, next) => {
  try {
    const { billingAgreementId, amount } = req.body;
    const order = await createOrderWithBillingAgreement_(
      billingAgreementId,
      amount
    );
    console.log('Order created with Billing Agreement:', order);
    res.json(order);
  } catch (err) {
    next(err);
  }
};
