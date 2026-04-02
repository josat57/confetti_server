import mongoose from "mongoose";

const aiEventPlanRequestSchema = new mongoose.Schema(
  {
    sessionToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    eventType: {
      type: String,
      required: true,
      trim: true,
      // No enum restriction - accept any event type
    },
    eventDate: {
      type: Date,
      required: true,
      validate: {
        validator: function (value) {
          return value > new Date();
        },
        message: "Event date must be in the future",
      },
    },
    guestCount: {
      type: Number,
      required: true,
      min: [1, "Guest count must be at least 1"],
      max: [10000, "Guest count cannot exceed 10,000"],
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: false, // Make optional since frontend may not have GPS
      },
      address: {
        type: String,
        required: false, // Make optional
      },
      city: {
        type: String,
        required: true,
      },
      state: {
        type: String,
        required: true,
      },
      country: {
        type: String,
        default: "Nigeria",
      },
      zipCode: {
        type: String,
        required: false,
      },
    },
    eventDescription: {
      type: String,
      required: true,
      minlength: [50, "Event description must be at least 50 characters"],
      maxlength: [1000, "Event description cannot exceed 1000 characters"],
    },
    guestClass: {
      ageGroups: [
        {
          type: String,
          enum: ["children", "teenagers", "young_adults", "adults", "seniors"],
        },
      ],
      formality: {
        type: String,
        enum: ["casual", "semi-formal", "formal", "black-tie"],
        default: "casual",
      },
      socialStatus: [
        {
          type: String,
          enum: ["budget-conscious", "middle-class", "affluent", "luxury"],
        },
      ],
      specialRequirements: [
        {
          type: String,
          enum: [
            "dietary-restrictions",
            "accessibility-needs",
            "cultural-considerations",
            "religious-considerations",
          ],
        },
      ],
      additionalDetails: {
        type: String,
        maxlength: 500,
      },
    },
    budget: {
      amount: {
        type: Number,
        required: true,
        min: [0, "Budget cannot be negative"],
      },
      currency: {
        type: String,
        default: "NGN",
        enum: ["NGN", "USD", "EUR", "GBP"],
      },
      budgetFlexibility: {
        type: String,
        enum: ["strict", "moderate", "flexible"],
        default: "moderate",
      },
    },
    status: {
      type: String,
      enum: ["processing", "completed", "failed"],
      default: "processing",
      index: true,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
aiEventPlanRequestSchema.index(
  { "location.coordinates": "2dsphere" },
  { sparse: true }
); // Sparse index for optional coordinates
aiEventPlanRequestSchema.index({ "location.city": 1, "location.state": 1 }); // Index for city/state queries
aiEventPlanRequestSchema.index({ createdAt: 1 });
aiEventPlanRequestSchema.index({ expiresAt: 1 });
aiEventPlanRequestSchema.index({ userId: 1 });
aiEventPlanRequestSchema.index({ status: 1, createdAt: -1 });

// Virtual for checking if expired
aiEventPlanRequestSchema.virtual("isExpired").get(function () {
  return this.expiresAt < new Date();
});

// Virtual for time until expiration
aiEventPlanRequestSchema.virtual("timeUntilExpiration").get(function () {
  const now = new Date();
  if (this.expiresAt < now) return 0;
  return Math.ceil((this.expiresAt - now) / (1000 * 60 * 60)); // Hours
});

// Method to check if request is valid
aiEventPlanRequestSchema.methods.isValid = function () {
  return this.status === "completed" && !this.isExpired;
};

// Static method to cleanup expired requests
aiEventPlanRequestSchema.statics.cleanupExpired = async function () {
  const result = await this.deleteMany({
    expiresAt: { $lt: new Date() },
  });
  return result.deletedCount;
};

const AIEventPlanRequest = mongoose.model(
  "AIEventPlanRequest",
  aiEventPlanRequestSchema
);

export default AIEventPlanRequest;
