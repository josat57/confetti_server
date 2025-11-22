import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: [true, "Vendor is required"],
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
    },
    rating: {
      type: Number,
      required: [true, "Rating is required"],
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot be more than 5"],
    },
    comment: {
      type: String,
      required: [true, "Comment is required"],
      trim: true,
    },
    categories: [
      {
        type: String,
        enum: [
          "service_quality",
          "value_for_money",
          "communication",
          "punctuality",
          "professionalism",
          "overall_experience",
        ],
      },
    ],
    ratings: {
      service_quality: {
        type: Number,
        min: 1,
        max: 5,
      },
      value_for_money: {
        type: Number,
        min: 1,
        max: 5,
      },
      communication: {
        type: Number,
        min: 1,
        max: 5,
      },
      punctuality: {
        type: Number,
        min: 1,
        max: 5,
      },
      professionalism: {
        type: Number,
        min: 1,
        max: 5,
      },
    },
    media: [
      {
        type: {
          type: String,
          enum: ["image", "video"],
          required: true,
        },
        url: {
          type: String,
          required: true,
        },
        caption: String,
      },
    ],
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    response: {
      comment: String,
      respondedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      respondedAt: Date,
    },
    helpful: {
      count: {
        type: Number,
        default: 0,
      },
      users: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],
    },
    report: {
      count: {
        type: Number,
        default: 0,
      },
      users: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      reasons: [
        {
          type: String,
          enum: [
            "inappropriate_content",
            "fake_review",
            "spam",
            "offensive_language",
            "other",
          ],
        },
      ],
    },
    timestamps: {
      created: {
        type: Date,
        default: Date.now,
      },
      updated: {
        type: Date,
        default: Date.now,
      },
      approved: Date,
      rejected: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
reviewSchema.index({ vendor: 1, status: 1 });
reviewSchema.index({ user: 1, vendor: 1 }, { unique: true });
reviewSchema.index({ event: 1 });
reviewSchema.index({ booking: 1 });
reviewSchema.index({ rating: -1 });

// Virtual for review age in seconds
reviewSchema.virtual("age").get(function () {
  return Math.floor((Date.now() - this.timestamps.created) / 1000);
});

// Method to approve review
reviewSchema.methods.approve = async function () {
  this.status = "approved";
  this.timestamps.approved = new Date();
  this.timestamps.updated = new Date();
  return this.save();
};

// Method to reject review
reviewSchema.methods.reject = async function () {
  this.status = "rejected";
  this.timestamps.rejected = new Date();
  this.timestamps.updated = new Date();
  return this.save();
};

// Method to add response
reviewSchema.methods.addResponse = async function (comment, respondedBy) {
  this.response = {
    comment,
    respondedBy,
    respondedAt: new Date(),
  };
  this.timestamps.updated = new Date();
  return this.save();
};

// Method to mark review as helpful
reviewSchema.methods.markAsHelpful = async function (userId) {
  if (!this.helpful.users.includes(userId)) {
    this.helpful.users.push(userId);
    this.helpful.count += 1;
    this.timestamps.updated = new Date();
    return this.save();
  }
  return this;
};

// Method to report review
reviewSchema.methods.reportReview = async function (userId, reason) {
  if (!this.report.users.includes(userId)) {
    this.report.users.push(userId);
    this.report.reasons.push(reason);
    this.report.count += 1;
    this.timestamps.updated = new Date();
    return this.save();
  }
  return this;
};

// Method to check if review is approved
reviewSchema.methods.isApproved = function () {
  return this.status === "approved";
};

// Method to check if review is rejected
reviewSchema.methods.isRejected = function () {
  return this.status === "rejected";
};

// Method to check if review is pending
reviewSchema.methods.isPending = function () {
  return this.status === "pending";
};

// Method to check if review has response
reviewSchema.methods.hasResponse = function () {
  return !!this.response;
};

// Method to check if review is reported
reviewSchema.methods.isReported = function () {
  return this.report.count > 0;
};

// Method to check if review is helpful
reviewSchema.methods.isHelpful = function () {
  return this.helpful.count > 0;
};

// Method to calculate average category rating
reviewSchema.methods.getAverageCategoryRating = function () {
  const ratings = Object.values(this.ratings).filter(
    (rating) => rating !== undefined
  );
  if (ratings.length === 0) return 0;
  return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
};

const Review = mongoose.model("Review", reviewSchema);

export default Review;
