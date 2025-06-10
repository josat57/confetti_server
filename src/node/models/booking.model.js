import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: [true, 'Event is required'],
  },
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: [true, 'Vendor is required'],
  },
  service: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, 'Service is required'],
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Client is required'],
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed', 'rejected'],
    default: 'pending',
  },
  date: {
    type: Date,
    required: [true, 'Date is required'],
  },
  startTime: {
    type: Date,
    required: [true, 'Start time is required'],
  },
  endTime: {
    type: Date,
    required: [true, 'End time is required'],
  },
  duration: {
    type: Number, // in hours
    required: [true, 'Duration is required'],
  },
  price: {
    amount: {
      type: Number,
      required: [true, 'Price amount is required'],
      min: [0, 'Price cannot be negative'],
    },
    currency: {
      type: String,
      default: 'NGN',
      enum: ['NGN', 'USD', 'EUR', 'GBP'],
    },
  },
  payment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
  },
  notes: {
    client: String,
    vendor: String,
    admin: String,
  },
  cancellation: {
    reason: String,
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    cancelledAt: Date,
    refundAmount: Number,
    refundStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
    },
  },
  review: {
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    comment: String,
    createdAt: Date,
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
    confirmed: Date,
    cancelled: Date,
    completed: Date,
    rejected: Date,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes
bookingSchema.index({ event: 1, vendor: 1 });
bookingSchema.index({ client: 1, status: 1 });
bookingSchema.index({ vendor: 1, status: 1 });
bookingSchema.index({ date: 1, status: 1 });
bookingSchema.index({ payment: 1 });

// Virtual for booking age in seconds
bookingSchema.virtual('age').get(function() {
  return Math.floor((Date.now() - this.timestamps.created) / 1000);
});

// Method to confirm booking
bookingSchema.methods.confirm = async function() {
  this.status = 'confirmed';
  this.timestamps.confirmed = new Date();
  this.timestamps.updated = new Date();
  return this.save();
};

// Method to cancel booking
bookingSchema.methods.cancel = async function(reason, cancelledBy) {
  this.status = 'cancelled';
  this.cancellation = {
    reason,
    cancelledBy,
    cancelledAt: new Date(),
  };
  this.timestamps.cancelled = new Date();
  this.timestamps.updated = new Date();
  return this.save();
};

// Method to complete booking
bookingSchema.methods.complete = async function() {
  this.status = 'completed';
  this.timestamps.completed = new Date();
  this.timestamps.updated = new Date();
  return this.save();
};

// Method to reject booking
bookingSchema.methods.reject = async function() {
  this.status = 'rejected';
  this.timestamps.rejected = new Date();
  this.timestamps.updated = new Date();
  return this.save();
};

// Method to add review
bookingSchema.methods.addReview = async function(rating, comment) {
  this.review = {
    rating,
    comment,
    createdAt: new Date(),
  };
  this.timestamps.updated = new Date();
  return this.save();
};

// Method to update payment
bookingSchema.methods.updatePayment = async function(paymentId) {
  this.payment = paymentId;
  this.timestamps.updated = new Date();
  return this.save();
};

// Method to update refund status
bookingSchema.methods.updateRefundStatus = async function(status) {
  if (!this.cancellation) {
    throw new Error('Booking is not cancelled');
  }
  this.cancellation.refundStatus = status;
  this.timestamps.updated = new Date();
  return this.save();
};

// Method to check if booking is confirmed
bookingSchema.methods.isConfirmed = function() {
  return this.status === 'confirmed';
};

// Method to check if booking is cancelled
bookingSchema.methods.isCancelled = function() {
  return this.status === 'cancelled';
};

// Method to check if booking is completed
bookingSchema.methods.isCompleted = function() {
  return this.status === 'completed';
};

// Method to check if booking is rejected
bookingSchema.methods.isRejected = function() {
  return this.status === 'rejected';
};

// Method to check if booking is pending
bookingSchema.methods.isPending = function() {
  return this.status === 'pending';
};

// Method to check if booking is reviewed
bookingSchema.methods.isReviewed = function() {
  return !!this.review;
};

// Method to check if booking is refunded
bookingSchema.methods.isRefunded = function() {
  return this.cancellation?.refundStatus === 'completed';
};

const Booking = mongoose.model('Booking', bookingSchema);

export default Booking; 