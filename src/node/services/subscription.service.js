import Subscription from '../models/subscription.model.js';
import User from '../models/user.model.js';
import Flutterwave from 'flutterwave-node-v3';
import Paystack from 'paystack';
import { sendSubscriptionEmail } from '../utils/email.js';
import { AppError } from '../utils/AppError.js';

// Initialize payment providers
const flutterwave = new Flutterwave(
  process.env.FLUTTERWAVE_PUBLIC_KEY,
  process.env.FLUTTERWAVE_SECRET_KEY
);

const paystack = new Paystack(process.env.PAYSTACK_SECRET_KEY);

// Plan configurations
const vendorPlans = [
  {
    name: 'Basic',
    price: 0,
    description: 'Perfect for vendors just starting out',
    features: [
      'Basic profile listing',
      'Up to 5 event listings per month',
      'Basic analytics',
      'Email support',
      'Standard search visibility',
    ],
    limitations: [
      'No featured listings',
      'Limited photo uploads',
      'Basic customer reviews',
    ],
    cta: 'Get Started',
    popular: false,
  },
  {
    name: 'Professional',
    price: 4900, // $49 in NGN
    period: '/month',
    description: 'Ideal for growing vendors',
    features: [
      'Enhanced profile listing',
      'Unlimited event listings',
      'Advanced analytics',
      'Priority support',
      'Featured in search results',
      'Photo gallery (up to 50 images)',
      'Customer review management',
      'Booking calendar',
    ],
    limitations: [],
    cta: 'Start Free Trial',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 9900, // $99 in NGN
    period: '/month',
    description: 'For established vendors',
    features: [
      'Premium profile listing',
      'Unlimited event listings',
      'Advanced analytics & reporting',
      '24/7 priority support',
      'Top search visibility',
      'Unlimited photo gallery',
      'Advanced review management',
      'Custom booking system',
      'API access',
      'White-label options',
    ],
    limitations: [],
    cta: 'Contact Sales',
    popular: false,
  },
];

const plannerPlans = [
  {
    name: 'Starter',
    price: 0,
    description: 'Perfect for personal event planning',
    features: [
      'Basic event planning tools',
      'Up to 3 active events',
      'Basic vendor search',
      'Email support',
      'Standard templates',
    ],
    limitations: [
      'No AI recommendations',
      'Limited guest management',
      'Basic budget tracking',
    ],
    cta: 'Get Started',
    popular: false,
  },
  {
    name: 'Professional',
    price: 2900, // $29 in NGN
    period: '/month',
    description: 'For professional event planners',
    features: [
      'Advanced planning tools',
      'Unlimited active events',
      'AI-powered recommendations',
      'Priority support',
      'Premium templates',
      'Advanced guest management',
      'Budget tracking & analytics',
      'Vendor management tools',
    ],
    limitations: [],
    cta: 'Start Free Trial',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 7900, // $79 in NGN
    period: '/month',
    description: 'For event planning agencies',
    features: [
      'All Professional features',
      'Team collaboration tools',
      'Custom branding',
      '24/7 priority support',
      'Advanced analytics & reporting',
      'API access',
      'White-label options',
      'Dedicated account manager',
    ],
    limitations: [],
    cta: 'Contact Sales',
    popular: false,
  },
];

class SubscriptionService {
  // Initialize trial subscription
  async initializeTrial(userId, planType, planName) {
    const user = await User.findById(userId);
    if (!user) throw new AppError('User not found', 404);

    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 14); // 14-day trial

    const subscription = await Subscription.create({
      user: userId,
      planType,
      planName,
      status: 'trial',
      startDate: new Date(),
      endDate: trialEndDate,
      trialEndDate,
      paymentProvider: 'none',
      amount: 0,
      autoRenew: false
    });

    await sendSubscriptionEmail(user, 'trial_started', {
      planType,
      planName,
      trialEndDate
    });

