import mongoose from "mongoose";

const announcementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Announcement title is required"],
      trim: true,
    },
    message: {
      type: String,
      required: [true, "Announcement message is required"],
    },
    type: {
      type: String,
      enum: ["info", "warning", "success", "error"],
      default: "info",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    targetAudience: {
      type: [String],
      enum: ["all", "users", "vendors", "admins", "event-planners"],
      default: ["all"],
    },
    isSticky: {
      type: Boolean,
      default: false,
    },
    scheduledFor: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    startDate: {
      type: Date,
      required: false,
    },
    endDate: {
      type: Date,
      required: false,
    },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    readBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    attachments: [
      {
        name: String,
        url: String,
        type: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes
announcementSchema.index({ status: 1, startDate: 1, endDate: 1 });
announcementSchema.index({ targetAudience: 1 });
announcementSchema.index({ createdBy: 1, createdAt: -1 });

const Announcement = mongoose.model("Announcement", announcementSchema);

export default Announcement;
