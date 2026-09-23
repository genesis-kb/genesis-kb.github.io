/**
 * AI Controller
 * Handles all AI-related API endpoints
 */

import * as aiService from '../services/aiService.js';
import * as chatService from '../services/chatService.js';
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

// Saved messages fed back to the model as context on each chat turn.
export const CHAT_CONTEXT_MESSAGES = 10;

// Cap on messages returned by GET /chat/:transcriptId (newest kept).
export const CHAT_HISTORY_LIMIT = 200;

/**
 * Chat with transcript context
 * POST /api/v1/ai/chat
 * Body: { message: string, transcript: string, transcriptId: string }
 *
 * Context comes from the user's saved chat for the transcript, and the new
 * question/answer pair is saved only once the model has replied — a failed
 * call leaves the chat unchanged. If saving fails after a reply, the reply
 * is still returned (it has been paid for) with `saved: false`.
 */
export const chat = async (req, res) => {
  const { message, transcript, transcriptId } = req.body;
  const userId = req.user.id;

  logger.info('Controller: Processing chat message');

  const previous = await chatService.getMessages(userId, transcriptId, {
    limit: CHAT_CONTEXT_MESSAGES,
  });
  const history = previous.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    text: msg.content,
  }));

  const response = await aiService.chatWithTranscript(history, message, transcript);

  let saved = true;
  try {
    await chatService.appendExchange(userId, transcriptId, message, response);
  } catch (error) {
    saved = false;
    // No message content in the log — only enough to find the failed save.
    logger.error('Failed to save chat exchange; returning the reply unsaved', {
      transcriptId,
      error: error.message,
    });
  }

  sendSuccess(res, {
    message: response,
    role: 'model',
    timestamp: Date.now(),
    saved,
  });
};

/**
 * Get the user's saved chat with a transcript (newest CHAT_HISTORY_LIMIT
 * messages, oldest first)
 * GET /api/v1/ai/chat/:transcriptId
 */
export const getChatHistory = async (req, res) => {
  const messages = await chatService.getMessages(req.user.id, req.params.transcriptId, {
    limit: CHAT_HISTORY_LIMIT,
  });

  sendSuccess(res, {
    messages: messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      createdAt: msg.created_at,
    })),
  });
};

/**
 * Delete the user's saved chat with a transcript
 * DELETE /api/v1/ai/chat/:transcriptId
 */
export const clearChatHistory = async (req, res) => {
  const cleared = await chatService.clearConversation(req.user.id, req.params.transcriptId);

  sendSuccess(res, { cleared });
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
  getChatHistory,
  clearChatHistory,
  generateSpeech,
  extractEntities,
};
