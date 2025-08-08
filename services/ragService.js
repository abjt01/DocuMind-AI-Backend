/**
 * RAG Service
 * Document processing and question answering
 */

const logger = require('../utils/logger');
const geminiService = require('./geminiService');
const pdfService = require('./pdfService');

class RagService {
  /**
   * Process document URL and questions
   */
  async processDocumentAndQuestions(documentUrl, questions, options = {}) {
    const { requestId } = options;
    
    logger.info('Processing document and questions', {
      requestId,
      documentUrl,
      questionCount: questions.length
    });

    try {
      // Extract text from PDF document
      let documentContent = '';
      
      try {
        documentContent = await pdfService.extractTextFromUrl(documentUrl);
        logger.info('Successfully extracted PDF content', {
          requestId,
          contentLength: documentContent.length
        });
      } catch (pdfError) {
        logger.warn('Failed to extract PDF content, proceeding without context', {
          requestId,
          error: pdfError.message
        });
      }

      // Generate answers using Gemini AI
      const answers = await geminiService.processQuestions(questions, documentContent, { requestId });

      return answers;

    } catch (error) {
      logger.error('Error in processDocumentAndQuestions', {
        requestId,
        error: error.message,
        stack: error.stack
      });

      const customError = new Error('Failed to process document and questions');
      customError.name = 'DocumentProcessingError';
      throw customError;
    }
  }

  /**
   * Process uploaded file and questions
   */
  async processFileAndQuestions(filePath, questions, options = {}) {
    const { requestId } = options;
    
    logger.info('Processing file and questions', {
      requestId,
      filePath,
      questionCount: questions.length
    });

    try {
      // Extract text from PDF file
      const documentContent = await pdfService.extractTextFromFile(filePath);
      
      // Generate answers using Gemini AI
      const answers = await geminiService.processQuestions(questions, documentContent, { requestId });

      return answers;

    } catch (error) {
      logger.error('Error in processFileAndQuestions', {
        requestId,
        error: error.message,
        stack: error.stack
      });

      const customError = new Error('Failed to process file and questions');
      customError.name = 'DocumentProcessingError';
      throw customError;
    }
  }
}

module.exports = new RagService();
