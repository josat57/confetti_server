import Vendor from "../models/vendor.model.js";
import User from "../models/user.model.js";
import { inviteTeamMember as vendorInviteTeamMember } from "./team.controller.js";

/**
 * Helper function to determine user type
 */
async function getUserType(user) {
  // Check if user is a vendor
  const vendor = await Vendor.findOne({ owner: user._id });

  if (vendor) {
    return { type: "vendor", vendor };
  }

  // Check if user is an event planner
  if (user.role === "event_planner" || user.role === "planner") {
    return { type: "planner" };
  }

  return { type: "unknown" };
}

/**
 * Smart team router that redirects to appropriate team endpoint
 * based on user role
 */
export const getTeamRoute = async (req, res, next) => {
  try {
    const user = req.user;
    const userType = await getUserType(user);

    if (userType.type === "vendor") {
      return res.status(200).json({
        status: "success",
        message: "Use vendor team endpoint",
        data: {
          endpoint: "/api/v1/vendors/team",
          userType: "vendor",
          vendorId: userType.vendor._id,
        },
      });
    }

    if (userType.type === "planner") {
      return res.status(200).json({
        status: "success",
        message: "Use planner team endpoint",
        data: {
          endpoint: "/api/v1/planner/team",
          userType: "planner",
        },
      });
    }

    // User doesn't have team access
    return res.status(403).json({
      status: "error",
      message: "Team management not available for your account type",
      data: {
        userRole: user.role,
        availableFor: ["vendor", "event_planner"],
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Proxy team invite to appropriate controller
 * POST /api/v1/team/invite
 */
export const inviteTeamMember = async (req, res, next) => {
  try {
    const user = req.user;
    const userType = await getUserType(user);

    if (userType.type === "vendor" || userType.type === "planner") {
      // Forward to the actual team controller
      // Both vendor and planner use the same team controller
      return vendorInviteTeamMember(req, res, next);
    }

    // User doesn't have team access
    return res.status(403).json({
      status: "error",
      message: "Team management not available for your account type",
      data: {
        userRole: user.role,
        availableFor: ["vendor", "event_planner"],
      },
    });
  } catch (error) {
    next(error);
  }
};
