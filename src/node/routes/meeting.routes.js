import express from "express";
import { protect } from "../middleware/auth.js";
import { requireClientPass } from "../services/plan-access.service.js";
import meetingService from "../services/meeting.service.js";

/**
 * Video calls with vendors: /api/v1/meetings. Clients need a pass with video calls
 * (Diaspora Pass) to start one; vendors and planners can start them with anyone they
 * have a conversation or booking with. Anyone invited can join, move or cancel.
 */
const router = express.Router();
router.use(protect);

const handle = (fn, status = 200) => async (req, res, next) => {
  try {
    res.status(status).json({ status: "success", data: await fn(req) });
  } catch (error) {
    next(error);
  }
};

router.get("/", handle(async (req) => ({ meetings: await meetingService.list(req.user, req.query) })));
router.post(
  "/",
  requireClientPass("videoCalls", { label: "Video calls" }),
  handle(async (req) => ({ meeting: await meetingService.create(req.user, req.body || {}) }), 201)
);
router.patch("/:id", handle(async (req) => ({ meeting: await meetingService.reschedule(req.user, req.params.id, req.body || {}) })));
router.post("/:id/cancel", handle(async (req) => ({ meeting: await meetingService.cancel(req.user, req.params.id) })));
router.get("/:id/invite.ics", async (req, res, next) => {
  try {
    const ics = await meetingService.ics(req.user, req.params.id);
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="invite.ics"');
    res.send(ics);
  } catch (error) {
    next(error);
  }
});

export default router;
