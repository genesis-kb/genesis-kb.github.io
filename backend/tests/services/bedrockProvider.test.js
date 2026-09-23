/**
 * Unit Tests — ai/bedrockProvider.js
 *
 * Tests Converse request/response mapping and Polly speech synthesis.
 * Mocks: @aws-sdk/client-bedrock-runtime, @aws-sdk/client-polly, config.
 */

import { jest } from '@jest/globals';

const mockBedrockSend = jest.fn();
const mockPollySend = jest.fn();
// Clients are created once and reused, so their options are captured here
// rather than read from mock.calls (cleared before each test).
const clientOptions = {};

jest.unstable_mockModule('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn((options) => {
    clientOptions.bedrock = options;
    return { send: mockBedrockSend };
  }),
  ConverseCommand: jest.fn((input) => ({ input })),
}));
jest.unstable_mockModule('@aws-sdk/client-polly', () => ({
  PollyClient: jest.fn((options) => {
    clientOptions.polly = options;
    return { send: mockPollySend };
  }),
  SynthesizeSpeechCommand: jest.fn((input) => ({ input })),
}));
jest.unstable_mockModule('../../src/config/index.js', () => ({
  default: {
    aws: {
      region: 'ap-south-1',
      accessKeyId: '',
      secretAccessKey: '',
      sessionToken: '',
      http: { connectionTimeoutMs: 10000, requestTimeoutMs: 60000, maxAttempts: 3 },
    },
    ai: {
      bedrock: {
        region: 'us-east-1',
        modelId: 'test-model',
        maxTokens: 4096,
        tts: { region: 'ap-south-1', voice: 'Joanna', engine: 'neural', sampleRate: 16000 },
      },
    },
  },
}));
jest.unstable_mockModule('../../src/config/logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const { generateText, synthesizeSpeech } = await import(
  '../../src/services/ai/bedrockProvider.js'
);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('generateText', () => {
  it('sends a single user turn to the configured model', async () => {
    mockBedrockSend.mockResolvedValueOnce({
      output: { message: { content: [{ text: 'Hello' }] } },
    });

    await generateText('Prompt', { maxTokens: 64 });

    expect(mockBedrockSend.mock.calls[0][0].input).toEqual({
      modelId: 'test-model',
      messages: [{ role: 'user', content: [{ text: 'Prompt' }] }],
      inferenceConfig: { maxTokens: 64 },
    });
  });

  it('builds the Bedrock client in the Bedrock region', async () => {
    mockBedrockSend.mockResolvedValueOnce({ output: { message: { content: [] } } });

    await generateText('Prompt');

    expect(clientOptions.bedrock.region).toBe('us-east-1');
  });

  it('defaults maxTokens from config', async () => {
    mockBedrockSend.mockResolvedValueOnce({ output: { message: { content: [] } } });

    await generateText('Prompt');

    expect(mockBedrockSend.mock.calls[0][0].input.inferenceConfig.maxTokens).toBe(4096);
  });

  it('joins text blocks and skips non-text blocks', async () => {
    mockBedrockSend.mockResolvedValueOnce({
      output: {
        message: {
          content: [{ reasoningContent: {} }, { text: 'Part 1 ' }, { text: 'Part 2' }],
        },
      },
    });

    await expect(generateText('Prompt')).resolves.toBe('Part 1 Part 2');
  });

  it('returns an empty string when the model returns no content', async () => {
    mockBedrockSend.mockResolvedValueOnce({});

    await expect(generateText('Prompt')).resolves.toBe('');
  });
});

describe('synthesizeSpeech', () => {
  it('requests 16kHz PCM from Polly and returns base64 with its format', async () => {
    mockPollySend.mockResolvedValueOnce({
      AudioStream: { transformToByteArray: async () => new Uint8Array([1, 2, 3, 4]) },
    });

    const speech = await synthesizeSpeech('Speak this');

    expect(mockPollySend.mock.calls[0][0].input).toEqual({
      Text: 'Speak this',
      OutputFormat: 'pcm',
      SampleRate: '16000',
      VoiceId: 'Joanna',
      Engine: 'neural',
    });
    expect(speech).toEqual({
      audio: Buffer.from([1, 2, 3, 4]).toString('base64'),
      format: 'pcm',
      sampleRate: 16000,
      channels: 1,
    });
  });

  it('builds the Polly client in the Polly region', async () => {
    mockPollySend.mockResolvedValueOnce({
      AudioStream: { transformToByteArray: async () => new Uint8Array([1]) },
    });

    await synthesizeSpeech('Speak this');

    expect(clientOptions.polly.region).toBe('ap-south-1');
  });

  it('throws when Polly returns no audio', async () => {
    mockPollySend.mockResolvedValueOnce({
      AudioStream: { transformToByteArray: async () => new Uint8Array() },
    });

    await expect(synthesizeSpeech('Speak this')).rejects.toThrow('No audio data received from Polly');
  });
});
