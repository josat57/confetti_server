import mongoose from "mongoose";

const locationSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: [true, "Location must belong to a vendor"],
      index: true,
    },
    name: {
      type: String,
      required: [true, "Location name is required"],
      trim: true,
    },
    address: {
      street: String,
      city: { type: String, required: true },
      state: { type: String, required: true },
      country: { type: String, default: "Nigeria" },
      postalCode: String,
      coordinates: {
        latitude: Number,
        longitude: Number,
      },
    },
    contact: {
      phone: String,
      email: String,
      manager: String,
    },
    businessHours: [
      {
        day: {
          type: String,
          enum: [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
          ],
        },
        open: String,
        close: String,
        closed: { type: Boolean, default: false },
      },
    ],
    capacity: {
      type: Number,
      min: 0,
    },
    features: [String],
    photos: [
      {
        url: String,
        caption: String,
        order: Number,
      },
    ],
    stats: {
      totalBookings: { type: Number, default: 0 },
      totalRevenue: { type: Number, default: 0 },
      averageRating: { type: Number, default: 0, min: 0, max: 5 },
      totalReviews: { type: Number, default: 0 },
    },
    status: {
      type: String,
      enum: ["active", "inactive", "maintenance"],
      default: "active",
    },
    isPrimary: {
      type: Boolean,
      default: false,
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
locationSchema.index({ vendor: 1, status: 1 });
locationSchema.index({ "address.city": 1, "address.state": 1 });

// Ensure only one primary location per vendor
locationSchema.pre("save", async function (next) {
  if (this.isPrimary && this.isModified("isPrimary")) {
    await this.constructor.updateMany(
      { vendor: this.vendor, _id: { $ne: this._id } },
      { isPrimary: false }
    );
  }
  next();
});

const Location = mongoose.model("Location", locationSchema);

export default Location;
