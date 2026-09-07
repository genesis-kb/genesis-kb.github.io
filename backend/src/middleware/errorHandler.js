/**
 * Error Handler Middleware
 * Centralized error handling for the application
 */

import logger from '../config/logger.js';
import config from '../config/index.js';

/**
 * Custom API Error class
 */
export class APIError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Not Found (404) handler
 */
export const notFoundHandler = (req, res, next) => {
  const error = new APIError(
    `Endpoint not found: ${req.method} ${req.originalUrl}`,
    404,
    'NOT_FOUND'
  );
  next(error);
};

/**
 * Global error handler middleware
 */
export const errorHandler = (err, req, res, next) => {
  // Default error values
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let code = err.code || 'INTERNAL_ERROR';

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    code = 'UNAUTHORIZED';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    code = 'INVALID_TOKEN';
  } else if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Invalid JSON in request body';
    code = 'INVALID_JSON';
  } else if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
    statusCode = 503;
    message = 'Service temporarily unavailable';
    code = 'SERVICE_UNAVAILABLE';
  } else if (err.message && err.message.includes('fetch')) {
    statusCode = 502;
    message = 'External service error';
    code = 'EXTERNAL_SERVICE_ERROR';
  } else if (err.message && err.message.includes('API key')) {
    statusCode = 500;
    message = 'Server configuration error';
    code = 'CONFIG_ERROR';
  }

  // Log error
  if (statusCode >= 500) {
    logger.error('Server Error:', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  } else {
    logger.warn('Client Error:', {
      message: err.message,
      code,
      path: req.path,
    });
  }

  // Send response
  const response = {
    success: false,
    error: {
      code,
      message,
    },
  };

  // Include stack trace in development
  if (config.server.isDevelopment) {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

/**
 * Async handler wrapper to catch errors in async route handlers
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Wrapped function
 */
export const asyncHandler = (fn) => (req, res, next) => {
  return Promise.resolve(fn(req, res, next)).catch(next);
};

export default {
  APIError,
  notFoundHandler,
  errorHandler,
  asyncHandler,
};
