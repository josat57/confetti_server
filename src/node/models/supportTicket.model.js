import mongoose from 'mongoose';

const supportTicketSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subject: {
    type: String,
    required: [true, 'Ticket subject is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Ticket description is required']
  },
  category: {
    type: String,
    required: true,
    enum: [
      'technical',
      'billing',
      'account',
      'event',
      'vendor',
      'general',
      'other'
    ]
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved', 'closed'],
    default: 'open'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  messages: [{
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'messages.senderType'
    },
    senderType: {
      type: String,
      enum: ['User', 'Admin']
    },
    content: {
      type: String,
      required: true
    },
    attachments: [{
      name: String,
      url: String,
      type: String
    }],
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  adminResponse: {
    content: String,
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    respondedAt: Date
  },
  resolution: {
    content: String,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    resolvedAt: Date
  },
  tags: [{
    type: String,
    trim: true
  }],
  relatedEvent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
  },
  relatedVendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor'
  }
}, {
  timestamps: true
});

// Indexes
supportTicketSchema.index({ user: 1, createdAt: -1 });
supportTicketSchema.index({ status: 1, priority: 1 });
supportTicketSchema.index({ assignedTo: 1, status: 1 });
supportTicketSchema.index({ category: 1, status: 1 });

const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);

export default SupportTicket; 