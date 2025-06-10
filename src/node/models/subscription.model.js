import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required'],
  },
  plan: {
    type: String,
    required: [true, 'Plan is required'],
    enum: ['basic', 'premium', 'enterprise'],
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'cancelled', 'expired', 'pending'],
    default: 'pending',
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
  billingCycle: {
    type: String,
    required: [true, 'Billing cycle is required'],
    enum: ['monthly', 'quarterly', 'yearly'],
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required'],
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required'],
  },
  trialEndDate: Date,
  autoRenew: {
    type: Boolean,
    default: true,
  },
  payment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
  },
  features: {
    events: {
      type: Number,
      default: 0,
    },
    guests: {
      type: Number,
      default: 0,
    },
    vendors: {
      type: Number,
      default: 0,
    },
    storage: {
      type: Number, // in MB
      default: 0,
    },
    support: {
      type: String,
      enum: ['email', 'priority', 'dedicated'],
      default: 'email',
    },
    customDomain: {
      type: Boolean,
      default: false,
    },
    analytics: {
      type: Boolean,
      default: false,
    },
    apiAccess: {
      type: Boolean,
      default: false,
    },
  },
  usage: {
    events: {
      type: Number,
      default: 0,
    },
    guests: {
      type: Number,
      default: 0,
    },
    vendors: {
      type: Number,
      default: 0,
    },
    storage: {
      type: Number, // in MB
      default: 0,
    },
    apiCalls: {
      type: Number,
      default: 0,
    },
  },
  cancellation: {
    reason: String,
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    cancelledAt: Date,
    effectiveDate: Date,
  },
  history: [{
    action: {
      type: String,
      enum: ['created', 'activated', 'cancelled', 'renewed', 'upgraded', 'downgraded', 'expired'],
      required: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    performedAt: {
      type: Date,
      default: Date.now,
    },
    details: mongoose.Schema.Types.Mixed,
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
    activated: Date,
    cancelled: Date,
    expired: Date,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes
subscriptionSchema.index({ user: 1, status: 1 });
subscriptionSchema.index({ plan: 1, status: 1 });
subscriptionSchema.index({ endDate: 1 });
subscriptionSchema.index({ payment: 1 });

// Virtual for subscription age in seconds
subscriptionSchema.virtual('age').get(function() {
  return Math.floor((Date.now() - this.timestamps.created) / 1000);
});

// Virtual for days until expiration
subscriptionSchema.virtual('daysUntilExpiration').get(function() {
  return Math.ceil((this.endDate - new Date()) / (1000 * 60 * 60 * 24));
});

// Virtual for days in trial
subscriptionSchema.virtual('daysInTrial').get(function() {
  if (!this.trialEndDate) return 0;
  return Math.ceil((this.trialEndDate - this.startDate) / (1000 * 60 * 60 * 24));
});

// Method to activate subscription
subscriptionSchema.methods.activate = async function() {
  this.status = 'active';
  this.timestamps.activated = new Date();
  this.timestamps.updated = new Date();
  this.history.push({
    action: 'activated',
    performedAt: new Date(),
  });
  return this.save();
};

// Method to cancel subscription
subscriptionSchema.methods.cancel = async function(reason, cancelledBy) {
  this.status = 'cancelled';
  this.autoRenew = false;
  this.cancellation = {
    reason,
    cancelledBy,
    cancelledAt: new Date(),
    effectiveDate: this.endDate,
  };
  this.timestamps.cancelled = new Date();
  this.timestamps.updated = new Date();
  this.history.push({
    action: 'cancelled',
    performedBy: cancelledBy,
    performedAt: new Date(),
    details: { reason },
  });
  return this.save();
};

// Method to renew subscription
subscriptionSchema.methods.renew = async function() {
  const now = new Date();
  const duration = this.endDate - this.startDate;
  this.startDate = now;
  this.endDate = new Date(now.getTime() + duration);
  this.timestamps.updated = now;
  this.history.push({
    action: 'renewed',
    performedAt: now,
  });
  return this.save();
};

// Method to upgrade subscription
subscriptionSchema.methods.upgrade = async function(newPlan, newPrice) {
  this.plan = newPlan;
  this.price = newPrice;
  this.timestamps.updated = new Date();
  this.history.push({
    action: 'upgraded',
    performedAt: new Date(),
    details: { from: this.plan, to: newPlan },
  });
  return this.save();
};

// Method to downgrade subscription
subscriptionSchema.methods.downgrade = async function(newPlan, newPrice) {
  this.plan = newPlan;
  this.price = newPrice;
  this.timestamps.updated = new Date();
  this.history.push({
    action: 'downgraded',
    performedAt: new Date(),
    details: { from: this.plan, to: newPlan },
  });
  return this.save();
};

// Method to update usage
subscriptionSchema.methods.updateUsage = async function(usage) {
  this.usage = { ...this.usage, ...usage };
  this.timestamps.updated = new Date();
  return this.save();
};

// Method to check if subscription is active
subscriptionSchema.methods.isActive = function() {
  return this.status === 'active';
};

// Method to check if subscription is cancelled
subscriptionSchema.methods.isCancelled = function() {
  return this.status === 'cancelled';
};

// Method to check if subscription is expired
subscriptionSchema.methods.isExpired = function() {
  return this.status === 'expired' || new Date() > this.endDate;
};

// Method to check if subscription is in trial
subscriptionSchema.methods.isInTrial = function() {
  return this.trialEndDate && new Date() <= this.trialEndDate;
};

// Method to check if subscription can be renewed
subscriptionSchema.methods.canBeRenewed = function() {
  return this.autoRenew && !this.isCancelled() && !this.isExpired();
};

// Method to check if subscription can be upgraded
subscriptionSchema.methods.canBeUpgraded = function() {
  return this.isActive() && !this.isCancelled();
};

// Method to check if subscription can be downgraded
subscriptionSchema.methods.canBeDowngraded = function() {
  return this.isActive() && !this.isCancelled();
};

// Method to check if subscription has exceeded limits
subscriptionSchema.methods.hasExceededLimits = function() {
  return (
    this.usage.events > this.features.events ||
    this.usage.guests > this.features.guests ||
    this.usage.vendors > this.features.vendors ||
    this.usage.storage > this.features.storage
  );
};

const Subscription = mongoose.model('Subscription', subscriptionSchema);

export default Subscription; 