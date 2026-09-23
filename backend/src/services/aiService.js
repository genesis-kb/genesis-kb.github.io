/**
 * AI Service
 * Provider-neutral AI operations (summary, chat, TTS, entities). Prompts and
 * response handling live here; the configured provider adapter
 * (config.ai.provider) only turns a prompt into text or text into audio.
 */

import config from '../config/index.js';
import logger from '../config/logger.js';
import * as bedrockProvider from './ai/bedrockProvider.js';
import * as geminiProvider from './ai/geminiProvider.js';

const providers = {
  bedrock: bedrockProvider,
  gemini: geminiProvider,
};

/**
 * Get the adapter for the configured AI provider
 * @returns {{generateText: Function, synthesizeSpeech: Function}} Provider adapter
 */
const getProvider = () => {
  // config.ai.enabled, not config.ai.provider: a provider can be selected but
  // left without the settings it needs (e.g. a placeholder Gemini key).
  if (!config.ai.enabled) {
    logger.error('No AI provider is configured. Please check your .env file.');
    throw new Error('AI provider is not configured');
  }

  return providers[config.ai.provider];
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
    const provider = getProvider();

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

    const summary = (await provider.generateText(prompt)) || 'Failed to generate summary.';
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
    const provider = getProvider();

    // Truncate transcript to avoid token limits
    const truncatedTranscript = contextTranscript.substring(
      0,
      config.ai.context.maxTranscriptLength
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

    const reply =
      (await provider.generateText(prompt)) ||
      "I didn't understand that. Please try rephrasing your question.";
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
 * @returns {Promise<{audio: string, format: string, sampleRate: number, channels: number}>}
 *   Base64 raw PCM plus the parameters needed to play it — the sample rate
 *   differs between providers.
 */
export const generateSpeech = async (text) => {
  if (!text || text.trim().length === 0) {
    throw new Error('Text is required for speech generation');
  }

  logger.info('Generating speech from text...');

  try {
    const provider = getProvider();

    // Truncate text to avoid token limits
    const safeText =
      text.length > config.ai.tts.maxTextLength
        ? text.substring(0, config.ai.tts.maxTextLength) + '...'
        : text;

    const speech = await provider.synthesizeSpeech(safeText);

    logger.info('Speech generated successfully');
    return speech;
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
    const provider = getProvider();

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

    // Parse JSON response
    const responseText = (await provider.generateText(prompt)) || '{}';
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
 * Health check for the configured AI provider
 * @returns {Promise<boolean|null>} True if accessible, false if the call
 *   failed, null if AI is disabled (no provider configured)
 */
export const healthCheck = async () => {
  // A deployment with no provider has AI switched off by design. Probing a
  // provider anyway would bill a request per health check and report
  // 'unhealthy' for a server that is working exactly as configured.
  if (!config.ai.enabled) {
    return null;
  }

  try {
    // Room for models that spend a few tokens reasoning before answering.
    await getProvider().generateText('Say "OK" if you can read this.', { maxTokens: 64 });
    return true;
  } catch (error) {
    logger.error(`AI provider (${config.ai.provider}) health check failed:`, {
      error: error.message,
    });
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
