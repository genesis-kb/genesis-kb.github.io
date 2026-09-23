/**
 * Unit Tests — config/index.js (AI provider selection)
 *
 * Tests how AI_PROVIDER and provider settings resolve to config.ai.
 * Each case imports a fresh copy of the config module under its own env.
 */

import { jest } from '@jest/globals';

const AI_ENV = [
  'AI_PROVIDER',
  'GEMINI_API_KEY',
  'AWS_REGION',
  'AWS_DEFAULT_REGION',
  'BEDROCK_REGION',
  'POLLY_REGION',
  'BEDROCK_MODEL_ID',
];
const originalEnv = { ...process.env };

/**
 * Import config with the given AI env. Unlisted AI vars are set to '' rather
 * than deleted so a local backend/.env can't fill them in through dotenv.
 */
const loadConfig = async (env) => {
  for (const name of AI_ENV) process.env[name] = env[name] ?? '';
  let config;
  await jest.isolateModulesAsync(async () => {
    ({ default: config } = await import('../../src/config/index.js'));
  });
  return config;
};

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-for-config-tests';
});

afterAll(() => {
  process.env = originalEnv;
});

describe('config.ai', () => {
  it('enables Bedrock when a region is set', async () => {
    const config = await loadConfig({ AI_PROVIDER: 'bedrock', AWS_REGION: 'us-east-1' });

    expect(config.ai.provider).toBe('bedrock');
    expect(config.ai.enabled).toBe(true);
    expect(config.ai.bedrock.region).toBe('us-east-1');
  });

  it('falls back to AWS_DEFAULT_REGION for Bedrock', async () => {
    const config = await loadConfig({ AI_PROVIDER: 'bedrock', AWS_DEFAULT_REGION: 'eu-west-1' });

    expect(config.ai.enabled).toBe(true);
    expect(config.ai.bedrock.region).toBe('eu-west-1');
  });

  it('disables Bedrock without a region', async () => {
    const config = await loadConfig({ AI_PROVIDER: 'bedrock' });

    expect(config.ai.enabled).toBe(false);
  });

  it('defaults to Amazon Nova Lite', async () => {
    const config = await loadConfig({ AI_PROVIDER: 'bedrock', AWS_REGION: 'us-east-1' });

    expect(config.ai.bedrock.modelId).toBe('amazon.nova-lite-v1:0');
  });

  it('runs Bedrock in BEDROCK_REGION and Polly in AWS_REGION', async () => {
    const config = await loadConfig({
      AI_PROVIDER: 'bedrock',
      AWS_REGION: 'ap-south-1',
      BEDROCK_REGION: 'us-east-1',
    });

    expect(config.ai.bedrock.region).toBe('us-east-1');
    expect(config.ai.bedrock.tts.region).toBe('ap-south-1');
    expect(config.aws.region).toBe('ap-south-1');
  });

  it('enables Bedrock with only BEDROCK_REGION, using it for Polly too', async () => {
    const config = await loadConfig({ AI_PROVIDER: 'bedrock', BEDROCK_REGION: 'us-east-1' });

    expect(config.ai.enabled).toBe(true);
    expect(config.ai.bedrock.tts.region).toBe('us-east-1');
  });

  it('uses POLLY_REGION when set', async () => {
    const config = await loadConfig({
      AI_PROVIDER: 'bedrock',
      AWS_REGION: 'us-east-1',
      POLLY_REGION: 'eu-west-1',
    });

    expect(config.ai.bedrock.tts.region).toBe('eu-west-1');
  });

  it('uses BEDROCK_MODEL_ID when set', async () => {
    const config = await loadConfig({
      AI_PROVIDER: 'bedrock',
      AWS_REGION: 'us-east-1',
      BEDROCK_MODEL_ID: 'custom-model',
    });

    expect(config.ai.bedrock.modelId).toBe('custom-model');
  });

  it('disables Gemini with a placeholder key', async () => {
    const config = await loadConfig({
      AI_PROVIDER: 'gemini',
      GEMINI_API_KEY: 'your-gemini-api-key-here',
    });

    expect(config.ai.enabled).toBe(false);
  });

  it('selects Gemini when AI_PROVIDER is unset and a usable key exists', async () => {
    const config = await loadConfig({ GEMINI_API_KEY: 'real-key' });

    expect(config.ai.provider).toBe('gemini');
    expect(config.ai.enabled).toBe(true);
  });

  it('disables AI when nothing is configured', async () => {
    const config = await loadConfig({});

    expect(config.ai.provider).toBe('none');
    expect(config.ai.enabled).toBe(false);
  });

  it('keeps AI off for AI_PROVIDER=none even with a key', async () => {
    const config = await loadConfig({ AI_PROVIDER: 'none', GEMINI_API_KEY: 'real-key' });

    expect(config.ai.enabled).toBe(false);
  });

  it('rejects an unknown AI_PROVIDER', async () => {
    await expect(loadConfig({ AI_PROVIDER: 'openai' })).rejects.toThrow(/AI_PROVIDER must be one of/);
  });
});
