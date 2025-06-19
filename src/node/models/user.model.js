import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Username is required'],
        unique: true,
        lowercase: true,
        trim: true,
        default: function() {
            return this.email.split('@')[0];
        }
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
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
        enum: ['user', 'vendor', 'admin', 'superadmin', 'event-planner'],
        default: 'user',
    },
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
        },
        theme: {
            type: String,
            enum: ['light', 'dark'],
            default: 'light',
        },
        language: {
            type: String,
            default: 'en',
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
    otp: {
        code: String,
        expires: Date,
        attempts: {
            type: Number,
            default: 0
        }
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    lastLogin: Date,
    loginAttempts: {
        type: Number,
        default: 0,
    },
    lockUntil: Date,
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});

// Virtual for full name
userSchema.virtual('fullName').get(function() {
    return `${this.firstName} ${this.lastName}`;
});

// Generate OTP
userSchema.methods.generateOTP = function() {
    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Hash the OTP before storing
    const hashedOTP = crypto
        .createHash('sha256')
        .update(otp)
        .digest('hex');
    
    // Set OTP and expiration (15 minutes)
    this.otp = {
        code: hashedOTP,
        expires: Date.now() + 15 * 60 * 1000, // 15 minutes
        attempts: 0
    };
    
    return otp; // Return the unhashed OTP for sending to user
};

// Verify OTP
userSchema.methods.verifyOTP = function(otp) {
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
    const hashedOTP = crypto
        .createHash('sha256')
        .update(otp)
        .digest('hex');

    // Increment attempts
    this.otp.attempts += 1;

    return hashedOTP === this.otp.code;
};

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw error;
    }
};

// Generate email verification token
userSchema.methods.generateEmailVerificationToken = function() {
    const token = crypto.randomBytes(32).toString('hex');
    this.emailVerificationToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');
    this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    return token;
};

// Generate password reset token
userSchema.methods.generatePasswordResetToken = function() {
    const token = crypto.randomBytes(32).toString('hex');
    this.passwordResetToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');
    this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    return token;
};

// Check if password was changed after token was issued
userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
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
userSchema.methods.incrementLoginAttempts = async function() {
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
userSchema.methods.resetLoginAttempts = function() {
    return this.updateOne({
        $set: { loginAttempts: 0, lockUntil: undefined },
    });
};

// Check if account is locked
userSchema.methods.isLocked = function() {
    return !!(this.lockUntil && this.lockUntil > Date.now());
};

/**
 * Generate a unique username (≤ 10 chars) from an email
 * @param {string} email - The user's email address
 * @returns {string} - A unique username
 */
userSchema.methods.generateUsername = function(email) {
    const localPart = email.split('@')[0];
    const cleaned = localPart.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  
    const randomSuffix = crypto.randomBytes(2).toString('hex').slice(0, 3); // 3 chars
    const maxBaseLength = 10 - randomSuffix.length - 1; // leave room for underscore
  
    const base = cleaned.slice(0, maxBaseLength);
    return `${base}_${randomSuffix}`;
}

const User = mongoose.model('User', userSchema);

export default User; 