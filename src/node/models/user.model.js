import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      lowercase: true,
      trim: true,
      default: function () {
        return this.email.split("@")[0];
      },
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 8,
      select: false,
    },
    firstName: {
      type: String,
      required: false,
      trim: true,
    },
    lastName: {
      type: String,
      required: false,
      trim: true,
    },
    role: {
      type: String,
      enum: ["admin", "event-planner", "vendor"],
      default: "event-planner",
    },
    status: {
      type: String,
      enum: ["pending_payment", "pending_verification", "active", "suspended"],
      default: "pending_verification",
    },
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
    },
    paymentMethods: [
      {
        type: {
          type: String,
          enum: ["card", "bank_account", "paypal"],
        },
        provider: String, // e.g., "stripe", "flutterwave"
        last4: String,
        brand: String, // e.g., "visa", "mastercard"
        expiryMonth: Number,
        expiryYear: Number,
        isDefault: { type: Boolean, default: false },
        providerCustomerId: String,
        providerPaymentMethodId: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    phone: {
      type: String,
      trim: true,
    },
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      zipCode: String,
    },
    preferences: {
      notifications: {
        email: { type: Boolean, default: true },
        push: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
        newLeads: { type: Boolean, default: true },
        bookingUpdates: { type: Boolean, default: true },
        paymentReminders: { type: Boolean, default: true },
        marketingEmails: { type: Boolean, default: false },
        systemUpdates: { type: Boolean, default: true },
      },
      theme: {
        type: String,
        enum: ["light", "dark", "auto", "system"],
        default: "light",
      },
      language: {
        type: String,
        default: "en",
      },
      timezone: {
        type: String,
        default: "UTC",
      },
      currency: {
        type: String,
        default: "USD",
      },
      dateFormat: {
        type: String,
        enum: ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"],
        default: "MM/DD/YYYY",
      },
      timeFormat: {
        type: String,
        enum: ["12h", "24h"],
        default: "12h",
      },
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    oauthProvider: String,
    oauthId: String,
    profilePicture: String,
    profileImageFileId: String, // GridFS file ID for profile image
    coverPhotoFileId: String, // GridFS file ID for cover photo
    coverPhoto: String, // URL for cover photo (if not using GridFS)
    otp: {
      code: String,
      expires: Date,
      attempts: {
        type: Number,
        default: 0,
      },
    },
    isActive: {
      type: Boolean,
      default: false, // Changed to false - users must verify payment/email before activation
    },
    lastLogin: Date,
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: Date,
    // Two-Factor Authentication
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorSecret: String,
    twoFactorTempSecret: String,
    twoFactorBackupCodes: [String],
    // SSO Configuration
    ssoConfig: {
      enabled: { type: Boolean, default: false },
      provider: String,
      clientId: String,
      clientSecret: String,
      domain: String,
      metadata: mongoose.Schema.Types.Mixed,
      configuredAt: Date,
    },
    // Favorites (for planners)
    favorites: {
      vendors: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Vendor",
        },
      ],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for full name
userSchema.virtual("fullName").get(function () {
  const firstName = this.firstName || "";
  const lastName = this.lastName || "";
  return `${firstName} ${lastName}`.trim() || "N/A";
});

// Generate OTP
userSchema.methods.generateOTP = function () {
  // Generate a 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Hash the OTP before storing
  const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");

  // Set OTP and expiration (15 minutes)
  this.otp = {
    code: hashedOTP,
    expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    attempts: 0,
  };

  return otp; // Return the unhashed OTP for sending to user
};

// Verify OTP
userSchema.methods.verifyOTP = function (otp) {
  if (!this.otp || !this.otp.code || !this.otp.expires) {
    return false;
  }

  // Check if OTP has expired
  if (Date.now() > this.otp.expires) {
    return false;
  }

  // Check if too many attempts
  if (this.otp.attempts >= 3) {
    return false;
  }

  // Hash the provided OTP and compare
  const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");

  // Increment attempts
  this.otp.attempts += 1;

  return hashedOTP === this.otp.code;
};

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Generate email verification token
userSchema.methods.generateEmailVerificationToken = function () {
  const token = crypto.randomBytes(32).toString("hex");
  this.emailVerificationToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  return token;
};

// Generate password reset token
userSchema.methods.generatePasswordResetToken = function () {
  const token = crypto.randomBytes(32).toString("hex");
  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  return token;
};

// Check if password was changed after token was issued
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// Increment login attempts
userSchema.methods.incrementLoginAttempts = async function () {
  if (this.lockUntil && this.lockUntil > Date.now()) {
    return;
  }
  const updates = { $inc: { loginAttempts: 1 } };
  if (this.loginAttempts + 1 >= 5) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  return this.updateOne(updates);
};

// Reset login attempts
userSchema.methods.resetLoginAttempts = function () {
  return this.updateOne({
    $set: { loginAttempts: 0, lockUntil: undefined },
  });
};

// Check if account is locked
userSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

/**
 * Generate a unique username (≤ 10 chars) from an email
 * @param {string} email - The user's email address
 * @returns {string} - A unique username
 */
userSchema.methods.generateUsername = function (email) {
  const localPart = email.split("@")[0];
  const cleaned = localPart.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

  const randomSuffix = crypto.randomBytes(2).toString("hex").slice(0, 3); // 3 chars
  const maxBaseLength = 10 - randomSuffix.length - 1; // leave room for underscore

  const base = cleaned.slice(0, maxBaseLength);
  return `${base}_${randomSuffix}`;
};

// Check if user can access a feature based on subscription
userSchema.methods.canAccessFeature = async function (feature) {
  if (!this.subscription) return false;

  const Subscription = mongoose.model("Subscription");
  const subscription = await Subscription.findById(this.subscription);

  if (!subscription || !subscription.isActive()) return false;

  // Feature access logic based on plan
  return subscription.hasFeature ? subscription.hasFeature(feature) : true;
};

// Check if user is pending payment
userSchema.methods.isPendingPayment = function () {
  return this.status === "pending_payment";
};

// Activate user account
userSchema.methods.activateAccount = async function () {
  this.status = "active";
  this.isEmailVerified = true;
  await this.save();
};

const User = mongoose.model("User", userSchema);

export default User;
