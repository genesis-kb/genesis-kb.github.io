/**
 * AI Routes
 *
 * POST /summary   — Pre-generated summary from the DB. No Gemini call, no auth:
 *                   transcripts are public, so their summaries are too.
 * POST /chat      — Gemini chat over transcript context. Auth required.
 * POST /tts       — Gemini text-to-speech. Auth required.
 * POST /entities  — Gemini entity extraction. Auth required.
 *
 * The three Gemini-backed routes cost money per call, so each one runs
 * behind requireAuth, requireAIConfigured (503 when no API key is set),
 * and a rate limiter.
 */

import { Router } from 'express';
import * as aiController from '../controllers/aiController.js';
import { sendSuccess } from '../utils/responseHelper.js';
import { APIError, asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAIConfigured } from '../middleware/aiAvailability.js';
import { aiLimiter, ttsLimiter } from '../middleware/rateLimiter.js';
import { validate, validationRules } from '../middleware/validation.js';
import * as supabaseService from '../services/supabaseService.js';
import logger from '../config/logger.js';

const router = Router();

/**
 * Middleware chain shared by the Gemini-backed routes.
 *
 * requireAuth runs first so anonymous requests are rejected without
 * consuming the caller's AI rate-limit budget; the general /api limiter
 * still covers unauthenticated floods.
 *
 * @param {Function} limiter - Rate limiter for this route
 * @param {Array} rules - express-validator rules for this route
 * @returns {Array} Middleware chain
 */
const aiGuards = (limiter, rules) => [
  requireAuth,
  requireAIConfigured,
  limiter,
  ...rules,
  validate,
];

/**
 * @route   POST /api/v1/ai/summary
 * @desc    Return pre-generated summary from DB (no Gemini call)
 * @access  Public
 */
router.post(
  '/summary',
  asyncHandler(async (req, res) => {
    const { transcriptId } = req.body;

    if (!transcriptId) {
      throw new APIError('transcriptId is required', 400, 'VALIDATION_ERROR');
    }

    logger.info(`Fetching DB summary for transcript: ${transcriptId}`);

    const transcript = await supabaseService.fetchTranscriptById(transcriptId);

    if (!transcript) {
      throw new APIError('Transcript not found', 404, 'NOT_FOUND');
    }

    const summary = transcript.summary || null;

    if (!summary) {
      return sendSuccess(res, { summary: 'No summary available for this transcript.', cached: false });
    }

    sendSuccess(res, { summary, cached: true });
  })
);

/**
 * @route   POST /api/v1/ai/chat
 * @desc    Chat with Gemini using transcript context
 * @access  Private
 */
router.post(
  '/chat',
  ...aiGuards(aiLimiter, validationRules.chat),
  asyncHandler(aiController.chat)
);

/**
 * @route   POST /api/v1/ai/tts
 * @desc    Generate speech audio from text
 * @access  Private
 */
router.post(
  '/tts',
  ...aiGuards(ttsLimiter, validationRules.tts),
  asyncHandler(aiController.generateSpeech)
);

/**
 * @route   POST /api/v1/ai/entities
 * @desc    Extract named entities from a transcript
 * @access  Private
 */
router.post(
  '/entities',
  ...aiGuards(aiLimiter, validationRules.entities),
  asyncHandler(aiController.extractEntities)
);

export default router;
