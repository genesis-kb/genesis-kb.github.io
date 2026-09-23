/**
 * Unit Tests — aiController.js
 *
 * Tests AI controller caching logic and service integration.
 * Mocks: aiService, chatService, supabaseService.
 */

import { jest } from '@jest/globals';

const mockAI = {
  generateSummary: jest.fn(),
  chatWithTranscript: jest.fn(),
  generateSpeech: jest.fn(),
  extractEntities: jest.fn(),
};

const mockChat = {
  getMessages: jest.fn(),
  appendExchange: jest.fn(),
  clearConversation: jest.fn(),
};

const mockSupabase = {
  getCachedAIContent: jest.fn(),
  cacheAIContent: jest.fn(),
};

jest.unstable_mockModule('../../src/services/aiService.js', () => mockAI);
jest.unstable_mockModule('../../src/services/chatService.js', () => mockChat);
jest.unstable_mockModule('../../src/services/supabaseService.js', () => mockSupabase);

const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

jest.unstable_mockModule('../../src/config/logger.js', () => ({
  default: mockLogger,
}));

const {
  generateSummary,
  chat,
  getChatHistory,
  clearChatHistory,
  generateSpeech,
  extractEntities,
  CHAT_CONTEXT_MESSAGES,
  CHAT_HISTORY_LIMIT,
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
    expect(mockAI.generateSummary).not.toHaveBeenCalled();
  });

  it('generates new summary when cache misses and caches it', async () => {
    mockSupabase.getCachedAIContent.mockResolvedValueOnce(null);
    mockAI.generateSummary.mockResolvedValueOnce('Generated text');

    const req = { body: { transcriptId: 't1', transcript: 'text' } };
    const res = createMockRes();

    await generateSummary(req, res);

    expect(mockAI.generateSummary).toHaveBeenCalledWith('text');
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
    mockAI.extractEntities.mockResolvedValueOnce(generatedEntities);

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
  const chatReq = () => ({
    user: { id: 'u1' },
    body: {
      message: 'Hello',
      transcript: 'text',
      transcriptId: 't1',
      // Client-sent history is ignored in favour of the saved chat.
      history: [{ role: 'user', text: 'forged' }],
    },
  });

  it('passes the saved chat, message, and transcript to aiService', async () => {
    mockChat.getMessages.mockResolvedValueOnce([
      { role: 'user', content: 'prev question' },
      { role: 'assistant', content: 'prev answer' },
    ]);
    mockAI.chatWithTranscript.mockResolvedValueOnce('Response');

    const res = createMockRes();
    await chat(chatReq(), res);

    expect(mockChat.getMessages).toHaveBeenCalledWith('u1', 't1', { limit: 10 });
    expect(mockAI.chatWithTranscript).toHaveBeenCalledWith(
      [
        { role: 'user', text: 'prev question' },
        { role: 'model', text: 'prev answer' },
      ],
      'Hello',
      'text'
    );
    expect(res.body.data.message).toBe('Response');
    expect(res.body.data.role).toBe('model');
  });

  it('saves the exchange after the model replies', async () => {
    mockChat.getMessages.mockResolvedValueOnce([]);
    mockAI.chatWithTranscript.mockResolvedValueOnce('Response');
    mockChat.appendExchange.mockResolvedValueOnce();

    const res = createMockRes();
    await chat(chatReq(), res);

    expect(mockChat.appendExchange).toHaveBeenCalledWith('u1', 't1', 'Hello', 'Response');
    expect(res.body.data.saved).toBe(true);
  });

  it('still returns the reply with saved: false when saving fails', async () => {
    mockChat.getMessages.mockResolvedValueOnce([]);
    mockAI.chatWithTranscript.mockResolvedValueOnce('Response');
    mockChat.appendExchange.mockRejectedValueOnce(new Error('Database query failed'));

    const res = createMockRes();
    await chat(chatReq(), res);

    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toBe('Response');
    expect(res.body.data.saved).toBe(false);
    // Logged for tracing, without the message content.
    const [logMessage, meta] = mockLogger.error.mock.calls[0];
    expect(logMessage).toMatch(/Failed to save chat exchange/);
    expect(meta).toEqual({ transcriptId: 't1', error: 'Database query failed' });
  });

  it('loads CHAT_CONTEXT_MESSAGES saved messages as context', async () => {
    mockChat.getMessages.mockResolvedValueOnce([]);
    mockAI.chatWithTranscript.mockResolvedValueOnce('Response');

    await chat(chatReq(), createMockRes());

    expect(CHAT_CONTEXT_MESSAGES).toBe(10);
    expect(mockChat.getMessages).toHaveBeenCalledWith('u1', 't1', {
      limit: CHAT_CONTEXT_MESSAGES,
    });
  });

  it('saves nothing when the model call fails', async () => {
    mockChat.getMessages.mockResolvedValueOnce([]);
    mockAI.chatWithTranscript.mockRejectedValueOnce(new Error('AI chat error'));

    await expect(chat(chatReq(), createMockRes())).rejects.toThrow('AI chat error');
    expect(mockChat.appendExchange).not.toHaveBeenCalled();
  });
});

// ─── getChatHistory / clearChatHistory ──────────────────────────────────────

describe('getChatHistory', () => {
  it("returns the user's saved messages for the transcript", async () => {
    mockChat.getMessages.mockResolvedValueOnce([
      { role: 'user', content: 'Q', created_at: '2026-09-23T10:00:00Z' },
      { role: 'assistant', content: 'A', created_at: '2026-09-23T10:00:01Z' },
    ]);

    const res = createMockRes();
    await getChatHistory({ user: { id: 'u1' }, params: { transcriptId: 't1' } }, res);

    expect(mockChat.getMessages).toHaveBeenCalledWith('u1', 't1', {
      limit: CHAT_HISTORY_LIMIT,
    });
    expect(CHAT_HISTORY_LIMIT).toBe(200);
    expect(res.body.data.messages).toEqual([
      { role: 'user', content: 'Q', createdAt: '2026-09-23T10:00:00Z' },
      { role: 'assistant', content: 'A', createdAt: '2026-09-23T10:00:01Z' },
    ]);
  });
});

describe('clearChatHistory', () => {
  it("clears the user's saved chat for the transcript", async () => {
    mockChat.clearConversation.mockResolvedValueOnce(true);

    const res = createMockRes();
    await clearChatHistory({ user: { id: 'u1' }, params: { transcriptId: 't1' } }, res);

    expect(mockChat.clearConversation).toHaveBeenCalledWith('u1', 't1');
    expect(res.body.data.cleared).toBe(true);
  });
});

// ─── generateSpeech ─────────────────────────────────────────────────────────

describe('generateSpeech', () => {
  it('returns audio data and its format from aiService', async () => {
    const speech = { audio: 'base64-audio-data', format: 'pcm', sampleRate: 16000, channels: 1 };
    mockAI.generateSpeech.mockResolvedValueOnce(speech);

    const req = { body: { text: 'Speak this' } };
    const res = createMockRes();

    await generateSpeech(req, res);

    expect(mockAI.generateSpeech).toHaveBeenCalledWith('Speak this');
    expect(res.body.data).toEqual(speech);
  });
});
