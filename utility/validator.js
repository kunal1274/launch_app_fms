/**
 * Centralized Validation Utility
 * Provides consistent validation across the application
 */

import { ValidationError } from './errorHandler.js';

export class Validator {
  /**
   * Validate required fields
   * @param {Object} data - Data to validate
   * @param {Array} requiredFields - Array of required field names
   * @returns {Object} Validation result
   */
  static validateRequired(data, requiredFields) {
    const errors = [];
    
    requiredFields.forEach(field => {
      if (data[field] === undefined || data[field] === null || data[field] === '') {
        errors.push({
          field,
          message: `${field} is required`,
          value: data[field]
        });
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate email format
   * @param {string} email - Email to validate
   * @returns {boolean} Is valid email
   */
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone number format
   * @param {string} phone - Phone number to validate
   * @returns {boolean} Is valid phone number
   */
  static isValidPhone(phone) {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  }

  /**
   * Validate ObjectId format
   * @param {string} id - ID to validate
   * @returns {boolean} Is valid ObjectId
   */
  static isValidObjectId(id) {
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    return objectIdRegex.test(id);
  }

  /**
   * Validate string length
   * @param {string} value - String to validate
   * @param {number} min - Minimum length
   * @param {number} max - Maximum length
   * @returns {boolean} Is valid length
   */
  static isValidLength(value, min, max) {
    if (typeof value !== 'string') return false;
    return value.length >= min && value.length <= max;
  }

  /**
   * Validate number range
   * @param {number} value - Number to validate
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {boolean} Is valid range
   */
  static isValidRange(value, min, max) {
    if (typeof value !== 'number') return false;
    return value >= min && value <= max;
  }

  /**
   * Validate enum value
   * @param {*} value - Value to validate
   * @param {Array} allowedValues - Array of allowed values
   * @returns {boolean} Is valid enum value
   */
  static isValidEnum(value, allowedValues) {
    return allowedValues.includes(value);
  }

  /**
   * Validate date format
   * @param {string|Date} date - Date to validate
   * @returns {boolean} Is valid date
   */
  static isValidDate(date) {
    const dateObj = new Date(date);
    return dateObj instanceof Date && !isNaN(dateObj);
  }

  /**
   * Validate URL format
   * @param {string} url - URL to validate
   * @returns {boolean} Is valid URL
   */
  static isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Sanitize string input
   * @param {string} input - String to sanitize
   * @returns {string} Sanitized string
   */
  static sanitizeString(input) {
    if (typeof input !== 'string') return input;
    return input.trim().replace(/[<>]/g, '');
  }

  /**
   * Validate and sanitize email
   * @param {string} email - Email to validate
   * @returns {Object} Validation result
   */
  static validateEmail(email) {
    const errors = [];
    
    if (!email) {
      errors.push({
        field: 'email',
        message: 'Email is required',
        value: email
      });
    } else if (!this.isValidEmail(email)) {
      errors.push({
        field: 'email',
        message: 'Invalid email format',
        value: email
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitized: this.sanitizeString(email)
    };
  }

  /**
   * Validate and sanitize phone number
   * @param {string} phone - Phone number to validate
   * @returns {Object} Validation result
   */
  static validatePhone(phone) {
    const errors = [];
    
    if (!phone) {
      errors.push({
        field: 'phone',
        message: 'Phone number is required',
        value: phone
      });
    } else if (!this.isValidPhone(phone)) {
      errors.push({
        field: 'phone',
        message: 'Invalid phone number format',
        value: phone
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitized: phone.replace(/\s/g, '')
    };
  }

  /**
   * Validate ObjectId
   * @param {string} id - ID to validate
   * @param {string} fieldName - Field name for error message
   * @returns {Object} Validation result
   */
  static validateObjectId(id, fieldName = 'id') {
    const errors = [];
    
    if (!id) {
      errors.push({
        field: fieldName,
        message: `${fieldName} is required`,
        value: id
      });
    } else if (!this.isValidObjectId(id)) {
      errors.push({
        field: fieldName,
        message: `Invalid ${fieldName} format`,
        value: id
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate pagination parameters
   * @param {Object} query - Query parameters
   * @returns {Object} Validation result
   */
  static validatePagination(query) {
    const errors = [];
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;

    if (page < 1) {
      errors.push({
        field: 'page',
        message: 'Page must be greater than 0',
        value: page
      });
    }

    if (limit < 1 || limit > 100) {
      errors.push({
        field: 'limit',
        message: 'Limit must be between 1 and 100',
        value: limit
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitized: { page, limit }
    };
  }

  /**
   * Validate date range
   * @param {string} startDate - Start date
   * @param {string} endDate - End date
   * @returns {Object} Validation result
   */
  static validateDateRange(startDate, endDate) {
    const errors = [];
    
    if (startDate && !this.isValidDate(startDate)) {
      errors.push({
        field: 'startDate',
        message: 'Invalid start date format',
        value: startDate
      });
    }

    if (endDate && !this.isValidDate(endDate)) {
      errors.push({
        field: 'endDate',
        message: 'Invalid end date format',
        value: endDate
      });
    }

    if (startDate && endDate && this.isValidDate(startDate) && this.isValidDate(endDate)) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (start > end) {
        errors.push({
          field: 'dateRange',
          message: 'Start date must be before end date',
          value: { startDate, endDate }
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate business rules
   * @param {Object} data - Data to validate
   * @param {Object} rules - Validation rules
   * @returns {Object} Validation result
   */
  static validateBusinessRules(data, rules) {
    const errors = [];

    Object.keys(rules).forEach(field => {
      const rule = rules[field];
      const value = data[field];

      // Required validation
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push({
          field,
          message: rule.requiredMessage || `${field} is required`,
          value
        });
        return;
      }

      // Skip other validations if field is not required and empty
      if (!rule.required && (value === undefined || value === null || value === '')) {
        return;
      }

      // Type validation
      if (rule.type && typeof value !== rule.type) {
        errors.push({
          field,
          message: rule.typeMessage || `${field} must be of type ${rule.type}`,
          value
        });
      }

      // Length validation
      if (rule.minLength && value.length < rule.minLength) {
        errors.push({
          field,
          message: rule.minLengthMessage || `${field} must be at least ${rule.minLength} characters`,
          value
        });
      }

      if (rule.maxLength && value.length > rule.maxLength) {
        errors.push({
          field,
          message: rule.maxLengthMessage || `${field} must be no more than ${rule.maxLength} characters`,
          value
        });
      }

      // Range validation
      if (rule.min !== undefined && value < rule.min) {
        errors.push({
          field,
          message: rule.minMessage || `${field} must be at least ${rule.min}`,
          value
        });
      }

      if (rule.max !== undefined && value > rule.max) {
        errors.push({
          field,
          message: rule.maxMessage || `${field} must be no more than ${rule.max}`,
          value
        });
      }

      // Enum validation
      if (rule.enum && !rule.enum.includes(value)) {
        errors.push({
          field,
          message: rule.enumMessage || `${field} must be one of: ${rule.enum.join(', ')}`,
          value
        });
      }

      // Custom validation
      if (rule.custom && typeof rule.custom === 'function') {
        const customResult = rule.custom(value, data);
        if (customResult !== true) {
          errors.push({
            field,
            message: customResult || `${field} is invalid`,
            value
          });
        }
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Throw validation error if validation fails
   * @param {Object} validationResult - Result from validation methods
   * @throws {ValidationError} If validation fails
   */
  static throwIfInvalid(validationResult) {
    if (!validationResult.isValid) {
      throw new ValidationError('Validation failed', validationResult.errors);
    }
  }
}

// Common validation schemas
export const commonSchemas = {
  email: {
    required: true,
    type: 'string',
    custom: (value) => Validator.isValidEmail(value) || 'Invalid email format'
  },
  phone: {
    required: true,
    type: 'string',
    custom: (value) => Validator.isValidPhone(value) || 'Invalid phone format'
  },
  objectId: {
    required: true,
    type: 'string',
    custom: (value) => Validator.isValidObjectId(value) || 'Invalid ID format'
  },
  name: {
    required: true,
    type: 'string',
    minLength: 2,
    maxLength: 100
  },
  description: {
    required: false,
    type: 'string',
    maxLength: 500
  },
  status: {
    required: true,
    type: 'string',
    enum: ['active', 'inactive', 'pending']
  }
};

export default Validator;