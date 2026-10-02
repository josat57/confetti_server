import mongoose from "mongoose";

/** A saved conversation with the general AI planning assistant. */
const aiChatSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    userType: {
      type: String,
      enum: ["vendor", "planner", "user", "admin"],
      required: true,
    },
    title: { type: String, trim: true, maxlength: 200, default: "Planning Session" },
    status: {
      type: String,
      enum: ["active", "completed", "archived"],
      default: "active",
    },
    messages: [
      {
        role: { type: String, enum: ["user", "assistant"], required: true },
        content: { type: String, required: true, maxlength: 10000 },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    // Plan created from this conversation (AIPlan.planId)
    generatedPlanId: { type: String },
  },
  { timestamps: true }
);

aiChatSessionSchema.index({ userId: 1, updatedAt: -1 });

const AIChatSession = mongoose.model("AIChatSession", aiChatSessionSchema);

export default AIChatSession;
