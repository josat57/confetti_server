import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['credit_card', 'paypal', 'stripe'],
    required: true
  },
  transactionId: {
    type: String,
    required: true,
    unique: true
  },
  paymentDetails: {
    cardLast4: String,
    cardBrand: String,
    paymentIntentId: String,
    chargeId: String
  },
  refundDetails: {
    refundId: String,
    refundAmount: Number,
    refundReason: String,
    refundedAt: Date
  },
  metadata: {
    type: Map,
    of: String
  }
}, {
  timestamps: true
});

// Indexes
paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ event: 1, status: 1 });
paymentSchema.index({ transactionId: 1 }, { unique: true });

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment; 