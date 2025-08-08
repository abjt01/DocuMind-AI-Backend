/**
 * Error Handler Middleware
 * Centralized error handling for all application errors
 */

const logger = require('../utils/logger');

/**
 * Global error handler middleware
 * @param {Error} error - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function errorHandler(error, req, res, next) {
  // If response was already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(error);
  }

  // Log error details
  logger.error('Application error occurred:', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      body: req.body && Object.keys(req.body).length > 0 ? '[REDACTED]' : undefined
    },
    timestamp: new Date().toISOString()
  });

  // Prepare error response
  let statusCode = 500;
  let errorResponse = {
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
    requestId: req.id || 'unknown'
  };

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    errorResponse.error = 'Validation Error';
    errorResponse.message = error.message;
    errorResponse.details = error.details || error.errors;
  } else if (error.name === 'UnauthorizedError' || error.message.includes('unauthorized')) {
    statusCode = 401;
    errorResponse.error = 'Unauthorized';
    errorResponse.message = 'Authentication required or invalid credentials';
  } else if (error.name === 'ForbiddenError' || error.message.includes('forbidden')) {
    statusCode = 403;
    errorResponse.error = 'Forbidden';
    errorResponse.message = 'Access denied';
  } else if (error.name === 'NotFoundError' || error.message.includes('not found')) {
    statusCode = 404;
    errorResponse.error = 'Not Found';
    errorResponse.message = error.message || 'Resource not found';
  } else if (error.name === 'RateLimitError' || error.message.includes('rate limit')) {
    statusCode = 429;
    errorResponse.error = 'Too Many Requests';
    errorResponse.message = 'Rate limit exceeded';
    errorResponse.retryAfter = error.retryAfter || 900; // 15 minutes default
  } else if (error.status && error.status >= 400 && error.status < 500) {
    // Client errors
    statusCode = error.status;
    errorResponse.error = error.name || 'Client Error';
    errorResponse.message = error.message;
  } else if (error.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    errorResponse.error = 'File Too Large';
    errorResponse.message = 'Uploaded file exceeds maximum size limit';
  } else if (error.code === 'ENOENT') {
    statusCode = 404;
    errorResponse.error = 'File Not Found';
    errorResponse.message = 'Requested file does not exist';
  } else if (error.code === 'ECONNREFUSED') {
    statusCode = 503;
    errorResponse.error = 'Service Unavailable';
    errorResponse.message = 'External service connection failed';
  }

  // Add additional context for development environment
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = error.stack;
    errorResponse.details = {
      originalError: error.name,
      code: error.code,
      errno: error.errno,
      syscall: error.syscall
    };
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
}

/**
 * Async error wrapper to catch errors in async route handlers
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Express middleware function
 */
function asyncErrorHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Creates a custom error with status code
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @param {string} name - Error name
 * @returns {Error} Custom error object
 */
function createError(message, statusCode = 500, name = 'CustomError') {
  const error = new Error(message);
  error.name = name;
  error.status = statusCode;
  return error;
}

/**
 * Handles 404 not found errors
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function notFoundHandler(req, res) {
  const error = createError(`Route ${req.method} ${req.originalUrl} not found`, 404, 'NotFoundError');
  
  logger.warn('404 Not Found:', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(404).json({
    error: 'Not Found',
    message: error.message,
    method: req.method,
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
}

// Export the main errorHandler function as default
module.exports = errorHandler;

// Also export all functions as named exports for flexibility
module.exports.errorHandler = errorHandler;
module.exports.asyncErrorHandler = asyncErrorHandler;
module.exports.createError = createError;
module.exports.notFoundHandler = notFoundHandler;
