import express from "express";
import { protect, restrictTo } from "../middleware/auth.js";
import { requirePlanFeature } from "../services/plan-access.service.js";
import * as c from "../controllers/venue.controller.js";

// Venue plan: /api/v1/vendors/venue
const router = express.Router();
router.use(protect, restrictTo("vendor"), requirePlanFeature("venueTools", { label: "Venue calendar and holds" }));

router.get("/spaces", c.listSpaces);
router.post("/spaces", c.createSpace);
router.patch("/spaces/:id", c.updateSpace);
router.delete("/spaces/:id", c.deleteSpace);

router.get("/calendar", c.getCalendar);
router.get("/availability", c.checkAvailability);

router.get("/reservations", c.listReservations);
router.post("/reservations", c.createReservation);
router.patch("/reservations/:id", c.updateReservation);
router.post("/reservations/:id/extend", c.extendHold);
router.post("/reservations/:id/convert", c.convertHold);
router.post("/reservations/:id/release", c.releaseReservation);

export default router;
