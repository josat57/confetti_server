import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Recipient is required'],
  },
  type: {
    type: String,
    required: [true, 'Notification type is required'],
    enum: [
      'event_update',
      'vendor_message',
      'payment_status',
      'system_update',
      'booking_status',
      'review',
      'reminder',
      'other',
    ],
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
  },
  data: {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
    },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
    },
    review: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Review',
    },
    metadata: mongoose.Schema.Types.Mixed,
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'read', 'failed'],
    default: 'pending',
  },
  channels: {
    email: {
      sent: {
        type: Boolean,
        default: false,
      },
      delivered: {
        type: Boolean,
        default: false,
      },
      failed: {
        type: Boolean,
        default: false,
      },
      error: String,
    },
    push: {
      sent: {
        type: Boolean,
        default: false,
      },
      delivered: {
        type: Boolean,
        default: false,
      },
      failed: {
        type: Boolean,
        default: false,
      },
      error: String,
    },
    sms: {
      sent: {
        type: Boolean,
        default: false,
      },
      delivered: {
        type: Boolean,
        default: false,
      },
      failed: {
        type: Boolean,
        default: false,
      },
      error: String,
    },
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
    sent: Date,
    delivered: Date,
    read: Date,
    failed: Date,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes
notificationSchema.index({ recipient: 1, status: 1 });
notificationSchema.index({ type: 1, status: 1 });
notificationSchema.index({ 'data.event': 1 });
notificationSchema.index({ 'data.vendor': 1 });
notificationSchema.index({ 'data.payment': 1 });
notificationSchema.index({ 'data.booking': 1 });
notificationSchema.index({ 'data.review': 1 });

// Virtual for notification age in seconds
notificationSchema.virtual('age').get(function() {
  return Math.floor((Date.now() - this.timestamps.created) / 1000);
});

// Method to mark notification as sent
notificationSchema.methods.markAsSent = async function(channel) {
  this.channels[channel].sent = true;
  this.channels[channel].failed = false;
  this.channels[channel].error = null;
  this.timestamps.sent = new Date();
  this.timestamps.updated = new Date();
  return this.save();
};

// Method to mark notification as delivered
notificationSchema.methods.markAsDelivered = async function(channel) {
  this.channels[channel].delivered = true;
  this.timestamps.delivered = new Date();
  this.timestamps.updated = new Date();
  return this.save();
};

// Method to mark notification as read
notificationSchema.methods.markAsRead = async function() {
  this.status = 'read';
  this.timestamps.read = new Date();
  this.timestamps.updated = new Date();
  return this.save();
};

// Method to mark notification as failed
notificationSchema.methods.markAsFailed = async function(channel, error) {
  this.channels[channel].failed = true;
  this.channels[channel].error = error;
  this.status = 'failed';
  this.timestamps.failed = new Date();
  this.timestamps.updated = new Date();
  return this.save();
};

// Method to check if notification is read
notificationSchema.methods.isRead = function() {
  return this.status === 'read';
};

// Method to check if notification is delivered
notificationSchema.methods.isDelivered = function() {
  return this.status === 'delivered';
};

// Method to check if notification is sent
notificationSchema.methods.isSent = function() {
  return this.status === 'sent';
};

// Method to check if notification is failed
notificationSchema.methods.isFailed = function() {
  return this.status === 'failed';
};

// Method to check if notification is pending
notificationSchema.methods.isPending = function() {
  return this.status === 'pending';
};

// Method to check if notification is urgent
notificationSchema.methods.isUrgent = function() {
  return this.priority === 'urgent';
};

// Method to check if notification is high priority
notificationSchema.methods.isHighPriority = function() {
  return this.priority === 'high';
};

// Method to check if notification is medium priority
notificationSchema.methods.isMediumPriority = function() {
  return this.priority === 'medium';
};

// Method to check if notification is low priority
notificationSchema.methods.isLowPriority = function() {
  return this.priority === 'low';
};

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification; 