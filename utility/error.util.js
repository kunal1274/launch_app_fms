/**
 * Standardized Error Handling Utility for FMS Application
 * This utility provides consistent error handling across all modules
 */

import logger from './logger.util.js';
import { HTTP_STATUS, ERROR_MESSAGES } from './response.util.js';

/**
 * Custom error classes
 */
export class AppError extends Error {
  constructor(message, statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message = ERROR_MESSAGES.VALIDATION_ERROR, errors = null) {
    super(message, HTTP_STATUS.BAD_REQUEST);
    this.errors = errors;
  }
}

export class NotFoundError extends AppError {
  constructor(message = ERROR_MESSAGES.NOT_FOUND) {
    super(message, HTTP_STATUS.NOT_FOUND);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = ERROR_MESSAGES.UNAUTHORIZED) {
    super(message, HTTP_STATUS.UNAUTHORIZED);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = ERROR_MESSAGES.FORBIDDEN) {
    super(message, HTTP_STATUS.FORBIDDEN);
  }
}

export class ConflictError extends AppError {
  constructor(message = ERROR_MESSAGES.CONFLICT) {
    super(message, HTTP_STATUS.CONFLICT);
  }
}

export class DatabaseError extends AppError {
  constructor(message = ERROR_MESSAGES.CONNECTION_ERROR) {
    super(message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export class DuplicateEntryError extends AppError {
  constructor(message = ERROR_MESSAGES.DUPLICATE_ENTRY) {
    super(message, HTTP_STATUS.CONFLICT);
  }
}

export class FileUploadError extends AppError {
  constructor(message = ERROR_MESSAGES.UPLOAD_FAILED) {
    super(message, HTTP_STATUS.BAD_REQUEST);
  }
}

export class BusinessLogicError extends AppError {
  constructor(message, statusCode = HTTP_STATUS.BAD_REQUEST) {
    super(message, statusCode);
  }
}

/**
 * Error handling middleware
 */
export const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error('Error occurred', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = new NotFoundError(message);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = new DuplicateEntryError(message);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = new ValidationError(message, err.errors);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = new UnauthorizedError(message);
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = new UnauthorizedError(message);
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    const message = 'File too large';
    error = new FileUploadError(message);
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    const message = 'Unexpected file field';
    error = new FileUploadError(message);
  }

  // Send error response
  sendErrorResponse(error, res);
};

/**
 * Send error response
 */
export const sendErrorResponse = (err, res) => {
  const statusCode = err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const message = err.message || ERROR_MESSAGES.INTERNAL_ERROR;

  const response = {
    success: false,
    status: statusCode,
    message: message,
    errors: err.errors || null,
    timestamp: new Date().toISOString(),
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

/**
 * Async error handler wrapper
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Error logging utility
 */
export const logError = (error, context = {}) => {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    statusCode: error.statusCode,
    isOperational: error.isOperational,
    context: context,
    timestamp: new Date().toISOString(),
  };

  if (error.statusCode >= 500) {
    logger.error('Server Error', errorInfo);
  } else {
    logger.warn('Client Error', errorInfo);
  }
};

/**
 * Validation error formatter
 */
export const formatValidationErrors = (errors) => {
  if (!errors) return null;

  const formattedErrors = {};

  if (Array.isArray(errors)) {
    errors.forEach((error, index) => {
      formattedErrors[`error_${index}`] = error.message || error;
    });
  } else if (typeof errors === 'object') {
    Object.keys(errors).forEach(key => {
      const error = errors[key];
      if (error.message) {
        formattedErrors[key] = error.message;
      } else if (typeof error === 'string') {
        formattedErrors[key] = error;
      }
    });
  }

  return formattedErrors;
};

/**
 * Database error handler
 */
export const handleDatabaseError = (error) => {
  if (error.name === 'ValidationError') {
    const errors = formatValidationErrors(error.errors);
    throw new ValidationError('Validation failed', errors);
  }

  if (error.code === 11000) {
    throw new DuplicateEntryError('Duplicate entry found');
  }

  if (error.name === 'CastError') {
    throw new NotFoundError('Resource not found');
  }

  if (error.name === 'MongoNetworkError' || error.name === 'MongoTimeoutError') {
    throw new DatabaseError('Database connection error');
  }

  throw new DatabaseError('Database operation failed');
};

/**
 * File upload error handler
 */
export const handleFileUploadError = (error) => {
  if (error.code === 'LIMIT_FILE_SIZE') {
    throw new FileUploadError('File size exceeds limit');
  }

  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    throw new FileUploadError('Unexpected file field');
  }

  if (error.code === 'LIMIT_FILE_COUNT') {
    throw new FileUploadError('Too many files uploaded');
  }

  if (error.code === 'LIMIT_UNEXPECTED_FIELD') {
    throw new FileUploadError('Unexpected field in form data');
  }

  throw new FileUploadError('File upload failed');
};

/**
 * Authentication error handler
 */
export const handleAuthError = (error) => {
  if (error.name === 'JsonWebTokenError') {
    throw new UnauthorizedError('Invalid token');
  }

  if (error.name === 'TokenExpiredError') {
    throw new UnauthorizedError('Token expired');
  }

  if (error.name === 'NotBeforeError') {
    throw new UnauthorizedError('Token not active');
  }

  throw new UnauthorizedError('Authentication failed');
};

/**
 * Business logic error handler
 */
export const handleBusinessLogicError = (error) => {
  if (error.message.includes('insufficient')) {
    throw new BusinessLogicError('Insufficient resources', HTTP_STATUS.BAD_REQUEST);
  }

  if (error.message.includes('not found')) {
    throw new NotFoundError('Resource not found');
  }

  if (error.message.includes('unauthorized')) {
    throw new UnauthorizedError('Unauthorized access');
  }

  if (error.message.includes('forbidden')) {
    throw new ForbiddenError('Access forbidden');
  }

  throw new BusinessLogicError('Business logic error', HTTP_STATUS.BAD_REQUEST);
};

/**
 * Error response templates
 */
export const errorTemplates = {
  validation: (errors) => ({
    success: false,
    status: HTTP_STATUS.BAD_REQUEST,
    message: ERROR_MESSAGES.VALIDATION_ERROR,
    errors: formatValidationErrors(errors),
    timestamp: new Date().toISOString(),
  }),

  notFound: (resource = 'Resource') => ({
    success: false,
    status: HTTP_STATUS.NOT_FOUND,
    message: `${resource} not found`,
    timestamp: new Date().toISOString(),
  }),

  unauthorized: (message = ERROR_MESSAGES.UNAUTHORIZED) => ({
    success: false,
    status: HTTP_STATUS.UNAUTHORIZED,
    message: message,
    timestamp: new Date().toISOString(),
  }),

  forbidden: (message = ERROR_MESSAGES.FORBIDDEN) => ({
    success: false,
    status: HTTP_STATUS.FORBIDDEN,
    message: message,
    timestamp: new Date().toISOString(),
  }),

  conflict: (message = ERROR_MESSAGES.CONFLICT) => ({
    success: false,
    status: HTTP_STATUS.CONFLICT,
    message: message,
    timestamp: new Date().toISOString(),
  }),

  internal: (message = ERROR_MESSAGES.INTERNAL_ERROR) => ({
    success: false,
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    message: message,
    timestamp: new Date().toISOString(),
  }),
};

export default {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  DatabaseError,
  DuplicateEntryError,
  FileUploadError,
  BusinessLogicError,
  errorHandler,
  sendErrorResponse,
  asyncHandler,
  logError,
  formatValidationErrors,
  handleDatabaseError,
  handleFileUploadError,
  handleAuthError,
  handleBusinessLogicError,
  errorTemplates,
};
