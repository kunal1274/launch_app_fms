// logger.js
import winston from 'winston';
import path from 'path';
import * as stackTrace from 'stack-trace'; // stack trace is written in common js
import DailyRotateFile from 'winston-daily-rotate-file';

// IN-USE : Custom format to include timestamp, level, message, and metadata
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }), // Capture stack trace
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    if (stack) {
      log += `\nStack Trace: ${stack}`;
    }
    // Include additional metadata if present
    if (Object.keys(meta).length > 0) {
      log += `\nMetadata: ${JSON.stringify(meta)}`;
    }
    return log;
  })
);

// IN-USE :  Define transports
const transports = [
  new winston.transports.Console(),
  new DailyRotateFile({
    filename: 'logs/application-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
  }),
  new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
  new winston.transports.File({ filename: 'logs/combined.log' }),
];

// NOT-IN-USE : will be used in company controllers for time being
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// NOT-IN-USE : we wont use it for now just for testing will be used in company controllers
export const loggerJsonFormat = winston.createLogger({
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

// Define log levels and colors if needed
const logger = winston.createLogger({
  //level: "info", // Default log level
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug', // based on environment
  format: customFormat,
  //   transports: [
  //     new winston.transports.Console(),
  //     new winston.transports.File({ filename: "logs/error.log", level: "error" }),
  //     new winston.transports.File({ filename: "logs/combined.log" }),
  //   ],
  transports,
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' }),
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' }),
  ],
});

// Log uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at Promise', { reason, promise });
  // Optionally exit the process
});

export const logStackError = (context, error) => {
  // `stackTrace.parse(error)` returns an array of CallSite objects
  const parsedStack = stackTrace.parse(error);
  const caller = parsedStack[0]; // or find the specific call site you want
  //   const trace = stackTrace.parse(error);
  //   const caller = trace[0]; // Get the first stack trace item relevant to the error

  const errorDetails = {
    context,
    errorType: error.name || 'Error',
    message: error.message || 'No message',
    stack: error.stack,
    fileName: caller ? path.basename(caller.getFileName()) : 'unknown',
    lineNumber: caller ? caller.getLineNumber() : 'unknown',
    columnNumber: caller ? caller.getColumnNumber() : 'unknown',
  };

  logger.error(errorDetails);
};

export default logger;
