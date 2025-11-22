import axios from "axios";
import { AppError } from "../utils/AppError.js";
import User from "../models/user.model.js";

class PaymentMethodService {
  /**
   * Tokenize card with Flutterwave
   * This creates a reusable card token for future charges
   */
  async tokenizeCard(cardDetails, userId) {
    if (!process.env.FLUTTERWAVE_SECRET_KEY) {
      throw new AppError("Flutterwave not configured", 500);
    }

    const { cardNumber, cvv, expiryMonth, expiryYear, email, fullName } =
      cardDetails;

    try {
      // Step 1: Charge the card with a small amount (100 NGN) to tokenize it
      const chargePayload = {
        card_number: cardNumber,
        cvv: cvv,
        expiry_month: expiryMonth,
        expiry_year: expiryYear,
        currency: "NGN",
        amount: "100", // Small amount for tokenization
        email: email,
        fullname: fullName,
        tx_ref: `TOKENIZE-${Date.now()}-${userId}`,
        redirect_url: `${process.env.FRONTEND_URL}/settings/payment-methods`,
        authorization: {
          mode: "pin",
          pin: cardDetails.pin, // Optional: if card requires PIN
        },
      };

      const response = await axios.post(
        "https://api.flutterwave.com/v3/charges?type=card",
        chargePayload,
        {
          headers: {
            Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.status === "success") {
        const data = response.data.data;

        // Extract card token and details
        return {
          token: data.card?.token || data.authorization?.authorization_code,
          last4: data.card?.last_4digits || cardNumber.slice(-4),
          brand: data.card?.type || "card",
          expiryMonth: expiryMonth,
          expiryYear: expiryYear,
          email: email,
          customerId: data.customer?.id,
        };
      } else {
        throw new AppError(
          response.data.message || "Card tokenization failed",
          400
        );
      }
    } catch (error) {
      console.error(
        "Flutterwave tokenization error:",
        error.response?.data || error.message
      );
      throw new AppError(
        error.response?.data?.message ||
          error.message ||
          "Failed to add payment method",
        400
      );
    }
  }

  /**
   * Get saved cards from Flutterwave
   */
  async getSavedCards(email) {
    if (!process.env.FLUTTERWAVE_SECRET_KEY) {
      throw new AppError("Flutterwave not configured", 500);
    }

    try {
      // Flutterwave doesn't have a direct API to list saved cards
      // Cards are saved per transaction and can be retrieved via customer email
      // For now, we'll rely on our database storage
      return [];
    } catch (error) {
      console.error("Error fetching saved cards:", error.message);
      return [];
    }
  }

  /**
   * Charge a saved card
   */
  async chargeCard(token, amount, currency, email, txRef) {
    if (!process.env.FLUTTERWAVE_SECRET_KEY) {
      throw new AppError("Flutterwave not configured", 500);
    }

    try {
      const payload = {
        token: token,
        currency: currency,
        amount: amount,
        email: email,
        tx_ref: txRef,
      };

      const response = await axios.post(
        "https://api.flutterwave.com/v3/tokenized-charges",
        payload,
        {
          headers: {
            Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.status === "success") {
        return response.data.data;
      } else {
        throw new AppError(response.data.message || "Card charge failed", 400);
      }
    } catch (error) {
      console.error(
        "Flutterwave charge error:",
        error.response?.data || error.message
      );
      throw new AppError(
        error.response?.data?.message || "Failed to charge card",
        400
      );
    }
  }

  /**
   * Add payment method to user
   */
  async addPaymentMethodToUser(userId, paymentMethodData) {
    const user = await User.findById(userId);

    if (!user) {
      throw new AppError("User not found", 404);
    }

    // If this is set as default, unset other defaults
    if (paymentMethodData.isDefault) {
      user.paymentMethods.forEach((pm) => {
        pm.isDefault = false;
      });
    }

    // Add new payment method
    user.paymentMethods.push({
      type: paymentMethodData.type || "card",
      provider: "flutterwave",
      last4: paymentMethodData.last4,
      brand: paymentMethodData.brand,
      expiryMonth: paymentMethodData.expiryMonth,
      expiryYear: paymentMethodData.expiryYear,
      providerCustomerId: paymentMethodData.customerId,
      providerPaymentMethodId: paymentMethodData.token,
      isDefault:
        paymentMethodData.isDefault || user.paymentMethods.length === 0,
    });

    await user.save();

    return user.paymentMethods[user.paymentMethods.length - 1];
  }

  /**
   * Initialize payment method setup (for 3D Secure cards)
   */
  async initializePaymentMethodSetup(userId, email) {
    if (!process.env.FLUTTERWAVE_SECRET_KEY) {
      throw new AppError("Flutterwave not configured", 500);
    }

    try {
      // Generate a unique reference for this setup
      const reference = `SETUP-${Date.now()}-${userId}`;

      // Create a payment link for card setup (100 NGN tokenization charge)
      const payload = {
        tx_ref: reference,
        amount: 100, // 100 NGN for tokenization
        currency: "NGN",
        redirect_url: `${process.env.FRONTEND_URL}/settings/payment-methods/verify?reference=${reference}`,
        customer: {
          email: email,
        },
        customizations: {
          title: "Add Payment Method",
          description: "Verify your card to add it as a payment method",
          logo: `${process.env.FRONTEND_URL}/logo.png`,
        },
        meta: {
          userId: userId,
          purpose: "payment_method_setup",
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
        return {
          paymentUrl: response.data.data.link,
          reference: reference,
        };
      } else {
        throw new AppError(
          response.data.message || "Failed to initialize payment method setup",
          500
        );
      }
    } catch (error) {
      console.error(
        "Payment method setup error:",
        error.response?.data || error.message
      );
      throw new AppError(
        error.response?.data?.message ||
          "Failed to initialize payment method setup",
        500
      );
    }
  }

  /**
   * Verify payment method setup
   */
  async verifyPaymentMethodSetup(reference, userId) {
    if (!process.env.FLUTTERWAVE_SECRET_KEY) {
      throw new AppError("Flutterwave not configured", 500);
    }

    try {
      // Verify the transaction
      const response = await axios.get(
        `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${reference}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
          },
        }
      );

      if (
        response.data.status === "success" &&
        response.data.data.status === "successful"
      ) {
        const data = response.data.data;

        // Extract card details
        const paymentMethodData = {
          type: "card",
          last4: data.card.last_4digits,
          brand: data.card.type,
          expiryMonth: data.card.expiry.split("/")[0],
          expiryYear: data.card.expiry.split("/")[1],
          customerId: data.customer.id,
          token: data.card.token,
          isDefault: false,
        };

        // Add to user's payment methods
        const paymentMethod = await this.addPaymentMethodToUser(
          userId,
          paymentMethodData
        );

        return paymentMethod;
      } else {
        throw new AppError("Payment verification failed", 400);
      }
    } catch (error) {
      console.error(
        "Payment method verification error:",
        error.response?.data || error.message
      );
      throw new AppError(
        error.response?.data?.message || "Failed to verify payment method",
        400
      );
    }
  }
}

export default new PaymentMethodService();
