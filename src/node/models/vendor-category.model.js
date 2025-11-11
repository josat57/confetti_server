import mongoose from "mongoose";

const vendorCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    displayName: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    icon: {
      type: String,
      default: "briefcase",
    },
    priority: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    metadata: {
      averagePriceRange: {
        min: Number,
        max: Number,
        currency: {
          type: String,
          default: "NGN",
        },
      },
      typicalServices: [String],
      commonEventTypes: [String],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
vendorCategorySchema.index({ name: 1 });
vendorCategorySchema.index({ isActive: 1, priority: -1 });

// Static method to get all active categories
vendorCategorySchema.statics.getActiveCategories = async function () {
  return this.find({ isActive: true }).sort({ priority: -1, displayName: 1 });
};

// Static method to get category by name
vendorCategorySchema.statics.findByName = async function (name) {
  return this.findOne({ name: name.toLowerCase(), isActive: true });
};

const VendorCategory = mongoose.model("VendorCategory", vendorCategorySchema);

export default VendorCategory;
