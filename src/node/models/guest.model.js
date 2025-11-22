import mongoose from "mongoose";

const guestSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    planner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Guest name is required"],
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    plusOne: {
      type: Boolean,
      default: false,
    },
    plusOneName: {
      type: String,
      trim: true,
    },
    rsvpStatus: {
      type: String,
      enum: ["pending", "accepted", "declined", "tentative"],
      default: "pending",
    },
    rsvpDate: Date,
    dietaryRestrictions: [String],
    specialRequirements: {
      type: String,
      trim: true,
    },
    tableAssignment: {
      type: String,
      trim: true,
    },
    seatNumber: Number,
    category: {
      type: String,
      trim: true,
    },
    relationship: {
      type: String,
      trim: true,
    },
    invitationSent: {
      type: Boolean,
      default: false,
    },
    invitationSentDate: Date,
    attended: {
      type: Boolean,
      default: false,
    },
    checkedInAt: Date,
    checkedInBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    notes: String,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
guestSchema.index({ event: 1, rsvpStatus: 1 });
guestSchema.index({ event: 1, tableAssignment: 1 });
guestSchema.index({ planner: 1, event: 1 });
guestSchema.index({ event: 1, category: 1 });

// Virtuals
guestSchema.virtual("guestCount").get(function () {
  return this.plusOne ? 2 : 1;
});

// Methods
guestSchema.methods.sendRSVP = function () {
  this.invitationSent = true;
  this.invitationSentDate = new Date();
  return this.save();
};

guestSchema.methods.updateRSVP = function (status) {
  this.rsvpStatus = status;
  this.rsvpDate = new Date();
  return this.save();
};

guestSchema.methods.checkIn = function (userId) {
  this.attended = true;
  this.checkedInAt = new Date();
  this.checkedInBy = userId;
  return this.save();
};

const Guest = mongoose.model("Guest", guestSchema);

export default Guest;
