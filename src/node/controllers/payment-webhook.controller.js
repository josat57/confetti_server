import crypto from "crypto";
import subscriptionService from "../services/subscription.service.js";
import User from "../models/user.model.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";
import { sendVerificationEmail } from "../utils/email.js";

/**
 * Payout transfer results (reference PAYOUT-…). Returns true when handled.
 */
const handleTransferWebhook = async (provider, payload, res) => {
  const data = payload.data || {};
  let succeeded;
  if (provider === "paystack" && /^transfer\./.test(payload.event || "")) {
    succeeded = payload.event === "transfer.success";
  } else if (provider === "flutterwave" && payload.event === "transfer.completed") {
    succeeded = String(data.status).toUpperCase() === "SUCCESSFUL";
  } else {
    return false;
  }
  try {
    const escrowService = (await import("../services/escrow.service.js")).default;
    await escrowService.handleTransferEvent({
      reference: data.reference,
      succeeded,
      failureReason: data.complete_message || data.reason || payload.event,
    });
    res.status(200).json({ message: "Webhook processed successfully" });
  } catch (error) {
    logger.error("Transfer webhook failed", { reference: data.reference, error: error.message });
    res.status(500).json({ message: error.message });
  }
  return true;
};

/**
 * Webhooks for event pass and escrow payments (references PASS-… / ESC-…). Returns true when handled.
 * The signature is already verified; completion still checks amount and currency.
 */
const handlePassWebhook = async (provider, payload, succeeded, res) => {
  const reference = provider === "flutterwave" ? payload.data?.tx_ref : payload.data?.reference;
  if (!reference || !/^(PASS|ESC)-/.test(String(reference))) return false;
  try {
    const Payment = (await import("../models/payment.model.js")).default;
    const payment = await Payment.findOne({ reference });
    if (!payment?.eventPass && !payment?.escrowPayment) {
      res.status(404).json({ message: "Payment not found" });
      return true;
    }
    if (succeeded) {
      const paymentService = (await import("../services/payment.service.js")).default;
      await paymentService.completeSubscriptionPayment(payment._id, { provider, data: payload.data });
    } else if (payment.status === "pending" && /failed/i.test(payload.data?.status || "")) {
      payment.status = "failed";
      await payment.save();
    }
    res.status(200).json({ message: "Webhook processed successfully" });
  } catch (error) {
    logger.error("Event pass webhook failed", { reference, error: error.message });
    res.status(error.statusCode && error.statusCode < 500 ? 200 : 500).json({ message: error.message });
  }
  return true;
};

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

    // Payout transfers, then event pass and escrow payments (completed from their Payment record)
    if (await handleTransferWebhook("flutterwave", payload, res)) return;
    if (await handlePassWebhook("flutterwave", payload, payload.event === "charge.completed" && payload.data?.status === "successful", res)) return;

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

        // Activation normally moves the user on and sends the verification email;
        // re-read so we don't send a second one with a different token
        const current = await User.findById(user._id);
        if (current?.status === "pending_payment") {
          const user = current;
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

    // Payout transfers, then event pass and escrow payments (completed from their Payment record)
    if (await handleTransferWebhook("paystack", payload, res)) return;
    if (await handlePassWebhook("paystack", payload, payload.event === "charge.success", res)) return;

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

        // Activation normally moves the user on and sends the verification email;
        // re-read so we don't send a second one with a different token
        const current = await User.findById(user._id);
        if (current?.status === "pending_payment") {
          const user = current;
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
