import axios from "axios";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";

/**
 * Bank accounts, transfers and refunds with the payment providers.
 * Payouts use Paystack Transfers when ESCROW_PAYOUTS=paystack (Transfers must be
 * enabled on the Paystack account); otherwise payouts are made by hand and marked
 * paid by an admin.
 */

const paystack = async (method, path, data) => {
  if (!process.env.PAYSTACK_SECRET_KEY) throw new AppError("Paystack isn't configured", 503);
  try {
    const response = await axios.request({
      method,
      url: `https://api.paystack.co${path}`,
      data,
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
      timeout: 30000,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    logger.warn("Paystack request failed", { path, message });
    throw new AppError(message, error.response?.status && error.response.status < 500 ? 400 : 502);
  }
};

export const automaticPayouts = () => process.env.ESCROW_PAYOUTS === "paystack" && !!process.env.PAYSTACK_SECRET_KEY;

/** Nigerian banks (name, code) */
export const listBanks = async () => {
  const res = await paystack("get", "/bank?country=nigeria&perPage=200");
  return (res.data || [])
    .filter((b) => b.active !== false)
    .map((b) => ({ name: b.name, code: b.code }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

/** The account holder's name for a bank account (checks it exists) */
export const resolveAccount = async (accountNumber, bankCode) => {
  const res = await paystack(
    "get",
    `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`
  );
  return { accountName: res.data?.account_name, accountNumber: res.data?.account_number };
};

/** Transfer recipient for payouts */
export const createRecipient = async ({ name, accountNumber, bankCode, currency = "NGN" }) => {
  const res = await paystack("post", "/transferrecipient", {
    type: "nuban",
    name,
    account_number: accountNumber,
    bank_code: bankCode,
    currency,
  });
  return res.data?.recipient_code;
};

/** Split-payment subaccount (Paystack settles the vendor's share directly) */
export const createSubaccount = async ({ businessName, accountNumber, bankCode, commissionPercent }) => {
  const res = await paystack("post", "/subaccount", {
    business_name: businessName,
    settlement_bank: bankCode,
    account_number: accountNumber,
    percentage_charge: commissionPercent,
  });
  return res.data?.subaccount_code;
};

/** Send money to a vendor's recipient. Returns { status, transferCode } */
export const transfer = async ({ amountMinor, recipientCode, reference, reason }) => {
  const res = await paystack("post", "/transfer", {
    source: "balance",
    amount: amountMinor,
    recipient: recipientCode,
    reference,
    reason,
  });
  return { status: res.data?.status, transferCode: res.data?.transfer_code };
};

/** Refund all or part of a payment through the provider that took it */
export const refundPayment = async ({ provider, reference, transactionId, amountMinor }) => {
  if (provider === "paystack") {
    const res = await paystack("post", "/refund", { transaction: reference, amount: amountMinor });
    return { status: res.data?.status, reference: String(res.data?.id || "") };
  }
  if (provider === "flutterwave") {
    if (!process.env.FLUTTERWAVE_SECRET_KEY) throw new AppError("Flutterwave isn't configured", 503);
    try {
      const response = await axios.post(
        `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(transactionId)}/refund`,
        { amount: amountMinor / 100 },
        { headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` }, timeout: 30000 }
      );
      return { status: response.data?.data?.status, reference: String(response.data?.data?.id || "") };
    } catch (error) {
      throw new AppError(error.response?.data?.message || error.message, 502);
    }
  }
  throw new AppError("Unknown payment provider", 400);
};
