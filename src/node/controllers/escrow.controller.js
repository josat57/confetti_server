import escrowService from "../services/escrow.service.js";
import EscrowPayment from "../models/escrow-payment.model.js";
import User from "../models/user.model.js";
import { listBanks } from "../services/payout-provider.service.js";
import { getPayoutAccount, savePayoutAccount } from "../services/vendor-payout.service.js";

const frontendUrl = () => process.env.FRONTEND_URL || "http://localhost:3000";
const ok = (res, data, status = 200) => res.status(status).json({ status: "success", data });
const wrap = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (error) {
    next(error);
  }
};

// ---- Clients (and planners) paying for bookings: /api/v1/escrow ----

export const getBanks = wrap(async (req, res) => ok(res, { banks: await listBanks() }));

export const startEscrowCheckout = wrap(async (req, res) => {
  const { bookingId, amount, paymentProvider } = req.body || {};
  ok(res, await escrowService.checkout(req.user, { bookingId, amount, paymentProvider }));
});

export const getBookingPayments = wrap(async (req, res) => ok(res, await escrowService.listForBooking(req.user, req.params.bookingId)));

export const confirmDelivery = wrap(async (req, res) =>
  ok(res, { payment: escrowService.shape(await escrowService.confirmDelivery(req.user, req.params.id)) })
);

export const openDispute = wrap(async (req, res) =>
  ok(res, { payment: escrowService.shape(await escrowService.openDispute(req.user, req.params.id, req.body?.reason)) })
);

/** Payment provider redirect back (no login) → the booking page */
export const escrowPaymentCallback = async (req, res) => {
  const { status, transaction_id, reference, trxref, tx_ref } = req.query;
  const ref = tx_ref || reference || trxref || "";
  const escrow = ref ? await EscrowPayment.findOne({ reference: ref }).select("booking client").lean().catch(() => null) : null;
  const client = escrow ? await User.findById(escrow.client).select("role").lean().catch(() => null) : null;
  const target =
    client?.role === "event-planner"
      ? `${frontendUrl()}/planner/dashboard/bookings`
      : `${frontendUrl()}/user/dashboard/bookings/${escrow?.booking || ""}`;
  const back = (outcome, message) =>
    res.redirect(`${target}?payment=${outcome}${message ? `&message=${encodeURIComponent(message)}` : ""}`);

  try {
    if (status === "cancelled" || status === "canceled") return back("cancelled");
    const isFlutterwave = !!transaction_id;
    if (isFlutterwave && !["successful", "success", "completed"].includes(status)) return back("failed");
    const id = transaction_id || reference || trxref;
    if (!id) return back("failed");
    await escrowService.verifyAndComplete(id, isFlutterwave ? "flutterwave" : "paystack");
    return back("success");
  } catch (error) {
    return back("failed", error.message);
  }
};

// ---- Vendors: /api/v1/vendors/payouts ----

export const getVendorPayouts = wrap(async (req, res) => ok(res, await escrowService.vendorSummary(req.user)));
export const getVendorPayoutAccount = wrap(async (req, res) => ok(res, { account: await getPayoutAccount(req.user) }));
export const updateVendorPayoutAccount = wrap(async (req, res) => {
  const { bankCode, accountNumber } = req.body || {};
  ok(res, { account: await savePayoutAccount(req.user, { bankCode, accountNumber }) });
});

// ---- Admins: /api/v1/admin/escrow ----

const adminId = (req) => req.admin?._id || req.user?._id;

export const adminListEscrow = wrap(async (req, res) => ok(res, await escrowService.adminList(req.query)));
export const adminEscrowReport = wrap(async (req, res) => ok(res, await escrowService.report(req.query)));
export const adminResolveEscrow = wrap(async (req, res) => {
  const { resolution, refundAmount, note } = req.body || {};
  const escrow = await escrowService.resolve(adminId(req), req.params.id, { resolution, refundAmount, note });
  ok(res, { payment: escrowService.shape(escrow) });
});
export const adminRetryPayout = wrap(async (req, res) =>
  ok(res, { payment: escrowService.shape(await escrowService.retryPayout(req.params.id)) })
);
export const adminMarkPayoutPaid = wrap(async (req, res) =>
  ok(res, { payment: escrowService.shape(await escrowService.markPayoutPaid(adminId(req), req.params.id, req.body?.note)) })
);
