import User from "../models/user.model.js";
import Subscription from "../models/subscription.model.js";
import RefreshToken from "../models/refreshToken.model.js";
import { logger } from "../utils/logger.js";

export const ACCOUNT_RETENTION_DAYS = 30;

/**
 * Close a user's account (self-service delete/disable):
 * deactivate, cancel open subscriptions, remove stored cards, revoke every
 * session and confirm by email. Personal data is purged after
 * ACCOUNT_RETENTION_DAYS by purgeClosedAccounts().
 */
export const closeUserAccount = async (user, reason) => {
  const now = new Date();
  user.isActive = false;
  user.deletedAt = now;
  user.accountDisabledReason = reason || "User requested account closure";
  user.paymentMethods = [];
  await user.save();

  const [subs, tokens] = await Promise.all([
    Subscription.updateMany(
      { user: user._id, status: { $in: ["active", "trial", "pending_payment"] } },
      { $set: { status: "cancelled", autoRenew: false } }
    ),
    RefreshToken.deleteMany({ user: user._id }),
  ]);

  try {
    const { sendEmailDirect } = await import("../utils/email.js");
    const purgeDate = new Date(now.getTime() + ACCOUNT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    await sendEmailDirect({
      to: user.email,
      subject: "Your Confetti account has been closed",
      text:
        `Your account was closed on ${now.toDateString()}. Active subscriptions were cancelled and saved cards removed. ` +
        `Your data will be permanently deleted on ${purgeDate.toDateString()}. Contact support before then to reactivate.`,
      html:
        `<p>Your account was closed on <strong>${now.toDateString()}</strong>. Active subscriptions were cancelled and saved cards removed.</p>` +
        `<p>Your data will be permanently deleted on <strong>${purgeDate.toDateString()}</strong>. Contact support before then if you want to reactivate your account.</p>`,
    });
  } catch (error) {
    logger.warn("Account closure email failed", { userId: String(user._id), error: error.message });
  }

  logger.info("Account closed", {
    userId: String(user._id),
    subscriptionsCancelled: subs.modifiedCount,
    sessionsRevoked: tokens.deletedCount,
  });
  return { subscriptionsCancelled: subs.modifiedCount, sessionsRevoked: tokens.deletedCount };
};

/**
 * Anonymise accounts closed more than ACCOUNT_RETENTION_DAYS ago.
 * Returns the number of accounts purged.
 */
export const purgeClosedAccounts = async () => {
  const cutoff = new Date(Date.now() - ACCOUNT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const users = await User.find({ deletedAt: { $lte: cutoff }, isActive: false, status: { $ne: "deleted" } })
    .select("_id")
    .lean();
  let purged = 0;
  for (const { _id } of users) {
    const res = await User.collection.updateOne(
      { _id, isActive: false, status: { $ne: "deleted" } },
      {
        $set: {
          status: "deleted",
          email: `deleted_${_id}@deleted.com`,
          firstName: "Deleted",
          lastName: "User",
          anonymizedAt: new Date(),
        },
        $unset: { phone: "", address: "", paymentMethods: "", username: "", profilePicture: "", avatar: "", bio: "" },
      }
    );
    purged += res.modifiedCount;
  }
  if (purged) logger.info(`Purged ${purged} closed account(s) past the ${ACCOUNT_RETENTION_DAYS}-day retention period`);
  return purged;
};
