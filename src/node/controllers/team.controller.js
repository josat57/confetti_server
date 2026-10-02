// Vendor teams have their own model (planner teams use team-member.model.js)
import TeamMember from "../models/vendor-team-member.model.js";
import Vendor from "../models/vendor.model.js";
import User from "../models/user.model.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";
import crypto from "crypto";
import { sendEmailDirect } from "../utils/email.js";

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
      .populate("user", "firstName lastName email")
      .populate("invitedBy", "firstName lastName email")
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
      .populate("invitedBy", "firstName lastName email");

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
      const localPart = email.toLowerCase().split("@")[0].replace(/[^a-z0-9._-]/g, "") || "member";
      user = await User.create({
        email: email.toLowerCase(),
        // username is unique: suffix avoids clashes with existing accounts
        username: `${localPart}_${crypto.randomBytes(3).toString("hex")}`,
        firstName: localPart,
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

    // Create the invitation (re-inviting a declined/inactive member reuses their record)
    let teamMember;
    if (existingMember) {
      existingMember.set({
        role: role || "staff",
        permissions: permissions || [],
        invitedBy: req.user._id,
        notes,
        status: "pending",
        invitationToken: crypto.randomBytes(32).toString("hex"),
        invitationExpires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
      teamMember = await existingMember.save();
    } else {
      teamMember = await TeamMember.create({
        vendor: vendor._id,
        user: user._id,
        role: role || "staff",
        permissions: permissions || [],
        invitedBy: req.user._id,
        notes,
        status: "pending",
      });
    }

    await teamMember.populate("user", "firstName lastName email");
    await teamMember.populate("invitedBy", "firstName lastName email");

    // Send invitation email
    try {
      const invitationLink = `${process.env.FRONTEND_URL}/team/accept/${teamMember.invitationToken}`;
      await sendEmailDirect({
        to: email,
        subject: `You're invited to join ${vendor.businessName || vendor.displayName} on Confetti`,
        html: `
          <h2>Team Invitation</h2>
          <p>Hi there,</p>
          <p><strong>${[req.user.firstName, req.user.lastName].filter(Boolean).join(" ") || req.user.email}</strong> has invited you to join the <strong>${vendor.businessName || vendor.displayName}</strong> team on Confetti as a <strong>${role || "staff"}</strong>.</p>
          <p>Click the button below to accept your invitation:</p>
          <p>
            <a href="${invitationLink}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:6px;">Accept Invitation</a>
          </p>
          <p>This invitation expires in 7 days. If you did not expect this invitation, you can safely ignore this email.</p>
          <p>Or copy this link: ${invitationLink}</p>
        `,
      });
    } catch (emailError) {
      logger.error(`Failed to send invitation email to ${email}:`, emailError.message);
    }
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
      .populate("invitedBy", "firstName lastName email");

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
    await teamMember.populate("user", "firstName lastName email");

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
    await teamMember.populate("user", "firstName lastName email");

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
    await teamMember.populate("user", "firstName lastName email");

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
    await teamMember.populate("user", "firstName lastName email");

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
      .populate("user", "firstName lastName email")
      .select("user role lastActiveAt")
      .sort({ lastActiveAt: -1 })
      .limit(parseInt(limit))
      .skip((page - 1) * limit);

    // Fetch audit logs for this vendor's team actions
    let auditActivities = [];
    try {
      const AuditLog = (await import("../models/auditLog.model.js")).default;
      const logs = await AuditLog.find({
        resource: "team_member",
        "changes.vendorId": vendor._id.toString(),
      })
        .populate("admin", "firstName lastName email")
        .sort({ timestamp: -1 })
        .limit(parseInt(limit))
        .skip((page - 1) * limit)
        .lean();

      auditActivities = logs.map((log) => ({
        action: log.action,
        performedBy: log.admin,
        resourceId: log.resourceId,
        changes: log.changes,
        timestamp: log.timestamp,
      }));
    } catch (_) {
      // Audit log collection may not exist yet; fall through to basic activity
    }

    const basicActivities = teamMembers.map((member) => ({
      user: member.user,
      role: member.role,
      lastActiveAt: member.lastActiveAt,
      action: "last_seen",
    }));

    res.status(200).json({
      status: "success",
      results: teamMembers.length,
      data: {
        activities: auditActivities.length ? auditActivities : basicActivities,
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
    }).populate("user", "firstName lastName email");

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

    // Send invitation email
    try {
      const invitationLink = `${process.env.FRONTEND_URL}/team/accept/${teamMember.invitationToken}`;
      await sendEmailDirect({
        to: teamMember.user.email,
        subject: `Reminder: You have a pending team invitation on Confetti`,
        html: `
          <h2>Team Invitation Reminder</h2>
          <p>Hi ${teamMember.user.firstName || "there"},</p>
          <p>This is a reminder that you have a pending invitation to join a team on Confetti.</p>
          <p>Click the button below to accept your invitation:</p>
          <p>
            <a href="${invitationLink}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:6px;">Accept Invitation</a>
          </p>
          <p>This invitation expires in 7 days.</p>
          <p>Or copy this link: ${invitationLink}</p>
        `,
      });
    } catch (emailError) {
      logger.error(`Failed to resend invitation email:`, emailError.message);
    }

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
