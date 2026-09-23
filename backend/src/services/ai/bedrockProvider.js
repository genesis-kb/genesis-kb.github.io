/**
 * Amazon Bedrock AI Provider
 * Text generation through the Bedrock Converse API (model-agnostic across
 * Bedrock models) and speech through Amazon Polly, since Bedrock has no
 * plain text-to-speech model.
 *
 * Clients are built through awsClientConfig: explicit AWS_ACCESS_KEY_ID /
 * AWS_SECRET_ACCESS_KEY when both are set, the default provider chain
 * (profile or IAM role) otherwise.
 */

import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import config from '../../config/index.js';
import { awsClientConfig } from '../../config/aws.js';
import logger from '../../config/logger.js';

let bedrockClient = null;
let pollyClient = null;

const getBedrockClient = () => {
  if (!bedrockClient) {
    bedrockClient = new BedrockRuntimeClient(awsClientConfig({ region: config.ai.bedrock.region }));
    logger.info('Bedrock runtime client initialized successfully');
  }
  return bedrockClient;
};

const getPollyClient = () => {
  if (!pollyClient) {
    pollyClient = new PollyClient(awsClientConfig({ region: config.ai.bedrock.tts.region }));
    logger.info('Polly client initialized successfully');
  }
  return pollyClient;
};

/**
 * Generate text from a single-turn prompt
 * @param {string} prompt - Prompt text
 * @param {Object} [options]
 * @param {number} [options.maxTokens] - Output token cap
 * @returns {Promise<string>} Generated text ('' when the model returned none)
 */
export const generateText = async (prompt, { maxTokens } = {}) => {
  const response = await getBedrockClient().send(
    new ConverseCommand({
      modelId: config.ai.bedrock.modelId,
      messages: [{ role: 'user', content: [{ text: prompt }] }],
      inferenceConfig: { maxTokens: maxTokens || config.ai.bedrock.maxTokens },
    })
  );

  // Converse may return non-text blocks (e.g. reasoning) ahead of the answer.
  const blocks = response.output?.message?.content || [];
  return blocks
    .filter((block) => typeof block.text === 'string')
    .map((block) => block.text)
    .join('');
};

/**
 * Synthesize speech with Amazon Polly
 * @param {string} text - Text to speak
 * @returns {Promise<{audio: string, format: string, sampleRate: number, channels: number}>}
 *   Base64 raw PCM (16-bit signed little-endian, mono)
 */
export const synthesizeSpeech = async (text) => {
  const { voice, engine, sampleRate } = config.ai.bedrock.tts;

  const response = await getPollyClient().send(
    new SynthesizeSpeechCommand({
      Text: text,
      OutputFormat: 'pcm',
      SampleRate: String(sampleRate),
      VoiceId: voice,
      Engine: engine,
    })
  );

  const bytes = await response.AudioStream?.transformToByteArray();
  if (!bytes || bytes.length === 0) {
    throw new Error('No audio data received from Polly');
  }

  return {
    audio: Buffer.from(bytes).toString('base64'),
    format: 'pcm',
    sampleRate,
    channels: 1,
  };
};

export default { generateText, synthesizeSpeech };
