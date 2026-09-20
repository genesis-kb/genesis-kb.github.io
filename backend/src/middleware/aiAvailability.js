/**
 * AI Availability Middleware
 * Gates the Gemini-backed endpoints on a usable API key being configured.
 */

import config from '../config/index.js';
import { APIError } from './errorHandler.js';
import logger from '../config/logger.js';

/**
 * requireAIConfigured — blocks AI requests with 503 when no usable
 * GEMINI_API_KEY is set, instead of letting the request reach Gemini and
 * fail there. Deployments without a key stay functional; only the AI
 * endpoints go dark.
 */
export const requireAIConfigured = (req, _res, next) => {
  if (!config.gemini.enabled) {
    logger.warn('AI request rejected — GEMINI_API_KEY is not configured', {
      path: req.path,
      method: req.method,
    });

    throw new APIError(
      'AI features are not available — this server has no AI provider configured.',
      503,
      'AI_NOT_CONFIGURED'
    );
  }

  next();
};

export default { requireAIConfigured };
