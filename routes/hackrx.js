/**
 * HackRX API Routes
 * Main endpoint for RAG chatbot functionality
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');

const logger = require('../utils/logger');
const { validateRequest } = require('../utils/validator');
const ragService = require('../services/ragService');
const authMiddleware = require('../middleware/auth');
const { asyncErrorHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadsDir = path.join(__dirname, '../uploads');
    fs.ensureDirSync(uploadsDir);
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp
    const uniqueId = uuidv4();
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const filename = `${timestamp}-${uniqueId}${ext}`;
    cb(null, filename);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept only PDF files
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    const error = new Error('Only PDF files are allowed');
    error.status = 400;
    cb(error, false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit
    files: 1 // Only one file at a time
  }
});

/**
 * POST /hackrx/run - Main RAG endpoint (FIXED PATH)
 * Processes PDF documents and answers questions using Gemini AI
 */
router.post('/hackrx/run', authMiddleware, asyncErrorHandler(async (req, res) => {
  const startTime = Date.now();
  const requestId = uuidv4();
  
  logger.info('RAG request received', {
    requestId,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  try {
    // Validate request body
    const validationResult = validateRequest(req.body);
    if (!validationResult.isValid) {
      logger.warn('Request validation failed', {
        requestId,
        errors: validationResult.errors
      });
      
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Request body validation failed',
        details: validationResult.errors,
        timestamp: new Date().toISOString(),
        requestId
      });
    }

    const { documents, questions } = req.body;

    // Validate questions array
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Questions must be a non-empty array',
        timestamp: new Date().toISOString(),
        requestId
      });
    }

    if (questions.length > 10) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Maximum 10 questions allowed per request',
        timestamp: new Date().toISOString(),
        requestId
      });
    }

    // Process the document and questions through RAG service
    logger.info('Processing RAG request', {
      requestId,
      documentUrl: documents,
      questionCount: questions.length
    });

    const answers = await ragService.processDocumentAndQuestions(
      documents,
      questions,
      { requestId }
    );

    const processingTime = Date.now() - startTime;
    
    logger.info('RAG request completed successfully', {
      requestId,
      processingTimeMs: processingTime,
      questionCount: questions.length,
      answerCount: answers.length
    });

    // Return response in exact format specified
    res.status(200).json({
      answers: answers
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logger.error('RAG request failed', {
      requestId,
      error: error.message,
      stack: error.stack,
      processingTimeMs: processingTime
    });

    // Handle specific service errors
    if (error.name === 'DocumentProcessingError') {
      return res.status(422).json({
        error: 'Document Processing Error',
        message: error.message,
        timestamp: new Date().toISOString(),
        requestId
      });
    }

    if (error.name === 'GeminiAPIError') {
      return res.status(502).json({
        error: 'AI Service Error',
        message: 'Failed to process questions with AI service',
        timestamp: new Date().toISOString(),
        requestId
      });
    }

    // Generic server error
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process RAG request',
      timestamp: new Date().toISOString(),
      requestId
    });
  }
}));

/**
 * POST /hackrx/upload - File upload endpoint for testing
 * Allows direct file upload instead of URL
 */
router.post('/hackrx/upload', authMiddleware, upload.single('document'), asyncErrorHandler(async (req, res) => {
  const requestId = uuidv4();
  
  logger.info('File upload request received', {
    requestId,
    ip: req.ip
  });

  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file provided',
        message: 'Please upload a PDF file',
        timestamp: new Date().toISOString(),
        requestId
      });
    }

    const { questions } = req.body;
    let parsedQuestions;

    try {
      parsedQuestions = JSON.parse(questions);
    } catch (parseError) {
      return res.status(400).json({
        error: 'Invalid questions format',
        message: 'Questions must be a valid JSON array',
        timestamp: new Date().toISOString(),
        requestId
      });
    }

    if (!Array.isArray(parsedQuestions) || parsedQuestions.length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Questions must be a non-empty array',
        timestamp: new Date().toISOString(),
        requestId
      });
    }

    const filePath = req.file.path;
    
    logger.info('Processing uploaded file', {
      requestId,
      filename: req.file.filename,
      size: req.file.size,
      questionCount: parsedQuestions.length
    });

    // Process the uploaded file
    const answers = await ragService.processFileAndQuestions(
      filePath,
      parsedQuestions,
      { requestId }
    );

    // Clean up uploaded file
    try {
      await fs.unlink(filePath);
      logger.info('Uploaded file cleaned up', { requestId, filePath });
    } catch (cleanupError) {
      logger.warn('Failed to cleanup uploaded file', {
        requestId,
        filePath,
        error: cleanupError.message
      });
    }

    logger.info('Upload request completed successfully', {
      requestId,
      questionCount: parsedQuestions.length,
      answerCount: answers.length
    });

    res.status(200).json({
      answers: answers
    });

  } catch (error) {
    logger.error('Upload request failed', {
      requestId,
      error: error.message,
      stack: error.stack
    });

    // Clean up file on error
    if (req.file && req.file.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        logger.error('Failed to cleanup file after error', {
          requestId,
          filePath: req.file.path,
          error: cleanupError.message
        });
      }
    }

    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process uploaded file',
      timestamp: new Date().toISOString(),
      requestId
    });
  }
}));

/**
 * GET /health - Health check for the HackRX service
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    service: 'HackRX RAG Service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

module.exports = router;
