/**
 * AI Availability Middleware
 * Gates the AI-backed endpoints on a usable AI provider being configured.
 */

import config from '../config/index.js';
import { APIError } from './errorHandler.js';
import logger from '../config/logger.js';

/**
 * requireAIConfigured — blocks AI requests with 503 when no AI provider is
 * usable (AI_PROVIDER unset/none, or the selected provider is missing its
 * settings), instead of letting the request reach the provider and fail
 * there. Deployments without AI stay functional; only the AI endpoints go
 * dark.
 */
export const requireAIConfigured = (req, _res, next) => {
  if (!config.ai.enabled) {
    logger.warn('AI request rejected — no AI provider is configured', {
      provider: config.ai.provider,
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
