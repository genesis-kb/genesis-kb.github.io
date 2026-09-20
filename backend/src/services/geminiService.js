/**
 * Gemini AI Service
 * Handles all AI operations using Google's Gemini API
 */

import { GoogleGenAI } from '@google/genai';
import config from '../config/index.js';
import logger from '../config/logger.js';

// Lazy-initialized Gemini client
let aiClient = null;

/**
 * Get or initialize the Gemini AI client
 * @returns {GoogleGenAI} Gemini AI client instance
 */
const getAIClient = () => {
  if (!aiClient) {
    // config.gemini.enabled, not apiKey: the .env.example placeholder is a
    // non-empty string, so a truthiness check would build a client around it
    // and only fail once Google rejected the request.
    if (!config.gemini.enabled) {
      logger.error('Gemini API key is missing or unfilled. Please check your .env file.');
      throw new Error('Gemini API key is not configured');
    }

    aiClient = new GoogleGenAI({ apiKey: config.gemini.apiKey });
    logger.info('Gemini AI client initialized successfully');
  }

  return aiClient;
};

/**
 * Generate a summary for a transcript
 * @param {string} transcript - The transcript text to summarize
 * @returns {Promise<string>} Generated summary
 */
export const generateSummary = async (transcript) => {
  if (!transcript || transcript.trim().length === 0) {
    throw new Error('Transcript text is required for summarization');
  }

  logger.info('Generating summary for transcript...');

  try {
    const ai = getAIClient();

    const prompt = `You are an expert Bitcoin analyst. Please summarize the following transcript from a Bitcoin conference.

Focus on:
- Key technical innovations discussed
- Economic arguments presented
- Strategic takeaways and conclusions
- Notable quotes or statements

Format the output with Markdown:
- Use **bold** for key points
- Use bullet points for lists
- Keep the summary concise but comprehensive (300-500 words)

Transcript:
${transcript}`;

    const response = await ai.models.generateContent({
      model: config.gemini.models.chat,
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 }, // Faster response
      },
    });

    const summary = response.text || 'Failed to generate summary.';
    logger.info('Summary generated successfully');

    return summary;
  } catch (error) {
    logger.error('Summary generation error:', { error: error.message });
    throw new Error(`AI error: ${error.message}`);
  }
};

/**
 * Chat with a transcript context
 * @param {Array} history - Chat history array
 * @param {string} currentMessage - Current user message
 * @param {string} contextTranscript - Transcript for context
 * @returns {Promise<string>} AI response
 */
