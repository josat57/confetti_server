import mongoose from "mongoose";

const emailTemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    htmlContent: {
      type: String,
      required: true,
    },
    textContent: {
      type: String,
    },
    category: {
      type: String,
      enum: [
        "authentication",
        "notification",
        "marketing",
        "transactional",
        "support",
        "system",
      ],
      default: "notification",
    },
    variables: [
      {
        name: String,
        description: String,
        example: String,
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    lastUsedAt: {
      type: Date,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
emailTemplateSchema.index({ key: 1 });
emailTemplateSchema.index({ category: 1 });
emailTemplateSchema.index({ isActive: 1 });

const EmailTemplate = mongoose.model("EmailTemplate", emailTemplateSchema);

export default EmailTemplate;
