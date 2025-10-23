/**
 * Enhanced Logger Utility for FMS Application
 * This file provides standardized logging functionality
 */

import winston from 'winston';
import path from 'path';
import * as stackTrace from 'stack-trace';
import DailyRotateFile from 'winston-daily-rotate-file';

/**
 * Log levels configuration
 */
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(logColors);

/**
 * Custom format for console output
 */
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`;
    }
    return log;
  })
);

/**
 * Custom format for file output
 */
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Custom format for HTTP requests
 */
const httpFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return `${timestamp} [${level.toUpperCase()}]: ${message}`;
  })
);

/**
 * Define transports
 */
const transports = [
  // Console transport
  new winston.transports.Console({
    format: consoleFormat,
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  }),

  // Daily rotate file for all logs
  new DailyRotateFile({
    filename: 'logs/application-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    format: fileFormat,
  }),

  // Error log file
  new DailyRotateFile({
    filename: 'logs/error-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '30d',
    level: 'error',
    format: fileFormat,
  }),

  // HTTP request log file
  new DailyRotateFile({
    filename: 'logs/http-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '7d',
    level: 'http',
    format: httpFormat,
  }),

  // Audit log file
  new DailyRotateFile({
    filename: 'logs/audit-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '90d',
    format: fileFormat,
  }),
];

/**
 * Create main logger
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  levels: logLevels,
  format: fileFormat,
  transports,
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' }),
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' }),
  ],
});

/**
 * JSON format logger for structured logging
 */
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const loggerJsonFormat = winston.createLogger({
  level: 'info',
  format: jsonFormat,
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: 'logs/errorJsonFormat.json',
      level: 'error',
    }),
    new winston.transports.File({ filename: 'logs/combinedJsonFormat.json' }),
  ],
});

/**
 * Enhanced logging functions
 */
const logUtils = {
  /**
   * Log error with stack trace
   */
  logError: (message, error, context = {}) => {
    const errorDetails = {
      message,
      error: {
        name: error?.name || 'Error',
        message: error?.message || 'Unknown error',
        stack: error?.stack,
      },
      context,
      timestamp: new Date().toISOString(),
    };

    logger.error(errorDetails);
  },

  /**
   * Log HTTP request
   */
  logHttp: (req, res, responseTime) => {
    const logData = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
      requestId: req.requestId,
    };

    logger.http('HTTP Request', logData);
  },

  /**
   * Log audit event
   */
  logAudit: (action, resource, userId, details = {}) => {
    const auditData = {
      action,
      resource,
      userId,
      details,
      timestamp: new Date().toISOString(),
      ip: details.ip,
      userAgent: details.userAgent,
    };

    logger.info('Audit Event', auditData);
  },

  /**
   * Log security event
   */
  logSecurity: (event, details = {}) => {
    const securityData = {
      event,
      details,
      timestamp: new Date().toISOString(),
      severity: details.severity || 'medium',
    };

    logger.warn('Security Event', securityData);
  },

  /**
   * Log business event
   */
  logBusiness: (event, details = {}) => {
    const businessData = {
      event,
      details,
      timestamp: new Date().toISOString(),
    };

    logger.info('Business Event', businessData);
  },

  /**
   * Log performance metrics
   */
  logPerformance: (operation, duration, details = {}) => {
    const performanceData = {
      operation,
      duration: `${duration}ms`,
      details,
      timestamp: new Date().toISOString(),
    };

    logger.info('Performance Metric', performanceData);
  },

  /**
   * Log database operation
   */
  logDatabase: (operation, collection, duration, details = {}) => {
    const dbData = {
      operation,
      collection,
      duration: `${duration}ms`,
      details,
      timestamp: new Date().toISOString(),
    };

    logger.debug('Database Operation', dbData);
  },
};

/**
 * Enhanced stack trace logging
 */
const logStackError = (context, error) => {
  const parsedStack = stackTrace.parse(error);
  const caller = parsedStack[0];

  const errorDetails = {
    context,
    errorType: error.name || 'Error',
    message: error.message || 'No message',
    stack: error.stack,
    fileName: caller ? path.basename(caller.getFileName()) : 'unknown',
    lineNumber: caller ? caller.getLineNumber() : 'unknown',
    columnNumber: caller ? caller.getColumnNumber() : 'unknown',
    timestamp: new Date().toISOString(),
  };

  logger.error('Stack Trace Error', errorDetails);
};

/**
 * Request logging middleware
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logUtils.logHttp(req, res, duration);
  });

  next();
};

/**
 * Error logging middleware
 */
const errorLogger = (error, req, res, next) => {
  logUtils.logError('Request Error', error, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    requestId: req.requestId,
  });

  next(error);
};

/**
 * Audit logging middleware
 */
const auditLogger = (action, resource) => {
  return (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      if (res.statusCode < 400) {
        logUtils.logAudit(action, resource, req.user?.id, {
          method: req.method,
          url: req.originalUrl,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          requestId: req.requestId,
        });
      }
      
      originalSend.call(this, data);
    };

    next();
  };
};

/**
 * Performance logging middleware
 */
const performanceLogger = (operation) => {
  return (req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      logUtils.logPerformance(operation, duration, {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        userId: req.user?.id,
      });
    });

    next();
  };
};

/**
 * Log uncaught exceptions and unhandled rejections
 */
process.on('uncaughtException', (error) => {
  logUtils.logError('Uncaught Exception', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logUtils.logError('Unhandled Rejection', reason, { promise });
});

export default logger;
export { logUtils, logStackError, requestLogger, errorLogger, auditLogger, performanceLogger, loggerJsonFormat };