export const chatWithTranscript = async (history, currentMessage, contextTranscript) => {
  if (!currentMessage || currentMessage.trim().length === 0) {
    throw new Error('Message is required');
  }

  if (!contextTranscript || contextTranscript.trim().length === 0) {
    throw new Error('Transcript context is required');
  }

  logger.info('Processing chat message...');

  try {
    const ai = getAIClient();

    // Truncate transcript to avoid token limits
    const truncatedTranscript = contextTranscript.substring(
      0,
      config.gemini.context.maxTranscriptLength
    );

    // Build conversation context
    let conversationContext = '';
    if (history && history.length > 0) {
      conversationContext = history
        .slice(-5) // Only use last 5 messages for context
        .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.text}`)
        .join('\n');
    }

    const prompt = `Context: The following is a transcript from a Bitcoin conference talk.

${truncatedTranscript}${truncatedTranscript.length < contextTranscript.length ? '\n... [Transcript truncated]' : ''}

Instructions:
- Answer the user's question based STRICTLY on the transcript provided above
- If the answer is not in the transcript, say "I couldn't find that information in this specific talk."
- Be concise and accurate
- Reference specific parts of the transcript when relevant

${conversationContext ? `Previous conversation:\n${conversationContext}\n\n` : ''}User Question: ${currentMessage}`;

    const response = await ai.models.generateContent({
      model: config.gemini.models.chat,
      contents: prompt,
    });

    const reply = response.text || "I didn't understand that. Please try rephrasing your question.";
    logger.info('Chat response generated successfully');

    return reply;
  } catch (error) {
    logger.error('Chat error:', { error: error.message });
    throw new Error(`AI chat error: ${error.message}`);
  }
};

/**
 * Generate speech from text using TTS
 * @param {string} text - Text to convert to speech
 * @returns {Promise<string>} Base64 encoded audio data
 */
export const generateSpeech = async (text) => {
  if (!text || text.trim().length === 0) {
    throw new Error('Text is required for speech generation');
  }

  logger.info('Generating speech from text...');

  try {
    const ai = getAIClient();

    // Truncate text to avoid token limits
    const safeText =
      text.length > config.gemini.tts.maxTextLength
        ? text.substring(0, config.gemini.tts.maxTextLength) + '...'
        : text;

    const response = await ai.models.generateContent({
      model: config.gemini.models.tts,
      contents: [{ parts: [{ text: safeText }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: config.gemini.tts.voice },
          },
        },
      },
    });

    const base64Audio =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      throw new Error('No audio data received from Gemini TTS');
    }

    logger.info('Speech generated successfully');
    return base64Audio;
  } catch (error) {
    logger.error('TTS error:', { error: error.message });
    throw new Error(`TTS error: ${error.message}`);
  }
};

/**
 * Extract key topics and entities from a transcript
 * @param {string} transcript - Transcript text
 * @returns {Promise<Object>} Extracted entities and topics
 */
export const extractEntities = async (transcript) => {
  if (!transcript || transcript.trim().length === 0) {
    throw new Error('Transcript is required for entity extraction');
  }

  logger.info('Extracting entities from transcript...');

  try {
    const ai = getAIClient();

    const prompt = `Analyze this Bitcoin conference transcript and extract the following as JSON:

{
  "speakers": ["list of speakers mentioned"],
  "topics": ["main topics discussed"],
  "technicalConcepts": ["specific Bitcoin/crypto technical terms"],
  "organizations": ["companies, protocols, or organizations mentioned"],
  "keyQuotes": ["2-3 notable quotes"],
  "sentiment": "bullish|bearish|neutral"
}

Transcript:
${transcript.substring(0, 10000)}

Return ONLY valid JSON, no markdown or explanations.`;

    const response = await ai.models.generateContent({
      model: config.gemini.models.chat,
      contents: prompt,
    });

    // Parse JSON response
    const responseText = response.text || '{}';
    // Remove markdown code blocks if present
    const cleanJson = responseText.replace(/```json\n?|\n?```/g, '').trim();
    
    let entities;
    try {
      entities = JSON.parse(cleanJson);
      // Validate expected structure
      if (typeof entities !== 'object' || entities === null) {
        throw new Error('Invalid response structure');
      }
    } catch (parseError) {
      logger.warn('Failed to parse entities JSON, returning defaults:', { error: parseError.message });
      entities = {
        speakers: [],
        topics: [],
        technicalConcepts: [],
        organizations: [],
        keyQuotes: [],
        sentiment: 'neutral'
      };
    }

    logger.info('Entities extracted successfully');
    return entities;
  } catch (error) {
    logger.error('Entity extraction error:', { error: error.message });
    throw new Error(`Entity extraction error: ${error.message}`);
  }
};

/**
 * Health check for Gemini API
 * @returns {Promise<boolean|null>} True if accessible, false if the call
 *   failed, null if AI is disabled (no usable key configured)
 */
export const healthCheck = async () => {
  // A deployment with no key has AI switched off by design. Probing Google
  // anyway would bill a request per health check and report 'unhealthy' for
  // a server that is working exactly as configured.
  if (!config.gemini.enabled) {
    return null;
  }

  try {
    const ai = getAIClient();
    await ai.models.generateContent({
      model: config.gemini.models.chat,
      contents: 'Say "OK" if you can read this.',
      config: {
        maxOutputTokens: 5,
      },
    });
    return true;
  } catch (error) {
    logger.error('Gemini health check failed:', { error: error.message });
    return false;
  }
};

export default {
  generateSummary,
  chatWithTranscript,
  generateSpeech,
  extractEntities,
  healthCheck,
};
