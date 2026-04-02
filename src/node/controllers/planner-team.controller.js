import TeamMember from "../models/team-member.model.js";
import TeamInvitation from "../models/team-invitation.model.js";
import User from "../models/user.model.js";
import Subscription from "../models/subscription.model.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";
import { sendEmail } from "../utils/email.js";

/**
 * Controller for Planner Team Management
 */
class PlannerTeamController {
  /**
   * Get all team members
   * GET /api/v1/planner/team
   */
  async getTeamMembers(req, res, next) {
    try {
      const plannerId = req.user.id;
      const { status = "active", includeActivity = false } = req.query;

      logger.info("Fetching team members", { plannerId, status });

      const query = { planner: plannerId };
      if (status) {
        query.status = status;
      }

      const selectFields = includeActivity === "true" ? "" : "-activityLog";

      const teamMembers = await TeamMember.find(query)
        .select(selectFields)
        .populate("user", "firstName lastName email profilePicture")
        .populate("assignedEvents", "title eventType startDate")
        .sort({ createdAt: -1 })
        .lean();

      // Get subscription to show tier limits
      const subscription = await Subscription.findOne({
        user: plannerId,
        planType: "planner",
      });

      const tierLimits = this._getTierLimits(subscription?.planName);

      res.status(200).json({
        success: true,
        data: {
          teamMembers,
          summary: {
            total: teamMembers.length,
            active: teamMembers.filter((m) => m.status === "active").length,
            inactive: teamMembers.filter((m) => m.status === "inactive").length,
            limit: tierLimits.teamMembers,
            remaining: Math.max(0, tierLimits.teamMembers - teamMembers.length),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Invite team member
   * POST /api/v1/planner/team/invite
   */
  async inviteTeamMember(req, res, next) {
    try {
      const plannerId = req.user.id;
      const {
        email,
        role: rawRole = "coordinator",
        assignedEvents = [],
      } = req.body;
      const role = rawRole.toLowerCase(); // Normalize role to lowercase

      if (!email) {
        throw new AppError("Email is required", 400);
      }

      logger.info("Inviting team member", { plannerId, email, role });

      // Check tier limits
      const subscription = await Subscription.findOne({
        user: plannerId,
        planType: "planner",
      });

      if (!subscription || !subscription.isActive()) {
        throw new AppError("Active subscription required", 403);
      }

      const tierLimits = this._getTierLimits(subscription.planName);
      const currentTeamCount = await TeamMember.countDocuments({
        planner: plannerId,
        status: "active",
      });

      if (currentTeamCount >= tierLimits.teamMembers) {
        throw new AppError(
          `Team member limit reached for ${subscription.planName} tier. Upgrade to add more members.`,
          403
        );
      }

      // Check if user is already a team member
      const existingMember = await TeamMember.findOne({
        planner: plannerId,
        user: { $exists: true },
      }).populate("user", "email");

      if (
        existingMember &&
        existingMember.user?.email === email.toLowerCase()
      ) {
        throw new AppError("User is already a team member", 400);
      }

      // Check for pending invitation
      const pendingInvitation = await TeamInvitation.findOne({
        planner: plannerId,
        email: email.toLowerCase(),
        status: "pending",
      });

      if (pendingInvitation && !pendingInvitation.isExpired()) {
        throw new AppError("Invitation already sent to this email", 400);
      }

      // Create invitation
      const invitation = new TeamInvitation({
        planner: plannerId,
        email: email.toLowerCase(),
        role,
        assignedEvents,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });

      const token = invitation.generateToken();
      await invitation.save();

      // Send invitation email
      const planner = await User.findById(plannerId).select(
        "firstName lastName email"
      );
      const invitationLink = `${process.env.FRONTEND_URL}/team/accept-invitation?token=${token}`;

      try {
        await sendEmail({
          to: email,
          subject: `You've been invited to join ${planner.firstName}'s team`,
          template: "team-invitation",
          data: {
            plannerName: `${planner.firstName} ${planner.lastName}`,
            role,
            invitationLink,
            expiresAt: invitation.expiresAt,
          },
        });
      } catch (emailError) {
        logger.error("Failed to send invitation email", { error: emailError });
        // Continue even if email fails
      }

      res.status(201).json({
        success: true,
        message: "Team invitation sent successfully",
        data: {
          invitation: {
            id: invitation._id,
            email: invitation.email,
            role: invitation.role,
            status: invitation.status,
            expiresAt: invitation.expiresAt,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Accept team invitation
   * POST /api/v1/planner/team/accept-invitation
   */
  async acceptInvitation(req, res, next) {
    try {
      const userId = req.user.id;
      const { token } = req.body;

      if (!token) {
        throw new AppError("Invitation token is required", 400);
      }

      logger.info("Accepting team invitation", { userId });

      const invitation = await TeamInvitation.findByToken(token);

      if (!invitation) {
        throw new AppError("Invalid or expired invitation", 404);
      }

      if (invitation.isExpired()) {
        invitation.status = "expired";
        await invitation.save();
        throw new AppError("Invitation has expired", 400);
      }

      // Check if user email matches invitation
      const user = await User.findById(userId).select("email");
      if (user.email !== invitation.email) {
        throw new AppError(
          "This invitation was sent to a different email address",
          403
        );
      }

      // Check if already a team member
      const existingMember = await TeamMember.findOne({
        planner: invitation.planner,
        user: userId,
      });

      if (existingMember) {
        throw new AppError("You are already a member of this team", 400);
      }

      // Accept invitation
      await invitation.accept(userId);

      // Create team member
      const teamMember = await TeamMember.create({
        planner: invitation.planner,
        user: userId,
        role: invitation.role,
        assignedEvents: invitation.assignedEvents,
        joinedAt: new Date(),
      });

      await teamMember.populate("planner", "firstName lastName email");
      await teamMember.populate("assignedEvents", "title eventType");

      res.status(200).json({
        success: true,
        message: "Successfully joined the team",
        data: {
          teamMember,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update team member
   * PUT /api/v1/planner/team/:id
   */
  async updateTeamMember(req, res, next) {
    try {
      const plannerId = req.user.id;
      const { id } = req.params;
      const { role, assignedEvents, status } = req.body;

      logger.info("Updating team member", { plannerId, memberId: id });

      const teamMember = await TeamMember.findOne({
        _id: id,
        planner: plannerId,
      });

      if (!teamMember) {
        throw new AppError("Team member not found", 404);
      }

      // Update fields
      if (role) teamMember.role = role;
      if (assignedEvents) teamMember.assignedEvents = assignedEvents;
      if (status) teamMember.status = status;

      await teamMember.save();
      await teamMember.populate(
        "user",
        "firstName lastName email profilePicture"
      );
      await teamMember.populate("assignedEvents", "title eventType startDate");

      // Log activity
      await teamMember.logActivity("updated", {
        updatedBy: plannerId,
        changes: { role, assignedEvents, status },
      });

      res.status(200).json({
        success: true,
        message: "Team member updated successfully",
        data: {
          teamMember,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove team member
   * DELETE /api/v1/planner/team/:id
   */
  async removeTeamMember(req, res, next) {
    try {
      const plannerId = req.user.id;
      const { id } = req.params;

      logger.info("Removing team member", { plannerId, memberId: id });

      const teamMember = await TeamMember.findOne({
        _id: id,
        planner: plannerId,
      });

      if (!teamMember) {
        throw new AppError("Team member not found", 404);
      }

      await TeamMember.deleteOne({ _id: id });

      res.status(200).json({
        success: true,
        message: "Team member removed successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get team activity overview
   * GET /api/v1/planner/team/activity
   */
  async getTeamActivity(req, res, next) {
    try {
      const plannerId = req.user.id;
      const { limit = 50 } = req.query;

      logger.info("Fetching team activity overview", { plannerId });

      // Get all team members with their recent activity
      const teamMembers = await TeamMember.find({ planner: plannerId })
        .select("user activityLog")
        .populate("user", "firstName lastName email")
        .lean();

      // Collect all activity from all team members
      const allActivity = [];
      teamMembers.forEach((member) => {
        if (member.activityLog && member.activityLog.length > 0) {
          member.activityLog.forEach((activity) => {
            allActivity.push({
              ...activity,
              user: member.user,
              memberId: member._id,
            });
          });
        }
      });

      // Sort by timestamp (most recent first) and limit
      const recentActivity = allActivity
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, parseInt(limit));

      res.status(200).json({
        success: true,
        data: {
          activity: recentActivity,
          total: allActivity.length,
          teamMembersCount: teamMembers.length,
        },
      });
    } catch (error) {
      logger.error("Error fetching team activity:", error);
      next(error);
    }
  }

  /**
   * Get team member activity log
   * GET /api/v1/planner/team/:id/activity
   */
  async getTeamMemberActivity(req, res, next) {
    try {
      const plannerId = req.user.id;
      const { id } = req.params;
      const { limit = 50 } = req.query;

      logger.info("Fetching team member activity", { plannerId, memberId: id });

      const teamMember = await TeamMember.findOne({
        _id: id,
        planner: plannerId,
      })
        .select("activityLog user")
        .populate("user", "firstName lastName email");

      if (!teamMember) {
        throw new AppError("Team member not found", 404);
      }

      // Get recent activity
      const activity = teamMember.activityLog
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, parseInt(limit));

      res.status(200).json({
        success: true,
        data: {
          user: teamMember.user,
          activity,
          total: teamMember.activityLog.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get pending invitations
   * GET /api/v1/planner/team/invitations
   */
  async getPendingInvitations(req, res, next) {
    try {
      const plannerId = req.user.id;

      logger.info("Fetching pending invitations", { plannerId });

      const invitations = await TeamInvitation.find({
        planner: plannerId,
        status: "pending",
        expiresAt: { $gt: new Date() },
      })
        .select("-token")
        .populate("assignedEvents", "title eventType")
        .sort({ createdAt: -1 })
        .lean();

      res.status(200).json({
        success: true,
        data: {
          invitations,
          total: invitations.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cancel invitation
   * DELETE /api/v1/planner/team/invitations/:id
   */
  async cancelInvitation(req, res, next) {
    try {
      const plannerId = req.user.id;
      const { id } = req.params;

      logger.info("Cancelling invitation", { plannerId, invitationId: id });

      const invitation = await TeamInvitation.findOne({
        _id: id,
        planner: plannerId,
      });

      if (!invitation) {
        throw new AppError("Invitation not found", 404);
      }

      invitation.status = "expired";
      await invitation.save();

      res.status(200).json({
        success: true,
        message: "Invitation cancelled successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  // Helper methods

  _getTierLimits(planName) {
    const limits = {
      Starter: { teamMembers: 1 },
      Professional: { teamMembers: 3 },
      Business: { teamMembers: 10 },
      Enterprise: { teamMembers: Infinity },
    };

    return limits[planName] || limits.Starter;
  }
}

export default new PlannerTeamController();
