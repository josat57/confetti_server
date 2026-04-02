import express from "express";
import { protect } from "../middleware/auth.js";
import {
  getTeamRoute,
  inviteTeamMember,
} from "../controllers/team-router.controller.js";

const router = express.Router();

// Protect the route
router.use(protect);

/**
 * @swagger
 * /team:
 *   get:
 *     summary: Get team endpoint information
 *     description: Returns the appropriate team endpoint based on user role (vendor or planner)
 *     tags: [Team]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Team endpoint information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Use vendor team endpoint
 *                 data:
 *                   type: object
 *                   properties:
 *                     endpoint:
 *                       type: string
 *                       example: /api/v1/vendors/team
 *                     userType:
 *                       type: string
 *                       example: vendor
 *       403:
 *         description: Team management not available for user type
 *       401:
 *         description: Not authenticated
 */
router.get("/", getTeamRoute);

/**
 * @swagger
 * /team/invite:
 *   post:
 *     summary: Invite team member
 *     description: Invite a new team member. Automatically routes to vendor or planner team based on user role.
 *     tags: [Team]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - role
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: joseph.samuel@cinfores.com
 *               role:
 *                 type: string
 *                 enum: [admin, manager, staff]
 *                 example: staff
 *               message:
 *                 type: string
 *                 example: Join our team!
 *     responses:
 *       200:
 *         description: Invitation sent successfully
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Team management not available for user type
 *       401:
 *         description: Not authenticated
 */
router.post("/invite", inviteTeamMember);

export default router;
