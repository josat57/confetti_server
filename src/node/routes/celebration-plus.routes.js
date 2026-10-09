import express from "express";
import { rateLimiter } from "../middleware/rateLimiter.js";
import { protect, restrictTo, authenticateAdmin, authorizeAdmin } from "../middleware/auth.js";
import { requireEventPass } from "../services/plan-access.service.js";
import * as c from "../controllers/celebration-plus.controller.js";

/**
 * Celebration Plus (roadmap Phase 8). Clients need a pass with the feature on the
 * event; planners use these on their own events through their plan.
 */

// /api/v1/events/:eventId/run-sheet
export const runSheetRoutes = express.Router({ mergeParams: true });
runSheetRoutes.use(protect, requireEventPass("runSheet", { label: "The run sheet" }));
runSheetRoutes.get("/", c.getRunSheet);
runSheetRoutes.patch("/", c.updateRunSheet);
runSheetRoutes.get("/pdf", c.runSheetPdf);
runSheetRoutes.post("/vendors", c.addRunSheetVendor);
runSheetRoutes.post("/vendors/import", c.importRunSheetVendors);
runSheetRoutes.patch("/vendors/:vendorKey", c.updateRunSheetVendor);
runSheetRoutes.delete("/vendors/:vendorKey", c.removeRunSheetVendor);
runSheetRoutes.post("/vendors/:vendorKey/share", c.shareRunSheetVendor);
runSheetRoutes.delete("/vendors/:vendorKey/share", c.revokeRunSheetShare);
runSheetRoutes.post("/items", c.addRunSheetItem);
runSheetRoutes.patch("/items/:itemId", c.updateRunSheetItem);
runSheetRoutes.delete("/items/:itemId", c.removeRunSheetItem);

// /api/v1/run-sheets/shared/:token (vendor's read-only link, no login)
export const sharedRunSheetRoutes = express.Router();
const sharedLimiter = rateLimiter("run-sheet-shared", 120, 15 * 60);
// Keep the link working if the limiter's store is down
sharedRunSheetRoutes.use((req, res, next) => sharedLimiter(req, res, () => next()));
sharedRunSheetRoutes.get("/:token", c.viewSharedRunSheet);
sharedRunSheetRoutes.get("/:token/pdf", c.sharedRunSheetPdf);

// /api/v1/events/:eventId/gifts
export const giftRoutes = express.Router({ mergeParams: true });
giftRoutes.use(protect, requireEventPass("giftTracking", { label: "Gift tracking" }));
giftRoutes.get("/", c.listGifts);
giftRoutes.post("/", c.createGift);
giftRoutes.post("/thank-you", c.setGiftThankYou);
giftRoutes.patch("/:giftId", c.updateGift);
giftRoutes.delete("/:giftId", c.deleteGift);

// /api/v1/events/:eventId/aso-ebi
export const asoEbiRoutes = express.Router({ mergeParams: true });
asoEbiRoutes.use(protect, requireEventPass("asoEbi", { label: "Aso-ebi tracking" }));
asoEbiRoutes.get("/", c.getAsoEbi);
asoEbiRoutes.get("/orders.csv", c.asoEbiCsv);
asoEbiRoutes.post("/fabrics", c.addAsoEbiFabric);
asoEbiRoutes.patch("/fabrics/:fabricId", c.updateAsoEbiFabric);
asoEbiRoutes.delete("/fabrics/:fabricId", c.deleteAsoEbiFabric);
asoEbiRoutes.post("/orders", c.addAsoEbiOrder);
asoEbiRoutes.post("/orders/collection", c.setAsoEbiCollection);
asoEbiRoutes.patch("/orders/:orderId", c.updateAsoEbiOrder);
asoEbiRoutes.delete("/orders/:orderId", c.deleteAsoEbiOrder);
asoEbiRoutes.post("/orders/:orderId/payments", c.recordAsoEbiPayment);
asoEbiRoutes.delete("/orders/:orderId/payments/:paymentId", c.removeAsoEbiPayment);

// /api/v1/events/:eventId/shortlist (clients with Celebration Plus; Confetti's team picks)
export const shortlistRoutes = express.Router({ mergeParams: true });
shortlistRoutes.use(protect, restrictTo("user"), requireEventPass("curatedShortlist", { label: "The curated shortlist" }));
shortlistRoutes.get("/", c.getShortlist);
shortlistRoutes.put("/brief", c.submitShortlistBrief);
shortlistRoutes.patch("/items/:itemId", c.setShortlistItemStatus);

// /api/v1/admin/curation
export const adminCurationRoutes = express.Router();
adminCurationRoutes.use(authenticateAdmin, authorizeAdmin(["vendor_management"]));
adminCurationRoutes.get("/", c.adminCurationQueue);
adminCurationRoutes.get("/vendors", c.adminCurationVendors);
adminCurationRoutes.get("/:eventId", c.adminCurationEvent);
adminCurationRoutes.post("/:eventId/items", c.adminCurationAdd);
adminCurationRoutes.patch("/:eventId/items/:itemId", c.adminCurationNote);
adminCurationRoutes.delete("/:eventId/items/:itemId", c.adminCurationRemove);
adminCurationRoutes.post("/:eventId/ready", c.adminCurationReady);
