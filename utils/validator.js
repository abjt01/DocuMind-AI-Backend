/**
 * Request Validator
 * Validates incoming API requests using Joi schemas
 */

const Joi = require('joi');
const logger = require('./logger');

// Schema for the main /run endpoint
const runRequestSchema = Joi.object({
  documents: Joi.string()
    .uri({ 
      scheme: ['http', 'https'],
      allowRelative: false 
    })
    .required()
    .messages({
      'string.uri': 'Documents must be a valid HTTP/HTTPS URL',
      'any.required': 'Documents field is required'
    }),

  questions: Joi.array()
    .items(
      Joi.string()
        .min(5)
        .max(1000)
        .required()
        .messages({
          'string.min': 'Each question must be at least 5 characters long',
          'string.max': 'Each question must not exceed 1000 characters',
          'any.required': 'Questions cannot be empty'
        })
    )
    .min(1)
    .max(10)
    .required()
    .messages({
      'array.min': 'At least one question is required',
      'array.max': 'Maximum 10 questions allowed per request',
      'any.required': 'Questions field is required'
    })
});

// Schema for file upload endpoint
const uploadRequestSchema = Joi.object({
  questions: Joi.string()
    .required()
    .custom((value, helpers) => {
      try {
        const parsed = JSON.parse(value);
        
        if (!Array.isArray(parsed)) {
          return helpers.error('questions.invalidFormat');
        }

        if (parsed.length === 0) {
          return helpers.error('questions.empty');
        }

        if (parsed.length > 10) {
          return helpers.error('questions.tooMany');
        }

        for (const question of parsed) {
          if (typeof question !== 'string') {
            return helpers.error('questions.invalidType');
          }
          if (question.length < 5) {
            return helpers.error('questions.tooShort');
          }
          if (question.length > 1000) {
            return helpers.error('questions.tooLong');
          }
        }

        return parsed;
      } catch (error) {
        return helpers.error('questions.invalidJSON');
      }
    }, 'Questions validation')
    .messages({
      'questions.invalidJSON': 'Questions must be valid JSON',
      'questions.invalidFormat': 'Questions must be a JSON array',
      'questions.empty': 'At least one question is required',
      'questions.tooMany': 'Maximum 10 questions allowed',
      'questions.invalidType': 'All questions must be strings',
      'questions.tooShort': 'Each question must be at least 5 characters long',
      'questions.tooLong': 'Each question must not exceed 1000 characters'
    })
});

/**
 * Validate request body against the run endpoint schema
 * @param {Object} requestBody - Request body to validate
 * @returns {Object} Validation result
 */
function validateRequest(requestBody) {
  try {
    const { error, value } = runRequestSchema.validate(requestBody, {
      abortEarly: false, // Collect all errors
      allowUnknown: false, // Don't allow extra fields
      stripUnknown: false // Don't remove extra fields, just error
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      logger.warn('Request validation failed', {
        errors,
        requestBody: JSON.stringify(requestBody, null, 2)
      });

      return {
        isValid: false,
        errors,
        value: null
      };
    }

    logger.debug('Request validation passed', {
      documentsUrl: value.documents,
      questionCount: value.questions.length
    });

    return {
      isValid: true,
      errors: null,
      value
    };

  } catch (validationError) {
    logger.error('Request validation error', {
      error: validationError.message,
      requestBody: JSON.stringify(requestBody, null, 2)
    });

    return {
      isValid: false,
      errors: [{
        field: 'validation',
        message: 'Validation processing failed',
        value: validationError.message
      }],
      value: null
    };
  }
}

/**
 * Validate file upload request
 * @param {Object} requestBody - Request body to validate
 * @returns {Object} Validation result
 */
function validateUploadRequest(requestBody) {
  try {
    const { error, value } = uploadRequestSchema.validate(requestBody, {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: false
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      return {
        isValid: false,
        errors,
        value: null
      };
    }

    return {
      isValid: true,
      errors: null,
      value: {
        questions: value.questions // Already parsed by custom validator
      }
    };

  } catch (validationError) {
    return {
      isValid: false,
      errors: [{
        field: 'validation',
        message: 'Upload validation processing failed',
        value: validationError.message
      }],
      value: null
    };
  }
}

/**
 * Validate file upload (multer file object)
 * @param {Object} file - Multer file object
 * @returns {Object} Validation result
 */
function validateUploadedFile(file) {
  try {
    if (!file) {
      return {
        isValid: false,
        error: 'No file uploaded',
        details: 'A PDF file is required'
      };
    }

    // Check file type
    if (file.mimetype !== 'application/pdf') {
      return {
        isValid: false,
        error: 'Invalid file type',
        details: `Expected PDF file, got ${file.mimetype}`
      };
    }

    // Check file size (20MB limit)
    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      return {
        isValid: false,
        error: 'File too large',
        details: `File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds 20MB limit`
      };
    }

    // Check filename
    if (!file.originalname || !file.originalname.toLowerCase().endsWith('.pdf')) {
      return {
        isValid: false,
        error: 'Invalid filename',
        details: 'File must have .pdf extension'
      };
    }

    return {
      isValid: true,
      file: {
        originalName: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
        path: file.path,
        filename: file.filename
      }
    };

  } catch (error) {
    logger.error('File validation error', {
      error: error.message,
      file: file ? {
        originalname: file.originalname,
        size: file.size,
        mimetype: file.mimetype
      } : null
    });

    return {
      isValid: false,
      error: 'File validation failed',
      details: error.message
    };
  }
}

/**
 * Sanitize string input
 * @param {string} input - String to sanitize
 * @param {Object} options - Sanitization options
 * @returns {string} Sanitized string
 */
function sanitizeString(input, options = {}) {
  if (typeof input !== 'string') {
    return '';
  }

  let sanitized = input;

  // Trim whitespace
  sanitized = sanitized.trim();

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');

  // Limit length
  const maxLength = options.maxLength || 1000;
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  // Remove control characters (except newlines and tabs if allowed)
  if (!options.allowControlChars) {
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }

  return sanitized;
}

/**
 * Validate and sanitize questions array
 * @param {Array} questions - Questions to validate
 * @returns {Object} Validation result with sanitized questions
 */
function validateAndSanitizeQuestions(questions) {
  try {
    if (!Array.isArray(questions)) {
      return {
        isValid: false,
        error: 'Questions must be an array'
      };
    }

    if (questions.length === 0) {
      return {
        isValid: false,
        error: 'At least one question is required'
      };
    }

    if (questions.length > 10) {
      return {
        isValid: false,
        error: 'Maximum 10 questions allowed'
      };
    }

    const sanitizedQuestions = [];
    const errors = [];

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];

      if (typeof question !== 'string') {
        errors.push(`Question ${i + 1}: Must be a string`);
        continue;
      }

      const sanitized = sanitizeString(question, { maxLength: 1000 });

      if (sanitized.length < 5) {
        errors.push(`Question ${i + 1}: Must be at least 5 characters long`);
        continue;
      }

      sanitizedQuestions.push(sanitized);
    }

    if (errors.length > 0) {
      return {
        isValid: false,
        errors
      };
    }

    return {
      isValid: true,
      questions: sanitizedQuestions
    };

  } catch (error) {
    return {
      isValid: false,
      error: `Question validation failed: ${error.message}`
    };
  }
}

module.exports = {
  validateRequest,
  validateUploadRequest,
  validateUploadedFile,
  sanitizeString,
  validateAndSanitizeQuestions,
  runRequestSchema,
  uploadRequestSchema
};