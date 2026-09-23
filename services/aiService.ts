/**
 * AI Service
 * Handles all AI operations via the backend API
 * Never calls an AI provider directly - all AI requests go through the backend
 */

import { api, APIError } from './api';
import config from './config';

/**
 * Summary response interface
 */
interface SummaryResponse {
  summary: string;
  cached: boolean;
}

/**
 * Chat response interface
 */
interface ChatResponse {
  message: string;
  role: 'model';
  timestamp: number;
  saved: boolean;
}

/**
 * One saved chat message, as returned by GET /ai/chat/:transcriptId
 */
export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

/**
 * Result of a chat turn.
 * `failed` replies carry a user-facing error message instead of a model
 * answer and were not saved; `unauthorized` means the session is gone.
 */
export interface ChatReply {
  message: string;
  saved: boolean;
  failed: boolean;
  unauthorized?: boolean;
}

/**
 * What a transcript's speech reads aloud. `summary` falls back to the
 * transcript text when there is no summary.
 */
export type SpeechSource = 'transcript' | 'summary';

/**
 * Stored speech for a transcript, as described by the backend
 */
export interface SpeechAudio {
  sampleRate: number;
  durationSeconds: number;
  byteSize: number;
  format: 'wav';
}

// Synthesis plus upload can take a while for long texts.
const SPEECH_GENERATE_TIMEOUT_MS = 120000;
const SPEECH_DOWNLOAD_TIMEOUT_MS = 60000;

/**
 * Generate a summary for a transcript
 * @param transcript - The transcript text to summarize
 * @param transcriptId - Optional transcript ID for caching
 * @returns Promise with generated summary
 */
export const generateSummary = async (
  transcript: string,
  transcriptId?: string
): Promise<string> => {
  try {
    if (!transcript || transcript.trim().length === 0) {
      throw new Error('Transcript text is required for summarization');
    }

    const response = await api.post<SummaryResponse>(config.endpoints.summary, {
      transcript,
      transcriptId,
    });

    if (response.cached) {
      console.log('Returned cached summary');
    }

    return response.summary;
  } catch (error) {
    if (error instanceof APIError) {
      console.error('Summary generation error:', error.message);
    } else {
      console.error('Unexpected error generating summary:', error);
    }
    throw error;
  }
};

/**
 * Chat with transcript context.
 * The backend keeps the conversation: it builds context from the saved chat
 * for this transcript and saves the new exchange, so no history is sent.
 * Errors are not thrown — they come back as a `failed` reply whose message
 * is safe to show the user.
 * @param currentMessage - Current user message
 * @param contextTranscript - Transcript for context
 * @param transcriptId - Transcript the chat belongs to
 * @returns Promise with the reply
 */
export const chatWithTranscript = async (
  currentMessage: string,
  contextTranscript: string,
  transcriptId: string
): Promise<ChatReply> => {
  const failure = (message: string, unauthorized = false): ChatReply => ({
    message,
    saved: false,
    failed: true,
    unauthorized,
  });

  try {
    if (!currentMessage || currentMessage.trim().length === 0) {
      throw new Error('Message is required');
    }

    if (!contextTranscript || contextTranscript.trim().length === 0) {
      throw new Error('Transcript context is required');
    }

    const response = await api.post<ChatResponse>(config.endpoints.chat, {
      message: currentMessage,
      transcript: contextTranscript,
      transcriptId,
    });

    return { message: response.message, saved: response.saved !== false, failed: false };
  } catch (error) {
    if (error instanceof APIError) {
      console.error('Chat error:', error.message);

      if (error.statusCode === 401) {
        return failure('Please sign in to chat about this transcript.', true);
      }
      
      if (error.code === 'CONNECTION_ERROR') {
        return failure('Error: Unable to connect to server. Please ensure the backend is running.');
      }
      
      if (error.code === 'RATE_LIMIT_EXCEEDED') {
        return failure('Too many requests. Please wait a moment and try again.');
      }
      
      if (error.code === 'VALIDATION_ERROR') {
        return failure('Invalid input. Please check your message and try again.');
      }
      
      return failure(`Sorry, I encountered an error: ${error.message}`);
    }
    
    console.error('Unexpected chat error:', error);
    return failure('Sorry, I encountered an unexpected error. Please try again.');
  }
};

/**
 * Get the signed-in user's saved chat with a transcript (oldest first)
 * @param transcriptId - Transcript ID
 * @returns Promise with the saved messages
 */
export const getChatHistory = async (transcriptId: string): Promise<ChatHistoryMessage[]> => {
  const response = await api.get<{ messages: ChatHistoryMessage[] }>(
    `${config.endpoints.chatHistory}/${encodeURIComponent(transcriptId)}`
  );
  return response.messages;
};

/**
 * Delete the signed-in user's saved chat with a transcript
 * @param transcriptId - Transcript ID
 */
export const clearChat = async (transcriptId: string): Promise<void> => {
  await api.delete(`${config.endpoints.chatHistory}/${encodeURIComponent(transcriptId)}`);
};

const speechPath = (transcriptId: string) =>
  `${config.endpoints.tts}/${encodeURIComponent(transcriptId)}`;

/**
 * User-facing message for a failed speech request
 */
const speechErrorMessage = (error: unknown): string => {
  if (!(error instanceof APIError)) {
    return 'An unexpected error occurred during audio generation.';
  }

  if (error.statusCode === 401) {
    return 'Please sign in to listen to audio.';
  }

  switch (error.code) {
    case 'RATE_LIMIT_EXCEEDED':
      return 'Too many audio requests. Please wait a moment and try again.';
    case 'NO_SPEECH_TEXT':
      return 'This transcript has no text to read aloud.';
    case 'TTS_STORAGE_NOT_CONFIGURED':
    case 'AI_NOT_CONFIGURED':
      return 'Audio generation is not available right now.';
    case 'CONNECTION_ERROR':
    case 'TIMEOUT':
      return error.message;
    default:
      return `Audio generation failed: ${error.message}`;
  }
};

/**
 * Load a transcript's speech as a WAV file.
 * Audio is generated once on the backend and stored; later calls — from any
 * user — download the stored copy. Generation only happens when nothing is
 * stored yet, so replays make no AI call and work even with AI disabled.
 * Errors are thrown with a message that is safe to show the user.
 * @param transcriptId - Transcript ID
 * @param source - What to read aloud
 * @returns Promise with the WAV bytes (decode with AudioContext.decodeAudioData)
 */
export const loadSpeechAudio = async (
  transcriptId: string,
  source: SpeechSource
): Promise<ArrayBuffer> => {
  const path = speechPath(transcriptId);
  const query = `?source=${source}`;

  try {
    const { audio } = await api.get<{ audio: SpeechAudio | null }>(`${path}${query}`);

    if (!audio) {
      await api.post<{ audio: SpeechAudio; cached: boolean }>(
        path,
        { source },
        { timeout: SPEECH_GENERATE_TIMEOUT_MS }
      );
    }

    return await api.getBinary(`${path}/audio${query}`, { timeout: SPEECH_DOWNLOAD_TIMEOUT_MS });
  } catch (error) {
    console.error('TTS error:', error);
    throw new Error(speechErrorMessage(error));
  }
};

export default {
  generateSummary,
  chatWithTranscript,
  getChatHistory,
  clearChat,
  loadSpeechAudio,
};