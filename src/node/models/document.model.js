import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Document name is required'],
    trim: true
  },
  type: {
    type: String,
    enum: ['image', 'video', 'document', 'audio', 'other'],
    required: [true, 'Document type is required']
  },
  mimeType: {
    type: String,
    required: [true, 'MIME type is required']
  },
  size: {
    type: Number,
    required: [true, 'File size is required'],
    min: [0, 'File size cannot be negative']
  },
  url: {
    type: String,
    required: [true, 'File URL is required']
  },
  thumbnail: {
    type: String
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Document owner is required']
  },
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
  },
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor'
  },
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking'
  },
  status: {
    type: String,
    enum: ['processing', 'active', 'archived', 'deleted'],
    default: 'processing'
  },
  metadata: {
    width: Number,
    height: Number,
    duration: Number,
    pages: Number,
    tags: [String],
    description: String,
    originalName: String,
    encoding: String,
    hash: String
  },
  permissions: {
    public: {
      type: Boolean,
      default: false
    },
    allowedUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    allowedRoles: [{
      type: String,
      enum: ['user', 'vendor', 'admin']
    }]
  },
  version: {
    current: {
      type: Number,
      default: 1
    },
    history: [{
      version: Number,
      url: String,
      size: Number,
      mimeType: String,
      createdAt: {
        type: Date,
        default: Date.now
      },
      createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      changes: String
    }]
  },
  timestamps: {
    uploaded: {
      type: Date,
      default: Date.now
    },
    processed: Date,
    archived: Date,
    deleted: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
documentSchema.index({ owner: 1 });
documentSchema.index({ event: 1 });
documentSchema.index({ vendor: 1 });
documentSchema.index({ booking: 1 });
documentSchema.index({ 'metadata.tags': 1 });
documentSchema.index({ type: 1, status: 1 });

// Virtual for document age in seconds
documentSchema.virtual('age').get(function() {
  return Math.floor((Date.now() - this.timestamps.uploaded) / 1000);
});

// Method to mark document as processed
documentSchema.methods.markAsProcessed = async function() {
  this.status = 'active';
  this.timestamps.processed = new Date();
  return this.save();
};

// Method to archive document
documentSchema.methods.archive = async function() {
  this.status = 'archived';
  this.timestamps.archived = new Date();
  return this.save();
};

// Method to delete document
documentSchema.methods.delete = async function() {
  this.status = 'deleted';
  this.timestamps.deleted = new Date();
  return this.save();
};

// Method to add new version
documentSchema.methods.addVersion = async function(versionData) {
  const newVersion = {
    version: this.version.current + 1,
    url: versionData.url,
    size: versionData.size,
    mimeType: versionData.mimeType,
    createdAt: new Date(),
    createdBy: versionData.userId,
    changes: versionData.changes
  };

  this.version.history.push(newVersion);
  this.version.current = newVersion.version;
  this.url = newVersion.url;
  this.size = newVersion.size;
  this.mimeType = newVersion.mimeType;

  return this.save();
};

// Method to check if user has permission
documentSchema.methods.hasPermission = function(user) {
  if (this.permissions.public) return true;
  if (this.owner.toString() === user._id.toString()) return true;
  if (this.permissions.allowedUsers.some(id => id.toString() === user._id.toString())) return true;
  if (this.permissions.allowedRoles.includes(user.role)) return true;
  return false;
};

// Method to check if document is processed
documentSchema.methods.isProcessed = function() {
  return this.status === 'active';
};

// Method to check if document is archived
documentSchema.methods.isArchived = function() {
  return this.status === 'archived';
};

// Method to check if document is deleted
documentSchema.methods.isDeleted = function() {
  return this.status === 'deleted';
};

// Method to check if document has thumbnail
documentSchema.methods.hasThumbnail = function() {
  return !!this.thumbnail;
};

// Method to check if document has versions
documentSchema.methods.hasVersions = function() {
  return this.version.history.length > 1;
};

const Document = mongoose.model('Document', documentSchema);

export default Document; 