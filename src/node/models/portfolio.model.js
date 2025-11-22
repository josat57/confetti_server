import mongoose from "mongoose";

const portfolioSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, "Portfolio title is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    eventType: {
      type: String,
      enum: [
        "wedding",
        "corporate",
        "birthday",
        "graduation",
        "conference",
        "party",
        "other",
      ],
    },
    eventDate: {
      type: Date,
    },
    location: {
      city: String,
      state: String,
      country: String,
    },
    photos: [
      {
        url: {
          type: String,
          required: true,
        },
        caption: String,
        order: {
          type: Number,
          default: 0,
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    coverPhoto: {
      type: String,
    },
    tags: [String],
    isFeatured: {
      type: Boolean,
      default: false,
    },
    views: {
      type: Number,
      default: 0,
    },
    likes: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },
    publishedAt: Date,
  },
  {
    timestamps: true,
  }
);

// Indexes
portfolioSchema.index({ vendor: 1, status: 1 });
portfolioSchema.index({ eventType: 1 });
portfolioSchema.index({ isFeatured: 1, status: 1 });
portfolioSchema.index({ views: -1 });
portfolioSchema.index({ createdAt: -1 });

// Method to increment views
portfolioSchema.methods.incrementViews = async function () {
  this.views += 1;
  await this.save();
};

// Method to publish
portfolioSchema.methods.publish = async function () {
  this.status = "published";
  this.publishedAt = new Date();
  await this.save();
};

// Method to archive
portfolioSchema.methods.archive = async function () {
  this.status = "archived";
  await this.save();
};

// Set cover photo to first photo if not set
portfolioSchema.pre("save", function (next) {
  if (!this.coverPhoto && this.photos && this.photos.length > 0) {
    this.coverPhoto = this.photos[0].url;
  }
  next();
});

const Portfolio = mongoose.model("Portfolio", portfolioSchema);

export default Portfolio;
