# FMS Components & Utilities Documentation

## Overview

This document provides comprehensive documentation for all reusable components, utilities, middleware, and services in the Financial Management System (FMS). These components form the foundation of the application architecture and provide consistent functionality across the system.

## Table of Contents

1. [Middleware Components](#middleware-components)
2. [Utility Functions](#utility-functions)
3. [Service Components](#service-components)
4. [Validation Components](#validation-components)
5. [Error Handling](#error-handling)
6. [Authentication Components](#authentication-components)
7. [File Management](#file-management)
8. [Logging & Audit](#logging--audit)
9. [UI Components](#ui-components)

## Middleware Components

### 1. Request Timer Middleware
**File**: `middleware/requestTimer.js`

Tracks and logs the execution time of each API request for performance monitoring.

```javascript
/**
 * Request Timer Middleware
 * Measures and logs the execution time of each request
 */
export const requestTimer = (req, res, next) => {
  const startTime = Date.now();
  
  // Override res.end to capture completion time
  const originalEnd = res.end;
  res.end = function(...args) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Log request details
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${duration}ms - ${res.statusCode}`);
    
    // Add duration to response headers
    res.set('X-Response-Time', `${duration}ms`);
    
    originalEnd.apply(this, args);
  };
  
  next();
};
```

**Usage:**
```javascript
app.use(requestTimer);
```

### 2. API Flow Recording Middleware
**File**: `middleware/recordApiFlow.js`

Records detailed API flow information for audit and debugging purposes.

```javascript
/**
 * API Flow Recording Middleware
 * Records comprehensive request/response data for audit trails
 */
export const recordApiFlow = async (req, res, next) => {
  const flowId = generateUniqueId();
  const startTime = Date.now();
  
  // Capture request details
  const requestData = {
    flowId,
    method: req.method,
    url: req.originalUrl,
    headers: sanitizeHeaders(req.headers),
    body: sanitizeRequestBody(req.body),
    query: req.query,
    params: req.params,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: new Date(),
    userId: req.user?.id || null
  };
  
  // Store original res.json and res.send methods
  const originalJson = res.json;
  const originalSend = res.send;
  
  // Override response methods to capture response data
  res.json = function(data) {
    captureResponse(flowId, {
      statusCode: res.statusCode,
      data: sanitizeResponseData(data),
      duration: Date.now() - startTime,
      headers: res.getHeaders()
    });
    
    return originalJson.call(this, data);
  };
  
  res.send = function(data) {
    captureResponse(flowId, {
      statusCode: res.statusCode,
      data: sanitizeResponseData(data),
      duration: Date.now() - startTime,
      headers: res.getHeaders()
    });
    
    return originalSend.call(this, data);
  };
  
  // Store request data
  await storeApiFlow(requestData);
  
  next();
};

/**
 * Sanitize sensitive headers
 */
const sanitizeHeaders = (headers) => {
  const sanitized = { ...headers };
  delete sanitized.authorization;
  delete sanitized.cookie;
  return sanitized;
};

/**
 * Sanitize request body (remove passwords, tokens, etc.)
 */
const sanitizeRequestBody = (body) => {
  if (!body) return body;
  
  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'secret', 'key'];
  
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '***REDACTED***';
    }
  });
  
  return sanitized;
};
```

### 3. Authentication Middleware
**File**: `middleware/authJwtHandler.js`

Handles JWT token validation and user authentication.

```javascript
import jwt from 'jsonwebtoken';
import { UserGlobalModel } from '../models/userGlobal.model.js';

/**
 * JWT Authentication Middleware
 * Validates JWT tokens and sets req.user
 */
export const authenticateJWT = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'failure',
        message: 'Access token is missing or invalid'
      });
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user in database
    const user = await UserGlobalModel.findById(decoded.userId)
      .select('-password')
      .lean();
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        status: 'failure',
        message: 'User not found or inactive'
      });
    }
    
    // Add user to request object
    req.user = user;
    req.token = token;
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'failure',
        message: 'Token has expired'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        status: 'failure',
        message: 'Invalid token'
      });
    }
    
    return res.status(500).json({
      status: 'failure',
      message: 'Authentication error',
      error: error.message
    });
  }
};

