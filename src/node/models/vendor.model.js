import mongoose from 'mongoose';

const vendorSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Vendor name is required'],
        trim: true,
    },
    description: {
        type: String,
        required: [true, 'Vendor description is required'],
        trim: true,
    },
    businessType: {
        type: String,
        required: [true, 'Business type is required'],
        enum: ['individual', 'company'],
    },
    categories: [{
        type: String,
        required: true,
        enum: [
            'venue',
            'catering',
            'photography',
            'videography',
            'music',
            'decoration',
            'attire',
            'beauty',
            'transportation',
            'accommodation',
            'other',
        ],
    }],
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
    contact: {
        email: {
            type: String,
            required: [true, 'Email is required'],
            lowercase: true,
            trim: true,
        },
        phone: {
            type: String,
            required: [true, 'Phone number is required'],
            trim: true,
        },
        website: {
            type: String,
            trim: true,
        },
        socialMedia: {
            facebook: String,
            instagram: String,
            twitter: String,
            linkedin: String,
        },
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Owner is required'],
    },
    team: [{
        name: {
            type: String,
            required: true,
        },
        role: {
            type: String,
            required: true,
        },
        bio: String,
        image: String,
    }],
    services: [{
        name: {
            type: String,
            required: true,
        },
        description: String,
        price: {
            amount: {
                type: Number,
                required: true,
                min: [0, 'Price cannot be negative'],
            },
            currency: {
                type: String,
                default: 'NGN',
                enum: ['NGN', 'USD', 'EUR', 'GBP'],
            },
        },
        duration: {
            type: Number, // in hours
            required: true,
        },
        isAvailable: {
            type: Boolean,
            default: true,
        },
    }],
    portfolio: [{
        title: {
            type: String,
            required: true,
        },
        description: String,
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
        }],
        eventType: {
            type: String,
            required: true,
        },
        date: Date,
    }],
    availability: [{
        date: {
            type: Date,
            required: true,
        },
        slots: [{
            startTime: {
                type: Date,
                required: true,
            },
            endTime: {
                type: Date,
                required: true,
            },
            isBooked: {
                type: Boolean,
                default: false,
            },
        }],
    }],
    reviews: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
        },
        comment: {
            type: String,
            required: true,
        },
        event: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Event',
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    }],
    documents: [{
        type: {
            type: String,
            required: true,
            enum: ['license', 'insurance', 'certification', 'other'],
        },
        name: {
            type: String,
            required: true,
        },
        url: {
            type: String,
            required: true,
        },
        expiryDate: Date,
        verified: {
            type: Boolean,
            default: false,
        },
    }],
    status: {
        type: String,
        enum: ['pending', 'active', 'suspended', 'inactive'],
        default: 'pending',
    },
    settings: {
        autoAcceptBookings: {
            type: Boolean,
            default: false,
        },
        notifications: {
            email: { type: Boolean, default: true },
            push: { type: Boolean, default: true },
            sms: { type: Boolean, default: false },
        },
        availability: {
            workingDays: {
                type: [Number], // 0-6 for Sunday-Saturday
                default: [1, 2, 3, 4, 5], // Monday-Friday
            },
            workingHours: {
                start: {
                    type: String,
                    default: '09:00',
                },
                end: {
                    type: String,
                    default: '17:00',
                },
            },
        },
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});

// Indexes
vendorSchema.index({ 'location.coordinates': '2dsphere' });
vendorSchema.index({ categories: 1 });
vendorSchema.index({ status: 1 });

// Virtual for average rating
vendorSchema.virtual('averageRating').get(function() {
    if (this.reviews.length === 0) return 0;
    const sum = this.reviews.reduce((acc, review) => acc + review.rating, 0);
    return sum / this.reviews.length;
});

// Virtual for total reviews
vendorSchema.virtual('totalReviews').get(function() {
    return this.reviews.length;
});

// Method to check if vendor is available on a specific date and time
vendorSchema.methods.isAvailable = function(date, startTime, endTime) {
    const availability = this.availability.find(a => 
        a.date.toDateString() === date.toDateString()
    );
    
    if (!availability) return false;
    
    return availability.slots.some(slot => 
        !slot.isBooked &&
        slot.startTime <= startTime &&
        slot.endTime >= endTime
    );
};

// Method to add a review
vendorSchema.methods.addReview = async function(userId, rating, comment, eventId) {
    this.reviews.push({
        user: userId,
        rating,
        comment,
        event: eventId,
    });
    return this.save();
};

// Method to update vendor status
vendorSchema.methods.updateStatus = async function(status) {
    this.status = status;
    return this.save();
};

// Method to add a service
vendorSchema.methods.addService = async function(service) {
    this.services.push(service);
    return this.save();
};

// Method to add a portfolio item
vendorSchema.methods.addPortfolioItem = async function(item) {
    this.portfolio.push(item);
    return this.save();
};

// Method to add a document
vendorSchema.methods.addDocument = async function(document) {
    this.documents.push(document);
    return this.save();
};

const Vendor = mongoose.model('Vendor', vendorSchema);

export default Vendor; 