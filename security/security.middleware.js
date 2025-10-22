/**
 * Security Middleware for FMS Application
 * This file provides comprehensive security middleware functions
 */

import { asyncHandler } from '../utility/error.util.js';
import { unauthorizedResponse, forbiddenResponse } from '../utility/response.util.js';
import { authUtils, authzUtils, sessionUtils, securityUtils } from './auth.utils.js';
import logger from '../utility/logger.util.js';

/**
 * Authentication middleware
 */
export const authenticate = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return unauthorizedResponse(res, 'Access token is required');
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  try {
    const payload = authUtils.verifyToken(token);
    req.user = payload;
    next();
  } catch (error) {
    return unauthorizedResponse(res, error.message);
  }
});

/**
 * Optional authentication middleware
 */
export const authenticateOptional = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    
    try {
      const payload = authUtils.verifyToken(token);
      req.user = payload;
    } catch (error) {
      // Continue without authentication
      req.user = null;
    }
  }
  
  next();
});

/**
 * Role-based authorization middleware
 */
export const authorize = (...roles) => {
  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      return unauthorizedResponse(res, 'Authentication required');
    }

    if (!authzUtils.hasRole(req.user, roles)) {
      return forbiddenResponse(res, 'Insufficient permissions');
    }

    next();
  });
};

/**
 * Permission-based authorization middleware
 */
export const requirePermission = (permission) => {
  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      return unauthorizedResponse(res, 'Authentication required');
    }

    if (!authzUtils.hasPermission(req.user, permission)) {
      return forbiddenResponse(res, `Permission '${permission}' is required`);
    }

    next();
  });
};

/**
 * Resource ownership middleware
 */
export const checkOwnership = (resourceModel, resourceIdParam = 'id') => {
  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      return unauthorizedResponse(res, 'Authentication required');
    }

    const resourceId = req.params[resourceIdParam];
    
    try {
      const resource = await resourceModel.findOne({
        _id: resourceId,
        isDeleted: false,
      });

      if (!resource) {
        return forbiddenResponse(res, 'Resource not found');
      }

      // Admin can access everything
      if (req.user.role === 'admin') {
        req.resource = resource;
        return next();
      }

      // Check ownership
      if (resource.createdBy && resource.createdBy.toString() === req.user.id) {
        req.resource = resource;
        return next();
      }

      return forbiddenResponse(res, 'You can only access your own resources');
    } catch (error) {
      logger.error('Resource ownership check failed', {
        error: error.message,
        resourceId,
        userId: req.user.id,
      });
      return forbiddenResponse(res, 'Resource access check failed');
    }
  });
};

/**
 * Rate limiting middleware
 */
export const rateLimit = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100, // limit each IP to 100 requests per windowMs
    message = 'Too many requests, please try again later',
    keyGenerator = (req) => req.ip,
  } = options;

  const requests = new Map();

  return (req, res, next) => {
    const key = keyGenerator(req);
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean old entries
    for (const [k, timestamps] of requests.entries()) {
      const validTimestamps = timestamps.filter(timestamp => timestamp > windowStart);
      if (validTimestamps.length === 0) {
        requests.delete(k);
      } else {
        requests.set(k, validTimestamps);
      }
    }

    // Check current request
    const userRequests = requests.get(key) || [];
    if (userRequests.length >= max) {
      return res.status(429).json({
        success: false,
        status: 429,
        message,
        timestamp: new Date().toISOString(),
        retryAfter: Math.ceil(windowMs / 1000),
      });
    }

    // Add current request
    userRequests.push(now);
    requests.set(key, userRequests);

    // Set rate limit headers
    res.set({
      'X-RateLimit-Limit': max,
      'X-RateLimit-Remaining': max - userRequests.length,
      'X-RateLimit-Reset': new Date(now + windowMs).toISOString(),
    });

    next();
  };
};

/**
 * Input sanitization middleware
 */
export const sanitizeInput = (req, res, next) => {
  const sanitizeObject = (obj) => {
    if (typeof obj === 'string') {
      return securityUtils.sanitizeInput(obj);
    } else if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    } else if (obj && typeof obj === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeObject(value);
      }
      return sanitized;
    }
    return obj;
  };

  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
};

/**
 * Security headers middleware
 */
export const securityHeaders = (req, res, next) => {
  // Remove X-Powered-By header
  res.removeHeader('X-Powered-By');
  
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Content Security Policy
  const csp = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none';";
  res.setHeader('Content-Security-Policy', csp);
  
  // Strict Transport Security (only in production)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  next();
};

/**
 * Request logging middleware
 */
export const logRequest = (req, res, next) => {
  const start = Date.now();
  
  req.startTime = start;
  
  // Log request
  logger.info('Request received', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    requestId: req.requestId,
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
      requestId: req.requestId,
    });
  });

  next();
};

/**
 * CSRF protection middleware
 */
export const csrfProtection = (req, res, next) => {
  // Skip CSRF for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const token = req.headers['x-csrf-token'] || req.body._csrf;
  const sessionToken = req.session?.csrfToken;

  if (!token || !securityUtils.validateCSRFToken(token, sessionToken)) {
    return res.status(403).json({
      success: false,
      status: 403,
      message: 'Invalid CSRF token',
      timestamp: new Date().toISOString(),
    });
  }

  next();
};

/**
 * Request size limiter middleware
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
 * Suspicious activity detection middleware
 */
export const detectSuspiciousActivity = (req, res, next) => {
  if (req.user) {
    const activity = securityUtils.checkSuspiciousActivity(
      req.user,
      `${req.method} ${req.originalUrl}`,
      {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date(),
      }
    );

    if (activity.isSuspicious) {
      logger.warn('Suspicious activity detected', {
        userId: req.user.id,
        activity,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
    }
  }

  next();
};

/**
 * API key authentication middleware
 */
export const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return unauthorizedResponse(res, 'API key is required');
  }

  // In production, you'd validate against a database of API keys
  const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];
  
  if (!validApiKeys.includes(apiKey)) {
    return unauthorizedResponse(res, 'Invalid API key');
  }

  req.apiKey = apiKey;
  next();
};

/**
 * IP whitelist middleware
 */
export const ipWhitelist = (allowedIPs = []) => {
  return (req, res, next) => {
    const clientIP = req.ip;
    
    if (allowedIPs.length > 0 && !allowedIPs.includes(clientIP)) {
      return forbiddenResponse(res, 'Access denied from this IP address');
    }

    next();
  };
};

/**
 * Request ID middleware
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
 * Cache control middleware
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
 * No cache middleware
 */
export const noCache = (req, res, next) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
};

export default {
  authenticate,
  authenticateOptional,
  authorize,
  requirePermission,
  checkOwnership,
  rateLimit,
  sanitizeInput,
  securityHeaders,
  logRequest,
  csrfProtection,
  requestSizeLimit,
  detectSuspiciousActivity,
  authenticateApiKey,
  ipWhitelist,
  requestId,
  cacheControl,
  noCache,
};
