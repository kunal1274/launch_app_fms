/**
 * Standardized Validation Utility for FMS Application
 * This utility provides consistent validation across all modules
 */

import { ValidationError } from './error.util.js';

/**
 * Validation schemas for common fields
 */
export const validationSchemas = {
  // Email validation
  email: {
    type: 'string',
    required: true,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: 'Please enter a valid email address',
  },

  // Phone validation
  phone: {
    type: 'string',
    required: false,
    pattern: /^[\+]?[1-9][\d]{0,15}$/,
    message: 'Please enter a valid phone number',
  },

  // URL validation
  url: {
    type: 'string',
    required: false,
    pattern: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
    message: 'Please enter a valid URL',
  },

  // Currency validation
  currency: {
    type: 'string',
    required: false,
    pattern: /^[A-Z]{3}$/,
    message: 'Currency must be a 3-letter ISO code',
    default: 'USD',
  },

  // Password validation
  password: {
    type: 'string',
    required: true,
    minLength: 8,
    maxLength: 128,
    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    message: 'Password must contain at least 8 characters, including uppercase, lowercase, number, and special character',
  },

  // Name validation
  name: {
    type: 'string',
    required: true,
    minLength: 2,
    maxLength: 100,
    pattern: /^[a-zA-Z\s\-'\.]+$/,
    message: 'Name must contain only letters, spaces, hyphens, apostrophes, and periods',
  },

  // Alphanumeric validation
  alphanumeric: {
    type: 'string',
    required: false,
    pattern: /^[a-zA-Z0-9]+$/,
    message: 'Field must contain only letters and numbers',
  },

  // Positive number validation
  positiveNumber: {
    type: 'number',
    required: false,
    min: 0,
    message: 'Value must be a positive number',
  },

  // Percentage validation
  percentage: {
    type: 'number',
    required: false,
    min: 0,
    max: 100,
    message: 'Percentage must be between 0 and 100',
  },

  // Date validation
  date: {
    type: 'string',
    required: false,
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    message: 'Date must be in YYYY-MM-DD format',
  },

  // DateTime validation
  datetime: {
    type: 'string',
    required: false,
    pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/,
    message: 'DateTime must be in ISO format',
  },

  // ObjectId validation
  objectId: {
    type: 'string',
    required: false,
    pattern: /^[0-9a-fA-F]{24}$/,
    message: 'Invalid ObjectId format',
  },

  // Boolean validation
  boolean: {
    type: 'boolean',
    required: false,
    message: 'Value must be true or false',
  },

  // Array validation
  array: {
    type: 'array',
    required: false,
    message: 'Value must be an array',
  },

  // Object validation
  object: {
    type: 'object',
    required: false,
    message: 'Value must be an object',
  },
};

/**
 * Validation functions
 */
export const validators = {
  /**
   * Validate email
   */
  email: (value, required = true) => {
    if (!required && (!value || value === '')) return null;
    if (required && (!value || value === '')) return 'Email is required';
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return 'Please enter a valid email address';
    }
    return null;
  },

  /**
   * Validate phone number
   */
  phone: (value, required = false) => {
    if (!required && (!value || value === '')) return null;
    if (required && (!value || value === '')) return 'Phone number is required';
    
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    if (!phoneRegex.test(value)) {
      return 'Please enter a valid phone number';
    }
    return null;
  },

  /**
   * Validate URL
   */
  url: (value, required = false) => {
    if (!required && (!value || value === '')) return null;
    if (required && (!value || value === '')) return 'URL is required';
    
    try {
      new URL(value);
      return null;
    } catch {
      return 'Please enter a valid URL';
    }
  },

  /**
   * Validate currency code
   */
  currency: (value, required = false) => {
    if (!required && (!value || value === '')) return null;
    if (required && (!value || value === '')) return 'Currency is required';
    
    const currencyRegex = /^[A-Z]{3}$/;
    if (!currencyRegex.test(value)) {
      return 'Currency must be a 3-letter ISO code';
    }
    return null;
  },

  /**
   * Validate password
   */
  password: (value, required = true) => {
    if (!required && (!value || value === '')) return null;
    if (required && (!value || value === '')) return 'Password is required';
    
    if (value.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    
    if (value.length > 128) {
      return 'Password must be less than 128 characters';
    }
    
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
    if (!passwordRegex.test(value)) {
      return 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character';
    }
    
    return null;
  },

  /**
   * Validate name
   */
  name: (value, required = true) => {
    if (!required && (!value || value === '')) return null;
    if (required && (!value || value === '')) return 'Name is required';
    
    if (value.length < 2) {
      return 'Name must be at least 2 characters long';
    }
    
    if (value.length > 100) {
      return 'Name must be less than 100 characters';
    }
    
    const nameRegex = /^[a-zA-Z\s\-'\.]+$/;
    if (!nameRegex.test(value)) {
      return 'Name must contain only letters, spaces, hyphens, apostrophes, and periods';
    }
    
    return null;
  },

  /**
   * Validate alphanumeric string
   */
  alphanumeric: (value, required = false) => {
    if (!required && (!value || value === '')) return null;
    if (required && (!value || value === '')) return 'Field is required';
    
    const alphanumericRegex = /^[a-zA-Z0-9]+$/;
    if (!alphanumericRegex.test(value)) {
      return 'Field must contain only letters and numbers';
    }
    
    return null;
  },

  /**
   * Validate positive number
   */
  positiveNumber: (value, required = false) => {
    if (!required && (value === undefined || value === null || value === '')) return null;
    if (required && (value === undefined || value === null || value === '')) return 'Number is required';
    
    const num = Number(value);
    if (isNaN(num)) {
      return 'Value must be a valid number';
    }
    
    if (num < 0) {
      return 'Value must be a positive number';
    }
    
    return null;
  },

  /**
   * Validate percentage
   */
  percentage: (value, required = false) => {
    if (!required && (value === undefined || value === null || value === '')) return null;
    if (required && (value === undefined || value === null || value === '')) return 'Percentage is required';
    
    const num = Number(value);
    if (isNaN(num)) {
      return 'Value must be a valid number';
    }
    
    if (num < 0 || num > 100) {
      return 'Percentage must be between 0 and 100';
    }
    
    return null;
  },

  /**
   * Validate date
   */
  date: (value, required = false) => {
    if (!required && (!value || value === '')) return null;
    if (required && (!value || value === '')) return 'Date is required';
    
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(value)) {
      return 'Date must be in YYYY-MM-DD format';
    }
    
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }
    
    return null;
  },

  /**
   * Validate datetime
   */
  datetime: (value, required = false) => {
    if (!required && (!value || value === '')) return null;
    if (required && (!value || value === '')) return 'DateTime is required';
    
    const datetimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    if (!datetimeRegex.test(value)) {
      return 'DateTime must be in ISO format';
    }
    
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return 'Invalid datetime';
    }
    
    return null;
  },

  /**
   * Validate ObjectId
   */
  objectId: (value, required = false) => {
    if (!required && (!value || value === '')) return null;
    if (required && (!value || value === '')) return 'ID is required';
    
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    if (!objectIdRegex.test(value)) {
      return 'Invalid ID format';
    }
    
    return null;
  },

  /**
   * Validate boolean
   */
  boolean: (value, required = false) => {
    if (!required && (value === undefined || value === null)) return null;
    if (required && (value === undefined || value === null)) return 'Boolean value is required';
    
    if (typeof value !== 'boolean') {
      return 'Value must be true or false';
    }
    
    return null;
  },

  /**
   * Validate array
   */
  array: (value, required = false) => {
    if (!required && (!value || value === null)) return null;
    if (required && (!value || value === null)) return 'Array is required';
    
    if (!Array.isArray(value)) {
      return 'Value must be an array';
    }
    
    return null;
  },

  /**
   * Validate object
   */
  object: (value, required = false) => {
    if (!required && (!value || value === null)) return null;
    if (required && (!value || value === null)) return 'Object is required';
    
    if (typeof value !== 'object' || Array.isArray(value)) {
      return 'Value must be an object';
    }
    
    return null;
  },

  /**
   * Validate string length
   */
  stringLength: (value, min, max, required = false) => {
    if (!required && (!value || value === '')) return null;
    if (required && (!value || value === '')) return 'Field is required';
    
    if (value.length < min) {
      return `Field must be at least ${min} characters long`;
    }
    
    if (value.length > max) {
      return `Field must be less than ${max} characters`;
    }
    
    return null;
  },

  /**
   * Validate number range
   */
  numberRange: (value, min, max, required = false) => {
    if (!required && (value === undefined || value === null || value === '')) return null;
    if (required && (value === undefined || value === null || value === '')) return 'Number is required';
    
    const num = Number(value);
    if (isNaN(num)) {
      return 'Value must be a valid number';
    }
    
    if (num < min || num > max) {
      return `Value must be between ${min} and ${max}`;
    }
    
    return null;
  },
};

