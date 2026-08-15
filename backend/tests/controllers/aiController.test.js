/**
 * Unit Tests — aiController.js
 *
 * Tests AI controller caching logic and service integration.
 * Mocks: geminiService, supabaseService.
 */

import { jest } from '@jest/globals';

const mockGemini = {
  generateSummary: jest.fn(),
  chatWithTranscript: jest.fn(),
  generateSpeech: jest.fn(),
  extractEntities: jest.fn(),
};

const mockSupabase = {
  getCachedAIContent: jest.fn(),
  cacheAIContent: jest.fn(),
};

jest.unstable_mockModule('../../src/services/geminiService.js', () => mockGemini);
jest.unstable_mockModule('../../src/services/supabaseService.js', () => mockSupabase);

jest.unstable_mockModule('../../src/config/logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const {
  generateSummary,
  chat,
  generateSpeech,
  extractEntities,
} = await import('../../src/controllers/aiController.js');

function createMockRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) { res.statusCode = code; return res; },
    json(data) { res.body = data; return res; },
  };
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── generateSummary ────────────────────────────────────────────────────────

describe('generateSummary', () => {
  it('returns cached summary when available', async () => {
    mockSupabase.getCachedAIContent.mockResolvedValueOnce('Cached text');

    const req = { body: { transcriptId: 't1', transcript: 'text' } };
    const res = createMockRes();

    await generateSummary(req, res);

    expect(res.body.success).toBe(true);
    expect(res.body.data.summary).toBe('Cached text');
    expect(res.body.data.cached).toBe(true);
    expect(mockGemini.generateSummary).not.toHaveBeenCalled();
  });

  it('generates new summary when cache misses and caches it', async () => {
    mockSupabase.getCachedAIContent.mockResolvedValueOnce(null);
    mockGemini.generateSummary.mockResolvedValueOnce('Generated text');

    const req = { body: { transcriptId: 't1', transcript: 'text' } };
    const res = createMockRes();

    await generateSummary(req, res);

    expect(mockGemini.generateSummary).toHaveBeenCalledWith('text');
    expect(mockSupabase.cacheAIContent).toHaveBeenCalledWith('t1', 'summary', 'Generated text');
    
    expect(res.body.data.summary).toBe('Generated text');
    expect(res.body.data.cached).toBe(false);
  });
});

// ─── extractEntities ────────────────────────────────────────────────────────

describe('extractEntities', () => {
  it('parses and returns cached entities when available', async () => {
    const cachedJson = JSON.stringify([{ type: 'person', name: 'Alice' }]);
    mockSupabase.getCachedAIContent.mockResolvedValueOnce(cachedJson);

    const req = { body: { transcriptId: 't1', transcript: 'text' } };
    const res = createMockRes();

    await extractEntities(req, res);

    expect(res.body.data.entities).toEqual([{ type: 'person', name: 'Alice' }]);
    expect(res.body.data.cached).toBe(true);
  });

  it('generates new entities and caches them as JSON string', async () => {
    mockSupabase.getCachedAIContent.mockResolvedValueOnce(null);
    const generatedEntities = [{ type: 'topic', name: 'Bitcoin' }];
    mockGemini.extractEntities.mockResolvedValueOnce(generatedEntities);

    const req = { body: { transcriptId: 't1', transcript: 'text' } };
    const res = createMockRes();

    await extractEntities(req, res);

    expect(mockSupabase.cacheAIContent).toHaveBeenCalledWith(
      't1',
      'entities',
      JSON.stringify(generatedEntities)
    );
    expect(res.body.data.entities).toEqual(generatedEntities);
    expect(res.body.data.cached).toBe(false);
  });
});

// ─── chat ───────────────────────────────────────────────────────────────────

describe('chat', () => {
  it('passes history, message, and transcript to geminiService', async () => {
    mockGemini.chatWithTranscript.mockResolvedValueOnce('Response');

    const req = {
      body: {
        message: 'Hello',
        transcript: 'text',
        history: [{ role: 'user', parts: [{ text: 'prev' }] }],
      },
    };
    const res = createMockRes();

    await chat(req, res);

    expect(mockGemini.chatWithTranscript).toHaveBeenCalledWith(
      req.body.history,
      'Hello',
      'text'
    );
    expect(res.body.data.message).toBe('Response');
  });
});

// ─── generateSpeech ─────────────────────────────────────────────────────────

describe('generateSpeech', () => {
  it('returns audio data from geminiService', async () => {
    const audioData = 'base64-audio-data';
    mockGemini.generateSpeech.mockResolvedValueOnce(audioData);

    const req = { body: { text: 'Speak this' } };
    const res = createMockRes();

    await generateSpeech(req, res);

    expect(mockGemini.generateSpeech).toHaveBeenCalledWith('Speak this');
    expect(res.body.data.audio).toBe(audioData);
    expect(res.body.data.format).toBe('pcm');
  });
});
