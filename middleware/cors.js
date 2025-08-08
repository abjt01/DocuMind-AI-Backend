/**
 * CORS Middleware Configuration
 * Handles Cross-Origin Resource Sharing settings
 */

const cors = require('cors');
const { getConfig } = require('../config/config');
const logger = require('../utils/logger');

// CORS configuration options
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = getConfig('CORS_ORIGIN');
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // If CORS_ORIGIN is '*', allow all origins
    if (allowedOrigins === '*') {
      return callback(null, true);
    }
    
    // Parse allowed origins (comma-separated list)
    const origins = allowedOrigins.split(',').map(o => o.trim());
    
    if (origins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'Pragma'
  ],
  exposedHeaders: ['X-Total-Count'],
  maxAge: 86400, // 24 hours
  optionsSuccessStatus: 200 // For legacy browser support
};

// Create CORS middleware with options
const corsMiddleware = cors(corsOptions);

// Log CORS configuration
logger.info('🌐 CORS configuration loaded', {
  allowedOrigins: getConfig('CORS_ORIGIN'),
  methods: corsOptions.methods,
  credentials: corsOptions.credentials
});

module.exports = corsMiddleware;