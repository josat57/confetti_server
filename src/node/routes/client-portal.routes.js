import express from "express";
import { protect, restrictTo } from "../middleware/auth.js";
import { rateLimiter } from "../middleware/rateLimiter.js";
import { requirePlanFeature } from "../services/plan-access.service.js";
import clientPortalService from "../services/client-portal.service.js";

const handle = (fn, status = 200) => async (req, res, next) => {
  try {
    res.status(status).json({ status: "success", data: await fn(req) });
  } catch (error) {
    next(error);
  }
};

// Planner side: /api/v1/planner/portal/events/:eventId (Studio plan and above)
export const plannerPortalRoutes = express.Router({ mergeParams: true });
plannerPortalRoutes.use(protect, restrictTo("event-planner"), requirePlanFeature("clientPortal", { label: "The client portal" }));
plannerPortalRoutes.get("/", handle((req) => clientPortalService.getForPlanner(req.user, req.params.eventId)));
plannerPortalRoutes.post("/invites", handle((req) => clientPortalService.invite(req.user, req.params.eventId, req.body || {}), 201));
plannerPortalRoutes.delete("/invites/:inviteId", handle((req) => clientPortalService.revokeInvite(req.user, req.params.eventId, req.params.inviteId)));
plannerPortalRoutes.post("/approvals", handle((req) => clientPortalService.addApproval(req.user, req.params.eventId, req.body || {}), 201));
plannerPortalRoutes.delete("/approvals/:approvalId", handle((req) => clientPortalService.deleteApproval(req.user, req.params.eventId, req.params.approvalId)));
plannerPortalRoutes.post("/comments", handle((req) => clientPortalService.plannerComment(req.user, req.params.eventId, req.body?.body), 201));
plannerPortalRoutes.patch(
  "/documents/:documentId",
  handle((req) => clientPortalService.setDocumentShared(req.user, req.params.eventId, req.params.documentId, req.body?.shared))
);

// Client side (private link, no login): /api/v1/portal/:token
const failOpen = (name, max, windowSeconds) => {
  const limiter = rateLimiter(name, max, windowSeconds);
  return (req, res, next) => limiter(req, res, () => next());
};
const router = express.Router();
router.get("/:token", failOpen("portal-view", 300, 3600), handle((req) => clientPortalService.viewByToken(req.params.token)));
router.post("/:token/comments", failOpen("portal-write", 60, 3600), handle((req) => clientPortalService.clientComment(req.params.token, req.body?.body), 201));
router.post(
  "/:token/approvals/:approvalId",
  failOpen("portal-write", 60, 3600),
  handle((req) => clientPortalService.respondToApproval(req.params.token, req.params.approvalId, req.body || {}))
);

export default router;
