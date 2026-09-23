/**
 * Google Gemini AI Provider
 * Text generation and TTS through the Gemini API.
 */

import { GoogleGenAI } from '@google/genai';
import config from '../../config/index.js';
import logger from '../../config/logger.js';

// Gemini TTS returns raw PCM at a fixed 24kHz mono.
const GEMINI_TTS_SAMPLE_RATE = 24000;

let aiClient = null;

const getAIClient = () => {
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey: config.ai.gemini.apiKey });
    logger.info('Gemini AI client initialized successfully');
  }
  return aiClient;
};

/**
 * Generate text from a single-turn prompt
 * @param {string} prompt - Prompt text
 * @param {Object} [options]
 * @param {number} [options.maxTokens] - Output token cap
 * @returns {Promise<string>} Generated text ('' when the model returned none)
 */
export const generateText = async (prompt, { maxTokens } = {}) => {
  const response = await getAIClient().models.generateContent({
    model: config.ai.gemini.models.chat,
    contents: prompt,
    config: maxTokens ? { maxOutputTokens: maxTokens } : undefined,
  });
  return response.text || '';
};

/**
 * Synthesize speech with Gemini TTS
 * @param {string} text - Text to speak
 * @returns {Promise<{audio: string, format: string, sampleRate: number, channels: number}>}
 *   Base64 raw PCM (16-bit signed little-endian, mono)
 */
export const synthesizeSpeech = async (text) => {
  const response = await getAIClient().models.generateContent({
    model: config.ai.gemini.models.tts,
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: config.ai.gemini.tts.voice },
        },
      },
    },
  });

  const audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!audio) {
    throw new Error('No audio data received from Gemini TTS');
  }

  return { audio, format: 'pcm', sampleRate: GEMINI_TTS_SAMPLE_RATE, channels: 1 };
};

export default { generateText, synthesizeSpeech };
