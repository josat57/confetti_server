import mongoose from "mongoose";

/**
 * A planner's client portal for one event: invited people (private links),
 * approvals the planner asks for, and comments from both sides.
 */
const clientPortalSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true, unique: true },
    planner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    invites: [
      {
        name: { type: String, trim: true, maxlength: 100 },
        email: { type: String, trim: true, lowercase: true, required: true },
        token: { type: String, required: true }, // 64 hex chars; the portal link
        status: { type: String, enum: ["invited", "active", "revoked"], default: "invited" },
        invitedAt: { type: Date, default: Date.now },
        lastViewedAt: Date,
      },
    ],
    approvals: [
      {
        title: { type: String, required: true, trim: true, maxlength: 200 },
        description: { type: String, trim: true, maxlength: 2000 },
        amount: Number, // naira, optional (e.g. a quote to approve)
        status: { type: String, enum: ["pending", "approved", "changes_requested"], default: "pending" },
        requestedAt: { type: Date, default: Date.now },
        respondedAt: Date,
        respondedBy: String,
        response: { type: String, trim: true, maxlength: 2000 },
      },
    ],
    comments: [
      {
        author: { type: String, enum: ["planner", "client"], required: true },
        name: String,
        body: { type: String, required: true, trim: true, maxlength: 2000 },
        approval: { type: mongoose.Schema.Types.ObjectId },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

clientPortalSchema.index({ "invites.token": 1 });

const ClientPortal = mongoose.model("ClientPortal", clientPortalSchema);

export default ClientPortal;
