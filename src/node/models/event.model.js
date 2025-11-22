import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Event title is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Event description is required"],
      trim: true,
    },
    eventType: {
      type: String,
      required: [true, "Event type is required"],
      enum: ["wedding", "birthday", "corporate", "social", "other"],
    },
    startDate: {
      type: Date,
      required: [true, "Event start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "Event end date is required"],
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        required: false, // Made optional
      },
      address: {
        street: String,
        city: String,
        state: String,
        country: String,
        zipCode: String,
      },
    },
    budget: {
      amount: {
        type: Number,
        required: false, // Made optional
        min: [0, "Budget cannot be negative"],
      },
      currency: {
        type: String,
        default: "NGN",
        enum: ["NGN", "USD", "EUR", "GBP"],
      },
    },
    guestCount: {
      type: Number,
      required: false, // Made optional
      min: [1, "Guest count must be at least 1"],
    },
    status: {
      type: String,
      enum: ["draft", "published", "cancelled", "completed"],
      default: "draft",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Made optional - will use createdBy if not provided
    },
    planner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Optional event planner
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: false, // Optional client reference
    },
    vendors: [
      {
        vendor: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Vendor",
        },
        role: {
          type: String,
          required: true,
        },
        status: {
          type: String,
          enum: ["pending", "accepted", "rejected", "completed"],
          default: "pending",
        },
        contract: {
          amount: Number,
          currency: {
            type: String,
            default: "NGN",
            enum: ["NGN", "USD", "EUR", "GBP"],
          },
          status: {
            type: String,
            enum: ["pending", "paid", "refunded"],
            default: "pending",
          },
        },
      },
    ],
    guests: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        status: {
          type: String,
          enum: ["invited", "confirmed", "declined"],
          default: "invited",
        },
        plusOne: {
          type: Boolean,
          default: false,
        },
      },
    ],
    tasks: [
      {
        title: {
          type: String,
          required: true,
        },
        description: String,
        dueDate: Date,
        status: {
          type: String,
          enum: ["pending", "in_progress", "completed"],
          default: "pending",
        },
        assignedTo: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],
    timeline: [
      {
        title: {
          type: String,
          required: true,
        },
        description: String,
        startTime: Date,
        endTime: Date,
        location: String,
      },
    ],
    media: [
      {
        type: {
          type: String,
          enum: ["image", "video"],
          required: true,
        },
        url: {
          type: String,
        },
        fileId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "uploads.files",
        },
        caption: String,
        uploadedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    settings: {
      isPrivate: {
        type: Boolean,
        default: false,
      },
      allowGuestInvites: {
        type: Boolean,
        default: false,
      },
      notifications: {
        email: { type: Boolean, default: true },
        push: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
      },
    },
    category: {
      type: String,
      required: false, // Made optional
    },
    capacity: {
      type: Number,
      required: false, // Made optional
    },
    price: {
      amount: {
        type: Number,
        required: false, // Made optional
      },
      currency: {
        type: String,
        default: "USD",
      },
    },
    registrationDeadline: Date,
    image: String,
    imageFileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "uploads.files",
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    attendees: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        registrationDate: {
          type: Date,
          default: Date.now,
        },
        status: {
          type: String,
          enum: ["registered", "attended", "cancelled"],
          default: "registered",
        },
      },
    ],
    schedule: [
      {
        title: String,
        description: String,
        startTime: Date,
        endTime: Date,
        speaker: String,
      },
    ],
    feedback: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        rating: {
          type: Number,
          min: 1,
          max: 5,
        },
        comment: String,
        createdAt: {
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

// Indexes
eventSchema.index({ startDate: 1, endDate: 1 });
eventSchema.index({ "location.coordinates": "2dsphere" });
eventSchema.index({ status: 1, category: 1 });

// Virtual for event duration in hours
eventSchema.virtual("duration").get(function () {
  return (this.endDate - this.startDate) / (1000 * 60 * 60);
});

// Virtual for days until event
eventSchema.virtual("daysUntil").get(function () {
  return Math.ceil((this.startDate - new Date()) / (1000 * 60 * 60 * 24));
});

// Virtual for confirmed guest count
eventSchema.virtual("confirmedGuestCount").get(function () {
  return this.guests.filter((guest) => guest.status === "confirmed").length;
});

// Method to check if event is in the past
eventSchema.methods.isPast = function () {
  return this.endDate < new Date();
};

// Method to check if event is upcoming
eventSchema.methods.isUpcoming = function () {
  return this.startDate > new Date();
};

// Method to check if event is ongoing
eventSchema.methods.isOngoing = function () {
  const now = new Date();
  return this.startDate <= now && this.endDate >= now;
};

// Method to get event status
eventSchema.methods.getStatus = function () {
  if (this.status === "cancelled") return "cancelled";
  if (this.isPast()) return "completed";
  if (this.isUpcoming()) return "upcoming";
  if (this.isOngoing()) return "ongoing";
  return this.status;
};

// Method to remove a vendor from the event
eventSchema.methods.removeVendor = async function (vendorId) {
  this.vendors = this.vendors.filter(
    (vendor) => !vendor.vendor.equals(vendorId)
  );
  return this.save();
};

// Method to remove a guest from the event
eventSchema.methods.removeGuest = async function (guestId) {
  this.guests = this.guests.filter((guest) => !guest.user.equals(guestId));
  return this.save();
};

// Method to add a guest to the event
eventSchema.methods.addGuest = async function (userId, plusOne = false) {
  // Check if guest already exists
  const existingGuest = this.guests.find((guest) => guest.user.equals(userId));
  if (existingGuest) {
    throw new Error("Guest already exists");
  }

  this.guests.push({
    user: userId,
    status: "invited",
    plusOne,
  });
  return this.save();
};

const Event = mongoose.model("Event", eventSchema);

export default Event;