/**
 * Role-based access control middleware
 */
export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'failure',
        message: 'Authentication required'
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'failure',
        message: 'Insufficient permissions'
      });
    }
    
    next();
  };
};

/**
 * Permission-based access control middleware
 */
export const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'failure',
        message: 'Authentication required'
      });
    }
    
    if (!req.user.permissions || !req.user.permissions.includes(permission)) {
      return res.status(403).json({
        status: 'failure',
        message: `Permission '${permission}' required`
      });
    }
    
    next();
  };
};
```

## Utility Functions

### 1. Common Error Utilities
**File**: `utility/ce.utils.js`

Common error handling and logging utilities.

```javascript
import logger from './logger.util.js';

/**
 * Common Error (CE) Utility
 * Standardized error handling and logging
 */
class CommonError extends Error {
  constructor(message, statusCode = 500, code = null) {
    super(message);
    this.name = 'CommonError';
    this.statusCode = statusCode;
    this.code = code;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Log and throw error
 */
export const ce = (message, statusCode = 500, code = null) => {
  const error = new CommonError(message, statusCode, code);
  logger.error(`CommonError: ${message}`, {
    statusCode,
    code,
    stack: error.stack
  });
  throw error;
};

/**
 * Handle async errors
 */
export const handleAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Create error response
 */
export const createErrorResponse = (message, statusCode = 500, details = null) => {
  return {
    status: 'failure',
    message,
    ...(details && { details }),
    timestamp: new Date().toISOString()
  };
};

/**
 * Database error handler
 */
export const handleDbError = (error) => {
  if (error.name === 'ValidationError') {
    const messages = Object.values(error.errors).map(e => e.message);
    return createErrorResponse('Validation Error', 422, messages);
  }
  
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern)[0];
    return createErrorResponse(`Duplicate value for field: ${field}`, 409);
  }
  
  if (error.name === 'CastError') {
    return createErrorResponse('Invalid ID format', 400);
  }
  
  return createErrorResponse('Database operation failed', 500);
};

export default ce;
```

### 2. Common Logging Utilities
**File**: `utility/cl.utils.js`

Common logging utilities for consistent log formatting.

```javascript
import logger from './logger.util.js';

/**
 * Common Logging (CL) Utility
 * Standardized logging across the application
 */

/**
 * Log info message
 */
export const cl = (message, data = null) => {
  const logData = {
    message,
    timestamp: new Date().toISOString(),
    ...(data && { data })
  };
  
  logger.info(logData);
  console.log(`[INFO] ${message}`, data ? data : '');
};

/**
 * Log error message
 */
export const clError = (message, error = null) => {
  const logData = {
    message,
    timestamp: new Date().toISOString(),
    ...(error && {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      }
    })
  };
  
  logger.error(logData);
  console.error(`[ERROR] ${message}`, error);
};

/**
 * Log warning message
 */
export const clWarn = (message, data = null) => {
  const logData = {
    message,
    timestamp: new Date().toISOString(),
    ...(data && { data })
  };
  
  logger.warn(logData);
  console.warn(`[WARN] ${message}`, data ? data : '');
};

/**
 * Log debug message
 */
export const clDebug = (message, data = null) => {
  if (process.env.NODE_ENV === 'development') {
    const logData = {
      message,
      timestamp: new Date().toISOString(),
      ...(data && { data })
    };
    
    logger.debug(logData);
    console.debug(`[DEBUG] ${message}`, data ? data : '');
  }
};

/**
 * Log API operation
 */
