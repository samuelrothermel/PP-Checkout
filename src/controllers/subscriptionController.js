import {
  createSubscriptionPlan,
  getSubscriptionPlan,
} from '../services/subscriptionApi.js';

// Create a new subscription plan
export const createPlan = async (req, res, next) => {
  try {
    const plan = await createSubscriptionPlan();
    console.log('Subscription Plan Created:', plan);
    res.json(plan);
  } catch (err) {
    next(err);
  }
};

// Get subscription plan by ID
export const getPlan = async (req, res, next) => {
  try {
    const { planId } = req.params;
    const plan = await getSubscriptionPlan(planId);
    console.log('Subscription Plan:', plan);
    res.json(plan);
  } catch (err) {
    next(err);
  }
};
