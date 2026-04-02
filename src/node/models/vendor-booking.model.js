import mongoose from "mongoose";

const vendorBookingSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: [true, "Vendor reference is required"],
      index: true,
    },
    planner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: false,
      index: true,
    },
    // Vendor-initiated booking fields (when no planner/event)
    clientName: {
      type: String,
    },
    clientEmail: {
      type: String,
    },
    clientPhone: {
      type: String,
    },
    eventType: {
      type: String,
    },
    eventDate: {
      type: Date,
    },
    eventEndDate: {
      type: Date,
    },
    location: {
      type: String,
    },
    guestCount: {
      type: Number,
    },
    totalAmount: {
      type: Number,
    },
    depositAmount: {
      type: Number,
    },
    currency: {
      type: String,
      default: "NGN",
    },
    notes: {
      type: String,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "contacted",
        "quoted",
        "booked",
        "confirmed",
        "cancelled",
        "completed",
      ],
      default: "pending",
      index: true,
    },
    serviceRequirements: {
      type: String,
      required: false,
    },
    budget: {
      amount: {
        type: Number,
        required: false,
        min: 0,
      },
      currency: {
        type: String,
        default: "NGN",
        enum: ["NGN", "USD", "EUR", "GBP"],
      },
    },
    specialRequirements: {
      type: String,
    },
    quote: {
      amount: Number,
      currency: {
        type: String,
        default: "NGN",
        enum: ["NGN", "USD", "EUR", "GBP"],
      },
      details: String,
      validUntil: Date,
      providedAt: Date,
    },
    contract: {
      signed: {
        type: Boolean,
        default: false,
      },
      signedAt: Date,
      terms: String,
      documentUrl: String,
    },
    payment: {
      totalAmount: Number,
      paidAmount: {
        type: Number,
        default: 0,
      },
      currency: {
        type: String,
        default: "NGN",
      },
      status: {
        type: String,
        enum: ["pending", "partial", "paid", "refunded"],
        default: "pending",
      },
      dueDate: Date,
    },
    communication: [
      {
        from: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        message: String,
        timestamp: {
          type: Date,
          default: Date.now,
        },
        type: {
          type: String,
          enum: ["message", "note", "status_change"],
          default: "message",
        },
      },
    ],
    notes: [
      {
        content: String,
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
    statusHistory: [
      {
        status: String,
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        changedAt: {
          type: Date,
          default: Date.now,
        },
        note: String,
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

vendorBookingSchema.index({ vendor: 1, status: 1 });
vendorBookingSchema.index({ planner: 1, status: 1 });
vendorBookingSchema.index({ event: 1 });
vendorBookingSchema.index({ createdAt: -1 });

vendorBookingSchema.methods.updateStatus = async function (
  newStatus,
  userId,
  note
) {
  this.statusHistory.push({
    status: this.status,
    changedBy: userId,
    note,
  });
  this.status = newStatus;
  return this.save();
};

vendorBookingSchema.methods.addCommunication = async function (
  from,
  message,
  type = "message"
) {
  this.communication.push({
    from,
    message,
    type,
  });
  return this.save();
};

const VendorBooking = mongoose.model("VendorBooking", vendorBookingSchema);

export default VendorBooking;
