import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: [true, "Expense must belong to a vendor"],
      index: true,
    },
    amount: {
      type: Number,
      required: [true, "Expense amount is required"],
      min: 0,
    },
    category: {
      type: String,
      required: [true, "Expense category is required"],
      enum: [
        "equipment",
        "supplies",
        "marketing",
        "staff",
        "transportation",
        "utilities",
        "rent",
        "insurance",
        "maintenance",
        "software",
        "other",
      ],
    },
    customCategory: String,
    description: {
      type: String,
      required: [true, "Expense description is required"],
    },
    date: {
      type: Date,
      required: [true, "Expense date is required"],
      default: Date.now,
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "card", "bank_transfer", "mobile_money", "other"],
    },
    receipt: {
      url: String,
      filename: String,
      uploadedAt: Date,
    },
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
    },
    tags: [String],
    notes: String,
    isRecurring: {
      type: Boolean,
      default: false,
    },
    recurringFrequency: {
      type: String,
      enum: ["daily", "weekly", "monthly", "yearly"],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
expenseSchema.index({ vendor: 1, date: -1 });
expenseSchema.index({ vendor: 1, category: 1 });
expenseSchema.index({ vendor: 1, location: 1 });

const Expense = mongoose.model("Expense", expenseSchema);

export default Expense;
