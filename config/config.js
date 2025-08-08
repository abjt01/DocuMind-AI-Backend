/**
 * Configuration Module
 * Handles environment variables and application configuration
 */

const logger = require('../utils/logger');

// Required environment variables
const REQUIRED_ENV_VARS = [
  'GEMINI_API_KEY',
  'AUTH_BEARER_TOKEN'
];

// Optional environment variables with defaults
const DEFAULT_CONFIG = {
  PORT: 8000,
  NODE_ENV: 'development',
  LOG_LEVEL: 'info',
  UPLOAD_MAX_SIZE: '20MB',
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: 100,
  CORS_ORIGIN: '*',
  GEMINI_MODEL: 'gemini-2.5-flash',
  GEMINI_GENERATION_CONFIG: {
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 8192
  }
};

/**
 * Validates that all required environment variables are present
 * @throws {Error} If any required environment variable is missing
 */
function validateEnvironment() {
  const missing = REQUIRED_ENV_VARS.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    const errorMessage = `Missing required environment variables: ${missing.join(', ')}`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }
  
  logger.info('✅ All required environment variables are present');
}

/**
 * Gets configuration value with fallback to default
 * @param {string} key - Configuration key
 * @returns {*} Configuration value
 */
function getConfig(key) {
  return process.env[key] || DEFAULT_CONFIG[key];
}

/**
 * Gets all configuration as an object
 * @returns {Object} Complete configuration object
 */
function getAllConfig() {
  return {
    // Server configuration
    port: parseInt(getConfig('PORT')),
    nodeEnv: getConfig('NODE_ENV'),
    logLevel: getConfig('LOG_LEVEL'),
    
    // API configuration
    geminiApiKey: process.env.GEMINI_API_KEY,
    authBearerToken: process.env.AUTH_BEARER_TOKEN,
    geminiModel: getConfig('GEMINI_MODEL'),
    geminiGenerationConfig: DEFAULT_CONFIG.GEMINI_GENERATION_CONFIG,
    
    // Upload configuration
    uploadMaxSize: getConfig('UPLOAD_MAX_SIZE'),
    uploadsDir: './uploads',
    
    // Security configuration
    rateLimitWindowMs: parseInt(getConfig('RATE_LIMIT_WINDOW_MS')),
    rateLimitMaxRequests: parseInt(getConfig('RATE_LIMIT_MAX_REQUESTS')),
    corsOrigin: getConfig('CORS_ORIGIN'),
    
    // API specification
    apiSpec: {
      baseUrl: `http://localhost:${getConfig('PORT')}/api/v1`,
      endpoint: '/hackrx/run',
      authentication: `Bearer ${process.env.AUTH_BEARER_TOKEN}`,
      methods: ['POST'],
      contentType: 'application/json'
    }
  };
}

/**
 * Logs current configuration (without sensitive data)
 */
function logConfiguration() {
  const config = getAllConfig();
  const safeConfig = {
    ...config,
    geminiApiKey: config.geminiApiKey ? '***REDACTED***' : 'NOT_SET',
    authBearerToken: config.authBearerToken ? '***REDACTED***' : 'NOT_SET'
  };
  
  logger.info('📋 Current configuration:', JSON.stringify(safeConfig, null, 2));
}

module.exports = {
  validateEnvironment,
  getConfig,
  getAllConfig,
  logConfiguration,
  DEFAULT_CONFIG,
  REQUIRED_ENV_VARS
};