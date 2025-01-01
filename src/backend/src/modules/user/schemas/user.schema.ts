import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose'; // v9.0.0
import { Document, HydratedDocument } from 'mongoose'; // v6.0.0

/**
 * Valid user roles in the system
 * @const {string[]}
 */
const VALID_ROLES = ['user', 'parent', 'caregiver', 'expert', 'admin'] as const;

/**
 * Role validation function for mongoose schema
 * @param {string[]} roles - Array of roles to validate
 * @returns {boolean} - Whether roles are valid
 */
const validateRoles = (roles: string[]): boolean => {
  return roles.every(role => VALID_ROLES.includes(role as typeof VALID_ROLES[number]));
};

/**
 * User schema class defining the structure and validation rules for user documents
 * Implements secure PII storage, authentication support, and role-based access control
 */
@Schema({
  timestamps: true,
  collection: 'users',
  versionKey: false,
  toJSON: {
    transform: (_, ret) => {
      delete ret.password;
      return ret;
    }
  }
})
export class User extends Document {
  @Prop({
    required: true,
    unique: true,
    index: true,
    trim: true,
    lowercase: true,
    validate: {
      validator: (email: string) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      },
      message: 'Invalid email format'
    }
  })
  email: string;

  @Prop({
    required: true,
    select: false,
    minlength: [8, 'Password must be at least 8 characters long']
  })
  password: string;

  @Prop({
    required: true,
    trim: true,
    minlength: [2, 'Name must be at least 2 characters long'],
    maxlength: [100, 'Name cannot exceed 100 characters']
  })
  name: string;

  @Prop({
    type: [String],
    default: ['user'],
    validate: [validateRoles, 'Invalid role assignment'],
    required: true
  })
  roles: string[];

  @Prop({
    type: Date,
    default: null,
    index: true
  })
  lastLogin: Date;

  @Prop({
    type: Boolean,
    default: true,
    index: true
  })
  isActive: boolean;

  @Prop({
    type: Date,
    default: null,
    index: true
  })
  deletedAt: Date;
}

/**
 * Type alias for User document with Mongoose methods and virtuals
 */
export type UserDocument = HydratedDocument<User>;

/**
 * Compiled Mongoose schema for User collection
 */
export const UserSchema = SchemaFactory.createForClass(User);

// Index configuration for performance optimization
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ roles: 1 });
UserSchema.index({ isActive: 1, deletedAt: 1 });

// Add compound index for user search
UserSchema.index({ 
  email: 'text', 
  name: 'text' 
}, {
  weights: {
    email: 2,
    name: 1
  }
});

// Pre-save middleware for data sanitization
UserSchema.pre('save', function(next) {
  // Ensure email is lowercase
  if (this.email) {
    this.email = this.email.toLowerCase();
  }
  
  // Ensure name is properly cased
  if (this.name) {
    this.name = this.name.trim();
  }
  
  next();
});

// Virtual for full user identification
UserSchema.virtual('identifier').get(function() {
  return `${this.name} <${this.email}>`;
});

// Method to safely return user data without sensitive fields
UserSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  return obj;
};