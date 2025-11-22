import mongoose from "mongoose";
import crypto from "crypto";

const teamInvitationSchema = new mongoose.Schema(
  {
    planner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
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
    token: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "expired"],
      default: "pending",
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    acceptedAt: Date,
    acceptedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
teamInvitationSchema.index({ planner: 1, email: 1 });
teamInvitationSchema.index({ token: 1 });
teamInvitationSchema.index({ status: 1, expiresAt: 1 });

// Generate invitation token
teamInvitationSchema.methods.generateToken = function () {
  const token = crypto.randomBytes(32).toString("hex");
  this.token = crypto.createHash("sha256").update(token).digest("hex");
  return token; // Return unhashed token for email
};

// Check if invitation is expired
teamInvitationSchema.methods.isExpired = function () {
  return this.expiresAt < new Date() || this.status === "expired";
};

// Accept invitation
teamInvitationSchema.methods.accept = async function (userId) {
  if (this.isExpired()) {
    throw new Error("Invitation has expired");
  }
  if (this.status !== "pending") {
    throw new Error("Invitation is no longer pending");
  }

  this.status = "accepted";
  this.acceptedAt = new Date();
  this.acceptedBy = userId;
  return this.save();
};

// Decline invitation
teamInvitationSchema.methods.decline = async function () {
  if (this.status !== "pending") {
    throw new Error("Invitation is no longer pending");
  }

  this.status = "declined";
  return this.save();
};

// Static method to find by token
teamInvitationSchema.statics.findByToken = async function (token) {
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
  return this.findOne({ token: hashedToken, status: "pending" });
};

const TeamInvitation = mongoose.model("TeamInvitation", teamInvitationSchema);

export default TeamInvitation;
