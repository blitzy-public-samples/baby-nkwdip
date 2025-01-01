import { Schema, Document } from 'mongoose'; // @package mongoose ^6.0.0
import { NeedType, IAnalysisFeatures, IAnalysisResult, IAnalysisDocument } from '../interfaces/analysis.interface';

/**
 * Mongoose schema definition for cry analysis results with comprehensive validation,
 * indexing, and automated data retention policies.
 */
export const AnalysisSchema = new Schema({
    babyId: {
        type: Schema.Types.ObjectId,
        ref: 'Baby',
        required: [true, 'Baby ID is required'],
        index: true,
        validate: {
            validator: function(v: any) {
                return Schema.Types.ObjectId.isValid(v);
            },
            message: 'Invalid baby ID format'
        }
    },

    needType: {
        type: String,
        enum: Object.values(NeedType),
        required: [true, 'Need type classification is required'],
        index: true,
        validate: {
            validator: function(v: string) {
                return Object.values(NeedType).includes(v as NeedType);
            },
            message: 'Invalid need type classification'
        }
    },

    confidence: {
        type: Number,
        required: [true, 'Confidence score is required'],
        min: [0, 'Confidence score cannot be negative'],
        max: [100, 'Confidence score cannot exceed 100'],
        index: true,
        validate: {
            validator: function(v: number) {
                return v >= 0 && v <= 100;
            },
            message: 'Confidence score must be between 0 and 100'
        }
    },

    features: {
        amplitude: {
            type: Number,
            required: [true, 'Amplitude measurement is required'],
            min: [-60, 'Amplitude cannot be below -60 dB'],
            max: [0, 'Amplitude cannot exceed 0 dB'],
            validate: {
                validator: function(v: number) {
                    return v >= -60 && v <= 0;
                },
                message: 'Invalid amplitude range'
            }
        },
        frequency: {
            type: Number,
            required: [true, 'Frequency measurement is required'],
            min: [20, 'Frequency cannot be below 20 Hz'],
            max: [20000, 'Frequency cannot exceed 20 kHz'],
            validate: {
                validator: function(v: number) {
                    return v >= 20 && v <= 20000;
                },
                message: 'Invalid frequency range'
            }
        },
        duration: {
            type: Number,
            required: [true, 'Duration measurement is required'],
            min: [0, 'Duration cannot be negative'],
            validate: {
                validator: function(v: number) {
                    return v > 0;
                },
                message: 'Duration must be positive'
            }
        },
        pattern: {
            type: String,
            required: [true, 'Pattern signature is required'],
            validate: {
                validator: function(v: string) {
                    return /^[A-Z0-9-]+$/.test(v);
                },
                message: 'Invalid pattern format'
            }
        },
        noiseLevel: {
            type: Number,
            required: [true, 'Noise level measurement is required'],
            min: [0, 'Noise level cannot be negative'],
            max: [100, 'Noise level cannot exceed 100'],
            validate: {
                validator: function(v: number) {
                    return v >= 0 && v <= 100;
                },
                message: 'Invalid noise level range'
            }
        },
        signalQuality: {
            type: Number,
            required: [true, 'Signal quality measurement is required'],
            min: [0, 'Signal quality cannot be negative'],
            max: [100, 'Signal quality cannot exceed 100']
        },
        backgroundNoise: {
            type: Number,
            required: [true, 'Background noise measurement is required'],
            min: [-120, 'Background noise cannot be below -120 dB'],
            max: [0, 'Background noise cannot exceed 0 dB']
        }
    },

    timestamp: {
        type: Date,
        default: Date.now,
        expires: '90d',
        index: true
    },

    processingMetadata: {
        duration: Number,
        sampleRate: Number,
        channels: Number,
        format: String
    }
}, {
    timestamps: true,
    versionKey: false,
    collection: 'analyses',
    validateBeforeSave: true,
    strict: true,
    toJSON: {
        virtuals: true,
        transform: function(doc: any, ret: any) {
            delete ret._id;
            return ret;
        },
        getters: true
    },
    toObject: {
        virtuals: true,
        getters: true
    }
});

// Compound index for efficient baby-specific queries
AnalysisSchema.index(
    { babyId: 1, timestamp: -1 },
    { name: 'baby_timestamp_idx', background: true }
);

// Index for need type queries
AnalysisSchema.index(
    { needType: 1 },
    { name: 'need_type_idx', background: true }
);

// Index for confidence-based queries
AnalysisSchema.index(
    { confidence: 1 },
    { name: 'confidence_idx', background: true, sparse: true }
);

// Pre-save hook for data validation
AnalysisSchema.pre('save', function(next) {
    if (this.isModified('features')) {
        // Validate feature relationships
        const features = this.features as IAnalysisFeatures;
        if (features.noiseLevel > features.signalQuality) {
            next(new Error('Noise level cannot exceed signal quality'));
            return;
        }
    }
    next();
});

// Post-save hook for related updates
AnalysisSchema.post('save', async function() {
    // Trigger any necessary updates or notifications
    // Implementation depends on notification service integration
});