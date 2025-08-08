/**
 * Gemini AI Service
 * Handles communication with Google Gemini API
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');

class GeminiService {
  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is required');
    }
    
    this.genAI = new GoogleGenerativeAI(apiKey);
    // Use the correct model name
    this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  }

  /**
   * Generate answer for a question based on document content
   */
  async generateAnswer(question, documentContent = '', options = {}) {
    const { requestId } = options;
    
    try {
      const prompt = documentContent 
        ? `Based on the following document content, answer the question.\n\nDocument Content:\n${documentContent}\n\nQuestion: ${question}\n\nAnswer:`
        : `Answer the following question: ${question}`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      logger.info('Successfully generated answer', {
        requestId,
        question: question.substring(0, 100),
        answerLength: text.length
      });
      
      return text;
      
    } catch (error) {
      logger.error('Failed to generate answer', {
        requestId,
        question,
        error: error.message
      });
      
      throw new Error(`Gemini API error: ${error.message}`);
    }
  }

  /**
   * Process multiple questions
   */
  async processQuestions(questions, documentContent = '', options = {}) {
    const { requestId } = options;
    const answers = [];
    
    for (let i = 0; i < questions.length; i++) {
      try {
        const answer = await this.generateAnswer(questions[i], documentContent, { requestId });
        answers.push(answer);
        
        logger.info(`Processed question ${i + 1}/${questions.length}`, { requestId });
        
      } catch (error) {
        logger.error(`Failed to process question ${i + 1}`, {
          requestId,
          question: questions[i],
          error: error.message
        });
        
        // Return a fallback answer instead of failing completely
        answers.push(`Sorry, I couldn't process this question: ${questions[i]}`);
      }
    }
    
    return answers;
  }
}

module.exports = new GeminiService();
