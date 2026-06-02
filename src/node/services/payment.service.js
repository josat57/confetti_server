import Payment from "../models/payment.model.js";
import User from "../models/user.model.js";
import { AppError } from "../utils/AppError.js";
import Flutterwave from "flutterwave-node-v3";
import crypto from "crypto";
import axios from "axios";
import { logger } from "../utils/logger.js";

// Initialize Flutterwave
let flutterwave;
try {
  if (
    process.env.FLUTTERWAVE_PUBLIC_KEY &&
    process.env.FLUTTERWAVE_SECRET_KEY
  ) {
    flutterwave = new Flutterwave(
      process.env.FLUTTERWAVE_PUBLIC_KEY,
      process.env.FLUTTERWAVE_SECRET_KEY
    );
  } else {
    logger.warn(
      "Flutterwave keys not configured, payment functionality will be limited"
    );
  }
} catch (error) {
  logger.error("Failed to initialize Flutterwave:", { message: error.message });
  flutterwave = null;
}

class PaymentService {
  /**
   * Task 4.1: Initialize payment for subscription
   * Generate unique payment reference, create payment record, initialize with provider
   */
  async initializePayment(data) {
    const {
      userId,
      subscriptionId,
      amount,
      currency = "NGN",
      planType,
      planName,
      email,
      name,
      paymentProvider = "flutterwave",
      isUpgrade = false,
      previousPlan,
      proratedAmount,
    } = data;

    // Generate unique reference
    const reference = `SUB-${Date.now()}-${userId}`;

    // Create payment record with subscription details
    const payment = await Payment.create({
      user: userId,
      subscription: subscriptionId,
      paymentType: "subscription",
      amount,
      currency,
      status: "pending",
      paymentMethod: paymentProvider,
      reference,
      transactionId: reference, // Will be updated after payment
      subscriptionDetails: {
        planType,
        planName,
        billingCycle: "monthly",
        isUpgrade,
        previousPlan,
        proratedAmount,
      },
    });

    // Initialize payment with Flutterwave or Paystack
    let paymentUrl;

    if (paymentProvider === "flutterwave") {
      if (!process.env.FLUTTERWAVE_SECRET_KEY) {
        throw new AppError("Flutterwave not configured", 500);
      }

      try {
        // Use Flutterwave REST API directly for payment initialization
        // Note: Flutterwave expects amount in major units (naira, dollars) not minor units (kobo, cents)
        // Convert from minor units to major units
        const amountInMajorUnits =
          currency === "NGN" ? amount / 100 : amount / 100;

        const payload = {
          tx_ref: reference,
          amount: amountInMajorUnits,
          currency: currency,
          redirect_url: `${
            process.env.PUBLIC_NGROK_URL ||
            process.env.PUBLIC_URL ||
            "http://localhost:9600"
          }/api/v1/subscriptions/payment-callback`,
          customer: {
            email: email,
            name: name || email,
          },
          customizations: {
            title: `Confetti ${planType} Subscription`,
            description: `${planName} Plan ${
              isUpgrade ? "Upgrade" : "Subscription"
            }`,
            logo: `${process.env.FRONTEND_URL}/logo.png`,
          },
          meta: {
            userId: userId,
            subscriptionId: subscriptionId,
            paymentId: payment._id.toString(),
            planType: planType,
            planName: planName,
          },
        };

        const response = await axios.post(
          "https://api.flutterwave.com/v3/payments",
          payload,
          {
            headers: {
              Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (response.data.status === "success") {
          paymentUrl = response.data.data.link;
        } else {
          throw new AppError(
            response.data.message || "Failed to initialize payment",
            500
          );
        }
      } catch (error) {
        logger.error("Flutterwave initialization error", {
          detail: error.response?.data || error.message,
        });
        throw new AppError(
          `Payment initialization failed: ${
            error.response?.data?.message || error.message
          }`,
          500
        );
      }
    } else if (paymentProvider === "paystack") {
      if (!process.env.PAYSTACK_SECRET_KEY) {
        throw new AppError("Paystack not configured", 500);
      }

      const response = await axios.post(
        "https://api.paystack.co/transaction/initialize",
        {
          amount: amount * 100, // Convert to kobo
          email,
          reference,
          callback_url: `${
            process.env.PUBLIC_NGROK_URL ||
            process.env.PUBLIC_URL ||
            "http://localhost:9600"
          }/api/v1/subscriptions/payment-callback`,
          metadata: {
            userId,
            subscriptionId,
            paymentId: payment._id.toString(),
            planType,
            planName,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      paymentUrl = response.data.data.authorization_url;
    } else {
      throw new AppError("Invalid payment provider", 400);
    }

    // Return payment URL and reference
    return {
      paymentUrl,
      reference,
      amount,
      paymentId: payment._id,
    };
  }

  /**
   * Task 4.2: Handle webhook from payment provider
   * Verify signature, extract reference, update payment, activate subscription
   */
  async handleWebhook(provider, webhookData, signature) {
    // Verify webhook signature
    const isValid = this.verifyWebhookSignature(
      provider,
      webhookData,
      signature
    );
    if (!isValid) {
      logger.warn(`Invalid webhook signature from ${provider}`);
      throw new AppError("Invalid webhook signature", 401);
    }

    // Extract payment reference
    const reference =
      provider === "flutterwave"
        ? webhookData.data?.tx_ref
        : webhookData.data?.reference;

    if (!reference) {
      throw new AppError("Payment reference not found in webhook", 400);
    }

    // Find payment record
    const payment = await Payment.findOne({ reference });
    if (!payment) {
      logger.warn(`Payment not found for reference: ${reference}`);
      throw new AppError("Payment not found", 404);
    }

    // Check idempotency (already processed)
    if (payment.webhookReceived && payment.status === "completed") {
      logger.info(`Webhook already processed for reference: ${reference}`);
      return { message: "Webhook already processed", payment };
    }

    // Update payment with webhook data
    payment.webhookReceived = true;
    payment.webhookData = webhookData;
    payment.transactionId =
      webhookData.data?.id ||
      webhookData.data?.transaction_id ||
      webhookData.data?.flw_ref ||
      reference;

    // Check payment status
    const isSuccessful =
      provider === "flutterwave"
        ? webhookData.data?.status === "successful"
        : webhookData.data?.status === "success";

    if (isSuccessful) {
      // Update payment status to completed
      payment.status = "completed";
      payment.paymentDetails = {
        customerEmail: webhookData.data?.customer?.email,
        customerName: webhookData.data?.customer?.name,
        cardLast4:
          webhookData.data?.card?.last4digits ||
          webhookData.data?.authorization?.last4,
        cardBrand:
          webhookData.data?.card?.type ||
          webhookData.data?.authorization?.brand,
      };
      await payment.save();

      // Call subscription service to activate or upgrade
      const subscriptionService = (await import("./subscription.service.js"))
        .default;

      if (payment.subscriptionDetails?.isUpgrade) {
        await subscriptionService.handleUpgradePaymentSuccess(payment._id);
      } else {
        await subscriptionService.handlePaymentSuccess(payment._id);
      }
    } else {
      // Payment failed
      payment.status = "failed";
      await payment.save();

      // Send failure notification
      const user = await User.findById(payment.user);
      if (user) {
        const { sendPaymentFailedEmail } = await import("../utils/email.js");
        await sendPaymentFailedEmail(user, payment);
      }
    }

    return { message: "Webhook processed successfully", payment };
  }

  /**
   * Task 4.3: Verify webhook signature
   * Use constant-time comparison to prevent timing attacks
   */
  verifyWebhookSignature(provider, data, signature) {
    try {
      if (provider === "flutterwave") {
        const secretHash = process.env.FLUTTERWAVE_WEBHOOK_SECRET;
        if (!secretHash) {
          logger.error("Flutterwave webhook secret not configured");
          return false;
        }

        // Flutterwave sends the secret hash directly in the header
        // Check if lengths match first (required for timingSafeEqual)
        if (signature.length !== secretHash.length) {
          return false;
        }

        // Use constant-time comparison
        return crypto.timingSafeEqual(
          Buffer.from(signature),
          Buffer.from(secretHash)
        );
      } else if (provider === "paystack") {
        const secretKey = process.env.PAYSTACK_SECRET_KEY;
        if (!secretKey) {
          logger.error("Paystack secret key not configured");
          return false;
        }

        // Paystack uses HMAC SHA512
        const hash = crypto
          .createHmac("sha512", secretKey)
          .update(JSON.stringify(data))
          .digest("hex");

        // Check if lengths match first (required for timingSafeEqual)
        if (signature.length !== hash.length) {
          return false;
        }

        // Use constant-time comparison
        return crypto.timingSafeEqual(
          Buffer.from(hash),
          Buffer.from(signature)
        );
      }

      logger.error(`Unknown payment provider: ${provider}`);
      return false;
    } catch (error) {
      logger.error(`Webhook signature verification failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Task 4.4: Requery payment status
   * Check payment status with provider API, update payment, activate subscription
   */
  async requeryPayment(reference) {
    // Find payment by reference
    const payment = await Payment.findOne({ reference });
    if (!payment) {
      throw new AppError("Payment not found", 404);
    }

    // Check requery attempt limits (max 3)
    if (payment.requeryAttempts >= 3) {
      throw new AppError("Maximum requery attempts reached", 429);
    }

    // Query payment provider API
    let providerResponse;
    try {
      if (payment.paymentMethod === "flutterwave") {
        if (!flutterwave) {
          throw new AppError("Flutterwave not configured", 500);
        }

        // Use transaction ID if available, otherwise use reference
        const transactionId = payment.transactionId || reference;
        providerResponse = await flutterwave.Transaction.verify({
          id: transactionId,
        });
      } else if (payment.paymentMethod === "paystack") {
        if (!process.env.PAYSTACK_SECRET_KEY) {
          throw new AppError("Paystack not configured", 500);
        }

        const response = await axios.get(
          `https://api.paystack.co/transaction/verify/${reference}`,
          {
            headers: {
              Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            },
          }
        );

        providerResponse = response.data;
      } else {
        throw new AppError("Invalid payment provider", 400);
      }
    } catch (error) {
      logger.error(`Payment requery failed: ${error.message}`);
      // Track requery attempts and timestamp even on failure
      payment.requeryAttempts += 1;
      payment.lastRequeryAt = new Date();
      await payment.save();
      throw new AppError("Payment verification failed", 500);
    }

    // Update requery tracking
    payment.requeryAttempts += 1;
    payment.lastRequeryAt = new Date();

    // Check payment status
    const isSuccessful =
      providerResponse.data?.status === "successful" ||
      providerResponse.data?.status === "success";

    // Update payment status if successful
    if (isSuccessful && payment.status !== "completed") {
      payment.status = "completed";
      payment.transactionId =
        providerResponse.data?.id ||
        providerResponse.data?.transaction_id ||
        providerResponse.data?.flw_ref ||
        reference;
      payment.paymentDetails = {
        customerEmail: providerResponse.data?.customer?.email,
        customerName: providerResponse.data?.customer?.name,
        cardLast4:
          providerResponse.data?.card?.last4digits ||
          providerResponse.data?.authorization?.last4,
        cardBrand:
          providerResponse.data?.card?.type ||
          providerResponse.data?.authorization?.brand,
      };
      await payment.save();

      // Call subscription service to activate
      const subscriptionService = (await import("./subscription.service.js"))
        .default;

      if (payment.subscriptionDetails?.isUpgrade) {
        await subscriptionService.handleUpgradePaymentSuccess(payment._id);
      } else {
        await subscriptionService.handlePaymentSuccess(payment._id);
      }
    } else {
      await payment.save();
    }

    return payment;
  }

  async createPayment(paymentData) {
    const payment = new Payment(paymentData);
    await payment.save();
    return payment;
  }

  async getPaymentById(id) {
    const payment = await Payment.findById(id);
    if (!payment) {
      throw new AppError("Payment not found", 404);
    }
    return payment;
  }

  async updatePayment(id, updateData) {
    const payment = await Payment.findByIdAndUpdate(id, updateData, {
      new: true,
    });
    if (!payment) {
      throw new AppError("Payment not found", 404);
    }
    return payment;
  }

  async listPayments(filter = {}) {
    return await Payment.find(filter);
  }

  async convertToNGN(id, rate) {
    const payment = await this.getPaymentById(id);
    payment.convertToNGN(rate);
    await payment.save();
    return payment;
  }
}

export default new PaymentService();
