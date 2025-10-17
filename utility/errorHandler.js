/**
 * Centralized Error Handling Utility
 * Provides consistent error handling across the application
 */

// Base Error Class
export class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// Specific Error Classes
export class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400);
    this.errors = errors;
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized access') {
    super(message, 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden access') {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409);
    this.name = 'ConflictError';
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message = 'Unprocessable entity') {
    super(message, 422);
    this.name = 'UnprocessableEntityError';
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'Internal server error') {
    super(message, 500);
    this.name = 'InternalServerError';
  }
}

// Error Handler Middleware
export const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error for debugging
  console.error('Error Details:', {
    name: err.name,
    message: err.message,
    stack: err.stack,
    statusCode: err.statusCode,
    isOperational: err.isOperational
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Invalid ID format';
    error = new NotFoundError(message);
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `Duplicate ${field} value entered`;
    error = new ConflictError(message);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(val => ({
      field: val.path,
      message: val.message,
      value: val.value
    }));
    const message = 'Validation failed';
    error = new ValidationError(message, errors);
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

  // Default to 500 server error
  if (!error.statusCode) {
    error = new InternalServerError('Something went wrong');
  }

  // Send error response
  res.status(error.statusCode).json({
    success: false,
    error: error.message,
    ...(error.errors && { errors: error.errors }),
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      details: {
        name: err.name,
        statusCode: error.statusCode,
        isOperational: error.isOperational
      }
    }),
    meta: {
      timestamp: new Date().toISOString(),
      requestId: req.requestId || 'unknown',
      path: req.originalUrl,
      method: req.method
    }
  });
};

// Async Error Wrapper
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Error Logger
export const logError = (error, req = null) => {
  const errorLog = {
    timestamp: new Date().toISOString(),
    name: error.name,
    message: error.message,
    stack: error.stack,
    statusCode: error.statusCode,
    isOperational: error.isOperational,
    ...(req && {
      request: {
        method: req.method,
        url: req.originalUrl,
        headers: req.headers,
        body: req.body,
        params: req.params,
        query: req.query
      }
    })
  };

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Error Log:', errorLog);
  }

  // TODO: Implement proper logging service (Winston, etc.)
  // logger.error(errorLog);
};

// Validation Error Helper
export const createValidationError = (field, message, value = null) => {
  return new ValidationError('Validation failed', [{
    field,
    message,
    value
  }]);
};

// Business Logic Error Helper
export const createBusinessError = (message, statusCode = 422) => {
  return new AppError(message, statusCode);
};

// Database Error Helper
export const handleDatabaseError = (error) => {
  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map(val => ({
      field: val.path,
      message: val.message,
      value: val.value
    }));
    return new ValidationError('Database validation failed', errors);
  }

  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    return new ConflictError(`Duplicate ${field} value`);
  }

  return new InternalServerError('Database operation failed');
};

export default {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  UnprocessableEntityError,
  InternalServerError,
  errorHandler,
  asyncHandler,
  logError,
  createValidationError,
  createBusinessError,
  handleDatabaseError
};