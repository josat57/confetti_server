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
      billingCycle = "monthly",
      newPeriod = false,
      couponCode,
      originalAmount,
      discountAmount,
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
        billingCycle,
        isUpgrade,
        previousPlan,
        proratedAmount,
        newPeriod,
        couponCode,
        originalAmount,
        discountAmount,
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
            process.env.RENDER_EXTERNAL_URL || // set automatically on Render
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
          amount, // already in kobo
          email,
          reference,
          callback_url: `${
            process.env.PUBLIC_NGROK_URL ||
            process.env.PUBLIC_URL ||
            process.env.RENDER_EXTERNAL_URL || // set automatically on Render
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

    // Check idempotency (already processed, by this webhook or the redirect callback)
    if (payment.status === "completed") {
      logger.info(`Webhook already processed for reference: ${reference}`);
      return { message: "Webhook already processed", payment };
    }

    payment.webhookReceived = true;
    payment.webhookData = webhookData;

    const isSuccessful =
      provider === "flutterwave"
        ? webhookData.data?.status === "successful"
        : webhookData.data?.status === "success";

    if (isSuccessful) {
      await payment.save();
      await this.completeSubscriptionPayment(payment._id, { provider, data: webhookData.data });
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

    await payment.save();
    if (isSuccessful && payment.status !== "completed") {
      await this.completeSubscriptionPayment(payment._id, {
        provider: payment.paymentMethod,
        data: providerResponse.data,
      });
      return Payment.findById(payment._id);
    }

    return payment;
  }

  /**
   * Mark a subscription payment as paid and apply it, exactly once.
   * Webhooks, the redirect callback and requeries can all arrive for the same
   * payment; only the first to claim it activates the subscription.
   * `data` is the provider's transaction (amount: Flutterwave in major units,
   * Paystack in kobo). Underpaid or wrong-currency payments are rejected.
   */
  async completeSubscriptionPayment(paymentId, { provider, data = {} } = {}) {
    const payment = await Payment.findById(paymentId);
    if (!payment) throw new AppError("Payment not found", 404);
    if (payment.status === "completed") return { payment, alreadyProcessed: true };

    if (data.amount !== undefined && data.amount !== null) {
      const paidMinor =
        provider === "paystack" ? Math.round(Number(data.amount)) : Math.round(Number(data.amount) * 100);
      const currencyOk = !data.currency || data.currency === payment.currency;
      if (!currencyOk || !(paidMinor >= payment.amount)) {
        logger.error("Payment amount or currency mismatch", {
          reference: payment.reference,
          expected: payment.amount,
          paid: paidMinor,
          expectedCurrency: payment.currency,
          paidCurrency: data.currency,
        });
        await Payment.updateOne({ _id: payment._id, status: { $ne: "completed" } }, { $set: { status: "failed" } });
        throw new AppError("The amount paid doesn't match this payment", 400);
      }
    }

    const claimed = await Payment.findOneAndUpdate(
      { _id: payment._id, status: { $ne: "completed" } },
      {
        $set: {
          status: "completed",
          transactionId: String(data.id || data.transaction_id || data.flw_ref || payment.transactionId || payment.reference),
          paymentDetails: {
            customerEmail: data.customer?.email,
            customerName: data.customer?.name,
            cardLast4: data.card?.last4digits || data.authorization?.last4,
            cardBrand: data.card?.type || data.authorization?.brand,
          },
        },
      },
      { new: true }
    );
    if (!claimed) return { payment, alreadyProcessed: true };

    if (claimed.eventPass) {
      const eventPassService = (await import("./event-pass.service.js")).default;
      await eventPassService.activateFromPayment(claimed._id);
      return { payment: claimed, alreadyProcessed: false };
    }

    if (claimed.paymentType === "subscription" && claimed.subscription) {
      const subscriptionService = (await import("./subscription.service.js")).default;
      if (claimed.subscriptionDetails?.isUpgrade) {
        await subscriptionService.handleUpgradePaymentSuccess(claimed._id);
      } else {
        await subscriptionService.handlePaymentSuccess(claimed._id);
      }
    }
    return { payment: claimed, alreadyProcessed: false };
  }

  /**
   * Start a one-time checkout with the provider (event passes and other purchases).
   * `amountMinor` is in kobo/cents. Returns the provider's payment page URL.
   */
  async startProviderCheckout({ provider, amountMinor, currency, reference, email, name, redirectUrl, title, description, meta }) {
    if (provider === "flutterwave") {
      if (!process.env.FLUTTERWAVE_SECRET_KEY) throw new AppError("Flutterwave not configured", 500);
      try {
        const response = await axios.post(
          "https://api.flutterwave.com/v3/payments",
          {
            tx_ref: reference,
            amount: amountMinor / 100, // Flutterwave takes major units
            currency,
            redirect_url: redirectUrl,
            customer: { email, name: name || email },
            customizations: { title, description, logo: `${process.env.FRONTEND_URL}/logo.png` },
            meta,
          },
          { headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`, "Content-Type": "application/json" } }
        );
        if (response.data.status !== "success") throw new Error(response.data.message || "Failed to initialize payment");
        return response.data.data.link;
      } catch (error) {
        logger.error("Flutterwave checkout error", { detail: error.response?.data || error.message });
        throw new AppError(`Payment initialization failed: ${error.response?.data?.message || error.message}`, 502);
      }
    }
    if (provider === "paystack") {
      if (!process.env.PAYSTACK_SECRET_KEY) throw new AppError("Paystack not configured", 500);
      try {
        const response = await axios.post(
          "https://api.paystack.co/transaction/initialize",
          { amount: amountMinor, currency, email, reference, callback_url: redirectUrl, metadata: meta },
          { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" } }
        );
        return response.data.data.authorization_url;
      } catch (error) {
        logger.error("Paystack checkout error", { detail: error.response?.data || error.message });
        throw new AppError(`Payment initialization failed: ${error.response?.data?.message || error.message}`, 502);
      }
    }
    throw new AppError("Invalid payment provider", 400);
  }

  /** Public base URL of this API (payment redirects) */
  publicApiUrl() {
    return (
      process.env.PUBLIC_NGROK_URL ||
      process.env.PUBLIC_URL ||
      process.env.RENDER_EXTERNAL_URL ||
      "http://localhost:9600"
    );
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
