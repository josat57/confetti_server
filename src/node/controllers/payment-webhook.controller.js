import crypto from "crypto";
import subscriptionService from "../services/subscription.service.js";
import User from "../models/user.model.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";
import { sendVerificationEmail } from "../utils/email.js";

/**
 * Handle Flutterwave webhook
 */
export const handleFlutterwaveWebhook = async (req, res, next) => {
  try {
    // Verify webhook signature
    const signature = req.headers["verif-hash"];
    const secretHash = process.env.FLUTTERWAVE_WEBHOOK_SECRET;

    if (!signature || !secretHash) {
      logger.warn("Invalid Flutterwave webhook signature");
      return res.status(401).json({ message: "Invalid signature" });
    }

    const sigBuf = Buffer.from(signature);
    const hashBuf = Buffer.from(secretHash);
    const signatureValid =
      sigBuf.length === hashBuf.length &&
      crypto.timingSafeEqual(sigBuf, hashBuf);

    if (!signatureValid) {
      logger.warn("Invalid Flutterwave webhook signature");
      return res.status(401).json({ message: "Invalid signature" });
    }

    const payload = req.body;
    logger.info("Flutterwave webhook received:", {
      event: payload.event,
      txRef: payload.data?.tx_ref,
      status: payload.data?.status,
    });

    // Handle successful payment
    if (
      payload.event === "charge.completed" &&
      payload.data.status === "successful"
    ) {
      const { tx_ref, id, customer, amount, currency } = payload.data;

      // Extract metadata
      const metadata = payload.data.meta || {};
      const { userId, planType, planName } = metadata;

      if (!userId || !planType || !planName) {
        logger.error("Missing metadata in Flutterwave webhook", { metadata });
        return res.status(400).json({ message: "Missing required metadata" });
      }

      // Find user
      const user = await User.findById(userId);
      if (!user) {
        logger.error("User not found for payment", { userId });
        return res.status(404).json({ message: "User not found" });
      }

      // Verify payment and create subscription
      try {
        const subscription = await subscriptionService.verifyPayment(
          id,
          "flutterwave"
        );

        // Update user status
        if (user.status === "pending_payment") {
          user.status = "pending_verification";

          // Generate verification token and OTP
          const token = user.generateEmailVerificationToken();
          const otp = user.generateOTP();
          await user.save();

          // Send verification email
          await sendVerificationEmail(user, otp, token);

          logger.info("Payment verified and verification email sent", {
            userId: user._id,
            email: user.email,
            subscriptionId: subscription._id,
          });
        }

        return res
          .status(200)
          .json({ message: "Webhook processed successfully" });
      } catch (error) {
        logger.error("Error processing Flutterwave payment:", error);
        return res.status(500).json({ message: "Error processing payment" });
      }
    }

    // Handle failed payment
    if (
      payload.event === "charge.completed" &&
      payload.data.status === "failed"
    ) {
      logger.info("Payment failed", { txRef: payload.data.tx_ref });
      // You can add logic here to notify the user about failed payment
    }

    res.status(200).json({ message: "Webhook received" });
  } catch (error) {
    logger.error("Flutterwave webhook error:", error);
    next(error);
  }
};

/**
 * Handle Paystack webhook
 */
export const handlePaystackWebhook = async (req, res, next) => {
  try {
    // Verify webhook signature
    const sigHeader = req.headers["x-paystack-signature"];
    if (!sigHeader || !process.env.PAYSTACK_SECRET_KEY) {
      logger.warn("Invalid Paystack webhook signature");
      return res.status(401).json({ message: "Invalid signature" });
    }

    const hash = crypto
      .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest("hex");

    const hashBuf = Buffer.from(hash, "hex");
    const sigBuf = Buffer.from(sigHeader, "hex");
    const signatureValid =
      hashBuf.length === sigBuf.length &&
      crypto.timingSafeEqual(hashBuf, sigBuf);

    if (!signatureValid) {
      logger.warn("Invalid Paystack webhook signature");
      return res.status(401).json({ message: "Invalid signature" });
    }

    const payload = req.body;
    logger.info("Paystack webhook received:", {
      event: payload.event,
      reference: payload.data?.reference,
      status: payload.data?.status,
    });

    // Handle successful payment
    if (payload.event === "charge.success") {
      const { reference, id, customer, amount, currency } = payload.data;

      // Extract metadata
      const metadata = payload.data.metadata || {};
      const { userId, planType, planName } = metadata;

      if (!userId || !planType || !planName) {
        logger.error("Missing metadata in Paystack webhook", { metadata });
        return res.status(400).json({ message: "Missing required metadata" });
      }

      // Find user
      const user = await User.findById(userId);
      if (!user) {
        logger.error("User not found for payment", { userId });
        return res.status(404).json({ message: "User not found" });
      }

      // Verify payment and create subscription
      try {
        const subscription = await subscriptionService.verifyPayment(
          reference,
          "paystack"
        );

        // Update user status
        if (user.status === "pending_payment") {
          user.status = "pending_verification";

          // Generate verification token and OTP
          const token = user.generateEmailVerificationToken();
          const otp = user.generateOTP();
          await user.save();

          // Send verification email
          await sendVerificationEmail(user, otp, token);

          logger.info("Payment verified and verification email sent", {
            userId: user._id,
            email: user.email,
            subscriptionId: subscription._id,
          });
        }

        return res
          .status(200)
          .json({ message: "Webhook processed successfully" });
      } catch (error) {
        logger.error("Error processing Paystack payment:", error);
        return res.status(500).json({ message: "Error processing payment" });
      }
    }

    // Handle failed payment
    if (payload.event === "charge.failed") {
      logger.info("Payment failed", { reference: payload.data.reference });
      // You can add logic here to notify the user about failed payment
    }

    res.status(200).json({ message: "Webhook received" });
  } catch (error) {
    logger.error("Paystack webhook error:", error);
    next(error);
  }
};
