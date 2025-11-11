import mongoose from "mongoose";

const vendorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Vendor name is required"],
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
    isVerified: {
      type: Boolean,
      default: false,
    },
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

const Vendor = mongoose.model("Vendor", vendorSchema);

export default Vendor;
