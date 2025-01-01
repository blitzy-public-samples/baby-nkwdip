import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose'; // v9.0.0
import { Document, HydratedDocument } from 'mongoose'; // v6.0.0
import { UserDocument } from '../../user/schemas/user.schema';

/**
 * Sensitivity levels for cry detection
 */
const SENSITIVITY_LEVELS = ['low', 'medium', 'high'] as const;
type SensitivityLevel = typeof SENSITIVITY_LEVELS[number];

/**
 * Interface for monitoring preferences
 */
interface MonitoringPreferences {
  backgroundMonitoring: boolean;
  notificationsEnabled: boolean;
  sensitivity: SensitivityLevel;
  noiseThreshold: number;
  nightMode: boolean;
}

/**
 * Interface for pattern history tracking
 */
interface PatternHistory {
  patterns: Array<{
    timestamp: Date;
    type: string;
    confidence: number;
    needType: string;
    audioRef?: string;
  }>;
  learningProgress: number;
  lastUpdate: Date | null;
}

/**
 * Baby schema class defining the structure for baby profiles
 * Implements secure storage, pattern tracking, and ML integration
 */
@Schema({
  timestamps: true,
  collection: 'babies',
  versionKey: false
})
export class Baby extends Document {
  @Prop({
    required: true,
    trim: true,
    minlength: [2, 'Name must be at least 2 characters long'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  })
  name: string;

  @Prop({
    required: true,
    index: true,
    validate: {
      validator: (date: Date) => {
        return date <= new Date();
      },
      message: 'Birth date cannot be in the future'
    }
  })
  birthDate: Date;

  @Prop({
    required: true,
    ref: 'User',
    index: true,
    type: Schema.Types.ObjectId
  })
  userId: UserDocument['_id'];

  @Prop({
    type: Object,
    required: true,
    default: {
      backgroundMonitoring: false,
      notificationsEnabled: true,
      sensitivity: 'medium',
      noiseThreshold: 0.5,
      nightMode: false
    }
  })
  preferences: MonitoringPreferences;

  @Prop({
    default: true,
    index: true
  })
  isActive: boolean;

  @Prop({
    type: Date,
    index: true
  })
  lastAnalysis: Date;

  @Prop({
    type: Object,
    default: {
      patterns: [],
      learningProgress: 0,
      lastUpdate: null
    }
  })
  patternHistory: PatternHistory;

  @Prop({
    required: true,
    type: Date,
    validate: {
      validator: (date: Date) => {
        return date > new Date();
      },
      message: 'Retention date must be in the future'
    }
  })
  retentionDate: Date;

  /**
   * Calculate baby's current age in months
   * @returns {number} Age in months with decimal precision
   */
  getAge(): number {
    const today = new Date();
    const birthDate = this.birthDate;
    const monthsDiff = (today.getFullYear() - birthDate.getFullYear()) * 12 +
      (today.getMonth() - birthDate.getMonth());
    const daysDiff = today.getDate() - birthDate.getDate();
    const decimalPart = daysDiff / 30; // Approximate days in month
    return Number((monthsDiff + decimalPart).toFixed(1));
  }

  /**
   * Update pattern history with new analysis results
   * @param {Object} pattern New pattern data to add
   */
  updatePatternHistory(pattern: PatternHistory['patterns'][0]): void {
    const MAX_PATTERNS = 1000; // Limit pattern history size
    
    this.patternHistory.patterns.unshift(pattern);
    if (this.patternHistory.patterns.length > MAX_PATTERNS) {
      this.patternHistory.patterns = this.patternHistory.patterns.slice(0, MAX_PATTERNS);
    }
    
    this.patternHistory.lastUpdate = new Date();
    this.patternHistory.learningProgress = Math.min(
      (this.patternHistory.patterns.length / 100) * 10,
      100
    );
    
    this.lastAnalysis = pattern.timestamp;
  }
}

/**
 * Type alias for Baby document with Mongoose methods
 */
export type BabyDocument = HydratedDocument<Baby>;

/**
 * Compiled Mongoose schema for Baby collection
 */
export const BabySchema = SchemaFactory.createForClass(Baby);

// Index configuration for performance optimization
BabySchema.index({ userId: 1, isActive: 1 });
BabySchema.index({ birthDate: 1 });
BabySchema.index({ retentionDate: 1 });
BabySchema.index({ 'patternHistory.lastUpdate': 1 });

// Pre-save middleware for data validation and retention date
BabySchema.pre('save', function(next) {
  if (this.isNew) {
    // Set retention date to 24 months from creation
    const retentionDate = new Date();
    retentionDate.setMonth(retentionDate.getMonth() + 24);
    this.retentionDate = retentionDate;
  }
  next();
});

// Virtual for age calculation
BabySchema.virtual('ageInMonths').get(function() {
  return this.getAge();
});

// Method to safely return baby data
BabySchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};