export const clApi = (method, endpoint, duration = null, statusCode = null) => {
  const message = `${method} ${endpoint}`;
  const data = {
    method,
    endpoint,
    ...(duration && { duration: `${duration}ms` }),
    ...(statusCode && { statusCode })
  };
  
  cl(message, data);
};

export default cl;
```

### 3. Date and Time Utilities
**File**: `utility/getLocalTime.js`

Date and time formatting utilities for Indian timezone.

```javascript
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Get formatted local date and time for Indian timezone
 */
export const getFormattedLocalDateTime = (date = null) => {
  const targetDate = date ? dayjs(date) : dayjs();
  return targetDate.tz('Asia/Kolkata').format('DD/MM/YYYY HH:mm:ss');
};

/**
 * Get local time string
 */
export const getLocalTimeString = (date = null) => {
  const targetDate = date ? dayjs(date) : dayjs();
  return targetDate.tz('Asia/Kolkata').format('HH:mm:ss');
};

/**
 * Get local date string
 */
export const getLocalDateString = (date = null) => {
  const targetDate = date ? dayjs(date) : dayjs();
  return targetDate.tz('Asia/Kolkata').format('DD/MM/YYYY');
};

/**
 * Get ISO string for Indian timezone
 */
export const getLocalISOString = (date = null) => {
  const targetDate = date ? dayjs(date) : dayjs();
  return targetDate.tz('Asia/Kolkata').toISOString();
};

/**
 * Convert UTC to local time
 */
export const utcToLocal = (utcDate) => {
  return dayjs(utcDate).tz('Asia/Kolkata');
};

/**
 * Convert local time to UTC
 */
export const localToUtc = (localDate) => {
  return dayjs.tz(localDate, 'Asia/Kolkata').utc();
};

/**
 * Get financial year
 */
export const getFinancialYear = (date = null) => {
  const targetDate = date ? dayjs(date) : dayjs();
  const year = targetDate.year();
  const month = targetDate.month() + 1; // dayjs months are 0-indexed
  
  if (month >= 4) {
    return `${year}-${year + 1}`;
  } else {
    return `${year - 1}-${year}`;
  }
};

/**
 * Format date for display
 */
export const formatDisplayDate = (date, format = 'DD MMM YYYY') => {
  return dayjs(date).tz('Asia/Kolkata').format(format);
};

/**
 * Get relative time
 */
export const getRelativeTime = (date) => {
  return dayjs(date).fromNow();
};
```

### 4. Logger Utility
**File**: `utility/logger.util.js`

Comprehensive logging utility using Winston.

```javascript
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

/**
 * Winston Logger Configuration
 * Provides structured logging with rotation and multiple transports
 */

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...meta
    });
  })
);

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');

// Daily rotate file transport for all logs
const allLogsTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'application-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d'
});

// Daily rotate file transport for error logs
const errorLogsTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d',
  level: 'error'
});

// Daily rotate file transport for HTTP logs
const httpLogsTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'http-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '7d',
  level: 'http'
});

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    allLogsTransport,
    errorLogsTransport,
    httpLogsTransport
  ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

/**
 * Log levels:
 * - error: Error messages
 * - warn: Warning messages  
 * - info: General information
 * - http: HTTP request logs
 * - debug: Debug information
 */

/**
 * Helper methods for specific log types
 */
logger.logError = (message, error = null, context = {}) => {
  logger.error(message, {
    error: error ? {
      message: error.message,
      stack: error.stack,
      name: error.name
    } : null,
    context
  });
};

logger.logApiCall = (method, url, statusCode, duration, userId = null) => {
  logger.http('API Call', {
    method,
    url,
    statusCode,
    duration: `${duration}ms`,
    userId
  });
};

logger.logDbOperation = (operation, collection, data = {}) => {
  logger.info('Database Operation', {
    operation,
    collection,
    data
  });
};

logger.logUserAction = (action, userId, details = {}) => {
  logger.info('User Action', {
    action,
    userId,
    details
  });
};

