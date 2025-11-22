import TeamMember from "../models/team-member.model.js";
import Vendor from "../models/vendor.model.js";
import User from "../models/user.model.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";
import crypto from "crypto";

/**
 * Get all team members
 * GET /api/v1/vendors/team
 */
export const getTeamMembers = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    const { status, role, page = 1, limit = 20 } = req.query;

    // Build query
    const query = { vendor: vendor._id };
    if (status) query.status = status;
    if (role) query.role = role;

    const skip = (page - 1) * limit;

    const teamMembers = await TeamMember.find(query)
      .populate("user", "name email")
      .populate("invitedBy", "name email")
      .sort({ role: 1, createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await TeamMember.countDocuments(query);

    // Get statistics
    const stats = await TeamMember.aggregate([
      { $match: { vendor: vendor._id } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const statusCounts = {
      active: 0,
      pending: 0,
      inactive: 0,
      declined: 0,
    };

    stats.forEach((stat) => {
      statusCounts[stat._id] = stat.count;
    });

    res.status(200).json({
      status: "success",
      results: teamMembers.length,
      data: {
        teamMembers,
        stats: statusCounts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single team member
 * GET /api/v1/vendors/team/:id
 */
export const getTeamMember = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    const teamMember = await TeamMember.findOne({
      _id: req.params.id,
      vendor: vendor._id,
    })
      .populate("user", "name email phone")
      .populate("invitedBy", "name email");

    if (!teamMember) {
      return next(new AppError("Team member not found", 404));
    }

    res.status(200).json({
      status: "success",
      data: { teamMember },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Invite team member
 * POST /api/v1/vendors/team/invite
 */
export const inviteTeamMember = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    const { email, role, permissions, notes } = req.body;

    if (!email) {
      return next(new AppError("Email is required", 400));
    }

    // Check if user exists
    let user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // Create a placeholder user account
      user = await User.create({
        email: email.toLowerCase(),
        name: email.split("@")[0],
        password: crypto.randomBytes(32).toString("hex"), // Random password
        role: "vendor",
        isActive: false, // Will be activated when they accept invitation
      });
    }

    // Check if already a team member
    const existingMember = await TeamMember.findOne({
      vendor: vendor._id,
      user: user._id,
    });

    if (existingMember) {
      if (existingMember.status === "active") {
        return next(new AppError("User is already a team member", 400));
      } else if (existingMember.status === "pending") {
        return next(new AppError("Invitation already sent to this user", 400));
      }
    }

    // Create team member invitation
    const teamMember = await TeamMember.create({
      vendor: vendor._id,
      user: user._id,
      role: role || "staff",
      permissions: permissions || [],
      invitedBy: req.user._id,
      notes,
      status: "pending",
    });

    await teamMember.populate("user", "name email");
    await teamMember.populate("invitedBy", "name email");

    // TODO: Send invitation email
    logger.info(`Team invitation sent to ${email} for vendor ${vendor._id}`);

    res.status(201).json({
      status: "success",
      message: "Team member invitation sent successfully",
      data: {
        teamMember,
        invitationToken: teamMember.invitationToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Accept team invitation
 * POST /api/v1/vendors/team/accept/:token
 */
export const acceptInvitation = async (req, res, next) => {
  try {
    const { token } = req.params;

    const teamMember = await TeamMember.findOne({
      invitationToken: token,
      status: "pending",
    })
      .populate("vendor", "businessName displayName")
      .populate("invitedBy", "name email");

    if (!teamMember) {
      return next(new AppError("Invalid or expired invitation", 400));
    }

    // Check if invitation is expired
    if (teamMember.isInvitationExpired) {
      return next(new AppError("Invitation has expired", 400));
    }

    // Check if the user accepting is the invited user
    if (teamMember.user.toString() !== req.user._id.toString()) {
      return next(
        new AppError("You are not authorized to accept this invitation", 403)
      );
    }

    // Activate the team member
    await teamMember.activate();

    // Activate user account if it was inactive
    const user = await User.findById(req.user._id);
    if (!user.isActive) {
      user.isActive = true;
      await user.save();
    }

    res.status(200).json({
      status: "success",
      message: "Invitation accepted successfully",
      data: { teamMember },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Decline team invitation
 * POST /api/v1/vendors/team/decline/:token
 */
export const declineInvitation = async (req, res, next) => {
  try {
    const { token } = req.params;

    const teamMember = await TeamMember.findOne({
      invitationToken: token,
      status: "pending",
    });

    if (!teamMember) {
      return next(new AppError("Invalid or expired invitation", 400));
    }

    // Check if the user declining is the invited user
    if (teamMember.user.toString() !== req.user._id.toString()) {
      return next(
        new AppError("You are not authorized to decline this invitation", 403)
      );
    }

    teamMember.status = "declined";
    teamMember.invitationToken = undefined;
    teamMember.invitationExpires = undefined;
    await teamMember.save();

    res.status(200).json({
      status: "success",
      message: "Invitation declined",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update team member role
 * PUT /api/v1/vendors/team/:id/role
 */
export const updateMemberRole = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    const { role, permissions } = req.body;

    if (!role) {
      return next(new AppError("Role is required", 400));
    }

    const teamMember = await TeamMember.findOne({
      _id: req.params.id,
      vendor: vendor._id,
    });

    if (!teamMember) {
      return next(new AppError("Team member not found", 404));
    }

    // Cannot change role of vendor owner
    if (teamMember.user.toString() === vendor.owner.toString()) {
      return next(new AppError("Cannot change role of vendor owner", 400));
    }

    teamMember.role = role;
    if (permissions) {
      teamMember.permissions = permissions;
    }

    await teamMember.save();
    await teamMember.populate("user", "name email");

    res.status(200).json({
      status: "success",
      message: "Team member role updated successfully",
      data: { teamMember },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update team member permissions
 * PUT /api/v1/vendors/team/:id/permissions
 */
export const updateMemberPermissions = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    const { permissions } = req.body;

    if (!permissions || !Array.isArray(permissions)) {
      return next(new AppError("Permissions array is required", 400));
    }

    const teamMember = await TeamMember.findOne({
      _id: req.params.id,
      vendor: vendor._id,
    });

    if (!teamMember) {
      return next(new AppError("Team member not found", 404));
    }

    teamMember.permissions = permissions;
    await teamMember.save();
    await teamMember.populate("user", "name email");

    res.status(200).json({
      status: "success",
      message: "Permissions updated successfully",
      data: { teamMember },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove team member
 * DELETE /api/v1/vendors/team/:id
 */
export const removeTeamMember = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    const teamMember = await TeamMember.findOne({
      _id: req.params.id,
      vendor: vendor._id,
    });

    if (!teamMember) {
      return next(new AppError("Team member not found", 404));
    }

    // Cannot remove vendor owner
    if (teamMember.user.toString() === vendor.owner.toString()) {
      return next(new AppError("Cannot remove vendor owner", 400));
    }

    await TeamMember.findByIdAndDelete(teamMember._id);

    res.status(200).json({
      status: "success",
      message: "Team member removed successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Deactivate team member
 * POST /api/v1/vendors/team/:id/deactivate
 */
export const deactivateTeamMember = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    const teamMember = await TeamMember.findOne({
      _id: req.params.id,
      vendor: vendor._id,
    });

    if (!teamMember) {
      return next(new AppError("Team member not found", 404));
    }

    // Cannot deactivate vendor owner
    if (teamMember.user.toString() === vendor.owner.toString()) {
      return next(new AppError("Cannot deactivate vendor owner", 400));
    }

    await teamMember.deactivate();
    await teamMember.populate("user", "name email");

    res.status(200).json({
      status: "success",
      message: "Team member deactivated successfully",
      data: { teamMember },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reactivate team member
 * POST /api/v1/vendors/team/:id/reactivate
 */
export const reactivateTeamMember = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    const teamMember = await TeamMember.findOne({
      _id: req.params.id,
      vendor: vendor._id,
    });

    if (!teamMember) {
      return next(new AppError("Team member not found", 404));
    }

    if (teamMember.status !== "inactive") {
      return next(new AppError("Team member is not inactive", 400));
    }

    teamMember.status = "active";
    await teamMember.save();
    await teamMember.populate("user", "name email");

    res.status(200).json({
      status: "success",
      message: "Team member reactivated successfully",
      data: { teamMember },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get team activity log
 * GET /api/v1/vendors/team/activity
 */
export const getTeamActivity = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    const { limit = 50, page = 1 } = req.query;

    // Get recent team member activities
    const teamMembers = await TeamMember.find({
      vendor: vendor._id,
      status: "active",
    })
      .populate("user", "name email")
      .select("user role lastActiveAt")
      .sort({ lastActiveAt: -1 })
      .limit(parseInt(limit))
      .skip((page - 1) * limit);

    // TODO: Implement comprehensive activity logging
    // For now, return basic team member info with last active times

    res.status(200).json({
      status: "success",
      results: teamMembers.length,
      data: {
        activities: teamMembers.map((member) => ({
          user: member.user,
          role: member.role,
          lastActiveAt: member.lastActiveAt,
          action: "active",
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Resend invitation
 * POST /api/v1/vendors/team/:id/resend
 */
export const resendInvitation = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    const teamMember = await TeamMember.findOne({
      _id: req.params.id,
      vendor: vendor._id,
      status: "pending",
    }).populate("user", "name email");

    if (!teamMember) {
      return next(
        new AppError("Pending team member invitation not found", 404)
      );
    }

    // Generate new invitation token
    teamMember.invitationToken = crypto.randomBytes(32).toString("hex");
    teamMember.invitationExpires = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    );
    await teamMember.save();

    // TODO: Send invitation email

    res.status(200).json({
      status: "success",
      message: "Invitation resent successfully",
      data: {
        teamMember,
        invitationToken: teamMember.invitationToken,
      },
    });
  } catch (error) {
    next(error);
  }
};
