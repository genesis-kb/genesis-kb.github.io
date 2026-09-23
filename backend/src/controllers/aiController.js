/**
 * AI Controller
 * Handles all AI-related API endpoints
 */

import * as aiService from '../services/aiService.js';
import * as supabaseService from '../services/supabaseService.js';
import { sendSuccess } from '../utils/responseHelper.js';
import { APIError } from '../middleware/errorHandler.js';
import logger from '../config/logger.js';

/**
 * Generate summary for a transcript
 * POST /api/v1/ai/summary
 * Body: { transcript: string, transcriptId?: string }
 */
export const generateSummary = async (req, res) => {
  const { transcript, transcriptId } = req.body;

  logger.info('Controller: Generating summary');

  // Check cache if transcriptId provided
  if (transcriptId) {
    const cachedSummary = await supabaseService.getCachedAIContent(
      transcriptId,
      'summary'
    );

    if (cachedSummary) {
      logger.info('Returning cached summary');
      return sendSuccess(res, { summary: cachedSummary, cached: true });
    }
  }

  // Generate new summary
  const summary = await aiService.generateSummary(transcript);

  // Cache the result if transcriptId provided
  if (transcriptId) {
    await supabaseService.cacheAIContent(transcriptId, 'summary', summary);
  }

  sendSuccess(res, { summary, cached: false });
};

/**
 * Chat with transcript context
 * POST /api/v1/ai/chat
 * Body: { message: string, transcript: string, history?: Array }
 */
export const chat = async (req, res) => {
  const { message, transcript, history = [] } = req.body;

  logger.info('Controller: Processing chat message');
  logger.info(`${transcript}`);

  const response = await aiService.chatWithTranscript(
    history,
    message,
    transcript
  );

  sendSuccess(res, {
    message: response,
    role: 'model',
    timestamp: Date.now(),
  });
};

/**
 * Generate speech from text
 * POST /api/v1/ai/tts
 * Body: { text: string }
 */
export const generateSpeech = async (req, res) => {
  const { text } = req.body;

  logger.info('Controller: Generating speech');

  // { audio, format, sampleRate, channels } — the sample rate depends on
  // the provider, so the client must read it rather than assume one.
  const speech = await aiService.generateSpeech(text);

  sendSuccess(res, speech);
};

/**
 * Extract entities from transcript
 * POST /api/v1/ai/entities
 * Body: { transcript: string, transcriptId?: string }
 */
export const extractEntities = async (req, res) => {
  const { transcript, transcriptId } = req.body;

  logger.info('Controller: Extracting entities');

  // Check cache if transcriptId provided
  if (transcriptId) {
    const cachedEntities = await supabaseService.getCachedAIContent(
      transcriptId,
      'entities'
    );

    if (cachedEntities) {
      logger.info('Returning cached entities');
      return sendSuccess(res, { entities: JSON.parse(cachedEntities), cached: true });
    }
  }

  // Extract new entities
  const entities = await aiService.extractEntities(transcript);

  // Cache the result if transcriptId provided
  if (transcriptId) {
    await supabaseService.cacheAIContent(
      transcriptId,
      'entities',
      JSON.stringify(entities)
    );
  }

  sendSuccess(res, { entities, cached: false });
};

export default {
  generateSummary,
  chat,
  generateSpeech,
  extractEntities,
};