export default logger;
```

## Service Components

### 1. File Upload Service
**File**: `shared_service/services/fileUpload.service.js`

Comprehensive file upload handling with multiple storage options.

```javascript
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

/**
 * File Upload Service
 * Handles file uploads with validation and storage management
 */

// Allowed file types
const ALLOWED_FILE_TYPES = {
  images: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  documents: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt'],
  archives: ['.zip', '.rar', '.7z']
};

// Maximum file sizes (in bytes)
const MAX_FILE_SIZES = {
  image: 5 * 1024 * 1024,    // 5MB
  document: 10 * 1024 * 1024, // 10MB
  archive: 50 * 1024 * 1024   // 50MB
};

/**
 * Create upload directory if it doesn't exist
 */
const ensureUploadDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

/**
 * Generate unique filename
 */
const generateFileName = (originalName) => {
  const ext = path.extname(originalName);
  const name = path.basename(originalName, ext);
  const uuid = uuidv4();
  return `${name}-${uuid}${ext}`;
};

/**
 * Validate file type
 */
const isValidFileType = (filename, allowedTypes) => {
  const ext = path.extname(filename).toLowerCase();
  return allowedTypes.includes(ext);
};

/**
 * Get file category
 */
const getFileCategory = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  
  if (ALLOWED_FILE_TYPES.images.includes(ext)) return 'image';
  if (ALLOWED_FILE_TYPES.documents.includes(ext)) return 'document';
  if (ALLOWED_FILE_TYPES.archives.includes(ext)) return 'archive';
  
  return 'other';
};

/**
 * Multer storage configuration
 */
const createStorage = (uploadPath) => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const fullPath = path.join(process.cwd(), 'uploads', uploadPath);
      ensureUploadDir(fullPath);
      cb(null, fullPath);
    },
    filename: (req, file, cb) => {
      const uniqueName = generateFileName(file.originalname);
      cb(null, uniqueName);
    }
  });
};

/**
 * File filter function
 */
