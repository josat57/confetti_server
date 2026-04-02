import mongoose from "mongoose";

const vendorSchema = new mongoose.Schema(
  {
    // Owner reference (links to User model)
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      index: true,
    },

    // Basic Info
    name: {
      type: String,
      required: [true, "Vendor name is required"],
      trim: true,
    },
    businessName: {
      type: String,
      trim: true,
    },
    displayName: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
    },
    tagline: {
      type: String,
      maxlength: 150,
    },
    businessType: {
      type: String,
      required: [true, "Business type is required"],
      enum: [
        "catering",
        "venue",
        "decoration",
        "photography",
        "music",
        "other",
      ],
    },
    category: {
      type: String,
      enum: [
        "venue",
        "catering",
        "entertainment",
        "photography",
        "videography",
        "decoration",
        "florals",
        "transportation",
        "audio_visual",
        "event_planning",
        "security",
        "valet_parking",
        "rentals",
        "cake_desserts",
        "bar_services",
        "lighting",
        "invitations",
        "favors_gifts",
        "other",
      ],
      index: true,
    },
    eventTypes: [
      {
        type: String,
        enum: [
          "wedding",
          "corporate",
          "birthday",
          "graduation",
          "conference",
          "other",
        ],
      },
    ],
    averagePrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    priceRange: {
      min: {
        type: Number,
        default: 0,
      },
      max: {
        type: Number,
        default: 0,
      },
    },
    capacity: {
      type: Number,
      min: 0,
    },
    availabilityStatus: {
      type: String,
      enum: ["high", "medium", "low"],
      default: "medium",
    },
    description: {
      type: String,
      required: [true, "Description is required"],
    },
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      zipCode: String,
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    status: {
      type: String,
      enum: ["pending", "approved", "suspended", "rejected"],
      default: "pending",
    },

    // Featured Status
    isFeatured: {
      type: Boolean,
      default: false,
    },
    featuredUntil: Date,

    // Active Status
    isActive: {
      type: Boolean,
      default: true,
    },
    documents: [
      {
        type: {
          type: String,
          enum: ["license", "insurance", "certification", "other"],
        },
        url: String,
        verified: {
          type: Boolean,
          default: false,
        },
      },
    ],
    services: [
      {
        name: String,
        description: String,
        price: {
          amount: Number,
          currency: {
            type: String,
            default: "USD",
          },
        },
      },
    ],
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    reviewCount: {
      type: Number,
      default: 0,
    },
    subcategory: {
      type: String,
    },
    features: [String],
    images: [String],

    // Media (Enhanced)
    logo: {
      type: String,
    },
    logoFileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "uploads.files",
    },
    coverImage: {
      type: String,
    },
    coverImageFileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "uploads.files",
    },
    photos: [
      {
        url: String,
        fileId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "uploads.files",
        },
        caption: String,
        order: { type: Number, default: 0 },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    videos: [
      {
        url: String,
        fileId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "uploads.files",
        },
        thumbnail: String,
        title: String,
        duration: Number,
        uploadedAt: { type: Date, default: Date.now },
      },
    ],

    // Branding (Professional+)
    branding: {
      primaryColor: { type: String, default: "#6366F1" },
      secondaryColor: { type: String, default: "#10B981" },
      font: { type: String, default: "Inter" },
      customCSS: String,
    },

    // Business Hours
    businessHours: [
      {
        day: {
          type: String,
          enum: [
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
            "sunday",
          ],
        },
        open: String,
        close: String,
        closed: { type: Boolean, default: false },
      },
    ],

    // Service Area
    serviceArea: {
      cities: [String],
      states: [String],
      radius: Number, // in kilometers
    },

    // Social Media
    socialMedia: {
      facebook: String,
      instagram: String,
      twitter: String,
      linkedin: String,
      website: String,
    },

    // Stats
    stats: {
      profileViews: { type: Number, default: 0 },
      totalBookings: { type: Number, default: 0 },
      totalReviews: { type: Number, default: 0 },
      averageRating: { type: Number, default: 0 },
      responseTime: { type: Number, default: 0 }, // in hours
      responseRate: { type: Number, default: 0 }, // percentage
      totalRevenue: { type: Number, default: 0 },
    },

    // Verification
    isVerified: {
      type: Boolean,
      default: false,
    },
    verifiedAt: Date,

    // Business Profile Fields
    registrationNumber: {
      type: String,
      trim: true,
      maxlength: [50, "Registration number cannot exceed 50 characters"],
      validate: {
        validator: function (v) {
          if (!v) return true; // Optional field
          // Allow alphanumeric characters and common separators (hyphens, slashes)
          return /^[a-zA-Z0-9\-\/]+$/.test(v);
        },
        message:
          "Registration number can only contain alphanumeric characters, hyphens, and slashes",
      },
    },
    taxId: {
      type: String,
      trim: true,
      select: false, // Exclude from queries by default for security
    },
    yearEstablished: {
      type: Number,
      min: [1800, "Year must be after 1800"],
      max: [new Date().getFullYear(), "Year cannot be in the future"],
      validate: {
        validator: function (v) {
          if (!v) return true; // Optional field
          return Number.isInteger(v) && v.toString().length === 4;
        },
        message: "Year must be a four-digit number",
      },
    },
    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
      index: true,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    rejectionReason: String,

    reviews: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        rating: {
          type: Number,
          required: true,
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
    availability: [
      {
        date: Date,
        slots: [
          {
            startTime: Date,
            endTime: Date,
            isBooked: {
              type: Boolean,
              default: false,
            },
          },
        ],
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes
vendorSchema.index({ name: "text", description: "text" });
vendorSchema.index({ "location.coordinates": "2dsphere" });
vendorSchema.index({ status: 1, businessType: 1 });
vendorSchema.index({ category: 1, status: 1 });
vendorSchema.index({ eventTypes: 1 });
vendorSchema.index({ isVerified: 1, status: 1 });
vendorSchema.index({ rating: -1, reviewCount: -1 });
vendorSchema.index({ owner: 1 });
vendorSchema.index({ subscription: 1 });
vendorSchema.index({ isFeatured: 1, status: 1 });
vendorSchema.index({ verificationStatus: 1 });

// Virtual for full display name
vendorSchema.virtual("fullDisplayName").get(function () {
  return this.displayName || this.businessName || this.name;
});

// Method to check if vendor can access feature based on subscription
vendorSchema.methods.canAccessFeature = function (feature) {
  if (!this.subscription) return false;

  const featureMap = {
    unlimited_listings: ["professional", "business", "enterprise"],
    booking_calendar: ["professional", "business", "enterprise"],
    lead_management: ["professional", "business", "enterprise"],
    team_collaboration: ["business", "enterprise"],
    payment_processing: ["business", "enterprise"],
    api_access: ["enterprise"],
    white_label: ["enterprise"],
  };

  const allowedPlans = featureMap[feature] || [];
  return allowedPlans.includes(this.subscription.planName?.toLowerCase());
};

// Method to increment profile views
vendorSchema.methods.incrementViews = async function () {
  this.stats.profileViews += 1;
  await this.save();
};

// Method to update average rating
vendorSchema.methods.updateRating = async function () {
  try {
    // Check if Review model is registered
    let Review;
    try {
      Review = mongoose.model("Review");
    } catch (error) {
      // Review model not registered yet, skip rating update
      return;
    }

    const stats = await Review.aggregate([
      { $match: { vendor: this._id, status: "approved" } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: "$rating" },
          count: { $sum: 1 },
        },
      },
    ]);

    if (stats.length > 0) {
      this.stats.averageRating = Math.round(stats[0].avgRating * 10) / 10;
      this.stats.totalReviews = stats[0].count;
      this.rating = this.stats.averageRating;
      this.reviewCount = this.stats.totalReviews;
    } else {
      // No reviews found, set defaults
      this.stats.averageRating = 0;
      this.stats.totalReviews = 0;
      this.rating = 0;
      this.reviewCount = 0;
    }

    await this.save();
  } catch (error) {
    // Log error but don't throw - rating update is not critical
    console.error("Error updating vendor rating:", error.message);
  }
};

// Method to check if vendor is featured
vendorSchema.methods.isFeaturedNow = function () {
  if (!this.isFeatured) return false;
  if (!this.featuredUntil) return true;
  return new Date() < this.featuredUntil;
};

// Method to verify business profile
vendorSchema.methods.verifyBusinessProfile = async function (adminId) {
  this.verificationStatus = "verified";
  this.verifiedAt = new Date();
  this.verifiedBy = adminId;
  this.rejectionReason = undefined;
  return this.save();
};

// Method to reject business profile
vendorSchema.methods.rejectBusinessProfile = async function (adminId, reason) {
  this.verificationStatus = "rejected";
  this.verifiedBy = adminId;
  this.rejectionReason = reason;
  return this.save();
};

// Method to check if business profile is verified
vendorSchema.methods.isBusinessVerified = function () {
  return this.verificationStatus === "verified";
};

// Ensure virtuals are included in JSON
vendorSchema.set("toJSON", { virtuals: true });
vendorSchema.set("toObject", { virtuals: true });

const Vendor = mongoose.model("Vendor", vendorSchema);

export default Vendor;
