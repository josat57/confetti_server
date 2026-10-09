import mongoose from "mongoose";

/**
 * A video call between a client and a vendor (Diaspora Pass, roadmap Phase 10).
 * The room is a private Daily.co room (DAILY_API_KEY) or a Jitsi link; everyone
 * gets a calendar invite by email with their own join link.
 */
const meetingSchema = new mongoose.Schema(
  {
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", index: true }],
    // People without an account (a vendor's walk-in client), invited by email
    guestEmails: [{ type: String, lowercase: true, trim: true }],
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", index: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "VendorBooking", index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    agenda: { type: String, trim: true, maxlength: 2000 },
    startsAt: { type: Date, required: true, index: true },
    durationMinutes: { type: Number, min: 10, max: 240, default: 30 },
    timezone: { type: String, trim: true, maxlength: 60 }, // the organiser's, for display
    provider: { type: String, enum: ["jitsi", "daily"], default: "jitsi" },
    roomName: { type: String, required: true },
    url: { type: String, required: true },
    // Daily: a personal join token per participant (and guest email); never sent to others
    joinTokens: {
      type: [{ user: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, email: String, token: String, _id: false }],
      select: false,
    },
    status: { type: String, enum: ["scheduled", "cancelled"], default: "scheduled", index: true },
    sequence: { type: Number, default: 0 }, // calendar invite version
    cancelledAt: Date,
  },
  { timestamps: true }
);

const Meeting = mongoose.model("Meeting", meetingSchema);
export default Meeting;
