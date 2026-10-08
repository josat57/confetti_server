import express from "express";
import { rateLimiter } from "../middleware/rateLimiter.js";
import { getRsvp, submitRsvp, openPixel } from "../controllers/rsvp.controller.js";

// Public RSVP (no login): /api/v1/rsvp/:token
const router = express.Router();

/** Rate limit per IP, but keep the page working if the limiter's store is down */
const limit = (name, max, windowSeconds) => {
  const limiter = rateLimiter(name, max, windowSeconds);
  return (req, res, next) => limiter(req, res, (error) => (error ? next() : next()));
};

router.get("/:token", limit("rsvp-view", 120, 60 * 60), getRsvp);
router.post("/:token", limit("rsvp-answer", 30, 60 * 60), submitRsvp);
router.get("/:token/open.gif", limit("rsvp-pixel", 300, 60 * 60), openPixel);

export default router;
