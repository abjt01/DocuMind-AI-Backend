/**
 * PDF Processing Service
 * Handles PDF document parsing and text extraction
 */

const fs = require('fs-extra');
const axios = require('axios');
const pdf = require('pdf-parse');
const path = require('path');
const logger = require('../utils/logger');

class PdfService {
  /**
   * Extract text from PDF URL
   */
  async extractTextFromUrl(pdfUrl, options = {}) {
    const { requestId } = options;
    
    logger.info('Extracting text from PDF URL', {
      requestId,
      url: pdfUrl
    });

    try {
      // Download PDF from URL
      const response = await axios({
        method: 'GET',
        url: pdfUrl,
        responseType: 'arraybuffer',
        timeout: 30000, // 30 seconds timeout
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RAG-Chatbot/1.0)'
        }
      });

      const pdfBuffer = Buffer.from(response.data);
      
      logger.info('PDF downloaded successfully', {
        requestId,
        size: pdfBuffer.length
      });

      // Extract text from PDF buffer
      const data = await pdf(pdfBuffer);
      const text = data.text;
      
      logger.info('Text extracted from PDF', {
        requestId,
        textLength: text.length,
        pages: data.numpages
      });

      if (!text || text.trim().length === 0) {
        throw new Error('PDF contains no extractable text');
      }

      return text;

    } catch (error) {
      logger.error('Failed to extract text from PDF URL', {
        requestId,
        url: pdfUrl,
        error: error.message
      });

      if (error.response) {
        throw new Error(`Failed to download PDF: ${error.response.status} ${error.response.statusText}`);
      } else if (error.code === 'ENOTFOUND') {
        throw new Error('PDF document not found at the provided URL');
      } else if (error.code === 'ETIMEDOUT') {
        throw new Error('Timeout while downloading PDF document');
      }

      throw new Error(`PDF processing failed: ${error.message}`);
    }
  }

  /**
   * Extract text from local PDF file
   */
  async extractTextFromFile(filePath, options = {}) {
    const { requestId } = options;
    
    logger.info('Extracting text from PDF file', {
      requestId,
      filePath
    });

    try {
      // Check if file exists
      const exists = await fs.pathExists(filePath);
      if (!exists) {
        throw new Error('PDF file not found');
      }

      // Read PDF file
      const pdfBuffer = await fs.readFile(filePath);
      
      // Extract text from PDF buffer
      const data = await pdf(pdfBuffer);
      const text = data.text;
      
      logger.info('Text extracted from PDF file', {
        requestId,
        filePath,
        textLength: text.length,
        pages: data.numpages
      });

      if (!text || text.trim().length === 0) {
        throw new Error('PDF contains no extractable text');
      }

      return text;

    } catch (error) {
      logger.error('Failed to extract text from PDF file', {
        requestId,
        filePath,
        error: error.message
      });

      throw new Error(`PDF file processing failed: ${error.message}`);
    }
  }

  /**
   * Validate PDF URL
   */
  async validatePdfUrl(pdfUrl) {
    try {
      const response = await axios.head(pdfUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RAG-Chatbot/1.0)'
        }
      });

      const contentType = response.headers['content-type'];
      if (!contentType || !contentType.includes('pdf')) {
        throw new Error('URL does not point to a PDF document');
      }

      return true;

    } catch (error) {
      throw new Error(`PDF URL validation failed: ${error.message}`);
    }
  }
}

module.exports = new PdfService();
