/**
 * Request Validation Middleware
 * Uses express-validator for input validation
 */

import { validationResult, body, param, query } from 'express-validator';
import { APIError } from './errorHandler.js';

/**
 * Middleware to check validation results
 * Wrapped in try-catch to ensure errors are properly passed to error handler
 */
export const validate = (req, res, next) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const messages = errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
      }));

      const error = new APIError(
        `Validation failed: ${messages.map((m) => m.message).join(', ')}`,
        400,
        'VALIDATION_ERROR'
      );
      return next(error);
    }

    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Validation rules for different endpoints
 */
export const validationRules = {
  // Auth validation rules
  register: [
    body('email')
      .notEmpty()
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Invalid email format')
      .normalizeEmail(),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
      .isString()
      .withMessage('Password must be a string')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .isLength({ max: 72 })
      .withMessage('Password must be at most 72 characters'),
    body('name')
      .optional()
      .isString()
      .withMessage('Name must be a string')
      .isLength({ min: 2, max: 50 })
      .withMessage('Name must be between 2 and 50 characters')
      .trim(),
  ],

  login: [
    body('email')
      .notEmpty()
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Invalid email format')
      .normalizeEmail(),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
      .isString()
      .withMessage('Password must be a string'),
  ],

  // Transcript ID parameter
  transcriptId: [
    param('id')
      .notEmpty()
      .withMessage('Transcript ID is required')
      .isUUID()
      .withMessage('Transcript ID must be a valid UUID'),
  ],

  // Search query
  search: [
    query('q')
      .notEmpty()
      .withMessage('Search query is required')
      .isLength({ min: 2, max: 200 })
      .withMessage('Search query must be between 2 and 200 characters')
      .trim()
      .escape(),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50'),
  ],

  // Summary generation
  generateSummary: [
    body('transcript')
      .notEmpty()
      .withMessage('Transcript text is required')
      .isLength({ min: 100 })
      .withMessage('Transcript must be at least 100 characters'),
    body('transcriptId')
      .optional()
      .isUUID()
      .withMessage('Transcript ID must be a valid UUID'),
  ],

  // Chat with transcript
  chat: [
    body('message')
      .notEmpty()
      .withMessage('Message is required')
      .isLength({ min: 1, max: 2000 })
      .withMessage('Message must be between 1 and 2000 characters')
      .trim(),
    body('transcript')
      .notEmpty()
      .withMessage('Transcript context is required')
      .isLength({ min: 100 })
      .withMessage('Transcript must be at least 100 characters'),
    body('history')
      .optional()
      .isArray()
      .withMessage('History must be an array'),
  ],

  // Text-to-speech
  tts: [
    body('text')
      .notEmpty()
      .withMessage('Text is required')
      .isLength({ min: 1, max: 5000 })
      .withMessage('Text must be between 1 and 5000 characters')
      .trim(),
  ],
};

export default {
  validate,
  validationRules,
};
