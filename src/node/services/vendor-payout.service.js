import Vendor from "../models/vendor.model.js";
import User from "../models/user.model.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";
import { decryptSecret, encryptSecret } from "../utils/secret-crypto.js";
import { getActivePlan } from "./plan-access.service.js";
import { createRecipient, createSubaccount, listBanks, resolveAccount } from "./payout-provider.service.js";

/**
 * Vendor payout accounts (where escrow payouts go).
 * The account is checked with Paystack, a transfer recipient is created at once,
 * and a split subaccount is created when the vendor is verified. The full account
 * number is kept only encrypted (for creating the subaccount); responses show the last 4.
 */

const shape = (account) =>
  account?.accountLast4
    ? {
        bankCode: account.bankCode,
        bankName: account.bankName,
        accountLast4: account.accountLast4,
        accountName: account.accountName,
        verified: !!account.verifiedAt,
        payoutsReady: !!account.recipientCode,
        subaccount: !!account.subaccountCode,
      }
    : null;

export const getPayoutAccount = async (user) => {
  const vendor = await Vendor.findOne({ owner: user._id }).select("payoutAccount");
  if (!vendor) throw new AppError("Vendor profile not found", 404);
  return shape(vendor.payoutAccount);
};

export const savePayoutAccount = async (user, { bankCode, accountNumber }) => {
  if (typeof bankCode !== "string" || !bankCode.trim()) throw new AppError("Choose your bank", 400);
  if (!/^\d{10}$/.test(String(accountNumber || ""))) throw new AppError("Enter your 10-digit account number", 400);
  const vendor = await Vendor.findOne({ owner: user._id }).select("+payoutAccount.accountNumberEnc");
  if (!vendor) throw new AppError("Vendor profile not found", 404);

  const banks = await listBanks();
  const bank = banks.find((b) => b.code === bankCode);
  if (!bank) throw new AppError("Unknown bank", 400);
  const { accountName } = await resolveAccount(accountNumber, bankCode);
  if (!accountName) throw new AppError("We couldn't find that account. Check the number and bank.", 400);
  const recipientCode = await createRecipient({ name: accountName, accountNumber, bankCode });

  vendor.payoutAccount = {
    bankCode,
    bankName: bank.name,
    accountLast4: String(accountNumber).slice(-4),
    accountName,
    currency: "NGN",
    recipientCode,
    accountNumberEnc: encryptSecret(String(accountNumber)),
    verifiedAt: new Date(),
    updatedAt: new Date(),
  };
  // Only the payout fields changed; older profiles may lack other required fields
  await vendor.save({ validateModifiedOnly: true });
  if (vendor.isVerified) await ensureSubaccount(vendor._id);
  return getPayoutAccount(user);
};

/** Create the split subaccount for a verified vendor with a payout account (idempotent) */
export const ensureSubaccount = async (vendorId) => {
  try {
    const vendor = await Vendor.findById(vendorId).select("+payoutAccount.accountNumberEnc");
    const account = vendor?.payoutAccount;
    if (!vendor?.isVerified || !account?.accountNumberEnc || account.subaccountCode) return null;
    const owner = await User.findById(vendor.owner).select("role");
    const { plan } = owner ? await getActivePlan(owner) : { plan: null };
    const subaccountCode = await createSubaccount({
      businessName: vendor.businessName || vendor.name,
      accountNumber: decryptSecret(account.accountNumberEnc),
      bankCode: account.bankCode,
      commissionPercent: Math.round((plan?.commissionRate ?? 0.05) * 100),
    });
    await Vendor.updateOne({ _id: vendor._id }, { $set: { "payoutAccount.subaccountCode": subaccountCode } });
    return subaccountCode;
  } catch (error) {
    logger.warn("Subaccount creation failed", { vendor: vendorId, error: error.message });
    return null;
  }
};
