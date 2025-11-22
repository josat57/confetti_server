import express from "express";
import { protect } from "../middleware/auth.js";
import {
  getTeamMembers,
  getTeamMember,
  inviteTeamMember,
  acceptInvitation,
  declineInvitation,
  updateMemberRole,
  updateMemberPermissions,
  removeTeamMember,
  deactivateTeamMember,
  reactivateTeamMember,
  getTeamActivity,
  resendInvitation,
} from "../controllers/team.controller.js";

const router = express.Router();

// All team routes require authentication
router.use(protect);

/**
 * @swagger
 * /vendors/team:
 *   get:
 *     summary: Get all team members
 *     description: Get list of all team members for the vendor
 *     tags: [Vendor Dashboard - Team]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, active, inactive, declined]
 *         description: Filter by status
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [admin, manager, staff]
 *         description: Filter by role
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Team members retrieved successfully
 *       404:
 *         description: Vendor profile not found
 */
router.get("/", getTeamMembers);

/**
 * @swagger
 * /vendors/team/activity:
 *   get:
 *     summary: Get team activity log
 *     description: Get recent activity log of team members
 *     tags: [Vendor Dashboard - Team]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: Activity log retrieved successfully
 *       404:
 *         description: Vendor profile not found
 */
router.get("/activity", getTeamActivity);

/**
 * @swagger
 * /vendors/team/invite:
 *   post:
 *     summary: Invite team member
 *     description: Send invitation to a new team member
 *     tags: [Vendor Dashboard - Team]
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
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               role:
 *                 type: string
 *                 enum: [admin, manager, staff]
 *                 default: staff
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Invitation sent successfully
 *       400:
 *         description: Invalid request or user already invited
 *       404:
 *         description: Vendor profile not found
 */
router.post("/invite", inviteTeamMember);

/**
 * @swagger
 * /vendors/team/accept/{token}:
 *   post:
 *     summary: Accept team invitation
 *     description: Accept a team member invitation using the invitation token
 *     tags: [Vendor Dashboard - Team]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Invitation token
 *     responses:
 *       200:
 *         description: Invitation accepted successfully
 *       400:
 *         description: Invalid or expired invitation
 *       403:
 *         description: Not authorized to accept this invitation
 */
router.post("/accept/:token", acceptInvitation);

/**
 * @swagger
 * /vendors/team/decline/{token}:
 *   post:
 *     summary: Decline team invitation
 *     description: Decline a team member invitation using the invitation token
 *     tags: [Vendor Dashboard - Team]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Invitation token
 *     responses:
 *       200:
 *         description: Invitation declined successfully
 *       400:
 *         description: Invalid or expired invitation
 *       403:
 *         description: Not authorized to decline this invitation
 */
router.post("/decline/:token", declineInvitation);

/**
 * @swagger
 * /vendors/team/{id}:
 *   get:
 *     summary: Get single team member
 *     description: Get details of a specific team member
 *     tags: [Vendor Dashboard - Team]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Team member ID
 *     responses:
 *       200:
 *         description: Team member retrieved successfully
 *       404:
 *         description: Team member not found
 */
router.get("/:id", getTeamMember);

/**
 * @swagger
 * /vendors/team/{id}/role:
 *   put:
 *     summary: Update team member role
 *     description: Update the role and permissions of a team member
 *     tags: [Vendor Dashboard - Team]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Team member ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [admin, manager, staff]
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Role updated successfully
 *       400:
 *         description: Invalid request or cannot change owner role
 *       404:
 *         description: Team member not found
 */
router.put("/:id/role", updateMemberRole);

/**
 * @swagger
 * /vendors/team/{id}/permissions:
 *   put:
 *     summary: Update team member permissions
 *     description: Update specific permissions for a team member
 *     tags: [Vendor Dashboard - Team]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Team member ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - permissions
 *             properties:
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [view_leads, manage_leads, view_bookings, manage_bookings, view_analytics, manage_team, manage_profile, manage_payments, view_calendar, manage_calendar, view_portfolio, manage_portfolio, view_reviews, respond_reviews, view_quotes, manage_quotes]
 *     responses:
 *       200:
 *         description: Permissions updated successfully
 *       400:
 *         description: Invalid permissions array
 *       404:
 *         description: Team member not found
 */
router.put("/:id/permissions", updateMemberPermissions);

/**
 * @swagger
 * /vendors/team/{id}/deactivate:
 *   post:
 *     summary: Deactivate team member
 *     description: Temporarily deactivate a team member
 *     tags: [Vendor Dashboard - Team]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Team member ID
 *     responses:
 *       200:
 *         description: Team member deactivated successfully
 *       400:
 *         description: Cannot deactivate vendor owner
 *       404:
 *         description: Team member not found
 */
router.post("/:id/deactivate", deactivateTeamMember);

/**
 * @swagger
 * /vendors/team/{id}/reactivate:
 *   post:
 *     summary: Reactivate team member
 *     description: Reactivate a previously deactivated team member
 *     tags: [Vendor Dashboard - Team]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Team member ID
 *     responses:
 *       200:
 *         description: Team member reactivated successfully
 *       400:
 *         description: Team member is not inactive
 *       404:
 *         description: Team member not found
 */
router.post("/:id/reactivate", reactivateTeamMember);

/**
 * @swagger
 * /vendors/team/{id}/resend:
 *   post:
 *     summary: Resend invitation
 *     description: Resend invitation email to a pending team member
 *     tags: [Vendor Dashboard - Team]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Team member ID
 *     responses:
 *       200:
 *         description: Invitation resent successfully
 *       404:
 *         description: Pending invitation not found
 */
router.post("/:id/resend", resendInvitation);

/**
 * @swagger
 * /vendors/team/{id}:
 *   delete:
 *     summary: Remove team member
 *     description: Permanently remove a team member from the team
 *     tags: [Vendor Dashboard - Team]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Team member ID
 *     responses:
 *       200:
 *         description: Team member removed successfully
 *       400:
 *         description: Cannot remove vendor owner
 *       404:
 *         description: Team member not found
 */
router.delete("/:id", removeTeamMember);

export default router;
