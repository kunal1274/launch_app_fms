/**
 * Base Middleware Template for FMS Application
 * This file provides standardized middleware patterns that all routes should use
 */

import { asyncHandler } from '../utility/error.util.js';
import { unauthorizedResponse, forbiddenResponse } from '../utility/response.util.js';
import { HTTP_STATUS } from '../utility/response.util.js';
import logger from '../utility/logger.util.js';

/**
 * Authentication Middleware
 */
export const authenticate = asyncHandler(async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return unauthorizedResponse(res, 'Access token is required');
  }

  try {
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return unauthorizedResponse(res, 'Invalid or expired token');
  }
});

/**
 * Optional Authentication Middleware
 */
export const authenticateOptional = asyncHandler(async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    } catch (error) {
      // Continue without authentication
    }
  }
  
  next();
});

/**
 * Role-Based Access Control Middleware
 */
export const authorize = (...roles) => {
  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      return unauthorizedResponse(res, 'Authentication required');
    }

    if (!roles.includes(req.user.role)) {
      return forbiddenResponse(res, 'Insufficient permissions');
    }

    next();
  });
};

/**
 * Permission-Based Access Control Middleware
 */
export const requirePermission = (permission) => {
  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      return unauthorizedResponse(res, 'Authentication required');
    }

    // Check if user has the required permission
    const hasPermission = req.user.permissions?.includes(permission);
    
    if (!hasPermission) {
      return forbiddenResponse(res, `Permission '${permission}' is required`);
    }

    next();
  });
};

/**
 * Resource Ownership Middleware
 */
export const checkOwnership = (resourceModel, resourceIdParam = 'id') => {
  return asyncHandler(async (req, res, next) => {
    const resourceId = req.params[resourceIdParam];
    const userId = req.user?.id;

    if (!userId) {
      return unauthorizedResponse(res, 'Authentication required');
    }

    const resource = await resourceModel.findOne({
      _id: resourceId,
      createdBy: userId,
      isDeleted: false,
    });

    if (!resource) {
      return forbiddenResponse(res, 'You can only access your own resources');
    }

    req.resource = resource;
    next();
  });
};

/**
 * Rate Limiting Middleware
 */
export const rateLimit = (windowMs = 15 * 60 * 1000, max = 100) => {
  const requests = new Map();

  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean old entries
    for (const [ip, timestamps] of requests.entries()) {
      const validTimestamps = timestamps.filter(timestamp => timestamp > windowStart);
      if (validTimestamps.length === 0) {
        requests.delete(ip);
      } else {
        requests.set(ip, validTimestamps);
      }
    }

    // Check current request
    const userRequests = requests.get(key) || [];
    if (userRequests.length >= max) {
      return res.status(429).json({
        success: false,
        status: 429,
        message: 'Too many requests, please try again later',
        timestamp: new Date().toISOString(),
      });
    }

    // Add current request
    userRequests.push(now);
    requests.set(key, userRequests);

    next();
  };
};

/**
 * Request Logging Middleware
 */
export const logRequest = (req, res, next) => {
  const start = Date.now();
  
  req.startTime = start;
  
  logger.info('Request received', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    logger.info('Request completed', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userId: req.user?.id,
    });
  });

  next();
};

/**
 * Response Time Middleware
 */
export const responseTime = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    res.set('X-Response-Time', `${duration}ms`);
  });

  next();
};

/**
 * CORS Middleware
 */
export const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  credentials: true,
  optionsSuccessStatus: 200,
};

/**
 * Security Headers Middleware
 */
export const securityHeaders = (req, res, next) => {
  // Remove X-Powered-By header
  res.removeHeader('X-Powered-By');
  
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  
  next();
};

/**
 * Request Size Limiter Middleware
 */
export const requestSizeLimit = (limit = '10mb') => {
  return (req, res, next) => {
    const contentLength = parseInt(req.get('Content-Length') || '0');
    const limitBytes = parseSize(limit);

    if (contentLength > limitBytes) {
      return res.status(413).json({
        success: false,
        status: 413,
        message: 'Request entity too large',
        timestamp: new Date().toISOString(),
      });
    }

    next();
  };
};

/**
 * Parse size string to bytes
 */
const parseSize = (size) => {
  const units = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };

  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)$/);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = match[2];

  return Math.floor(value * units[unit]);
};

/**
 * Cache Control Middleware
 */
export const cacheControl = (maxAge = 3600) => {
  return (req, res, next) => {
    if (req.method === 'GET') {
      res.set('Cache-Control', `public, max-age=${maxAge}`);
    } else {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
    next();
  };
};

/**
 * No Cache Middleware
 */
export const noCache = (req, res, next) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
};

/**
 * API Version Middleware
 */
export const apiVersion = (version = 'v1') => {
  return (req, res, next) => {
    req.apiVersion = version;
    res.set('API-Version', version);
    next();
  };
};

/**
 * Request ID Middleware
 */
export const requestId = (req, res, next) => {
  const id = req.get('X-Request-ID') || generateRequestId();
  req.requestId = id;
  res.set('X-Request-ID', id);
  next();
};

/**
 * Generate unique request ID
 */
const generateRequestId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

/**
 * Error Handler Middleware
 */
export const errorHandler = (err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    requestId: req.requestId,
  });

  // Default error response
  const statusCode = err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const message = err.message || 'Internal server error';

  res.status(statusCode).json({
    success: false,
    status: statusCode,
    message: message,
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

/**
 * 404 Handler Middleware
 */
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    status: 404,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
  });
};

/**
 * Health Check Middleware
 */
export const healthCheck = (req, res) => {
  res.status(200).json({
    success: true,
    status: 200,
    message: 'Service is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0',
  });
};

/**
 * Middleware composition helper
 */
export const compose = (...middlewares) => {
  return middlewares.reduce((a, b) => (req, res, next) => {
    a(req, res, (err) => {
      if (err) return next(err);
      b(req, res, next);
    });
  });
};

/**
 * Conditional middleware
 */
export const conditional = (condition, middleware) => {
  return (req, res, next) => {
    if (condition(req, res)) {
      return middleware(req, res, next);
    }
    next();
  };
};

/**
 * Skip middleware in test environment
 */
export const skipInTest = (middleware) => {
  return conditional(
    (req, res) => process.env.NODE_ENV !== 'test',
    middleware
  );
};

export default {
  authenticate,
  authenticateOptional,
  authorize,
  requirePermission,
  checkOwnership,
  rateLimit,
  logRequest,
  responseTime,
  corsOptions,
  securityHeaders,
  requestSizeLimit,
  cacheControl,
  noCache,
  apiVersion,
  requestId,
  errorHandler,
  notFoundHandler,
  healthCheck,
  compose,
  conditional,
  skipInTest,
};
