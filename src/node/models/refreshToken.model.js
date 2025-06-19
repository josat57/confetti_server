import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  revokedAt: {
    type: Date,
    default: null
  },
  replacedByToken: {
    type: String,
    default: null
  },
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

// Index for faster queries
refreshTokenSchema.index({ token: 1 });
refreshTokenSchema.index({ user: 1 });
refreshTokenSchema.index({ expiresAt: 1 });

// Check if token is expired
refreshTokenSchema.methods.isExpired = function() {
  return Date.now() >= this.expiresAt;
};

// Check if token is revoked
refreshTokenSchema.methods.isRevoked = function() {
  return this.revokedAt !== null;
};

// Revoke token
refreshTokenSchema.methods.revoke = function(replacedByToken = null) {
  this.revokedAt = Date.now();
  this.replacedByToken = replacedByToken;
  return this.save();
};

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

export default RefreshToken; 