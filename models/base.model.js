/**
 * Base Model Template for FMS Application
 * This file provides a standardized base model structure that all models should extend
 */

import mongoose from 'mongoose';

/**
 * Base schema with common fields that all models should have
 */
export const baseSchema = new mongoose.Schema(
  {
    // Common fields for all models
    isActive: {
      type: Boolean,
      default: true,
      required: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    deletedAt: {
      type: Date,
      required: false,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
    versionKey: false, // Disable __v field
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/**
 * Common indexes that should be applied to all models
 */
baseSchema.index({ isActive: 1 });
baseSchema.index({ isDeleted: 1 });
baseSchema.index({ createdAt: -1 });
baseSchema.index({ updatedAt: -1 });

/**
 * Common virtual fields
 */
baseSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

/**
 * Common instance methods
 */
baseSchema.methods.softDelete = function (deletedBy = null) {
  this.isDeleted = true;
  this.isActive = false;
  this.deletedBy = deletedBy;
  this.deletedAt = new Date();
  return this.save();
};

baseSchema.methods.restore = function (restoredBy = null) {
  this.isDeleted = false;
  this.isActive = true;
  this.updatedBy = restoredBy;
  this.deletedBy = null;
  this.deletedAt = null;
  return this.save();
};

baseSchema.methods.activate = function (activatedBy = null) {
  this.isActive = true;
  this.updatedBy = activatedBy;
  return this.save();
};

baseSchema.methods.deactivate = function (deactivatedBy = null) {
  this.isActive = false;
  this.updatedBy = deactivatedBy;
  return this.save();
};

/**
 * Common static methods
 */
baseSchema.statics.findActive = function (query = {}) {
  return this.find({ ...query, isActive: true, isDeleted: false });
};

baseSchema.statics.findOneActive = function (query = {}) {
  return this.findOne({ ...query, isActive: true, isDeleted: false });
};

baseSchema.statics.findDeleted = function (query = {}) {
  return this.find({ ...query, isDeleted: true });
};

baseSchema.statics.findInactive = function (query = {}) {
  return this.find({ ...query, isActive: false, isDeleted: false });
};

/**
 * Common pre-save middleware
 */
baseSchema.pre('save', function (next) {
  // Set updatedBy if not already set
  if (this.isModified() && !this.isNew && !this.updatedBy) {
    // This would typically be set by the controller
    // but we provide a fallback here
  }
  next();
});

/**
 * Common pre-find middleware to exclude deleted documents by default
 */
baseSchema.pre(/^find/, function (next) {
  // Only exclude deleted documents if isDeleted is not explicitly queried
  if (this.getQuery().isDeleted === undefined) {
    this.find({ isDeleted: { $ne: true } });
  }
  next();
});

/**
 * Common validation rules
 */
export const commonValidations = {
  // Email validation
  email: {
    type: String,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'],
  },
  
  // Phone validation
  phone: {
    type: String,
    trim: true,
    match: [/^[\+]?[1-9][\d]{0,15}$/, 'Please enter a valid phone number'],
  },
  
  // URL validation
  url: {
    type: String,
    trim: true,
    match: [/^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/, 'Please enter a valid URL'],
  },
  
  // Currency validation
  currency: {
    type: String,
    uppercase: true,
    trim: true,
    match: [/^[A-Z]{3}$/, 'Currency must be a 3-letter ISO code'],
    default: 'USD',
  },
  
  // Positive number validation
  positiveNumber: {
    type: Number,
    min: [0, 'Value must be positive'],
  },
  
  // Percentage validation
  percentage: {
    type: Number,
    min: [0, 'Percentage must be at least 0'],
    max: [100, 'Percentage cannot exceed 100'],
  },
};

/**
 * Common error messages
 */
export const commonErrorMessages = {
  REQUIRED: 'This field is required',
  INVALID_EMAIL: 'Please enter a valid email address',
  INVALID_PHONE: 'Please enter a valid phone number',
  INVALID_URL: 'Please enter a valid URL',
  INVALID_CURRENCY: 'Please enter a valid 3-letter currency code',
  INVALID_PERCENTAGE: 'Percentage must be between 0 and 100',
  INVALID_POSITIVE_NUMBER: 'Value must be a positive number',
  DUPLICATE_ENTRY: 'This entry already exists',
  NOT_FOUND: 'Record not found',
  UNAUTHORIZED: 'You are not authorized to perform this action',
  FORBIDDEN: 'Access to this resource is forbidden',
  VALIDATION_ERROR: 'Validation failed',
  INTERNAL_ERROR: 'An internal server error occurred',
};

/**
 * Helper function to create a standardized model
 * @param {string} modelName - Name of the model
 * @param {mongoose.Schema} schema - Mongoose schema
 * @param {string} collectionName - Optional collection name
 * @returns {mongoose.Model} Mongoose model
 */
export const createStandardModel = (modelName, schema, collectionName = null) => {
  // Add base schema to the provided schema
  const finalSchema = new mongoose.Schema(
    { ...baseSchema.obj, ...schema.obj },
    { ...baseSchema.options, ...schema.options }
  );
  
  // Add common indexes
  finalSchema.index({ isActive: 1 });
  finalSchema.index({ isDeleted: 1 });
  finalSchema.index({ createdAt: -1 });
  finalSchema.index({ updatedAt: -1 });
  
  // Add common virtuals
  finalSchema.virtual('id').get(function () {
    return this._id.toHexString();
  });
  
  // Add common methods
  finalSchema.methods.softDelete = baseSchema.methods.softDelete;
  finalSchema.methods.restore = baseSchema.methods.restore;
  finalSchema.methods.activate = baseSchema.methods.activate;
  finalSchema.methods.deactivate = baseSchema.methods.deactivate;
  
  // Add common statics
  finalSchema.statics.findActive = baseSchema.statics.findActive;
  finalSchema.statics.findOneActive = baseSchema.statics.findOneActive;
  finalSchema.statics.findDeleted = baseSchema.statics.findDeleted;
  finalSchema.statics.findInactive = baseSchema.statics.findInactive;
  
  // Add common pre-save middleware
  finalSchema.pre('save', baseSchema.pre('save'));
  
  // Add common pre-find middleware
  finalSchema.pre(/^find/, baseSchema.pre(/^find/));
  
  return mongoose.model(modelName, finalSchema, collectionName);
};

export default baseSchema;
