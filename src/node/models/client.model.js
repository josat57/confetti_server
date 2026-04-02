import mongoose from "mongoose";

const clientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Client name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Client email is required"],
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: [true, "Client phone is required"],
      trim: true,
    },
    company: {
      type: String,
      trim: true,
    },
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      zipCode: String,
    },
    planner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Planner reference is required"],
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    nextFollowUp: {
      type: Date,
    },
    preferences: {
      communicationMethod: {
        type: String,
        enum: ["email", "phone", "sms", "whatsapp"],
        default: "email",
      },
      eventTypes: [String],
      budgetRange: {
        min: Number,
        max: Number,
        currency: {
          type: String,
          default: "NGN",
        },
      },
      notes: String,
    },
    notes: [
      {
        content: {
          type: String,
          required: true,
        },
        createdBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    feedback: [
      {
        rating: {
          type: Number,
          min: 1,
          max: 5,
        },
        comment: String,
        eventId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Event",
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

clientSchema.index({ planner: 1, status: 1 });
clientSchema.index({ email: 1, planner: 1 });
clientSchema.index({ name: "text", company: "text" });

clientSchema.virtual("eventCount", {
  ref: "Event",
  localField: "_id",
  foreignField: "client",
  count: true,
});

const Client = mongoose.model("Client", clientSchema);

export default Client;
