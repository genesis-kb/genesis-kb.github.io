/**
 * AI Routes
 *
 * POST   /summary             — Pre-generated summary from the DB. No AI call,
 *                               no auth: transcripts are public, so their
 *                               summaries are too.
 * POST   /chat                — AI chat over transcript context; saves the
 *                               exchange. Auth required.
 * GET    /chat/:transcriptId  — The user's saved chat. Auth required.
 * DELETE /chat/:transcriptId  — Clear the user's saved chat. Auth required.
 * GET    /tts/:transcriptId   — Stored speech metadata (null if none).
 *                               Auth required.
 * GET    /tts/:transcriptId/audio — Stream stored speech as WAV. Auth
 *                               required.
 * POST   /tts/:transcriptId   — Generate and store a transcript's speech;
 *                               returns the stored copy when it exists.
 *                               Auth required.
 * POST   /entities            — AI entity extraction. Auth required.
 *
 * The three AI-backed routes cost money per call, so each one runs
 * behind requireAuth, requireAIConfigured (503 when no AI provider is
 * configured), and a rate limiter. The saved-chat and stored-speech read
 * routes make no model call, so they skip the AI gate and use the
 * user-data limiter. All /tts routes answer 503 TTS_STORAGE_NOT_CONFIGURED
 * when no audio bucket is configured.
 */

import { Router } from 'express';
import * as aiController from '../controllers/aiController.js';
import { sendSuccess } from '../utils/responseHelper.js';
import { APIError, asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAIConfigured } from '../middleware/aiAvailability.js';
import { aiLimiter, ttsLimiter, userDataLimiter } from '../middleware/rateLimiter.js';
import { validate, validationRules } from '../middleware/validation.js';
import * as supabaseService from '../services/supabaseService.js';
import logger from '../config/logger.js';

const router = Router();

/**
 * Middleware chain shared by the AI-backed routes.
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
 * @desc    Return pre-generated summary from DB (no AI call)
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
 * @desc    Chat with the AI provider using transcript context
 * @access  Private
 */
router.post(
  '/chat',
  ...aiGuards(aiLimiter, validationRules.chat),
  asyncHandler(aiController.chat)
);

/**
 * Middleware chain for reading and clearing a saved chat. No model call is
 * made, so these use the user-data limiter instead of the AI gate/limiter.
 */
const chatHistoryGuards = [
  requireAuth,
  userDataLimiter,
  ...validationRules.chatHistory,
  validate,
];

/**
 * @route   GET /api/v1/ai/chat/:transcriptId
 * @desc    Get the user's saved chat with a transcript
 * @access  Private
 */
router.get(
  '/chat/:transcriptId',
  ...chatHistoryGuards,
  asyncHandler(aiController.getChatHistory)
);

/**
 * @route   DELETE /api/v1/ai/chat/:transcriptId
 * @desc    Delete the user's saved chat with a transcript
 * @access  Private
 */
router.delete(
  '/chat/:transcriptId',
  ...chatHistoryGuards,
  asyncHandler(aiController.clearChatHistory)
);

/**
 * Middleware chain for reading stored speech. No model call is made, so
 * stored audio stays playable with AI disabled and uses the user-data
 * limiter.
 */
const ttsAudioGuards = [
  requireAuth,
  userDataLimiter,
  ...validationRules.ttsAudio,
  validate,
];

/**
 * @route   GET /api/v1/ai/tts/:transcriptId?source=transcript|summary
 * @desc    Get metadata for a transcript's stored speech (null if none)
 * @access  Private
 */
router.get(
  '/tts/:transcriptId',
  ...ttsAudioGuards,
  asyncHandler(aiController.getSpeechAudio)
);

/**
 * @route   GET /api/v1/ai/tts/:transcriptId/audio?source=transcript|summary
 * @desc    Stream a transcript's stored speech as WAV
 * @access  Private
 */
router.get(
  '/tts/:transcriptId/audio',
  ...ttsAudioGuards,
  asyncHandler(aiController.streamSpeechAudio)
);

/**
 * @route   POST /api/v1/ai/tts/:transcriptId
 * @desc    Generate and store a transcript's speech (or return the stored copy)
 * @access  Private
 */
router.post(
  '/tts/:transcriptId',
  ...aiGuards(ttsLimiter, validationRules.ttsGenerate),
  asyncHandler(aiController.createSpeechAudio)
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
