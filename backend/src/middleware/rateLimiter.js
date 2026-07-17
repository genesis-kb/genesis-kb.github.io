/**
 * Rate Limiter Middleware
 * Protects API endpoints from abuse
 */

import rateLimit from 'express-rate-limit';
import config from '../config/index.js';
import logger from '../config/logger.js';

/**
 * Create rate limit exceeded handler
 * @param {string} type - Type of rate limit (general, ai)
 * @returns {Function} Handler function
 */
const createLimitHandler = (type) => (req, res) => {
  logger.warn(`Rate limit exceeded (${type}):`, {
    ip: req.ip,
    path: req.path,
    method: req.method,
  });

  res.status(429).json({
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: `Too many requests. Please try again later.`,
      retryAfter: res.getHeader('Retry-After'),
    },
  });
};

/**
 * General API rate limiter
 * Applies to all endpoints
 */
export const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
  handler: createLimitHandler('general'),
  skip: (req) => {
    // Skip rate limiting for health check endpoint
    return req.path === '/api/v1/health';
  },
});

/**
 * Stricter rate limiter for AI endpoints
 * These are more expensive operations
 */
export const aiLimiter = rateLimit({
  windowMs: config.rateLimit.ai.windowMs,
  max: config.rateLimit.ai.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimitHandler('ai'),
  keyGenerator: (req) => {
    // Use IP + endpoint for more granular limiting
    return `${req.ip}-${req.path}`;
  },
});

/**
 * Very strict limiter for TTS (most expensive)
 * Only 5 requests per minute
 */
export const ttsLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimitHandler('tts'),
});

/**
 * Strict limiter for authentication endpoints
 * Protects against brute-force attacks
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimitHandler('auth'),
});

/**
 * Rate limiter for user data endpoints (notes, bookmarks, highlights)
 * More generous than AI endpoints but stricter than general API
 */
export const userDataLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute — enough for rapid note-taking
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimitHandler('user-data'),
});

export default {
  generalLimiter,
  aiLimiter,
  ttsLimiter,
  authLimiter,
  userDataLimiter,
};
