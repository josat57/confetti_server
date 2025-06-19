import mongoose from 'mongoose';

const contentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Content title is required'],
    trim: true
  },
  type: {
    type: String,
    required: [true, 'Content type is required'],
    enum: ['article', 'blog', 'news', 'announcement', 'guide']
  },
  content: {
    type: String,
    required: [true, 'Content body is required']
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  moderationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  moderationReason: String,
  moderatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  moderatedAt: Date,
  tags: [{
    type: String,
    trim: true
  }],
  category: {
    type: String,
    required: true
  },
  featured: {
    type: Boolean,
    default: false
  },
  views: {
    type: Number,
    default: 0
  },
  likes: {
    type: Number,
    default: 0
  },
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    content: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Indexes
contentSchema.index({ title: 'text', content: 'text' });
contentSchema.index({ status: 1, type: 1 });
contentSchema.index({ author: 1, createdAt: -1 });

const Content = mongoose.model('Content', contentSchema);

export default Content; 