const createFileFilter = (allowedTypes = null) => {
  return (req, file, cb) => {
    if (allowedTypes && !isValidFileType(file.originalname, allowedTypes)) {
      const error = new Error(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`);
      error.code = 'INVALID_FILE_TYPE';
      return cb(error, false);
    }
    
    cb(null, true);
  };
};

/**
 * Create multer upload middleware
 */
export const createUploadMiddleware = (options = {}) => {
  const {
    uploadPath = 'general',
    allowedTypes = null,
    maxFileSize = 10 * 1024 * 1024, // 10MB default
    maxFiles = 5
  } = options;
  
  return multer({
    storage: createStorage(uploadPath),
    fileFilter: createFileFilter(allowedTypes),
    limits: {
      fileSize: maxFileSize,
      files: maxFiles
    }
  });
};

/**
 * Sales order file upload
 */
export const salesOrderUpload = createUploadMiddleware({
  uploadPath: 'sales-orders',
  allowedTypes: [...ALLOWED_FILE_TYPES.documents, ...ALLOWED_FILE_TYPES.images],
  maxFileSize: MAX_FILE_SIZES.document,
  maxFiles: 10
});

/**
 * Customer document upload
 */
export const customerDocumentUpload = createUploadMiddleware({
  uploadPath: 'customers',
  allowedTypes: ALLOWED_FILE_TYPES.documents,
  maxFileSize: MAX_FILE_SIZES.document,
  maxFiles: 5
});

/**
 * Product image upload
 */
export const productImageUpload = createUploadMiddleware({
  uploadPath: 'products',
  allowedTypes: ALLOWED_FILE_TYPES.images,
  maxFileSize: MAX_FILE_SIZES.image,
  maxFiles: 8
});

/**
 * File information processor
 */
export const processUploadedFiles = (files) => {
  if (!files || files.length === 0) return [];
  
  return files.map(file => ({
    filename: file.filename,
    originalName: file.originalname,
    path: file.path,
    size: file.size,
    mimetype: file.mimetype,
    category: getFileCategory(file.originalname),
    uploadedAt: new Date()
  }));
};

/**
 * Delete uploaded file
 */
export const deleteUploadedFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
};

/**
 * Get file URL
 */
export const getFileUrl = (filename, uploadPath = 'general') => {
  return `/uploads/${uploadPath}/${filename}`;
};
```

### 2. Email Service
**File**: `services/email.service.js`

Email service for notifications and communications.

```javascript
import nodemailer from 'nodemailer';
import logger from '../utility/logger.util.js';

/**
 * Email Service
 * Handles email notifications and communications
 */

class EmailService {
  constructor() {
    this.transporter = this.createTransporter();
  }
  
  /**
   * Create nodemailer transporter
   */
  createTransporter() {
    return nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }
  
  /**
   * Send email
   */
  async sendEmail(to, subject, html, attachments = []) {
    try {
      const mailOptions = {
        from: `"${process.env.APP_NAME}" <${process.env.SMTP_FROM}>`,
        to,
        subject,
        html,
        attachments
      };
      
      const result = await this.transporter.sendMail(mailOptions);
      
      logger.info('Email sent successfully', {
        to,
        subject,
        messageId: result.messageId
      });
      
      return {
        success: true,
        messageId: result.messageId
      };
    } catch (error) {
      logger.logError('Email sending failed', error, { to, subject });
      throw error;
    }
  }
  
  /**
   * Send welcome email to new users
   */
  async sendWelcomeEmail(user, temporaryPassword) {
    const subject = `Welcome to ${process.env.APP_NAME}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to ${process.env.APP_NAME}</h2>
        <p>Dear ${user.name},</p>
        <p>Your account has been created successfully. Here are your login credentials:</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Email:</strong> ${user.email}</p>
          <p><strong>Temporary Password:</strong> ${temporaryPassword}</p>
        </div>
        <p><strong>Important:</strong> Please change your password after your first login.</p>
        <p>You can access the system at: <a href="${process.env.APP_URL}">${process.env.APP_URL}</a></p>
        <p>Best regards,<br>The ${process.env.APP_NAME} Team</p>
      </div>
    `;
    
    return this.sendEmail(user.email, subject, html);
  }
  
  /**
   * Send OTP email
   */
  async sendOtpEmail(email, otp, purpose = 'verification') {
    const subject = `Your OTP for ${purpose}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>OTP Verification</h2>
        <p>Your OTP for ${purpose} is:</p>
        <div style="background-color: #f0f8ff; padding: 20px; text-align: center; border-radius: 5px; margin: 20px 0;">
          <h1 style="color: #2563eb; font-size: 32px; margin: 0;">${otp}</h1>
        </div>
        <p>This OTP is valid for 10 minutes.</p>
        <p>If you didn't request this OTP, please ignore this email.</p>
      </div>
    `;
    
    return this.sendEmail(email, subject, html);
  }
  
  /**
   * Send sales order confirmation
   */
  async sendSalesOrderConfirmation(customer, salesOrder) {
    const subject = `Sales Order Confirmation - ${salesOrder.orderNumber}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Sales Order Confirmation</h2>
        <p>Dear ${customer.name},</p>
        <p>Thank you for your order. Here are the details:</p>
        
        <div style="border: 1px solid #ddd; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3>Order Details</h3>
          <p><strong>Order Number:</strong> ${salesOrder.orderNumber}</p>
          <p><strong>Order Date:</strong> ${new Date(salesOrder.orderDate).toLocaleDateString()}</p>
          <p><strong>Total Amount:</strong> ${salesOrder.currency} ${salesOrder.totalAmount.toFixed(2)}</p>
        </div>
        
        <h3>Order Items</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #f5f5f5;">
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Item</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Quantity</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Price</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${salesOrder.salesOrderLines.map(line => `
              <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">${line.itemId.description || line.itemId.itemNumber}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${line.quantity}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${line.unitPrice.toFixed(2)}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${line.lineTotal.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <p>We will process your order and notify you once it's ready for shipment.</p>
        <p>Best regards,<br>The Sales Team</p>
      </div>
    `;
    
    return this.sendEmail(customer.email, subject, html);
  }
  
  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(user, resetToken) {
    const resetUrl = `${process.env.APP_URL}/reset-password?token=${resetToken}`;
    const subject = 'Password Reset Request';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>Dear ${user.name},</p>
        <p>You have requested to reset your password. Click the button below to reset your password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this password reset, please ignore this email.</p>
        <p>Best regards,<br>The ${process.env.APP_NAME} Team</p>
      </div>
    `;
    
    return this.sendEmail(user.email, subject, html);
  }
}

export const emailService = new EmailService();
export default emailService;
```

## UI Components

### 1. Reusable React Components

#### Dashboard Card Component
```jsx
/**
 * Dashboard Card Component
 * Reusable card for dashboard overview sections
 */
import React from 'react';
import './DashboardCard.css';

const DashboardCard = ({
  title,
  description,
  mainStat,
  statLabel,
  totalStat,
  icon,
  onClick,
  className = '',
  color = 'blue'
}) => {
  return (
    <div 
      className={`dashboard-card ${className} ${color}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="card-icon">
        {icon}
      </div>
      
      <div className="card-content">
        <h4 className="card-title">{title}</h4>
        <p className="card-description">{description}</p>
        
        <div className="card-stats">
          <span className="main-stat">{mainStat}</span>
          <span className="stat-label">{statLabel}</span>
          {totalStat && <span className="total-stat">{totalStat}</span>}
        </div>
      </div>
      
      {onClick && (
        <div className="card-arrow">
          →
        </div>
      )}
    </div>
  );
};

export default DashboardCard;
```

#### Data Table Component
```jsx
/**
 * Data Table Component
 * Reusable table with sorting, filtering, and pagination
 */
import React, { useState, useMemo } from 'react';
import './DataTable.css';

const DataTable = ({
  data = [],
  columns = [],
  onEdit,
  onDelete,
  onView,
  searchable = true,
  sortable = true,
  pagination = true,
  pageSize = 10,
  loading = false,
  className = ''
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  
  // Filter and sort data
  const processedData = useMemo(() => {
    let filtered = data;
    
    // Apply search filter
    if (searchTerm) {
      filtered = data.filter(item =>
        columns.some(column => {
          const value = item[column.key];
          return value && value.toString().toLowerCase().includes(searchTerm.toLowerCase());
        })
      );
    }
    
    // Apply sorting
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    
    return filtered;
  }, [data, searchTerm, sortConfig, columns]);
  
  // Pagination
  const totalPages = Math.ceil(processedData.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedData = pagination 
    ? processedData.slice(startIndex, startIndex + pageSize)
    : processedData;
  
  const handleSort = (key) => {
    if (!sortable) return;
    
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };
  
  if (loading) {
    return <div className="table-loading">Loading...</div>;
  }
  
  return (
    <div className={`data-table-container ${className}`}>
      {searchable && (
        <div className="table-search">
          <input
            type="search"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
      )}
      
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map(column => (
                <th
                  key={column.key}
                  onClick={() => handleSort(column.key)}
                  className={`
                    ${sortable ? 'sortable' : ''} 
                    ${sortConfig.key === column.key ? `sorted-${sortConfig.direction}` : ''}
                  `}
                >
                  {column.title}
                  {sortable && sortConfig.key === column.key && (
                    <span className="sort-indicator">
                      {sortConfig.direction === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </th>
              ))}
              {(onView || onEdit || onDelete) && (
                <th className="actions-column">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((item, index) => (
              <tr key={item._id || index}>
                {columns.map(column => (
                  <td key={column.key}>
                    {column.render ? column.render(item[column.key], item) : item[column.key]}
                  </td>
                ))}
                {(onView || onEdit || onDelete) && (
                  <td className="actions-cell">
                    <div className="action-buttons">
                      {onView && (
                        <button
                          onClick={() => onView(item)}
                          className="btn-icon"
                          title="View"
                        >
                          👁️
                        </button>
                      )}
                      {onEdit && (
                        <button
                          onClick={() => onEdit(item)}
                          className="btn-icon"
                          title="Edit"
                        >
                          ✏️
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(item)}
                          className="btn-icon delete"
                          title="Delete"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {pagination && totalPages > 1 && (
        <div className="table-pagination">
          <div className="pagination-info">
            Showing {startIndex + 1}-{Math.min(startIndex + pageSize, processedData.length)} of {processedData.length}
          </div>
          
          <div className="pagination-controls">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="page-btn"
            >
              ‹
            </button>
            
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i + 1}
                onClick={() => handlePageChange(i + 1)}
                className={`page-btn ${currentPage === i + 1 ? 'active' : ''}`}
              >
                {i + 1}
              </button>
            ))}
            
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="page-btn"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable;
```

#### Form Component
```jsx
/**
 * Reusable Form Component
 * Dynamic form generator with validation
 */
import React, { useState } from 'react';
import './Form.css';

const Form = ({
  fields = [],
  initialValues = {},
  onSubmit,
  onCancel,
  submitLabel = 'Submit',
  cancelLabel = 'Cancel',
  loading = false,
  className = ''
}) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  
  const handleChange = (name, value) => {
    setValues(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };
  
  const validateField = (field, value) => {
    if (field.required && (!value || value.toString().trim() === '')) {
      return `${field.label} is required`;
    }
    
    if (field.validation) {
      return field.validation(value);
    }
    
    return '';
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate all fields
    const newErrors = {};
    fields.forEach(field => {
      const error = validateField(field, values[field.name]);
      if (error) {
        newErrors[field.name] = error;
      }
    });
    
    setErrors(newErrors);
    
    // If no errors, submit form
    if (Object.keys(newErrors).length === 0) {
      onSubmit(values);
    }
  };
  
  const renderField = (field) => {
    const { name, label, type, options, placeholder, required } = field;
    const value = values[name] || '';
    const error = errors[name];
    
    switch (type) {
      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleChange(name, e.target.value)}
            className={error ? 'error' : ''}
          >
            <option value="">{placeholder || `Select ${label}`}</option>
            {options.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
        
      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleChange(name, e.target.value)}
            placeholder={placeholder}
            className={error ? 'error' : ''}
            rows={field.rows || 3}
          />
        );
        
      default:
        return (
          <input
            type={type || 'text'}
            value={value}
            onChange={(e) => handleChange(name, e.target.value)}
            placeholder={placeholder}
            className={error ? 'error' : ''}
          />
        );
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className={`reusable-form ${className}`}>
      <div className="form-fields">
        {fields.map(field => (
          <div key={field.name} className="form-field">
            <label>
              {field.label}
              {field.required && <span className="required">*</span>}
            </label>
            {renderField(field)}
            {errors[field.name] && (
              <span className="error-message">{errors[field.name]}</span>
            )}
          </div>
        ))}
      </div>
      
      <div className="form-actions">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary"
            disabled={loading}
          >
            {cancelLabel}
          </button>
        )}
        <button
          type="submit"
          className="btn-primary"
          disabled={loading}
        >
          {loading ? 'Processing...' : submitLabel}
        </button>
      </div>
    </form>
  );
};

export default Form;
```

This comprehensive component and utility documentation provides all the reusable pieces needed to build and maintain the FMS system effectively. Each component follows consistent patterns and includes proper error handling, validation, and user experience considerations.