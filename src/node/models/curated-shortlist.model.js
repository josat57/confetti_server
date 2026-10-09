import mongoose from "mongoose";

/**
 * Vendors picked by Confetti's team for a Celebration Plus event (roadmap Phase 8),
 * on top of the AI suggestions. The client describes what they need (brief); the team
 * adds vendors with a note on why; the client marks the ones they like.
 */
const shortlistSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: ["new", "requested", "in_progress", "ready"], default: "new", index: true },
    brief: {
      categories: [{ type: String, trim: true, maxlength: 60 }],
      budget: { type: Number, min: 0 }, // naira, for the vendors in the brief
      notes: { type: String, trim: true, maxlength: 2000 },
      submittedAt: Date,
    },
    items: [
      {
        vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true },
        category: { type: String, trim: true },
        note: { type: String, trim: true, maxlength: 1000 }, // why the team picked them
        addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
        addedAt: { type: Date, default: Date.now },
        clientStatus: { type: String, enum: ["new", "interested", "dismissed"], default: "new" },
      },
    ],
    readyAt: Date,
  },
  { timestamps: true }
);

const CuratedShortlist = mongoose.model("CuratedShortlist", shortlistSchema);
export default CuratedShortlist;
