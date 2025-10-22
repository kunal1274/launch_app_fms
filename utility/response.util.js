/**
 * Standardized Response Utility for FMS Application
 * This utility provides consistent response formats across all API endpoints
 */

/**
 * Standard response structure
 */
export class ApiResponse {
  constructor(status, message, data = null, meta = null, errors = null) {
    this.status = status;
    this.message = message;
    this.data = data;
    this.meta = meta;
    this.errors = errors;
    this.timestamp = new Date().toISOString();
    this.success = status >= 200 && status < 300;
  }

  /**
   * Convert response to JSON format
   */
  toJSON() {
    return {
      success: this.success,
      status: this.status,
      message: this.message,
      data: this.data,
      meta: this.meta,
      errors: this.errors,
      timestamp: this.timestamp,
    };
  }
}

/**
 * Success response helper
 */
export const successResponse = (res, status = 200, message = 'Success', data = null, meta = null) => {
  const response = new ApiResponse(status, message, data, meta);
  return res.status(status).json(response.toJSON());
};

/**
 * Error response helper
 */
export const errorResponse = (res, status = 500, message = 'Internal Server Error', errors = null) => {
  const response = new ApiResponse(status, message, null, null, errors);
  return res.status(status).json(response.toJSON());
};

/**
 * Validation error response helper
 */
export const validationErrorResponse = (res, errors, message = 'Validation failed') => {
  const response = new ApiResponse(400, message, null, null, errors);
  return res.status(400).json(response.toJSON());
};

/**
 * Not found response helper
 */
export const notFoundResponse = (res, message = 'Resource not found') => {
  const response = new ApiResponse(404, message);
  return res.status(404).json(response.toJSON());
};

/**
 * Unauthorized response helper
 */
export const unauthorizedResponse = (res, message = 'Unauthorized access') => {
  const response = new ApiResponse(401, message);
  return res.status(401).json(response.toJSON());
};

/**
 * Forbidden response helper
 */
export const forbiddenResponse = (res, message = 'Access forbidden') => {
  const response = new ApiResponse(403, message);
  return res.status(403).json(response.toJSON());
};

/**
 * Conflict response helper
 */
export const conflictResponse = (res, message = 'Resource conflict', errors = null) => {
  const response = new ApiResponse(409, message, null, null, errors);
  return res.status(409).json(response.toJSON());
};

/**
 * Created response helper
 */
export const createdResponse = (res, message = 'Resource created successfully', data = null) => {
  const response = new ApiResponse(201, message, data);
  return res.status(201).json(response.toJSON());
};

/**
 * Updated response helper
 */
export const updatedResponse = (res, message = 'Resource updated successfully', data = null) => {
  const response = new ApiResponse(200, message, data);
  return res.status(200).json(response.toJSON());
};

/**
 * Deleted response helper
 */
export const deletedResponse = (res, message = 'Resource deleted successfully') => {
  const response = new ApiResponse(200, message);
  return res.status(200).json(response.toJSON());
};

/**
 * Paginated response helper
 */
export const paginatedResponse = (res, data, pagination, message = 'Data retrieved successfully') => {
  const meta = {
    pagination: {
      page: pagination.page || 1,
      limit: pagination.limit || 10,
      total: pagination.total || 0,
      pages: Math.ceil((pagination.total || 0) / (pagination.limit || 10)),
      hasNext: pagination.page < Math.ceil((pagination.total || 0) / (pagination.limit || 10)),
      hasPrev: pagination.page > 1,
    },
  };
  
  const response = new ApiResponse(200, message, data, meta);
  return res.status(200).json(response.toJSON());
};

/**
 * Standard HTTP status codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

/**
 * Standard error messages
 */
