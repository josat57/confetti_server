import mongoose from "mongoose";

const whatsNewSchema = new mongoose.Schema(
  {
    version: {
      type: String,
      required: true,
      unique: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    features: [
      {
        title: String,
        description: String,
        icon: String,
        category: {
          type: String,
          enum: ["new", "improvement", "fix", "breaking"],
          default: "new",
        },
      },
    ],
    releaseDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    imageUrl: {
      type: String,
    },
    videoUrl: {
      type: String,
    },
    blogPostUrl: {
      type: String,
    },
    published: {
      type: Boolean,
      default: true,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    targetTiers: {
      type: [String],
      enum: ["starter", "professional", "business", "enterprise"],
      default: ["starter", "professional", "business", "enterprise"],
    },
    viewCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
whatsNewSchema.index({ version: 1 });
whatsNewSchema.index({ releaseDate: -1 });
whatsNewSchema.index({ published: 1 });
whatsNewSchema.index({ featured: 1 });

// Methods
whatsNewSchema.methods.incrementViewCount = function () {
  this.viewCount += 1;
  return this.save();
};

// Static methods
whatsNewSchema.statics.getLatestReleases = function (limit = 5) {
  return this.find({ published: true }).sort({ releaseDate: -1 }).limit(limit);
};

whatsNewSchema.statics.getFeaturedRelease = function () {
  return this.findOne({ published: true, featured: true }).sort({
    releaseDate: -1,
  });
};

whatsNewSchema.statics.getReleasesSince = function (date) {
  return this.find({
    published: true,
    releaseDate: { $gte: date },
  }).sort({ releaseDate: -1 });
};

const WhatsNew = mongoose.model("WhatsNew", whatsNewSchema);

export default WhatsNew;
