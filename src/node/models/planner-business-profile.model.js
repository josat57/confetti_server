import mongoose from "mongoose";

const plannerBusinessProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      unique: true,
      index: true,
    },
    companyName: {
      type: String,
      required: [true, "Company name is required"],
      trim: true,
      maxlength: [200, "Company name cannot exceed 200 characters"],
    },
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
    address: {
      street: {
        type: String,
        required: [true, "Street address is required"],
        trim: true,
      },
      city: {
        type: String,
        required: [true, "City is required"],
        trim: true,
      },
      state: {
        type: String,
        required: [true, "State is required"],
        trim: true,
      },
      country: {
        type: String,
        default: "Nigeria",
        trim: true,
      },
      zipCode: {
        type: String,
        trim: true,
      },
    },
    logo: {
      type: String,
    },
    logoFileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "uploads.files",
    },
    description: {
      type: String,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
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
    taxId: {
      type: String,
      trim: true,
      select: false, // Exclude from queries by default for security
    },
    branding: {
      primaryColor: {
        type: String,
        default: "#6366F1", // Indigo
        validate: {
          validator: function (v) {
            if (!v) return true; // Allow empty/undefined
            // Validate hex color format
            return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v);
          },
          message:
            "Primary color must be a valid hex color code (e.g., #6366F1)",
        },
      },
      secondaryColor: {
        type: String,
        default: "#10B981", // Green
        validate: {
          validator: function (v) {
            if (!v) return true; // Allow empty/undefined
            return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v);
          },
          message:
            "Secondary color must be a valid hex color code (e.g., #10B981)",
        },
      },
      accentColor: {
        type: String,
        default: "#F59E0B", // Amber
        validate: {
          validator: function (v) {
            if (!v) return true;
            return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v);
          },
          message:
            "Accent color must be a valid hex color code (e.g., #F59E0B)",
        },
      },
      font: {
        type: String,
        default: "Inter",
        enum: [
          "Inter",
          "Roboto",
          "Open Sans",
          "Lato",
          "Montserrat",
          "Poppins",
          "Raleway",
          "Ubuntu",
          "Nunito",
          "Playfair Display",
        ],
      },
      customCSS: {
        type: String,
        maxlength: [5000, "Custom CSS cannot exceed 5000 characters"],
      },
    },
    additionalLocations: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        address: {
          street: String,
          city: String,
          state: String,
          country: String,
          zipCode: String,
        },
        isPrimary: {
          type: Boolean,
          default: false,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
      index: true,
    },
    verifiedAt: Date,
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    rejectionReason: String,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
plannerBusinessProfileSchema.index({ userId: 1 });
plannerBusinessProfileSchema.index({ verificationStatus: 1 });
plannerBusinessProfileSchema.index({ companyName: "text" });

// Virtual for primary location
plannerBusinessProfileSchema.virtual("primaryLocation").get(function () {
  const primaryLoc = this.additionalLocations.find((loc) => loc.isPrimary);
  return primaryLoc || null;
});

// Virtual for full address string
plannerBusinessProfileSchema.virtual("fullAddress").get(function () {
  const { street, city, state, country, zipCode } = this.address;
  const parts = [street, city, state, zipCode, country].filter(Boolean);
  return parts.join(", ");
});

// Method to verify profile
plannerBusinessProfileSchema.methods.verify = async function (adminId) {
  this.verificationStatus = "verified";
  this.verifiedAt = new Date();
  this.verifiedBy = adminId;
  this.rejectionReason = undefined;
  return this.save();
};

// Method to reject profile
plannerBusinessProfileSchema.methods.reject = async function (adminId, reason) {
  this.verificationStatus = "rejected";
  this.verifiedBy = adminId;
  this.rejectionReason = reason;
  return this.save();
};

// Method to check if profile is verified
plannerBusinessProfileSchema.methods.isVerified = function () {
  return this.verificationStatus === "verified";
};

// Method to add location
plannerBusinessProfileSchema.methods.addLocation = function (locationData) {
  this.additionalLocations.push(locationData);
  return this.save();
};

// Method to update location
plannerBusinessProfileSchema.methods.updateLocation = function (
  locationId,
  locationData
) {
  const location = this.additionalLocations.id(locationId);
  if (!location) {
    throw new Error("Location not found");
  }
  Object.assign(location, locationData);
  return this.save();
};

// Method to delete location
plannerBusinessProfileSchema.methods.deleteLocation = function (locationId) {
  const location = this.additionalLocations.id(locationId);
  if (!location) {
    throw new Error("Location not found");
  }
  if (location.isPrimary) {
    throw new Error("Cannot delete primary location");
  }
  location.remove();
  return this.save();
};

// Method to set primary location
plannerBusinessProfileSchema.methods.setPrimaryLocation = function (
  locationId
) {
  // Remove primary flag from all locations
  this.additionalLocations.forEach((loc) => {
    loc.isPrimary = false;
  });

  // Set primary flag on specified location
  const location = this.additionalLocations.id(locationId);
  if (!location) {
    throw new Error("Location not found");
  }
  location.isPrimary = true;
  return this.save();
};

// Pre-save middleware to ensure at least one location exists
plannerBusinessProfileSchema.pre("save", function (next) {
  // Main address always exists due to required fields
  // This is just a safety check for additional locations
  if (this.additionalLocations.length === 0) {
    // No additional locations is fine, main address is required
    return next();
  }

  // Ensure only one primary location in additional locations
  const primaryLocations = this.additionalLocations.filter(
    (loc) => loc.isPrimary
  );
  if (primaryLocations.length > 1) {
    return next(new Error("Only one location can be marked as primary"));
  }

  next();
});

const PlannerBusinessProfile = mongoose.model(
  "PlannerBusinessProfile",
  plannerBusinessProfileSchema
);

export default PlannerBusinessProfile;
