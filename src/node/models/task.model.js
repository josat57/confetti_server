import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    planner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, "Task title is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    assignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    dueDate: {
      type: Date,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["todo", "in-progress", "completed", "cancelled"],
      default: "todo",
    },
    category: {
      type: String,
      trim: true,
    },
    dependencies: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Task",
      },
    ],
    attachments: [
      {
        name: String,
        fileId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "uploads.files",
        },
        url: String,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
        uploadedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],
    comments: [
      {
        content: {
          type: String,
          required: true,
        },
        createdBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    reminders: [
      {
        type: {
          type: String,
          enum: ["email", "sms", "push"],
          default: "email",
        },
        sentAt: Date,
        scheduledFor: Date,
      },
    ],
    completedAt: Date,
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
taskSchema.index({ event: 1, status: 1 });
taskSchema.index({ planner: 1, status: 1 });
taskSchema.index({ assignee: 1, status: 1 });
taskSchema.index({ dueDate: 1, status: 1 });
taskSchema.index({ priority: 1, status: 1 });

// Virtuals
taskSchema.virtual("isOverdue").get(function () {
  return (
    this.dueDate && this.dueDate < new Date() && this.status !== "completed"
  );
});

// Methods
taskSchema.methods.markComplete = function (userId) {
  this.status = "completed";
  this.completedAt = new Date();
  this.completedBy = userId;
  return this.save();
};

taskSchema.methods.addComment = function (content, userId) {
  this.comments.push({
    content,
    createdBy: userId,
  });
  return this.save();
};

taskSchema.methods.addReminder = function (type, scheduledFor) {
  this.reminders.push({
    type,
    scheduledFor,
  });
  return this.save();
};

taskSchema.methods.markReminderSent = function (reminderId) {
  const reminder = this.reminders.id(reminderId);
  if (reminder) {
    reminder.sentAt = new Date();
  }
  return this.save();
};

const Task = mongoose.model("Task", taskSchema);

export default Task;