/**
 * Validation helper functions
 */
export const validationHelpers = {
  /**
   * Validate required fields
   */
  validateRequired: (data, requiredFields) => {
    const errors = {};
    
    requiredFields.forEach(field => {
      if (data[field] === undefined || data[field] === null || data[field] === '') {
        errors[field] = `${field} is required`;
      }
    });
    
    return Object.keys(errors).length > 0 ? errors : null;
  },

  /**
   * Validate field types
   */
  validateTypes: (data, typeMap) => {
    const errors = {};
    
    Object.keys(typeMap).forEach(field => {
      const expectedType = typeMap[field];
      const value = data[field];
      
      if (value !== undefined && value !== null) {
        if (expectedType === 'array' && !Array.isArray(value)) {
          errors[field] = `${field} must be an array`;
        } else if (expectedType === 'object' && (typeof value !== 'object' || Array.isArray(value))) {
          errors[field] = `${field} must be an object`;
        } else if (expectedType === 'boolean' && typeof value !== 'boolean') {
          errors[field] = `${field} must be a boolean`;
        } else if (expectedType === 'number' && typeof value !== 'number') {
          errors[field] = `${field} must be a number`;
        } else if (expectedType === 'string' && typeof value !== 'string') {
          errors[field] = `${field} must be a string`;
        }
      }
    });
    
    return Object.keys(errors).length > 0 ? errors : null;
  },

  /**
   * Validate field patterns
   */
  validatePatterns: (data, patternMap) => {
    const errors = {};
    
    Object.keys(patternMap).forEach(field => {
      const { pattern, message } = patternMap[field];
      const value = data[field];
      
      if (value && !pattern.test(value)) {
        errors[field] = message || `${field} format is invalid`;
      }
    });
    
    return Object.keys(errors).length > 0 ? errors : null;
  },

  /**
   * Validate field ranges
   */
  validateRanges: (data, rangeMap) => {
    const errors = {};
    
    Object.keys(rangeMap).forEach(field => {
      const { min, max, message } = rangeMap[field];
      const value = data[field];
      
      if (value !== undefined && value !== null) {
        if (typeof value === 'string') {
          if (value.length < min || value.length > max) {
            errors[field] = message || `${field} must be between ${min} and ${max} characters`;
          }
        } else if (typeof value === 'number') {
          if (value < min || value > max) {
            errors[field] = message || `${field} must be between ${min} and ${max}`;
          }
        }
      }
    });
    
    return Object.keys(errors).length > 0 ? errors : null;
  },

  /**
   * Validate enum values
   */
  validateEnums: (data, enumMap) => {
    const errors = {};
    
    Object.keys(enumMap).forEach(field => {
      const allowedValues = enumMap[field];
      const value = data[field];
      
      if (value && !allowedValues.includes(value)) {
        errors[field] = `${field} must be one of: ${allowedValues.join(', ')}`;
      }
    });
    
    return Object.keys(errors).length > 0 ? errors : null;
  },
};

