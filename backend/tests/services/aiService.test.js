/**
 * Unit Tests — aiService.js (chat prompt construction)
 *
 * Tests that the chat history the caller passes reaches the prompt intact.
 * Mocks: provider adapters, config, logger.
 */

import { jest } from '@jest/globals';

const mockBedrock = { generateText: jest.fn(), synthesizeSpeech: jest.fn() };

jest.unstable_mockModule('../../src/services/ai/bedrockProvider.js', () => mockBedrock);
jest.unstable_mockModule('../../src/services/ai/geminiProvider.js', () => ({
  generateText: jest.fn(),
  synthesizeSpeech: jest.fn(),
}));
jest.unstable_mockModule('../../src/config/index.js', () => ({
  default: {
    ai: {
      provider: 'bedrock',
      enabled: true,
      tts: { maxTextLength: 2000 },
      context: { maxTranscriptLength: 25000 },
    },
  },
}));
jest.unstable_mockModule('../../src/config/logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const { chatWithTranscript } = await import('../../src/services/aiService.js');

beforeEach(() => {
  jest.clearAllMocks();
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
