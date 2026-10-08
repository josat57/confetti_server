import featuredService from "../services/featured.service.js";

const frontendUrl = () => process.env.FRONTEND_URL || "http://localhost:3000";
const wrap = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (error) {
    next(error);
  }
};

/** GET /vendors/boost — credits, slots, price and current boosts */
export const getBoostOverview = wrap(async (req, res) =>
  res.status(200).json({ status: "success", data: await featuredService.overview(req.user) })
);

/** POST /vendors/boost/checkout { weeks, paymentProvider } */
export const startBoostCheckout = wrap(async (req, res) => {
  const { weeks, paymentProvider } = req.body || {};
  res.status(200).json({ status: "success", data: await featuredService.checkout(req.user, { weeks: Number(weeks), paymentProvider }) });
});

/** POST /vendors/boost/use-credit */
export const useBoostCredit = wrap(async (req, res) => {
  const boost = await featuredService.useCredit(req.user);
  res.status(201).json({ status: "success", data: { boost: { _id: boost._id, startsAt: boost.startsAt, endsAt: boost.endsAt } } });
});

/** GET /featured/callback — payment provider redirect (no login) */
export const boostPaymentCallback = async (req, res) => {
  const { status, transaction_id, reference, trxref } = req.query;
  const back = (outcome, message) =>
    res.redirect(`${frontendUrl()}/vendor/dashboard/boost?payment=${outcome}${message ? `&message=${encodeURIComponent(message)}` : ""}`);
  try {
    if (status === "cancelled" || status === "canceled") return back("cancelled");
    const isFlutterwave = !!transaction_id;
    if (isFlutterwave && !["successful", "success", "completed"].includes(status)) return back("failed");
    const id = transaction_id || reference || trxref;
    if (!id) return back("failed");
    await featuredService.verifyAndComplete(id, isFlutterwave ? "flutterwave" : "paystack");
    return back("success");
  } catch (error) {
    return back("failed", error.message);
  }
};