    return subscription;
  }

  // Create payment intent
  async createPaymentIntent(userId, planType, planName, paymentProvider) {
    const user = await User.findById(userId);
    if (!user) throw new AppError('User not found', 404);

    const plan = planType === 'vendor' ? 
      vendorPlans.find(p => p.name === planName) :
      plannerPlans.find(p => p.name === planName);

    if (!plan) throw new AppError('Invalid plan', 400);

    let paymentIntent;
    if (paymentProvider === 'flutterwave') {
      paymentIntent = await flutterwave.Charge.initiate({
        amount: plan.price,
        currency: 'NGN',
        email: user.email,
        tx_ref: `SUB-${Date.now()}-${userId}`,
        customer: {
          email: user.email,
          name: `${user.firstName} ${user.lastName}`
        },
        customizations: {
          title: `Confetti ${planType} Subscription`,
          description: `${planName} Plan Subscription`
        }
      });
    } else if (paymentProvider === 'paystack') {
      paymentIntent = await paystack.transaction.initialize({
        amount: plan.price * 100, // Convert to kobo
        email: user.email,
        reference: `SUB-${Date.now()}-${userId}`,
        callback_url: `${process.env.FRONTEND_URL}/subscription/verify`,
        metadata: {
          userId,
          planType,
          planName
        }
      });
    }

    return paymentIntent;
  }

  // Verify payment and activate subscription
  async verifyPayment(paymentId, provider) {
    let payment;
    if (provider === 'flutterwave') {
      payment = await flutterwave.Transaction.verify(paymentId);
    } else if (provider === 'paystack') {
      payment = await paystack.transaction.verify(paymentId);
    }

    if (!payment || payment.status !== 'success') {
      throw new AppError('Payment verification failed', 400);
    }

    const { userId, planType, planName } = payment.metadata;
    const user = await User.findById(userId);
    if (!user) throw new AppError('User not found', 404);

    const plan = planType === 'vendor' ? 
      vendorPlans.find(p => p.name === planName) :
      plannerPlans.find(p => p.name === planName);

    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    const subscription = await Subscription.create({
      user: userId,
      planType,
      planName,
      status: 'active',
      startDate: new Date(),
      endDate,
      paymentProvider: provider,
      paymentId: paymentId,
      amount: plan.price,
      autoRenew: true
    });

    await sendSubscriptionEmail(user, 'subscription_activated', {
      planType,
      planName,
      endDate
    });

    return subscription;
  }

  // Upgrade subscription
  async upgradeSubscription(subscriptionId, newPlanName) {
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) throw new AppError('Subscription not found', 404);

    const currentPlan = subscription.planType === 'vendor' ? 
      vendorPlans.find(p => p.name === subscription.planName) :
      plannerPlans.find(p => p.name === subscription.planName);

    const newPlan = subscription.planType === 'vendor' ? 
      vendorPlans.find(p => p.name === newPlanName) :
      plannerPlans.find(p => p.name === newPlanName);

    if (!newPlan) throw new AppError('Invalid plan', 400);

    // Calculate prorated amount
    const daysRemaining = Math.ceil((subscription.endDate - new Date()) / (1000 * 60 * 60 * 24));
    const totalDays = Math.ceil((subscription.endDate - subscription.startDate) / (1000 * 60 * 60 * 24));
    const proratedAmount = Math.round((newPlan.price - currentPlan.price) * (daysRemaining / totalDays));

    // Update subscription
    subscription.planName = newPlanName;
    subscription.amount = newPlan.price;
    subscription.history.push({
      planName: newPlanName,
      status: 'active',
      startDate: new Date(),
      endDate: subscription.endDate,
      amount: newPlan.price,
      changeType: 'upgrade',
      proratedAmount
    });

    await subscription.save();

    return subscription;
  }

  // Downgrade subscription
  async downgradeSubscription(subscriptionId, newPlanName) {
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) throw new AppError('Subscription not found', 404);

    const currentPlan = subscription.planType === 'vendor' ? 
      vendorPlans.find(p => p.name === subscription.planName) :
      plannerPlans.find(p => p.name === subscription.planName);

    const newPlan = subscription.planType === 'vendor' ? 
      vendorPlans.find(p => p.name === newPlanName) :
      plannerPlans.find(p => p.name === newPlanName);

    if (!newPlan) throw new AppError('Invalid plan', 400);

    // Calculate prorated amount
    const daysRemaining = Math.ceil((subscription.endDate - new Date()) / (1000 * 60 * 60 * 24));
    const totalDays = Math.ceil((subscription.endDate - subscription.startDate) / (1000 * 60 * 60 * 24));
    const proratedAmount = Math.round((currentPlan.price - newPlan.price) * (daysRemaining / totalDays));

    // Update subscription
    subscription.planName = newPlanName;
    subscription.amount = newPlan.price;
    subscription.history.push({
      planName: newPlanName,
      status: 'active',
      startDate: new Date(),
      endDate: subscription.endDate,
      amount: newPlan.price,
      changeType: 'downgrade',
      proratedAmount
    });

    await subscription.save();

    return subscription;
  }

  // Cancel subscription
  async cancelSubscription(subscriptionId) {
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) throw new AppError('Subscription not found', 404);

    subscription.status = 'cancelled';
    subscription.autoRenew = false;
    subscription.history.push({
      planName: subscription.planName,
      status: 'cancelled',
      startDate: new Date(),
      endDate: subscription.endDate,
      amount: subscription.amount,
      changeType: 'cancellation'
    });

    await subscription.save();

    const user = await User.findById(subscription.user);
    await sendSubscriptionEmail(user, 'subscription_cancelled', {
      planType: subscription.planType,
      planName: subscription.planName,
      endDate: subscription.endDate
    });

    return subscription;
  }

  // Get user subscriptions
  async getUserSubscriptions(userId) {
    return Subscription.find({ user: userId });
  }

  // Check feature access
  async checkFeatureAccess(userId, planType, feature) {
    const subscription = await Subscription.findOne({
      user: userId,
      planType,
      status: { $in: ['active', 'trial'] }
    });

    if (!subscription) return false;

    switch (feature) {
      case 'createEvent':
        return subscription.canCreateEvent();
      case 'uploadPhoto':
        return subscription.canUploadPhoto();
      default:
        return false;
    }
  }

  // Update usage
  async updateUsage(subscriptionId, feature, increment = 1) {
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) throw new AppError('Subscription not found', 404);

    if (feature === 'eventsCreated') {
      subscription.usage.eventsCreated += increment;
    } else if (feature === 'photosUploaded') {
      subscription.usage.photosUploaded += increment;
    }

    await subscription.save();
    return subscription;
  }
}

export default new SubscriptionService(); 