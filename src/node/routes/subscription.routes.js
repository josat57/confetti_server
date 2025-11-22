import express from "express";
import {
  getPlans,
  startTrial,
  createPaymentIntent,
  verifyPayment,
  handlePaymentCallback,
  upgradeSubscription,
  downgradeSubscription,
  cancelSubscription,
  getUserSubscriptions,
  checkFeatureAccess,
  updateUsage,
  getCurrentSubscription,
  getSubscriptionUsage,
  getSubscriptionPayments,
} from "../controllers/subscription.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Public routes
/**
 * @swagger
 * /subscriptions/plans:
 *   get:
 *     summary: Get all available subscription plans
 *     description: Retrieve a list of all available subscription plans for both vendors and event planners, including pricing, features, and limitations
 *     tags: [Subscriptions]
 *     responses:
 *       200:
 *         description: Successfully retrieved subscription plans
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     vendorPlans:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                             example: Professional
 *                           price:
 *                             type: number
 *                             example: 29.99
 *                           currency:
 *                             type: string
 *                             example: NGN
 *                           billingCycle:
 *                             type: string
 *                             enum: [monthly, yearly]
 *                             example: monthly
 *                           features:
 *                             type: array
 *                             items:
 *                               type: string
 *                             example: ["Unlimited events", "Priority support", "Advanced analytics"]
 *                           limits:
 *                             type: object
 *                             properties:
 *                               eventsCreated:
 *                                 type: number
 *                                 example: -1
 *                               photosUploaded:
 *                                 type: number
 *                                 example: -1
 *                     plannerPlans:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                             example: Starter
 *                           price:
 *                             type: number
 *                             example: 19.99
 *                           currency:
 *                             type: string
 *                             example: NGN
 *                           billingCycle:
 *                             type: string
 *                             enum: [monthly, yearly]
 *                             example: monthly
 *                           features:
 *                             type: array
 *                             items:
 *                               type: string
 *                             example: ["Up to 5 events", "Basic support", "Standard analytics"]
 *                           limits:
 *                             type: object
 *                             properties:
 *                               eventsCreated:
 *                                 type: number
 *                                 example: 5
 *                               photosUploaded:
 *                                 type: number
 *                                 example: 10
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/plans", getPlans);

// Public route for payment provider callback (no auth required)
router.get("/payment-callback", handlePaymentCallback);

// Protected routes
router.use(protect);

router.post("/trial", startTrial);
router.post("/payment-intent", createPaymentIntent);
router.post("/verify-payment", verifyPayment);

/**
 * @swagger
 * /subscriptions/{id}/upgrade:
 *   post:
 *     summary: Upgrade subscription to a higher tier plan
 *     description: Upgrade an active subscription to a higher tier plan. Calculates prorated charges and returns payment URL if payment is required.
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Subscription ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newPlanName
 *             properties:
 *               newPlanName:
 *                 type: string
 *                 example: Professional
 *                 description: Name of the new plan to upgrade to
 *               paymentProvider:
 *                 type: string
 *                 enum: [flutterwave, paystack]
 *                 default: flutterwave
 *                 description: Payment provider to use for the upgrade payment
 *     responses:
 *       200:
 *         description: Upgrade successful or payment required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Payment required to complete upgrade
 *                 data:
 *                   type: object
 *                   properties:
 *                     subscription:
 *                       $ref: '#/components/schemas/Subscription'
 *                     paymentUrl:
 *                       type: string
 *                       example: https://checkout.flutterwave.com/v3/hosted/pay/abc123
 *                       description: Payment URL (only present if payment required)
 *                     reference:
 *                       type: string
 *                       example: SUB-1699999999999-507f1f77bcf86cd799439011
 *                       description: Payment reference (only present if payment required)
 *                     prorationDetails:
 *                       type: object
 *                       properties:
 *                         daysRemaining:
 *                           type: number
 *                           example: 15
 *                         currentPlanCredit:
 *                           type: number
 *                           example: 1450
 *                         newPlanCost:
 *                           type: number
 *                           example: 2450
 *                         amountDue:
 *                           type: number
 *                           example: 1000
 *       400:
 *         description: Bad request - Invalid plan or subscription not active
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Subscription not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/:id/upgrade", upgradeSubscription);
router.patch("/:subscriptionId/downgrade", downgradeSubscription);
router.patch("/:subscriptionId/cancel", cancelSubscription);
router.get("/user", getUserSubscriptions);
router.get("/check-access/:planType/:feature", checkFeatureAccess);
router.patch("/:subscriptionId/usage", updateUsage);

/**
 * @swagger
 * /subscriptions/current:
 *   get:
 *     summary: Get current active subscription
 *     description: Retrieve the current active subscription for the authenticated user with usage statistics, days remaining, and recent payment history
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved current subscription
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     subscription:
 *                       $ref: '#/components/schemas/Subscription'
 *                     usage:
 *                       type: object
 *                       properties:
 *                         eventsCreated:
 *                           type: number
 *                           example: 5
 *                         photosUploaded:
 *                           type: number
 *                           example: 23
 *                         lastResetDate:
 *                           type: string
 *                           format: date-time
 *                           example: 2024-01-01T00:00:00.000Z
 *                     daysRemaining:
 *                       type: number
 *                       example: 15
 *                       description: Number of days remaining in current billing cycle
 *                     paymentHistory:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           amount:
 *                             type: number
 *                             example: 4900
 *                           currency:
 *                             type: string
 *                             example: NGN
 *                           status:
 *                             type: string
 *                             example: completed
 *                           paymentMethod:
 *                             type: string
 *                             example: flutterwave
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *       401:
 *         description: Unauthorized - Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: No active subscription found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/current", getCurrentSubscription);
router.get("/my-subscription", getCurrentSubscription); // Alias for /current

/**
 * @swagger
 * /subscriptions/{id}/usage:
 *   get:
 *     summary: Get subscription usage statistics
 *     description: Retrieve current usage statistics for a specific subscription including usage counts, limits, and percentages
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Subscription ID
 *     responses:
 *       200:
 *         description: Successfully retrieved usage statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     usage:
 *                       type: object
 *                       properties:
 *                         eventsCreated:
 *                           type: number
 *                           example: 5
 *                         photosUploaded:
 *                           type: number
 *                           example: 23
 *                         lastResetDate:
 *                           type: string
 *                           format: date-time
 *                     limits:
 *                       type: object
 *                       properties:
 *                         eventsCreated:
 *                           type: number
 *                           example: -1
 *                           description: Maximum events allowed (-1 for unlimited)
 *                         photosUploaded:
 *                           type: number
 *                           example: 50
 *                           description: Maximum photos allowed (-1 for unlimited)
 *                     percentages:
 *                       type: object
 *                       properties:
 *                         eventsCreated:
 *                           type: number
 *                           example: 50
 *                           description: Percentage of events limit used
 *                         photosUploaded:
 *                           type: number
 *                           example: 46
 *                           description: Percentage of photos limit used
 *                     lastResetDate:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Unauthorized - Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Subscription not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/:id/usage", getSubscriptionUsage);

/**
 * @swagger
 * /subscriptions/{id}/payments:
 *   get:
 *     summary: Get subscription payment history
 *     description: Retrieve complete payment history for a specific subscription including all transactions, amounts, and statuses
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Subscription ID
 *     responses:
 *       200:
 *         description: Successfully retrieved payment history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     payments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: 507f1f77bcf86cd799439011
 *                           amount:
 *                             type: number
 *                             example: 4900
 *                           currency:
 *                             type: string
 *                             example: NGN
 *                           status:
 *                             type: string
 *                             enum: [pending, completed, failed, refunded]
 *                             example: completed
 *                           paymentMethod:
 *                             type: string
 *                             enum: [flutterwave, paystack]
 *                             example: flutterwave
 *                           paymentType:
 *                             type: string
 *                             enum: [subscription, event, refund]
 *                             example: subscription
 *                           subscriptionDetails:
 *                             type: object
 *                             properties:
 *                               planType:
 *                                 type: string
 *                                 example: vendor
 *                               planName:
 *                                 type: string
 *                                 example: Professional
 *                               billingCycle:
 *                                 type: string
 *                                 example: monthly
 *                               isUpgrade:
 *                                 type: boolean
 *                                 example: false
 *                               previousPlan:
 *                                 type: string
 *                                 example: Basic
 *                               proratedAmount:
 *                                 type: number
 *                                 example: 1000
 *                           transactionId:
 *                             type: string
 *                             example: FLW-123456789
 *                           reference:
 *                             type: string
 *                             example: SUB-1699999999999-507f1f77bcf86cd799439011
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *       401:
 *         description: Unauthorized - Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Subscription not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/:id/payments", getSubscriptionPayments);

export default router;
