import mongoose from "mongoose";

const helpArticleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    category: {
      type: String,
      required: true,
      enum: [
        "getting-started",
        "events",
        "clients",
        "vendors",
        "budget",
        "tasks",
        "guests",
        "calendar",
        "team",
        "settings",
        "billing",
        "integrations",
        "troubleshooting",
      ],
    },
    content: {
      type: String,
      required: true,
    },
    excerpt: {
      type: String,
      required: true,
      maxlength: 200,
    },
    tags: [
      {
        type: String,
        lowercase: true,
      },
    ],
    videoUrl: {
      type: String,
    },
    relatedArticles: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "HelpArticle",
      },
    ],
    viewCount: {
      type: Number,
      default: 0,
    },
    helpfulCount: {
      type: Number,
      default: 0,
    },
    notHelpfulCount: {
      type: Number,
      default: 0,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    published: {
      type: Boolean,
      default: true,
    },
    publishedAt: {
      type: Date,
      default: Date.now,
    },
    author: {
      type: String,
      default: "Confetti Support Team",
    },
    lastUpdatedBy: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
helpArticleSchema.index({ slug: 1 });
helpArticleSchema.index({ category: 1 });
helpArticleSchema.index({ tags: 1 });
helpArticleSchema.index({ published: 1 });
helpArticleSchema.index({ featured: 1 });
helpArticleSchema.index({ title: "text", content: "text", tags: "text" });

// Methods
helpArticleSchema.methods.incrementViewCount = function () {
  this.viewCount += 1;
  return this.save();
};

helpArticleSchema.methods.markHelpful = function () {
  this.helpfulCount += 1;
  return this.save();
};

helpArticleSchema.methods.markNotHelpful = function () {
  this.notHelpfulCount += 1;
  return this.save();
};

// Static methods
helpArticleSchema.statics.searchArticles = async function (
  query,
  category = null
) {
  const searchQuery = {
    published: true,
    $text: { $search: query },
  };

  if (category) {
    searchQuery.category = category;
  }

  return this.find(searchQuery, { score: { $meta: "textScore" } })
    .sort({ score: { $meta: "textScore" } })
    .limit(20);
};

helpArticleSchema.statics.getFeaturedArticles = function () {
  return this.find({ published: true, featured: true })
    .sort({ viewCount: -1 })
    .limit(6);
};

helpArticleSchema.statics.getPopularArticles = function (limit = 10) {
  return this.find({ published: true }).sort({ viewCount: -1 }).limit(limit);
};

helpArticleSchema.statics.getArticlesByCategory = function (category) {
  return this.find({ published: true, category }).sort({ publishedAt: -1 });
};

const HelpArticle = mongoose.model("HelpArticle", helpArticleSchema);

export default HelpArticle;
