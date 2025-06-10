import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Report name is required'],
    trim: true
  },
  type: {
    type: String,
    required: [true, 'Report type is required'],
    enum: ['event', 'vendor', 'booking', 'system', 'financial', 'analytics']
  },
  format: {
    type: String,
    required: [true, 'Report format is required'],
    enum: ['pdf', 'excel', 'csv', 'json']
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  parameters: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: new Map()
  },
  filters: {
    dateRange: {
      start: Date,
      end: Date
    },
    categories: [String],
    status: [String],
    custom: Map
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  url: {
    type: String,
    default: null
  },
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  metadata: {
    recordCount: Number,
    processingTime: Number,
    fileSize: Number,
    error: String
  },
  schedule: {
    isScheduled: {
      type: Boolean,
      default: false
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'custom']
    },
    nextRun: Date,
    lastRun: Date,
    recipients: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  },
  timestamps: {
    created: {
      type: Date,
      default: Date.now
    },
    updated: {
      type: Date,
      default: Date.now
    },
    processed: Date,
    completed: Date,
    failed: Date
  }
}, {
  timestamps: true
});

// Indexes
reportSchema.index({ type: 1, status: 1 });
reportSchema.index({ 'schedule.nextRun': 1 });
reportSchema.index({ generatedBy: 1, created: -1 });

// Virtuals
reportSchema.virtual('age').get(function() {
  return Date.now() - this.timestamps.created;
});

reportSchema.virtual('processingDuration').get(function() {
  if (!this.timestamps.processed) return null;
  return this.timestamps.completed - this.timestamps.processed;
});

// Methods
reportSchema.methods.markAsProcessing = async function() {
  this.status = 'processing';
  this.timestamps.processed = new Date();
  return this.save();
};

reportSchema.methods.markAsCompleted = async function(data, url, metadata) {
  this.status = 'completed';
  this.data = data;
  this.url = url;
  this.metadata = {
    ...this.metadata,
    ...metadata
  };
  this.timestamps.completed = new Date();
  return this.save();
};

reportSchema.methods.markAsFailed = async function(error) {
  this.status = 'failed';
  this.metadata.error = error;
  this.timestamps.failed = new Date();
  return this.save();
};

reportSchema.methods.schedule = async function(scheduleData) {
  this.schedule = {
    ...this.schedule,
    ...scheduleData,
    isScheduled: true
  };
  return this.save();
};

reportSchema.methods.cancelSchedule = async function() {
  this.schedule.isScheduled = false;
  this.schedule.nextRun = null;
  return this.save();
};

reportSchema.methods.updateSchedule = async function(scheduleData) {
  this.schedule = {
    ...this.schedule,
    ...scheduleData
  };
  return this.save();
};

// Statics
reportSchema.statics.findScheduledReports = function() {
  return this.find({
    'schedule.isScheduled': true,
    'schedule.nextRun': { $lte: new Date() }
  });
};

reportSchema.statics.findUserReports = function(userId, options = {}) {
  const query = { generatedBy: userId };
  if (options.type) query.type = options.type;
  if (options.status) query.status = options.status;
  
  return this.find(query)
    .sort({ 'timestamps.created': -1 })
    .limit(options.limit || 50)
    .skip(options.skip || 0);
};

const Report = mongoose.model('Report', reportSchema);

export default Report; 