/**
 * Main validation function
 */
export const validate = (data, schema) => {
  const errors = {};
  
  Object.keys(schema).forEach(field => {
    const fieldSchema = schema[field];
    const value = data[field];
    
    // Check required
    if (fieldSchema.required && (value === undefined || value === null || value === '')) {
      errors[field] = `${field} is required`;
      return;
    }
    
    // Skip validation if field is not required and empty
    if (!fieldSchema.required && (value === undefined || value === null || value === '')) {
      return;
    }
    
    // Validate type
    if (fieldSchema.type && typeof value !== fieldSchema.type) {
      errors[field] = `${field} must be a ${fieldSchema.type}`;
      return;
    }
    
    // Validate pattern
    if (fieldSchema.pattern && !fieldSchema.pattern.test(value)) {
      errors[field] = fieldSchema.message || `${field} format is invalid`;
      return;
    }
    
    // Validate min/max for strings
    if (fieldSchema.type === 'string' && typeof value === 'string') {
      if (fieldSchema.minLength && value.length < fieldSchema.minLength) {
        errors[field] = `${field} must be at least ${fieldSchema.minLength} characters long`;
        return;
      }
      if (fieldSchema.maxLength && value.length > fieldSchema.maxLength) {
        errors[field] = `${field} must be less than ${fieldSchema.maxLength} characters`;
        return;
      }
    }
    
    // Validate min/max for numbers
    if (fieldSchema.type === 'number' && typeof value === 'number') {
      if (fieldSchema.min !== undefined && value < fieldSchema.min) {
        errors[field] = `${field} must be at least ${fieldSchema.min}`;
        return;
      }
      if (fieldSchema.max !== undefined && value > fieldSchema.max) {
        errors[field] = `${field} must be less than ${fieldSchema.max}`;
        return;
      }
    }
  });
  
  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Validation failed', errors);
  }
  
  return true;
};

export default {
  validationSchemas,
  validators,
  validationHelpers,
  validate,
};
