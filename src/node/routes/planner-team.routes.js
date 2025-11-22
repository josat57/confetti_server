import express from "express";
import PlannerTeamController from "../controllers/planner-team.controller.js";
import { protect, restrictTo } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication and planner role
router.use(protect);
router.use(restrictTo("event-planner"));

/**
 * @route   GET /api/v1/planner/team
 * @desc    Get all team members
 * @access  Private (Event Planners only)
 * @query   status (active|inactive), includeActivity (boolean)
 */
router.get("/", PlannerTeamController.getTeamMembers);

/**
 * @route   POST /api/v1/planner/team/invite
 * @desc    Invite team member
 * @access  Private (Event Planners only)
 * @body    email, role (admin|manager|coordinator), assignedEvents
 */
router.post("/invite", PlannerTeamController.inviteTeamMember);

/**
 * @route   POST /api/v1/planner/team/accept-invitation
 * @desc    Accept team invitation
 * @access  Private (Authenticated users)
 * @body    token
 */
router.post("/accept-invitation", PlannerTeamController.acceptInvitation);

/**
 * @route   GET /api/v1/planner/team/invitations
 * @desc    Get pending invitations
 * @access  Private (Event Planners only)
 */
router.get("/invitations", PlannerTeamController.getPendingInvitations);

/**
 * @route   DELETE /api/v1/planner/team/invitations/:id
 * @desc    Cancel invitation
 * @access  Private (Event Planners only)
 */
router.delete("/invitations/:id", PlannerTeamController.cancelInvitation);

/**
 * @route   PUT /api/v1/planner/team/:id
 * @desc    Update team member
 * @access  Private (Event Planners only)
 * @body    role, assignedEvents, status
 */
router.put("/:id", PlannerTeamController.updateTeamMember);

/**
 * @route   DELETE /api/v1/planner/team/:id
 * @desc    Remove team member
 * @access  Private (Event Planners only)
 */
router.delete("/:id", PlannerTeamController.removeTeamMember);

/**
 * @route   GET /api/v1/planner/team/:id/activity
 * @desc    Get team member activity log
 * @access  Private (Event Planners only)
 * @query   limit (number)
 */
router.get("/:id/activity", PlannerTeamController.getTeamMemberActivity);

export default router;
