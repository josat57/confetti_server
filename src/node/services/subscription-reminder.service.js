import Subscription from "../models/subscription.model.js";
import User from "../models/user.model.js";
import { sendSubscriptionExpiringEmail } from "../utils/email.js";
import { logger } from "../utils/logger.js";

/**
 * Subscription Reminder Service
 * Task 10.4: Send subscription expiration reminders
 * Requirements: 5.4
 *
 * This service checks for subscriptions expiring in 7, 3, or 1 day(s)
 * and sends reminder emails to users
 */
class SubscriptionReminderService {
  /**
   * Check and send expiration reminders for subscriptions
   * Should be run daily via cron job
   */
  async sendExpirationReminders() {
    try {
      logger.info("Starting subscription expiration reminder check...");

      const now = new Date();
      const reminderDays = [7, 3, 1]; // Days before expiration to send reminders

      for (const days of reminderDays) {
        await this.sendRemindersForDay(days, now);
      }

      logger.info("Subscription expiration reminder check completed");
    } catch (error) {
      logger.error("Error in subscription expiration reminder service:", error);
      throw error;
    }
  }

  /**
   * Send reminders for subscriptions expiring in specific number of days
   */
  async sendRemindersForDay(daysRemaining, now) {
    try {
      // Calculate the target date (e.g., 7 days from now)
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + daysRemaining);

      // Set to start and end of day for comparison
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Find subscriptions expiring on this day
      // Only send reminders for active subscriptions with autoRenew disabled
      const expiringSubscriptions = await Subscription.find({
        status: "active",
        autoRenew: false, // Only remind users who won't auto-renew
        endDate: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
      }).populate("user", "email username firstName lastName");

      logger.info(
        `Found ${expiringSubscriptions.length} subscriptions expiring in ${daysRemaining} day(s)`
      );

      // Send reminder emails
      for (const subscription of expiringSubscriptions) {
        try {
          if (!subscription.user) {
            logger.warn(
              `Subscription ${subscription._id} has no associated user`
            );
            continue;
          }

          await sendSubscriptionExpiringEmail(
            subscription.user,
            subscription,
            daysRemaining
          );

          logger.info(
            `Sent ${daysRemaining}-day expiration reminder to ${subscription.user.email}`
          );
        } catch (emailError) {
          logger.error(
            `Failed to send expiration reminder to ${subscription.user?.email}:`,
            emailError
          );
          // Continue with other subscriptions even if one fails
        }
      }

      return expiringSubscriptions.length;
    } catch (error) {
      logger.error(
        `Error sending reminders for ${daysRemaining} day(s):`,
        error
      );
      throw error;
    }
  }

  /**
   * Send immediate reminder for a specific subscription
   * Useful for manual triggers or testing
   */
  async sendImmediateReminder(subscriptionId) {
    try {
      const subscription = await Subscription.findById(subscriptionId).populate(
        "user",
        "email username firstName lastName"
      );

      if (!subscription) {
        throw new Error("Subscription not found");
      }

      if (!subscription.user) {
        throw new Error("Subscription has no associated user");
      }

      // Calculate days remaining
      const now = new Date();
      const daysRemaining = Math.ceil(
        (subscription.endDate - now) / (1000 * 60 * 60 * 24)
      );

      if (daysRemaining <= 0) {
        throw new Error("Subscription has already expired");
      }

      await sendSubscriptionExpiringEmail(
        subscription.user,
        subscription,
        daysRemaining
      );

      logger.info(
        `Sent immediate expiration reminder to ${subscription.user.email}`
      );

      return {
        success: true,
        message: "Reminder sent successfully",
        daysRemaining,
      };
    } catch (error) {
      logger.error("Error sending immediate reminder:", error);
      throw error;
    }
  }

  /**
   * Get subscriptions that need reminders
   * Useful for monitoring and testing
   */
  async getSubscriptionsNeedingReminders() {
    try {
      const now = new Date();
      const reminderDays = [7, 3, 1];
      const results = {};

      for (const days of reminderDays) {
        const targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() + days);

        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);

        const subscriptions = await Subscription.find({
          status: "active",
          autoRenew: false,
          endDate: {
            $gte: startOfDay,
            $lte: endOfDay,
          },
        })
          .populate("user", "email username firstName lastName")
          .select("planType planName amount endDate user");

        results[`${days}Days`] = subscriptions;
      }

      return results;
    } catch (error) {
      logger.error("Error getting subscriptions needing reminders:", error);
      throw error;
    }
  }
}

export default new SubscriptionReminderService();
