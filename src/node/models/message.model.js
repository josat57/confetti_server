import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Sender is required'],
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Recipient is required'],
  },
  type: {
    type: String,
    enum: ['text', 'image', 'video', 'file', 'location', 'system'],
    default: 'text',
  },
  content: {
    text: String,
    media: [{
      type: {
        type: String,
        enum: ['image', 'video', 'file'],
        required: true,
      },
      url: {
        type: String,
        required: true,
      },
      name: String,
      size: Number,
      mimeType: String,
      thumbnail: String,
    }],
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        required: true,
      },
      address: String,
    },
  },
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
  },
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
  },
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read', 'failed'],
    default: 'sent',
  },
  metadata: {
    isEdited: {
      type: Boolean,
      default: false,
    },
    editedAt: Date,
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: Date,
    isForwarded: {
      type: Boolean,
      default: false,
    },
    forwardedFrom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
    },
    isReply: {
      type: Boolean,
      default: false,
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
    },
  },
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    emoji: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],
  timestamps: {
    created: {
      type: Date,
      default: Date.now,
    },
    updated: {
      type: Date,
      default: Date.now,
    },
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
messageSchema.index({ sender: 1, recipient: 1 });
messageSchema.index({ event: 1 });
messageSchema.index({ vendor: 1 });
messageSchema.index({ booking: 1 });
messageSchema.index({ 'content.location.coordinates': '2dsphere' });

// Virtual for message age in seconds
messageSchema.virtual('age').get(function() {
  return Math.floor((Date.now() - this.timestamps.created) / 1000);
});

// Method to mark message as delivered
messageSchema.methods.markAsDelivered = async function() {
  this.status = 'delivered';
  this.timestamps.delivered = new Date();
  this.timestamps.updated = new Date();
  return this.save();
};

// Method to mark message as read
messageSchema.methods.markAsRead = async function() {
  this.status = 'read';
  this.timestamps.read = new Date();
  this.timestamps.updated = new Date();
  return this.save();
};

// Method to mark message as failed
messageSchema.methods.markAsFailed = async function() {
  this.status = 'failed';
  this.timestamps.failed = new Date();
  this.timestamps.updated = new Date();
  return this.save();
};

// Method to edit message
messageSchema.methods.edit = async function(newContent) {
  this.content = newContent;
  this.metadata.isEdited = true;
  this.metadata.editedAt = new Date();
  this.timestamps.updated = new Date();
  return this.save();
};

// Method to delete message
messageSchema.methods.delete = async function() {
  this.metadata.isDeleted = true;
  this.metadata.deletedAt = new Date();
  this.timestamps.updated = new Date();
  return this.save();
};

// Method to forward message
messageSchema.methods.forward = async function(newRecipient) {
  this.metadata.isForwarded = true;
  this.metadata.forwardedFrom = this._id;
  this.recipient = newRecipient;
  this.timestamps.updated = new Date();
  return this.save();
};

// Method to reply to message
messageSchema.methods.reply = async function(replyContent) {
  this.metadata.isReply = true;
  this.metadata.replyTo = this._id;
  this.content = replyContent;
  this.timestamps.updated = new Date();
  return this.save();
};

// Method to add reaction
messageSchema.methods.addReaction = async function(userId, emoji) {
  const existingReaction = this.reactions.find(
    r => r.user.toString() === userId.toString() && r.emoji === emoji
  );

  if (existingReaction) {
    this.reactions = this.reactions.filter(
      r => !(r.user.toString() === userId.toString() && r.emoji === emoji)
    );
  } else {
    this.reactions.push({
      user: userId,
      emoji,
    });
  }

  this.timestamps.updated = new Date();
  return this.save();
};

// Method to check if message is delivered
messageSchema.methods.isDelivered = function() {
  return this.status === 'delivered';
};

// Method to check if message is read
messageSchema.methods.isRead = function() {
  return this.status === 'read';
};

// Method to check if message is failed
messageSchema.methods.isFailed = function() {
  return this.status === 'failed';
};

// Method to check if message is edited
messageSchema.methods.isEdited = function() {
  return this.metadata.isEdited;
};

// Method to check if message is deleted
messageSchema.methods.isDeleted = function() {
  return this.metadata.isDeleted;
};

// Method to check if message is forwarded
messageSchema.methods.isForwarded = function() {
  return this.metadata.isForwarded;
};

// Method to check if message is reply
messageSchema.methods.isReply = function() {
  return this.metadata.isReply;
};

// Method to check if message has media
messageSchema.methods.hasMedia = function() {
  return this.content.media && this.content.media.length > 0;
};

// Method to check if message has location
messageSchema.methods.hasLocation = function() {
  return this.content.location && this.content.location.coordinates;
};

// Method to check if message has reactions
messageSchema.methods.hasReactions = function() {
  return this.reactions && this.reactions.length > 0;
};

const Message = mongoose.model('Message', messageSchema);

export default Message; 