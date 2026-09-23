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
}

/**
 * TTS response — base64 raw PCM plus the parameters needed to play it.
 * The sample rate depends on the backend's AI provider.
 */
export interface TTSResponse {
  audio: string;
  format: string;
  sampleRate: number;
  channels: number;
}

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
 * Chat with transcript context
 * @param history - Chat history array
 * @param currentMessage - Current user message
 * @param contextTranscript - Transcript for context
 * @param transcriptId - Optional transcript ID for tracking
 * @returns Promise with AI response
 */
export const chatWithTranscript = async (
  history: { role: 'user' | 'model'; text: string }[],
  currentMessage: string,
  contextTranscript: string,
  transcriptId?: string
): Promise<string> => {
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
      history,
      transcriptId,
    });

    return response.message;
  } catch (error) {
    if (error instanceof APIError) {
      console.error('Chat error:', error.message);
      
      if (error.code === 'CONNECTION_ERROR') {
        return 'Error: Unable to connect to server. Please ensure the backend is running.';
      }
      
      if (error.code === 'RATE_LIMIT_EXCEEDED') {
        return 'Too many requests. Please wait a moment and try again.';
      }
      
      if (error.code === 'VALIDATION_ERROR') {
        return 'Invalid input. Please check your message and try again.';
      }
      
      return `Sorry, I encountered an error: ${error.message}`;
    }
    
    console.error('Unexpected chat error:', error);
    return 'Sorry, I encountered an unexpected error. Please try again.';
  }
};

/**
 * Generate speech from text using TTS
 * @param text - Text to convert to speech
 * @param transcriptId - Optional transcript ID for caching
 * @returns Promise with base64 PCM audio and its format
 */
export const generateSpeech = async (text: string, transcriptId?: string): Promise<TTSResponse> => {
  try {
    if (!text || text.trim().length === 0) {
      throw new Error('Text is required for speech generation');
    }

    const response = await api.post<TTSResponse>(config.endpoints.tts, {
      text,
      transcriptId,
    });

    return response;
  } catch (error) {
    if (error instanceof APIError) {
      console.error('TTS error:', error.message);
      
      if (error.code === 'RATE_LIMIT_EXCEEDED') {
        throw new Error('Too many audio requests. Please wait a moment and try again.');
      }
      
      throw new Error(`Audio generation failed: ${error.message}`);
    }
    
    console.error('Unexpected TTS error:', error);
    throw new Error('An unexpected error occurred during audio generation.');
  }
};

/**
 * Helper to decode base64 to ArrayBuffer
 * This stays on the frontend as it's for audio playback
 */
export function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Helper to decode audio data using manual PCM decoding
 * This stays on the frontend as it's for audio playback
 */
export async function decodeAudioData(
  speech: TTSResponse,
  audioContext: AudioContext
): Promise<AudioBuffer> {
  const bytes = decodeBase64(speech.audio);
  
  // The audio bytes returned by the API is raw PCM data.
  // We must implement the decoding logic manually.
  
  const { sampleRate, channels: numChannels } = speech;
  
  const dataInt16 = new Int16Array(bytes.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = audioContext.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Convert int16 to float32 (-1.0 to 1.0)
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export default {
  generateSummary,
  chatWithTranscript,
  generateSpeech,
  decodeBase64,
  decodeAudioData,
};