import express from "express";
import authRoutes from "./auth.routes.js";
import userRoutes from "./user.routes.js";
import eventRoutes from "./event.routes.js";
import vendorRoutes from "./vendor.routes.js";
import paymentRoutes from "./payment.routes.js";
import notificationRoutes from "./notification.routes.js";
import analyticsRoutes from "./analytics.routes.js";
import subscriptionRoutes from "./subscription.routes.js";
import adminRoutes from "./admin.routes.js";
import healthRoutes from "./health.routes.js";
import emailHealthRoutes from "./email-health.js";
import aiPlannerRoutes from "./ai-planner.routes.js";
import webhookRoutes from "./webhook.routes.js";
import monitoringRoutes from "./monitoring.routes.js";
import subscriptionPlanRoutes from "./subscriptionPlan.routes.js";
import calendarRoutes from "./calendar.routes.js";
import teamRoutes from "./team.routes.js";
import teamRouterRoutes from "./team-router.routes.js";
import leadRoutes from "./lead.routes.js";
import quoteRoutes from "./quote.routes.js";
import crmRoutes from "./crm.routes.js";
import apiAccessRoutes from "./api-access.routes.js";
import locationRoutes from "./location.routes.js";
import securityRoutes from "./security.routes.js";
import financialRoutes from "./financial.routes.js";
import settingsRoutes from "./settings.routes.js";
import plannerRoutes from "./planner.routes.js";
import plannerDashboardRoutes from "./planner-dashboard.routes.js";
import plannerDocumentRoutes from "./planner-document.routes.js";
import plannerClientRoutes from "./planner-client.routes.js";
import plannerVendorRoutes, { bookingRouter } from "./planner-vendor.routes.js";
import plannerTaskRoutes from "./planner-task.routes.js";
import plannerGuestRoutes, {
  eventGuestStatsRouter,
} from "./planner-guest.routes.js";
import plannerAIRoutes from "./planner-ai.routes.js";
import plannerCalendarRoutes from "./planner-calendar.routes.js";
import plannerTeamRoutes from "./planner-team.routes.js";
import plannerNotificationRoutes from "./planner-notification.routes.js";
import plannerReportsRoutes from "./planner-reports.routes.js";
import plannerSettingsRoutes from "./planner-settings.routes.js";
import plannerSearchRoutes from "./planner-search.routes.js";
import mobileRoutes from "./mobile.routes.js";
import onboardingRoutes from "./onboarding.routes.js";
import helpRoutes from "./help.routes.js";
import whatsNewRoutes from "./whats-new.routes.js";
import webhookManagementRoutes from "./webhook.routes.js";
import dataExchangeRoutes from "./data-exchange.routes.js";
import paymentWebhookRoutes from "./payment-webhook.routes.js";
import taskRoutes, { eventTaskRoutes } from "./task.routes.js";
import guestRoutes, {
  eventGuestRoutes,
  eventSeatingRoutes,
} from "./guest.routes.js";
import documentRoutes, { eventDocumentRoutes } from "./document.routes.js";
import messageRoutes from "./communication.routes.js";
import budgetRoutes, { eventBudgetRoutes } from "./budget.routes.js";
import businessProfileRoutes from "./business-profile.routes.js";
import businessVerificationRoutes from "./business-verification.routes.js";
import brandingRoutes from "./branding.routes.js";
import featureFlagRoutes from "./featureFlagRoutes.js";
import couponRoutes from "./couponRoutes.js";
// Vendor AI routes are now integrated into universal AI planner
// import vendorAIRoutes from "./vendor-ai-planner.routes.js";

const router = express.Router();

// Routes
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/team", teamRouterRoutes);
router.use("/settings", settingsRoutes);
router.use("/business-profile", businessProfileRoutes);
router.use("/branding", brandingRoutes);
router.use("/planner", plannerRoutes);
router.use("/planner/dashboard", plannerDashboardRoutes);
router.use("/planner/documents", plannerDocumentRoutes);
router.use("/planner/clients", plannerClientRoutes);
router.use("/planner/vendors", plannerVendorRoutes);
router.use("/planner/bookings", bookingRouter);
router.use("/planner/budget", budgetRoutes);
router.use("/planner/budgets", budgetRoutes);
router.use("/planner/tasks", plannerTaskRoutes);
router.use("/planner/guests", plannerGuestRoutes);
router.use("/planner/ai", plannerAIRoutes);
router.use("/planner/calendar", plannerCalendarRoutes);
router.use("/planner/team", plannerTeamRoutes);
router.use("/planner/notifications", plannerNotificationRoutes);
router.use("/planner/reports", plannerReportsRoutes);
router.use("/planner/settings", plannerSettingsRoutes);
router.use("/planner/search", plannerSearchRoutes);
router.use("/mobile", mobileRoutes);
router.use("/onboarding", onboardingRoutes);
router.use("/help", helpRoutes);
router.use("/whats-new", whatsNewRoutes);
router.use("/webhooks", webhookManagementRoutes);
router.use("/webhooks/payment", paymentWebhookRoutes);
router.use("/data", dataExchangeRoutes);
router.use("/events/:eventId/guests/stats", eventGuestStatsRouter);
router.use("/tasks", taskRoutes);
router.use("/guests", guestRoutes);
router.use("/documents", documentRoutes);
router.use("/messages", messageRoutes);
router.use("/events/:eventId/tasks", eventTaskRoutes);
router.use("/events/:eventId/guests", eventGuestRoutes);
router.use("/events/:eventId/seating", eventSeatingRoutes);
router.use("/events/:eventId/documents", eventDocumentRoutes);
router.use("/events/:eventId/budget", eventBudgetRoutes);
router.use("/events", eventRoutes);
// Register specific vendor sub-routes BEFORE the general /vendors route
router.use("/vendors/calendar", calendarRoutes);
router.use("/vendors/team", teamRoutes);
router.use("/vendors/leads", leadRoutes);
router.use("/vendors/quotes", quoteRoutes);
router.use("/vendors/payments", paymentRoutes);
router.use("/vendors/clients", crmRoutes);
router.use("/vendors/locations", locationRoutes);
router.use("/vendors/security", securityRoutes);
router.use("/vendors/bookings", bookingRouter);
// Vendor AI routes are now part of universal AI planner at /ai-planner
// router.use("/vendors/ai-planner", vendorAIRoutes);
// General vendor routes (with /:id) must come AFTER specific routes
router.use("/vendors", vendorRoutes);
router.use("/vendors", apiAccessRoutes);
router.use("/vendors", financialRoutes);
router.use("/quotes", quoteRoutes); // Public quote routes
// Admin routes MUST come before general routes to avoid conflicts
router.use("/admin", adminRoutes);
router.use("/admin/business-profiles", businessVerificationRoutes);
router.use("/admin", featureFlagRoutes);
router.use("/admin", couponRoutes);
// General routes (after admin routes)
router.use("/notifications", notificationRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/subscriptions", subscriptionRoutes);
router.use("/subscription-plans", subscriptionPlanRoutes);
router.use("/health", healthRoutes);
router.use("/email-health", emailHealthRoutes);
router.use("/ai-planner", aiPlannerRoutes);
router.use("/webhooks", webhookRoutes);
router.use("/monitoring", monitoringRoutes);

// Error handling for undefined routes
router.use("*", (req, res) => {
  res.status(404).json({
    status: "error",
    message: `Cannot ${req.method} ${req.originalUrl}`,
    error: "Route not found",
  });
});

export default router;
