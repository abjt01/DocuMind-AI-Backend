/**
 * Authentication Middleware
 * Handles Bearer token authentication for API endpoints
 */

const logger = require('../utils/logger');

/**
 * Authentication middleware to verify Bearer token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const expectedToken = process.env.AUTH_BEARER_TOKEN;
    
    // Check if Authorization header exists
    if (!authHeader) {
      logger.warn('Authentication failed: No Authorization header provided', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path
      });
      
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Authorization header is missing',
        timestamp: new Date().toISOString()
      });
    }
    
    // Check if it follows Bearer token format
    if (!authHeader.startsWith('Bearer ')) {
      logger.warn('Authentication failed: Invalid authorization format', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        authHeader: authHeader.substring(0, 20) + '...'
      });
      
      return res.status(401).json({
        error: 'Invalid authentication format',
        message: 'Authorization header must use Bearer token format',
        timestamp: new Date().toISOString()
      });
    }
    
    // Extract token from header
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Validate token against configured bearer token
    if (token !== expectedToken) {
      logger.warn('Authentication failed: Invalid bearer token', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        tokenLength: token.length,
        tokenPrefix: token.substring(0, 8) + '...'
      });
      
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid bearer token',
        timestamp: new Date().toISOString()
      });
    }
    
    // Token is valid - log successful authentication
    logger.info('Authentication successful', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method
    });
    
    // Add authentication info to request object
    req.auth = {
      authenticated: true,
      tokenType: 'Bearer',
      timestamp: new Date().toISOString()
    };
    
    // Continue to next middleware/route handler
    next();
    
  } catch (error) {
    logger.error('Authentication middleware error:', error);
    
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Authentication processing failed',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Optional authentication middleware that doesn't require authentication
 * but adds auth info if present
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function optionalAuthMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const expectedToken = process.env.AUTH_BEARER_TOKEN;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      if (token === expectedToken) {
        req.auth = {
          authenticated: true,
          tokenType: 'Bearer',
          timestamp: new Date().toISOString()
        };
        
        logger.info('Optional authentication successful', {
          ip: req.ip,
          path: req.path
        });
      }
    }
    
    // Always continue, regardless of authentication status
    next();
    
  } catch (error) {
    logger.error('Optional authentication middleware error:', error);
    // Continue anyway since authentication is optional
    next();
  }
}

/**
 * Generates authentication headers for API documentation
 * @returns {Object} Authentication headers example
 */
function getAuthHeaders() {
  const expectedToken = process.env.AUTH_BEARER_TOKEN;
  
  return {
    'Authorization': `Bearer ${expectedToken}`,
    'Content-Type': 'application/json'
  };
}

/**
 * Validates if a token matches the configured bearer token
 * @param {string} token - Token to validate
 * @returns {boolean} True if token is valid
 */
function validateToken(token) {
  try {
    const expectedToken = process.env.AUTH_BEARER_TOKEN;
    return token === expectedToken;
  } catch (error) {
    logger.error('Token validation error:', error);
    return false;
  }
}

// Export the main authMiddleware function as default for your route usage
module.exports = authMiddleware;

// Also export all functions as named exports for flexibility
module.exports.authMiddleware = authMiddleware;
module.exports.optionalAuthMiddleware = optionalAuthMiddleware;
module.exports.getAuthHeaders = getAuthHeaders;
module.exports.validateToken = validateToken;
