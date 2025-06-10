import mongoose from 'mongoose';

const analyticsSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  action: {
    type: String,
    enum: ['view', 'click', 'purchase', 'share', 'other'],
    required: true,
  },
  metadata: {
    type: Object,
    default: {},
  },
  timestamps: {
    created: { type: Date, default: Date.now },
  },
}, {
  timestamps: true,
});

const Analytics = mongoose.model('Analytics', analyticsSchema);
export default Analytics; 