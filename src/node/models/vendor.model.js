import mongoose from 'mongoose';

const vendorSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Vendor name is required'],
        trim: true,
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true,
    },
    phone: {
        type: String,
        required: [true, 'Phone number is required'],
    },
    businessType: {
        type: String,
        required: [true, 'Business type is required'],
        enum: ['catering', 'venue', 'decoration', 'photography', 'music', 'other'],
    },
    description: {
        type: String,
        required: [true, 'Description is required'],
    },
    address: {
        street: String,
        city: String,
        state: String,
        country: String,
        zipCode: String,
    },
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
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'suspended', 'rejected'],
        default: 'pending',
    },
    documents: [{
        type: {
            type: String,
            enum: ['license', 'insurance', 'certification', 'other'],
        },
        url: String,
        verified: {
            type: Boolean,
            default: false,
        },
    }],
    services: [{
        name: String,
        description: String,
        price: {
            amount: Number,
            currency: {
                type: String,
                default: 'USD',
            },
        },
    }],
    rating: {
        average: {
            type: Number,
            default: 0,
            min: 0,
            max: 5,
        },
        count: {
            type: Number,
            default: 0,
        },
    },
    reviews: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
        },
        comment: String,
        createdAt: {
            type: Date,
            default: Date.now,
        },
    }],
    availability: [{
        date: Date,
        slots: [{
            startTime: Date,
            endTime: Date,
            isBooked: {
                type: Boolean,
                default: false,
            },
        }],
    }],
}, {
    timestamps: true,
});

// Indexes
vendorSchema.index({ name: 'text', description: 'text' });
vendorSchema.index({ 'location.coordinates': '2dsphere' });
vendorSchema.index({ status: 1, businessType: 1 });

const Vendor = mongoose.model('Vendor', vendorSchema);

export default Vendor;