/**
 * Unit Tests — aiService.js (chat prompt construction, speech text and voice)
 *
 * Tests that the chat history the caller passes reaches the prompt intact,
 * and the speech helpers the TTS audio cache keys on.
 * Mocks: provider adapters, config, logger.
 */

import { jest } from '@jest/globals';

const mockBedrock = { generateText: jest.fn(), synthesizeSpeech: jest.fn() };

jest.unstable_mockModule('../../src/services/ai/bedrockProvider.js', () => mockBedrock);
jest.unstable_mockModule('../../src/services/ai/geminiProvider.js', () => ({
  generateText: jest.fn(),
  synthesizeSpeech: jest.fn(),
}));
const mockConfig = {
  ai: {
    provider: 'bedrock',
    enabled: true,
    tts: { maxTextLength: 2000 },
    context: { maxTranscriptLength: 25000 },
    bedrock: { tts: { voice: 'Joanna', engine: 'neural' } },
    gemini: { tts: { voice: 'Kore' } },
  },
};

jest.unstable_mockModule('../../src/config/index.js', () => ({ default: mockConfig }));
jest.unstable_mockModule('../../src/config/logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const { chatWithTranscript, prepareSpeechText, getSpeechVoice } = await import(
  '../../src/services/aiService.js'
);

beforeEach(() => {
  jest.clearAllMocks();
  mockConfig.ai.provider = 'bedrock';
});

describe('chatWithTranscript', () => {
  it('includes every history message in the prompt, in order', async () => {
    mockBedrock.generateText.mockResolvedValueOnce('Reply');
    const history = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'model',
      text: `message-${i}`,
    }));

    await chatWithTranscript(history, 'Next question', 'Transcript text');

    const prompt = mockBedrock.generateText.mock.calls[0][0];
    const positions = history.map((msg) => prompt.indexOf(msg.text));
    expect(positions.every((pos) => pos >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(prompt).toContain('User: message-0');
    expect(prompt).toContain('Assistant: message-1');
  });
});

describe('prepareSpeechText', () => {
  it('returns text within the limit unchanged', () => {
    const text = 'x'.repeat(2000);
    expect(prepareSpeechText(text)).toBe(text);
  });

  it('truncates longer text to the limit plus an ellipsis', () => {
    const prepared = prepareSpeechText('x'.repeat(2500));
    expect(prepared).toBe('x'.repeat(2000) + '...');
  });

  it('is idempotent', () => {
    const once = prepareSpeechText('y'.repeat(5000));
    expect(prepareSpeechText(once)).toBe(once);
  });
});

describe('getSpeechVoice', () => {
  it('identifies the Polly voice and engine for bedrock', () => {
    expect(getSpeechVoice()).toEqual({ provider: 'bedrock', voice: 'Joanna', engine: 'neural' });
  });

  it('identifies the Gemini voice with no engine', () => {
    mockConfig.ai.provider = 'gemini';
    expect(getSpeechVoice()).toEqual({ provider: 'gemini', voice: 'Kore', engine: '' });
  });

  it('returns an empty voice when AI is off', () => {
    mockConfig.ai.provider = 'none';
    expect(getSpeechVoice()).toEqual({ provider: 'none', voice: '', engine: '' });
  });
});
