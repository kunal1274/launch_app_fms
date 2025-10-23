/**
 * Authentication Utilities for FMS Application
 * This file provides standardized authentication and authorization functions
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { asyncHandler } from '../utility/error.util.js';
import { UnauthorizedError, ForbiddenError } from '../utility/error.util.js';
import logger from '../utility/logger.util.js';

/**
 * Authentication utilities
 */
export const authUtils = {
  /**
   * Generate JWT token
   */
  generateToken: (payload, expiresIn = '24h') => {
    try {
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        throw new Error('JWT_SECRET is not configured');
      }

      return jwt.sign(payload, secret, { expiresIn });
    } catch (error) {
      logger.error('Token generation failed', { error: error.message });
      throw new Error('Token generation failed');
    }
  },

  /**
   * Verify JWT token
   */
  verifyToken: (token) => {
    try {
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        throw new Error('JWT_SECRET is not configured');
      }

      return jwt.verify(token, secret);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedError('Token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedError('Invalid token');
      } else {
        throw new UnauthorizedError('Token verification failed');
      }
    }
  },

  /**
   * Decode JWT token without verification
   */
  decodeToken: (token) => {
    try {
      return jwt.decode(token);
    } catch (error) {
      logger.error('Token decoding failed', { error: error.message });
      return null;
    }
  },

  /**
   * Hash password
   */
  hashPassword: asyncHandler(async (password) => {
    try {
      const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
      return await bcrypt.hash(password, saltRounds);
    } catch (error) {
      logger.error('Password hashing failed', { error: error.message });
      throw new Error('Password hashing failed');
    }
  }),

  /**
   * Compare password with hash
   */
  comparePassword: asyncHandler(async (password, hash) => {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      logger.error('Password comparison failed', { error: error.message });
      throw new Error('Password comparison failed');
    }
  }),

  /**
   * Generate random token
   */
  generateRandomToken: (length = 32) => {
    return crypto.randomBytes(length).toString('hex');
  },

  /**
   * Generate secure random string
   */
  generateSecureString: (length = 16) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  /**
   * Generate password reset token
   */
  generatePasswordResetToken: () => {
    return {
      token: authUtils.generateRandomToken(32),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    };
  },

  /**
   * Generate email verification token
   */
  generateEmailVerificationToken: () => {
    return {
      token: authUtils.generateRandomToken(32),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    };
  },

  /**
   * Validate password strength
   */
  validatePasswordStrength: (password) => {
    const errors = [];
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },

  /**
   * Generate session ID
   */
  generateSessionId: () => {
    return authUtils.generateRandomToken(64);
  },

  /**
   * Create user payload for JWT
   */
  createUserPayload: (user) => {
    return {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: user.permissions || [],
      isActive: user.isActive,
    };
  },
};

/**
 * Authorization utilities
 */
export const authzUtils = {
  /**
   * Check if user has role
   */
  hasRole: (user, requiredRole) => {
    if (!user || !user.role) {
      return false;
    }
    
    if (Array.isArray(requiredRole)) {
      return requiredRole.includes(user.role);
    }
    
    return user.role === requiredRole;
  },

  /**
   * Check if user has permission
   */
  hasPermission: (user, requiredPermission) => {
    if (!user || !user.permissions) {
      return false;
    }
    
    if (Array.isArray(requiredPermission)) {
      return requiredPermission.some(permission => user.permissions.includes(permission));
    }
    
    return user.permissions.includes(requiredPermission);
  },

  /**
   * Check if user can access resource
   */
  canAccessResource: (user, resource, action = 'read') => {
    if (!user || !resource) {
      return false;
    }

    // Admin can access everything
    if (user.role === 'admin') {
      return true;
    }

    // Owner can access their own resources
    if (resource.createdBy && resource.createdBy.toString() === user.id) {
      return true;
    }

    // Check specific permissions
    const permission = `${resource.constructor.modelName.toLowerCase()}:${action}`;
    return authzUtils.hasPermission(user, permission);
  },

  /**
   * Check if user can modify resource
   */
  canModifyResource: (user, resource) => {
    return authzUtils.canAccessResource(user, resource, 'update');
  },

  /**
   * Check if user can delete resource
   */
  canDeleteResource: (user, resource) => {
    return authzUtils.canAccessResource(user, resource, 'delete');
  },

  /**
   * Filter resources based on user permissions
   */
  filterResources: (user, resources, action = 'read') => {
    if (!user || !resources || !Array.isArray(resources)) {
      return [];
    }

    return resources.filter(resource => 
      authzUtils.canAccessResource(user, resource, action)
    );
  },

  /**
   * Get user accessible fields
   */
  getAccessibleFields: (user, modelName, action = 'read') => {
    const baseFields = ['_id', 'createdAt', 'updatedAt'];
    
    if (user.role === 'admin') {
      return null; // Admin can access all fields
    }

    const permission = `${modelName.toLowerCase()}:${action}`;
    
    if (authzUtils.hasPermission(user, permission)) {
      return null; // User has full access
    }

    // Return only basic fields for limited access
    return baseFields;
  },
};

