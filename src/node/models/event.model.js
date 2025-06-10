import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Event title is required'],
        trim: true,
    },
    description: {
        type: String,
        required: [true, 'Event description is required'],
        trim: true,
    },
    eventType: {
        type: String,
        required: [true, 'Event type is required'],
        enum: ['wedding', 'birthday', 'corporate', 'social', 'other'],
    },
    startDate: {
        type: Date,
        required: [true, 'Start date is required'],
    },
    endDate: {
        type: Date,
        required: [true, 'End date is required'],
    },
    location: {
        address: {
            type: String,
            required: [true, 'Address is required'],
        },
        city: {
            type: String,
            required: [true, 'City is required'],
        },
        state: {
            type: String,
            required: [true, 'State is required'],
        },
        country: {
            type: String,
            required: [true, 'Country is required'],
        },
        coordinates: {
            type: {
                type: String,
                enum: ['Point'],
                default: 'Point',
            },
            coordinates: {
                type: [Number],
                required: [true, 'Coordinates are required'],
            },
        },
    },
    budget: {
        amount: {
            type: Number,
            required: [true, 'Budget amount is required'],
            min: [0, 'Budget cannot be negative'],
        },
        currency: {
            type: String,
            default: 'NGN',
            enum: ['NGN', 'USD', 'EUR', 'GBP'],
        },
    },
    guestCount: {
        type: Number,
        required: [true, 'Guest count is required'],
        min: [1, 'Guest count must be at least 1'],
    },
    status: {
        type: String,
        enum: ['draft', 'published', 'cancelled', 'completed'],
        default: 'draft',
    },
    organizer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Organizer is required'],
    },
    vendors: [{
        vendor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Vendor',
        },
        role: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            enum: ['pending', 'accepted', 'rejected', 'completed'],
            default: 'pending',
        },
        contract: {
            amount: Number,
            currency: {
                type: String,
                default: 'NGN',
                enum: ['NGN', 'USD', 'EUR', 'GBP'],
            },
            status: {
                type: String,
                enum: ['pending', 'paid', 'refunded'],
                default: 'pending',
            },
        },
    }],
    guests: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        status: {
            type: String,
            enum: ['invited', 'confirmed', 'declined'],
            default: 'invited',
        },
        plusOne: {
            type: Boolean,
            default: false,
        },
    }],
    tasks: [{
        title: {
            type: String,
            required: true,
        },
        description: String,
        dueDate: Date,
        status: {
            type: String,
            enum: ['pending', 'in_progress', 'completed'],
            default: 'pending',
        },
        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    }],
    timeline: [{
        title: {
            type: String,
            required: true,
        },
        description: String,
        startTime: Date,
        endTime: Date,
        location: String,
    }],
    media: [{
        type: {
            type: String,
            enum: ['image', 'video'],
            required: true,
        },
        url: {
            type: String,
            required: true,
        },
        caption: String,
        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    }],
    settings: {
        isPrivate: {
            type: Boolean,
            default: false,
        },
        allowGuestInvites: {
            type: Boolean,
            default: false,
        },
        notifications: {
            email: { type: Boolean, default: true },
            push: { type: Boolean, default: true },
            sms: { type: Boolean, default: false },
        },
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});

// Index for geospatial queries
eventSchema.index({ 'location.coordinates': '2dsphere' });

// Virtual for event duration in hours
eventSchema.virtual('duration').get(function() {
    return (this.endDate - this.startDate) / (1000 * 60 * 60);
});

// Virtual for days until event
eventSchema.virtual('daysUntil').get(function() {
    return Math.ceil((this.startDate - new Date()) / (1000 * 60 * 60 * 24));
});

// Virtual for confirmed guest count
eventSchema.virtual('confirmedGuestCount').get(function() {
    return this.guests.filter(guest => guest.status === 'confirmed').length;
});

// Method to check if event is in the past
eventSchema.methods.isPast = function() {
    return this.endDate < new Date();
};

// Method to check if event is upcoming
eventSchema.methods.isUpcoming = function() {
    return this.startDate > new Date();
};

// Method to check if event is ongoing
eventSchema.methods.isOngoing = function() {
    const now = new Date();
    return this.startDate <= now && this.endDate >= now;
};

// Method to get event status
eventSchema.methods.getStatus = function() {
    if (this.status === 'cancelled') return 'cancelled';
    if (this.isPast()) return 'completed';
    if (this.isUpcoming()) return 'upcoming';
    if (this.isOngoing()) return 'ongoing';
    return this.status;
};

// Method to remove a vendor from the event
eventSchema.methods.removeVendor = async function(vendorId) {
    this.vendors = this.vendors.filter(vendor => !vendor.vendor.equals(vendorId));
    return this.save();
};

// Method to remove a guest from the event
eventSchema.methods.removeGuest = async function(guestId) {
    this.guests = this.guests.filter(guest => !guest.user.equals(guestId));
    return this.save();
};

// Method to add a guest to the event
eventSchema.methods.addGuest = async function(userId, plusOne = false) {
    // Check if guest already exists
    const existingGuest = this.guests.find(guest => guest.user.equals(userId));
    if (existingGuest) {
        throw new Error('Guest already exists');
    }

    this.guests.push({
        user: userId,
        status: 'invited',
        plusOne
    });
    return this.save();
};

const Event = mongoose.model('Event', eventSchema);

export default Event; 