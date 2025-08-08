/**
 * Winston Logger Configuration
 * Centralized logging for the application
 */

const winston = require('winston');
const path = require('path');

// Define log levels and colors
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'cyan',
  http: 'magenta',
  debug: 'white'
};

// Add colors to winston
winston.addColors(logColors);

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      msg += `\n${JSON.stringify(meta, null, 2)}`;
    }
    
    return msg;
  })
);

// Custom format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
require('fs-extra').ensureDirSync(logsDir);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console({
    level: process.env.LOG_LEVEL || 'info',
    format: consoleFormat,
    handleExceptions: true,
    handleRejections: true
  }),

  // File transport for all logs
  new winston.transports.File({
    filename: path.join(logsDir, 'combined.log'),
    level: 'debug',
    format: fileFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    handleExceptions: true,
    handleRejections: true
  }),

  // File transport for errors only
  new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    level: 'error',
    format: fileFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    handleExceptions: true,
    handleRejections: true
  }),

  // File transport for HTTP requests (if needed)
  new winston.transports.File({
    filename: path.join(logsDir, 'http.log'),
    level: 'http',
    format: fileFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 3
  })
];

// Create logger instance
const logger = winston.createLogger({
  levels: logLevels,
  level: process.env.LOG_LEVEL || 'info',
  format: fileFormat,
  defaultMeta: {
    service: 'RAG-Chatbot',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  },
  transports,
  exitOnError: false
});

// Handle uncaught exceptions and rejections
logger.exceptions.handle(
  new winston.transports.File({
    filename: path.join(logsDir, 'exceptions.log'),
    format: fileFormat
  })
);

logger.rejections.handle(
  new winston.transports.File({
    filename: path.join(logsDir, 'rejections.log'),
    format: fileFormat
  })
);

// Add custom methods
logger.logRequest = function(req, res, responseTime) {
  const logData = {
    method: req.method,
    url: req.originalUrl,
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentLength: res.get('content-length')
  };

  if (res.statusCode >= 400) {
    this.error('HTTP Error', logData);
  } else {
    this.http('HTTP Request', logData);
  }
};

logger.logError = function(error, context = {}) {
  this.error('Application Error', {
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...context
  });
};

logger.logAPICall = function(service, operation, duration, success = true, details = {}) {
  const logData = {
    service,
    operation,
    duration: `${duration}ms`,
    success,
    ...details
  };

  if (success) {
    this.info('API Call Completed', logData);
  } else {
    this.error('API Call Failed', logData);
  }
};

logger.logSecurity = function(event, details = {}) {
  this.warn('Security Event', {
    event,
    timestamp: new Date().toISOString(),
    ...details
  });
};

// Production optimizations
if (process.env.NODE_ENV === 'production') {
  // In production, reduce console logging
  logger.transports.forEach((transport) => {
    if (transport instanceof winston.transports.Console) {
      transport.level = 'warn';
    }
  });
}

// Development optimizations
if (process.env.NODE_ENV === 'development') {
  // In development, enable debug logging
  logger.transports.forEach((transport) => {
    if (transport instanceof winston.transports.Console) {
      transport.level = 'debug';
    }
  });
}

// Log configuration on startup
logger.info('Logger initialized', {
  level: logger.level,
  transports: logger.transports.map(t => t.constructor.name),
  logDirectory: logsDir,
  environment: process.env.NODE_ENV || 'development'
});

module.exports = logger;