/**
 * Session management utilities
 */
export const sessionUtils = {
  /**
   * Create session
   */
  createSession: (user, options = {}) => {
    const {
      expiresIn = '24h',
      rememberMe = false,
    } = options;

    const sessionId = authUtils.generateSessionId();
    const token = authUtils.generateToken(
      authUtils.createUserPayload(user),
      rememberMe ? '30d' : expiresIn
    );

    return {
      sessionId,
      token,
      expiresAt: new Date(Date.now() + (rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000)),
      user: authUtils.createUserPayload(user),
    };
  },

  /**
   * Validate session
   */
  validateSession: (token) => {
    try {
      const payload = authUtils.verifyToken(token);
      return {
        valid: true,
        user: payload,
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message,
      };
    }
  },

  /**
   * Refresh session
   */
  refreshSession: (user, currentToken) => {
    try {
      // Verify current token
      authUtils.verifyToken(currentToken);
      
      // Generate new token
      const newToken = authUtils.generateToken(
        authUtils.createUserPayload(user),
        '24h'
      );

      return {
        success: true,
        token: newToken,
        user: authUtils.createUserPayload(user),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  },

  /**
   * Destroy session
   */
  destroySession: (token) => {
    // In a real implementation, you would add the token to a blacklist
    // or remove it from the active sessions store
    logger.info('Session destroyed', { token: token.substring(0, 20) + '...' });
    return { success: true };
  },
};

/**
 * Security utilities
 */
export const securityUtils = {
  /**
   * Sanitize user input
   */
  sanitizeInput: (input) => {
    if (typeof input === 'string') {
      return input
        .trim()
        .replace(/[<>]/g, '') // Remove potential HTML tags
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+=/gi, ''); // Remove event handlers
    }
    return input;
  },

  /**
   * Validate email format
   */
  validateEmail: (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  /**
   * Check for suspicious activity
   */
  checkSuspiciousActivity: (user, action, metadata = {}) => {
    // This is a simplified version - in production, you'd have more sophisticated logic
    const suspiciousPatterns = [
      'multiple_failed_logins',
      'unusual_location',
      'rapid_requests',
      'privilege_escalation',
    ];

    // Log the activity for monitoring
    logger.info('User activity', {
      userId: user.id,
      action,
      metadata,
      timestamp: new Date(),
    });

    return {
      isSuspicious: false, // Simplified - always return false
      riskLevel: 'low',
      patterns: [],
    };
  },

  /**
   * Rate limiting check
   */
  checkRateLimit: (identifier, action, limit = 100, windowMs = 15 * 60 * 1000) => {
    // This is a simplified version - in production, you'd use Redis or similar
    const key = `${identifier}:${action}`;
    const now = Date.now();
    
    // For now, just return true (allow)
    // In production, implement proper rate limiting
    return {
      allowed: true,
      remaining: limit,
      resetTime: now + windowMs,
    };
  },

  /**
   * Generate CSRF token
   */
  generateCSRFToken: () => {
    return authUtils.generateRandomToken(32);
  },

  /**
   * Validate CSRF token
   */
  validateCSRFToken: (token, sessionToken) => {
    // In production, you'd store and validate against session
    return token && token.length === 64;
  },
};

export default {
  authUtils,
  authzUtils,
  sessionUtils,
  securityUtils,
};
