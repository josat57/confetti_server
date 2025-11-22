import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      index: true,
    },
    subject: {
      type: String,
      trim: true,
    },
    content: {
      type: String,
      required: [true, "Message content is required"],
    },
    type: {
      type: String,
      enum: ["direct", "event", "vendor", "client"],
      default: "direct",
    },
    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
    },
    readAt: Date,
    attachments: [
      {
        name: String,
        fileId: String,
        size: Number,
        mimeType: String,
      },
    ],
    parentMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
messageSchema.index({ sender: 1, recipient: 1 });
messageSchema.index({ event: 1 });
messageSchema.index({ status: 1 });
messageSchema.index({ createdAt: -1 });

// Methods
messageSchema.methods.markAsRead = function () {
  this.status = "read";
  this.readAt = new Date();
  return this.save();
};

const Message = mongoose.model("Message", messageSchema);

export default Message;
