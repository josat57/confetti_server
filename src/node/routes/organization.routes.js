import express from "express";
import { protect, authenticateAdmin, authorizeAdmin } from "../middleware/auth.js";
import organizationService from "../services/organization.service.js";
import purchaseService from "../services/purchase.service.js";
import billingService from "../services/corporate-billing.service.js";
import reportService from "../services/corporate-report.service.js";

/**
 * Corporate accounts (roadmap Phase 11).
 * Company: /api/v1/organizations/...   Confetti admin: /api/v1/admin/corporate/...
 */

const handle = (fn, status = 200) => async (req, res, next) => {
  try {
    res.status(status).json({ status: "success", data: await fn(req, res) });
  } catch (error) {
    next(error);
  }
};
const stream = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (error) {
    next(error);
  }
};
const frontendUrl = () => (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");

const router = express.Router();

// Card payment redirect back (no login)
router.get("/callback", async (req, res) => {
  const { status, transaction_id, reference, trxref } = req.query;
  const back = (outcome, message) =>
    res.redirect(`${frontendUrl()}/company/billing?payment=${outcome}${message ? `&message=${encodeURIComponent(message)}` : ""}`);
  try {
    if (status === "cancelled" || status === "canceled") return back("cancelled");
    const isFlutterwave = !!transaction_id;
    if (isFlutterwave && !["successful", "success", "completed"].includes(status)) return back("failed");
    const id = transaction_id || reference || trxref;
    if (!id) return back("failed");
    await billingService.verifyAndComplete(id, isFlutterwave ? "flutterwave" : "paystack");
    return back("success");
  } catch (error) {
    return back("failed", error.message);
  }
});

router.use(protect);
// The company being worked in (people can belong to several)
router.use((req, res, next) => {
  const chosen = req.get("x-organization-id");
  if (chosen) req.user.activeOrganization = chosen;
  next();
});

// Company
router.get("/mine", handle(async (req) => ({ organizations: await organizationService.listMine(req.user) })));
router.post("/", handle((req) => organizationService.create(req.user, req.body || {}), 201));
router.get("/me", handle((req) => organizationService.get(req.user)));
router.patch("/me", handle((req) => organizationService.update(req.user, req.body || {})));
router.put("/me/budgets", handle((req) => organizationService.setBudgets(req.user, req.body || {})));

// Members and invitations
router.get("/me/members", handle((req) => organizationService.members(req.user)));
router.post("/me/invites", handle((req) => organizationService.invite(req.user, req.body || {}), 201));
router.delete("/me/invites/:id", handle((req) => organizationService.revokeInvite(req.user, req.params.id)));
router.patch("/me/members/:userId", handle((req) => organizationService.updateMember(req.user, req.params.userId, req.body || {})));
router.delete("/me/members/:userId", handle((req) => organizationService.removeMember(req.user, req.params.userId)));
router.get("/invites/:token", handle((req) => organizationService.previewInvite(req.params.token)));
router.post("/invites/:token/accept", handle((req) => organizationService.acceptInvite(req.user, req.params.token)));

// Events and bookings
router.get("/me/events", handle(async (req) => ({ events: await organizationService.events(req.user, req.query) })));
router.post("/me/events", handle(async (req) => ({ event: await organizationService.createEvent(req.user, req.body || {}) }), 201));
router.post("/me/events/:eventId/attach", handle(async (req) => ({ event: await organizationService.attachEvent(req.user, req.params.eventId, req.body || {}) })));
router.get("/me/bookings", handle(async (req) => ({ bookings: await organizationService.bookings(req.user) })));

// Purchase requests and approvals
router.get("/me/purchases", handle(async (req) => ({ purchases: await purchaseService.list(req.user, req.query) })));
router.post("/me/purchases", handle(async (req) => ({ purchase: await purchaseService.create(req.user, req.body || {}) }), 201));
router.get("/me/purchases/:id", handle(async (req) => ({ purchase: await purchaseService.get(req.user, req.params.id) })));
router.post("/me/purchases/:id/approve", handle(async (req) => ({ purchase: await purchaseService.decide(req.user, req.params.id, "approved", req.body?.note) })));
router.post("/me/purchases/:id/reject", handle(async (req) => ({ purchase: await purchaseService.decide(req.user, req.params.id, "rejected", req.body?.note) })));
router.post("/me/purchases/:id/cancel", handle(async (req) => ({ purchase: await purchaseService.cancel(req.user, req.params.id) })));

// Reports
router.get("/me/reports", handle((req) => reportService.build(req.user, req.query)));
router.get(
  "/me/reports/export.csv",
  stream(async (req, res) => {
    const csv = await reportService.csv(req.user, req.query);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="spending-report.csv"');
    res.send(`﻿${csv}`);
  })
);
router.get("/me/reports/export.pdf", stream((req, res) => reportService.pdf(req.user, req.query, res)));

// Billing
router.post("/me/contract/request", handle((req) => billingService.requestContract(req.user, req.body || {})));
router.get("/me/invoices", handle((req) => billingService.invoices(req.user)));
router.get("/me/invoices/:id/pdf", stream((req, res) => billingService.invoicePdf(req.user, req.params.id, res)));
router.post("/me/invoices/:id/pay", handle((req) => billingService.payByCard(req.user, req.params.id, req.body || {})));
router.get("/me/receipts", handle(async (req) => ({ receipts: await billingService.receipts(req.user) })));
router.get("/me/receipts/:escrowId/pdf", stream((req, res) => billingService.receiptPdf(req.user, req.params.escrowId, res)));

// Confetti admin: /api/v1/admin/corporate
export const adminCorporateRoutes = express.Router();
adminCorporateRoutes.use(authenticateAdmin, authorizeAdmin(["financial_oversight"]));
adminCorporateRoutes.get("/", handle(async (req) => ({ organizations: await billingService.adminList(req.query) })));
adminCorporateRoutes.get("/invoices/:id/pdf", stream((req, res) => billingService.adminInvoicePdf(req.params.id, res)));
adminCorporateRoutes.post("/invoices/:id/mark-paid", handle(async (req) => ({ invoice: await billingService.adminMarkPaid(req.params.id, req.body || {}) })));
adminCorporateRoutes.post("/invoices/:id/void", handle(async (req) => ({ invoice: await billingService.adminVoid(req.params.id) })));
adminCorporateRoutes.get("/:id", handle((req) => billingService.adminGet(req.params.id)));
adminCorporateRoutes.post("/:id/invoices", handle(async (req) => ({ invoice: await billingService.issueInvoice(req.params.id, req.body || {}) }), 201));
adminCorporateRoutes.post("/:id/contract/cancel", handle((req) => billingService.adminCancelContract(req.params.id)));

export default router;
