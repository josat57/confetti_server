import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  currency: {
    type: String,
    enum: ['NGN', 'USD', 'EUR', 'GBP'],
    default: 'NGN',
  },
  paymentType: {
    type: String,
    enum: ['event', 'vendor', 'subscription', 'other'],
    required: true,
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'bank', 'wallet', 'cash', 'transfer'],
    required: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  description: String,
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled'],
    default: 'pending',
  },
  exchangeRate: {
    type: Number,
    default: 1,
  },
  amountInNGN: {
    type: Number,
    default: 0,
  },
  metadata: {
    type: Object,
    default: {},
  },
  timestamps: {
    created: { type: Date, default: Date.now },
    completed: Date,
    failed: Date,
    refunded: Date,
    cancelled: Date,
  },
}, {
  timestamps: true,
});

paymentSchema.methods.markCompleted = function() {
  this.status = 'completed';
  this.timestamps.completed = new Date();
};

paymentSchema.methods.markFailed = function() {
  this.status = 'failed';
  this.timestamps.failed = new Date();
};

paymentSchema.methods.markRefunded = function() {
  this.status = 'refunded';
  this.timestamps.refunded = new Date();
};

paymentSchema.methods.convertToNGN = function(rate) {
  this.amountInNGN = this.amount * rate;
  this.exchangeRate = rate;
};

const Payment = mongoose.model('Payment', paymentSchema);
export default Payment; 