export const ERROR_MESSAGES = {
  // General errors
  INTERNAL_ERROR: 'An internal server error occurred',
  VALIDATION_ERROR: 'Validation failed',
  NOT_FOUND: 'Resource not found',
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'Access forbidden',
  CONFLICT: 'Resource conflict',
  
  // Authentication errors
  INVALID_CREDENTIALS: 'Invalid credentials',
  TOKEN_EXPIRED: 'Token has expired',
  TOKEN_INVALID: 'Invalid token',
  TOKEN_MISSING: 'Token is required',
  
  // Authorization errors
  INSUFFICIENT_PERMISSIONS: 'Insufficient permissions',
  ROLE_REQUIRED: 'Role is required',
  
  // Validation errors
  REQUIRED_FIELD: 'This field is required',
  INVALID_EMAIL: 'Invalid email format',
  INVALID_PHONE: 'Invalid phone number format',
  INVALID_URL: 'Invalid URL format',
  INVALID_DATE: 'Invalid date format',
  INVALID_NUMBER: 'Invalid number format',
  INVALID_BOOLEAN: 'Invalid boolean value',
  
  // Database errors
  DUPLICATE_ENTRY: 'Duplicate entry found',
  CONSTRAINT_VIOLATION: 'Database constraint violation',
  CONNECTION_ERROR: 'Database connection error',
  
  // File upload errors
  FILE_TOO_LARGE: 'File size exceeds limit',
  INVALID_FILE_TYPE: 'Invalid file type',
  UPLOAD_FAILED: 'File upload failed',
  
  // Business logic errors
  INSUFFICIENT_BALANCE: 'Insufficient balance',
  INVALID_AMOUNT: 'Invalid amount',
  TRANSACTION_FAILED: 'Transaction failed',
  ORDER_NOT_FOUND: 'Order not found',
  PRODUCT_NOT_AVAILABLE: 'Product not available',
};

/**
 * Standard success messages
 */
export const SUCCESS_MESSAGES = {
  // General success
  SUCCESS: 'Operation completed successfully',
  CREATED: 'Resource created successfully',
  UPDATED: 'Resource updated successfully',
  DELETED: 'Resource deleted successfully',
  RETRIEVED: 'Data retrieved successfully',
  
  // Authentication success
  LOGIN_SUCCESS: 'Login successful',
  LOGOUT_SUCCESS: 'Logout successful',
  REGISTRATION_SUCCESS: 'Registration successful',
  PASSWORD_RESET: 'Password reset successful',
  
  // File operations
  FILE_UPLOADED: 'File uploaded successfully',
  FILE_DELETED: 'File deleted successfully',
  
  // Business operations
  ORDER_CREATED: 'Order created successfully',
  ORDER_UPDATED: 'Order updated successfully',
  ORDER_CANCELLED: 'Order cancelled successfully',
  PAYMENT_SUCCESS: 'Payment processed successfully',
  INVENTORY_UPDATED: 'Inventory updated successfully',
};

/**
 * Validation helper functions
 */
export const validationHelpers = {
  /**
   * Check if value is required
   */
  isRequired: (value, fieldName) => {
    if (value === undefined || value === null || value === '') {
      return `${fieldName} is required`;
    }
    return null;
  },
  
  /**
   * Check if email is valid
   */
  isValidEmail: (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return 'Invalid email format';
    }
    return null;
  },
  
  /**
   * Check if phone is valid
   */
  isValidPhone: (phone) => {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    if (!phoneRegex.test(phone)) {
      return 'Invalid phone number format';
    }
    return null;
  },
  
  /**
   * Check if URL is valid
   */
  isValidUrl: (url) => {
    try {
      new URL(url);
      return null;
    } catch {
      return 'Invalid URL format';
    }
  },
  
  /**
   * Check if date is valid
   */
  isValidDate: (date) => {
    if (isNaN(Date.parse(date))) {
      return 'Invalid date format';
    }
    return null;
  },
  
  /**
   * Check if number is valid
   */
  isValidNumber: (number) => {
    if (isNaN(number) || !isFinite(number)) {
      return 'Invalid number format';
    }
    return null;
  },
  
  /**
   * Check if value is within range
   */
  isInRange: (value, min, max, fieldName) => {
    if (value < min || value > max) {
      return `${fieldName} must be between ${min} and ${max}`;
    }
    return null;
  },
  
  /**
   * Check if string length is valid
   */
  isValidLength: (string, min, max, fieldName) => {
    if (string.length < min || string.length > max) {
      return `${fieldName} must be between ${min} and ${max} characters`;
    }
    return null;
  },
};

export default {
  ApiResponse,
  successResponse,
  errorResponse,
  validationErrorResponse,
  notFoundResponse,
  unauthorizedResponse,
  forbiddenResponse,
  conflictResponse,
  createdResponse,
  updatedResponse,
  deletedResponse,
  paginatedResponse,
  HTTP_STATUS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  validationHelpers,
};
