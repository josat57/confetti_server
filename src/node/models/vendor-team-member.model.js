import crypto from "crypto";
import mongoose from "mongoose";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Members of a vendor's team (used by controllers/team.controller.js).
 * Planner teams use models/team-member.model.js, which has a different shape.
 */
const vendorTeamMemberSchema = new mongoose.Schema(
  {
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    role: {
      type: String,
      enum: ["owner", "admin", "manager", "staff", "viewer"],
      default: "staff",
    },
    permissions: [{ type: String, trim: true }],
    status: {
      type: String,
      enum: ["pending", "active", "inactive", "declined"],
      default: "pending",
      index: true,
    },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    notes: { type: String, maxlength: 1000 },
    invitationToken: { type: String, index: true, sparse: true },
    invitationExpires: Date,
    joinedAt: Date,
    deactivatedAt: Date,
    lastActiveAt: Date,
  },
  { timestamps: true }
);

vendorTeamMemberSchema.index({ vendor: 1, user: 1 }, { unique: true });

vendorTeamMemberSchema.pre("save", function (next) {
  if (this.isNew && this.status === "pending" && !this.invitationToken) {
    this.invitationToken = crypto.randomBytes(32).toString("hex");
    this.invitationExpires = new Date(Date.now() + INVITATION_TTL_MS);
  }
  next();
});

vendorTeamMemberSchema.virtual("isInvitationExpired").get(function () {
  return Boolean(this.invitationExpires && this.invitationExpires < new Date());
});

vendorTeamMemberSchema.methods.activate = function () {
  this.status = "active";
  this.joinedAt = new Date();
  this.lastActiveAt = new Date();
  this.invitationToken = undefined;
  this.invitationExpires = undefined;
  return this.save();
};

vendorTeamMemberSchema.methods.deactivate = function () {
  this.status = "inactive";
  this.deactivatedAt = new Date();
  return this.save();
};

const VendorTeamMember =
  mongoose.models.VendorTeamMember || mongoose.model("VendorTeamMember", vendorTeamMemberSchema);

export default VendorTeamMember;
