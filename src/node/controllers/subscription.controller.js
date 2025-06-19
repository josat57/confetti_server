import subscriptionService from '../services/subscription.service.js';
import { AppError } from '../utils/AppError.js';

// Get all plans
export const getPlans = async (req, res) => {
  res.json({
    status: 'success',
    data: {
      vendorPlans,
      plannerPlans
    }
  });
};

// Start trial
export const startTrial = async (req, res, next) => {
  try {
    const { planType, planName } = req.body;
    const subscription = await subscriptionService.initializeTrial(
      req.user._id,
      planType,
      planName
    );

    res.status(201).json({
      status: 'success',
      data: subscription
    });
  } catch (error) {
    next(error);
  }
};

// Create payment intent
export const createPaymentIntent = async (req, res, next) => {
  try {
    const { planType, planName, paymentProvider } = req.body;
    const paymentIntent = await subscriptionService.createPaymentIntent(
      req.user._id,
      planType,
      planName,
      paymentProvider
    );

    res.json({
      status: 'success',
      data: paymentIntent
    });
  } catch (error) {
    next(error);
  }
};

// Verify payment
export const verifyPayment = async (req, res, next) => {
  try {
    const { paymentId, provider } = req.body;
    const subscription = await subscriptionService.verifyPayment(
      paymentId,
      provider
    );

    res.json({
      status: 'success',
      data: subscription
    });
  } catch (error) {
    next(error);
  }
};

// Upgrade subscription
export const upgradeSubscription = async (req, res, next) => {
  try {
    const { subscriptionId } = req.params;
    const { newPlanName } = req.body;
    const subscription = await subscriptionService.upgradeSubscription(
      subscriptionId,
      newPlanName
    );

    res.json({
      status: 'success',
      data: subscription
    });
  } catch (error) {
    next(error);
  }
};

// Downgrade subscription
export const downgradeSubscription = async (req, res, next) => {
  try {
    const { subscriptionId } = req.params;
    const { newPlanName } = req.body;
    const subscription = await subscriptionService.downgradeSubscription(
      subscriptionId,
      newPlanName
    );

    res.json({
      status: 'success',
      data: subscription
    });
  } catch (error) {
    next(error);
  }
};

// Cancel subscription
export const cancelSubscription = async (req, res, next) => {
  try {
    const { subscriptionId } = req.params;
    const subscription = await subscriptionService.cancelSubscription(
      subscriptionId
    );

    res.json({
      status: 'success',
      data: subscription
    });
  } catch (error) {
    next(error);
  }
};

// Get user subscriptions
export const getUserSubscriptions = async (req, res, next) => {
  try {
    const subscriptions = await subscriptionService.getUserSubscriptions(
      req.user._id
    );

    res.json({
      status: 'success',
      data: subscriptions
    });
  } catch (error) {
    next(error);
  }
};

// Check feature access
export const checkFeatureAccess = async (req, res, next) => {
  try {
    const { planType, feature } = req.params;
    const hasAccess = await subscriptionService.checkFeatureAccess(
      req.user._id,
      planType,
      feature
    );

    res.json({
      status: 'success',
      data: { hasAccess }
    });
  } catch (error) {
    next(error);
  }
};

// Update usage
export const updateUsage = async (req, res, next) => {
  try {
    const { subscriptionId } = req.params;
    const { feature, increment } = req.body;
    const subscription = await subscriptionService.updateUsage(
      subscriptionId,
      feature,
      increment
    );

    res.json({
      status: 'success',
      data: subscription
    });
  } catch (error) {
    next(error);
  }
}; 