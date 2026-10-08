import express from "express";
import { protect } from "../middleware/auth.js";
import { createTicket, listTickets, getTicket, replyToTicket, closeTicket, rateTicket } from "../services/support.service.js";

// Support tickets for clients, planners and vendors: /api/v1/support/tickets
const router = express.Router();
router.use(protect);

const handle = (fn, status = 200) => async (req, res, next) => {
  try {
    res.status(status).json({ status: "success", data: await fn(req) });
  } catch (error) {
    next(error);
  }
};

router.get("/tickets", handle((req) => listTickets(req.user, req.query)));
router.post("/tickets", handle(async (req) => ({ ticket: await createTicket(req.user, req.body) }), 201));
router.get("/tickets/:id", handle(async (req) => ({ ticket: await getTicket(req.user, req.params.id) })));
router.post("/tickets/:id/messages", handle(async (req) => ({ ticket: await replyToTicket(req.user, req.params.id, req.body?.content) })));
router.post("/tickets/:id/close", handle(async (req) => ({ ticket: await closeTicket(req.user, req.params.id) })));
router.post("/tickets/:id/rating", handle(async (req) => ({ ticket: await rateTicket(req.user, req.params.id, req.body || {}) })));

export default router;
