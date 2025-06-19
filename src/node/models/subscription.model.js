import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  planType: {
    type: String,
    enum: ['vendor', 'planner'],
    required: true
  },
  planName: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'trial', 'cancelled', 'expired'],
    default: 'trial'
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: true
  },
  trialEndDate: {
    type: Date
  },
  paymentProvider: {
    type: String,
    enum: ['flutterwave', 'paystack'],
    required: true
  },
  paymentId: {
    type: String
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'NGN'
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'yearly'],
    default: 'monthly'
  },
  autoRenew: {
    type: Boolean,
    default: true
  },
  usage: {
    eventsCreated: {
      type: Number,
      default: 0
    },
    photosUploaded: {
      type: Number,
      default: 0
    },
    lastResetDate: {
      type: Date,
      default: Date.now
    }
  },
  history: [{
    planName: String,
    status: String,
    startDate: Date,
    endDate: Date,
    amount: Number,
    paymentId: String,
    changeType: {
      type: String,
      enum: ['upgrade', 'downgrade', 'cancellation', 'renewal']
    },
    proratedAmount: Number,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Indexes
subscriptionSchema.index({ user: 1, planType: 1 });
subscriptionSchema.index({ status: 1 });
subscriptionSchema.index({ endDate: 1 });

// Methods
subscriptionSchema.methods.isActive = function() {
  return this.status === 'active' || this.status === 'trial';
};

subscriptionSchema.methods.isTrial = function() {
  return this.status === 'trial';
};

subscriptionSchema.methods.canCreateEvent = function() {
  if (!this.isActive()) return false;
  
  const plan = this.planType === 'vendor' ? 
    vendorPlans.find(p => p.name === this.planName) :
    plannerPlans.find(p => p.name === this.planName);
    
  if (!plan) return false;
  
  if (plan.name === 'Basic' || plan.name === 'Starter') {
    return this.usage.eventsCreated < 5;
  }
  
  return true;
};

subscriptionSchema.methods.canUploadPhoto = function() {
  if (!this.isActive()) return false;
  
  const plan = this.planType === 'vendor' ? 
    vendorPlans.find(p => p.name === this.planName) :
    plannerPlans.find(p => p.name === this.planName);
    
  if (!plan) return false;
  
  if (plan.name === 'Basic' || plan.name === 'Starter') {
    return this.usage.photosUploaded < 10;
  }
  
  if (plan.name === 'Professional') {
    return this.usage.photosUploaded < 50;
  }
  
  return true;
};

subscriptionSchema.methods.resetUsage = function() {
  this.usage = {
    eventsCreated: 0,
    photosUploaded: 0,
    lastResetDate: new Date()
  };
  return this.save();
};

const Subscription = mongoose.model('Subscription', subscriptionSchema);

export default Subscription; 