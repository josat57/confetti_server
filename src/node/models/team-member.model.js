import mongoose from "mongoose";

const teamMemberSchema = new mongoose.Schema(
  {
    planner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["admin", "manager", "coordinator"],
      default: "coordinator",
      required: true,
    },
    assignedEvents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Event",
      },
    ],
    permissions: {
      canCreateEvents: {
        type: Boolean,
        default: false,
      },
      canEditEvents: {
        type: Boolean,
        default: true,
      },
      canDeleteEvents: {
        type: Boolean,
        default: false,
      },
      canManageTasks: {
        type: Boolean,
        default: true,
      },
      canManageGuests: {
        type: Boolean,
        default: true,
      },
      canManageBudget: {
        type: Boolean,
        default: false,
      },
      canInviteTeam: {
        type: Boolean,
        default: false,
      },
    },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
    },
    invitedAt: {
      type: Date,
      default: Date.now,
    },
    joinedAt: Date,
    lastActiveAt: Date,
    activityLog: [
      {
        action: {
          type: String,
          required: true,
        },
        details: mongoose.Schema.Types.Mixed,
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound indexes
teamMemberSchema.index({ planner: 1, user: 1 }, { unique: true });
teamMemberSchema.index({ planner: 1, status: 1 });
teamMemberSchema.index({ user: 1, status: 1 });

// Set permissions based on role
teamMemberSchema.pre("save", function (next) {
  if (this.isModified("role")) {
    switch (this.role) {
      case "admin":
        this.permissions = {
          canCreateEvents: true,
          canEditEvents: true,
          canDeleteEvents: true,
          canManageTasks: true,
          canManageGuests: true,
          canManageBudget: true,
          canInviteTeam: true,
        };
        break;
      case "manager":
        this.permissions = {
          canCreateEvents: true,
          canEditEvents: true,
          canDeleteEvents: false,
          canManageTasks: true,
          canManageGuests: true,
          canManageBudget: true,
          canInviteTeam: false,
        };
        break;
      case "coordinator":
        this.permissions = {
          canCreateEvents: false,
          canEditEvents: true,
          canDeleteEvents: false,
          canManageTasks: true,
          canManageGuests: true,
          canManageBudget: false,
          canInviteTeam: false,
        };
        break;
    }
  }
  next();
});

// Methods
teamMemberSchema.methods.logActivity = function (action, details = {}) {
  this.activityLog.push({
    action,
    details,
    timestamp: new Date(),
  });
  this.lastActiveAt = new Date();
  return this.save();
};

teamMemberSchema.methods.hasPermission = function (permission) {
  return this.permissions[permission] === true;
};

teamMemberSchema.methods.canAccessEvent = function (eventId) {
  if (this.role === "admin") return true;
  return this.assignedEvents.some((id) => id.equals(eventId));
};

teamMemberSchema.methods.assignToEvent = function (eventId) {
  if (!this.assignedEvents.some((id) => id.equals(eventId))) {
    this.assignedEvents.push(eventId);
  }
  return this.save();
};

teamMemberSchema.methods.unassignFromEvent = function (eventId) {
  this.assignedEvents = this.assignedEvents.filter((id) => !id.equals(eventId));
  return this.save();
};

const TeamMember = mongoose.model("TeamMember", teamMemberSchema);

export default TeamMember;
