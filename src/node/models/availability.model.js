import mongoose from "mongoose";

const availabilitySchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: [true, "Vendor is required"],
      index: true,
    },
    date: {
      type: Date,
      required: [true, "Date is required"],
      index: true,
    },
    status: {
      type: String,
      enum: ["available", "booked", "blocked"],
      default: "available",
      index: true,
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
    },
    blockReason: {
      type: String,
      maxlength: [500, "Block reason cannot exceed 500 characters"],
    },
    notes: {
      type: String,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
    },
    timeSlots: [
      {
        startTime: {
          type: String,
          required: true,
          match: [
            /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
            "Invalid time format (HH:MM)",
          ],
        },
        endTime: {
          type: String,
          required: true,
          match: [
            /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
            "Invalid time format (HH:MM)",
          ],
        },
        isAvailable: {
          type: Boolean,
          default: true,
        },
        booking: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Booking",
        },
      },
    ],
    // Recurring availability settings
    isRecurring: {
      type: Boolean,
      default: false,
    },
    recurringPattern: {
      frequency: {
        type: String,
        enum: ["daily", "weekly", "monthly"],
      },
      interval: {
        type: Number,
        min: 1,
      },
      daysOfWeek: [
        {
          type: Number,
          min: 0,
          max: 6, // 0 = Sunday, 6 = Saturday
        },
      ],
      endDate: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
availabilitySchema.index({ vendor: 1, date: 1 }, { unique: true });
availabilitySchema.index({ vendor: 1, status: 1, date: 1 });

// Virtual for checking if date is in the past
availabilitySchema.virtual("isPast").get(function () {
  return this.date < new Date();
});

// Method to check if a specific time slot is available
availabilitySchema.methods.isTimeSlotAvailable = function (startTime, endTime) {
  if (this.status !== "available") {
    return false;
  }

  if (!this.timeSlots || this.timeSlots.length === 0) {
    return true; // No time slots means full day is available
  }

  // Check if requested time overlaps with any unavailable slot
  for (const slot of this.timeSlots) {
    if (!slot.isAvailable) {
      if (
        (startTime >= slot.startTime && startTime < slot.endTime) ||
        (endTime > slot.startTime && endTime <= slot.endTime) ||
        (startTime <= slot.startTime && endTime >= slot.endTime)
      ) {
        return false;
      }
    }
  }

  return true;
};

// Method to block a date
availabilitySchema.methods.block = function (reason, notes) {
  this.status = "blocked";
  this.blockReason = reason;
  if (notes) {
    this.notes = notes;
  }
  return this.save();
};

// Method to unblock a date
availabilitySchema.methods.unblock = function () {
  this.status = "available";
  this.blockReason = undefined;
  this.booking = undefined;
  return this.save();
};

// Method to mark as booked
availabilitySchema.methods.markAsBooked = function (bookingId) {
  this.status = "booked";
  this.booking = bookingId;
  return this.save();
};

// Static method to get availability for a date range
availabilitySchema.statics.getAvailabilityRange = async function (
  vendorId,
  startDate,
  endDate
) {
  return this.find({
    vendor: vendorId,
    date: {
      $gte: startDate,
      $lte: endDate,
    },
  }).sort({ date: 1 });
};

// Static method to check if vendor is available on a specific date
availabilitySchema.statics.isVendorAvailable = async function (vendorId, date) {
  const availability = await this.findOne({
    vendor: vendorId,
    date: {
      $gte: new Date(date.setHours(0, 0, 0, 0)),
      $lt: new Date(date.setHours(23, 59, 59, 999)),
    },
  });

  if (!availability) {
    return true; // No record means available by default
  }

  return availability.status === "available";
};

// Static method to get available dates in a range
availabilitySchema.statics.getAvailableDates = async function (
  vendorId,
  startDate,
  endDate
) {
  const availabilities = await this.find({
    vendor: vendorId,
    date: {
      $gte: startDate,
      $lte: endDate,
    },
    status: "available",
  }).select("date timeSlots");

  return availabilities.map((a) => ({
    date: a.date,
    hasTimeSlots: a.timeSlots && a.timeSlots.length > 0,
    availableSlots: a.timeSlots
      ? a.timeSlots.filter((slot) => slot.isAvailable)
      : [],
  }));
};

// Pre-save middleware to validate date
availabilitySchema.pre("save", function (next) {
  // Ensure date is set to start of day
  if (this.date) {
    this.date = new Date(this.date.setHours(0, 0, 0, 0));
  }

  // Validate time slots
  if (this.timeSlots && this.timeSlots.length > 0) {
    for (const slot of this.timeSlots) {
      if (slot.startTime >= slot.endTime) {
        return next(new Error("Start time must be before end time"));
      }
    }
  }

  next();
});

const Availability = mongoose.model("Availability", availabilitySchema);

export default Availability;
