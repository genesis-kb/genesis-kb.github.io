/**
 * Route Tests — aiRoutes.js
 *
 * Mounts the real AI router with the real auth, AI-gate, rate-limit and
 * validation middleware, and checks who gets through.
 * Mocks: aiService, chatService, supabaseService, logger.
 * AI is disabled through the environment (AI_PROVIDER=none).
 */

import { jest } from '@jest/globals';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';

// Set before config is imported; dotenv never overrides variables that exist.
// Restored in afterAll so later test files in this worker see the original env.
const originalEnv = { ...process.env };
process.env.JWT_SECRET = 'route-test-secret-at-least-32-characters';
process.env.AI_PROVIDER = 'none';

const mockChat = {
  getMessages: jest.fn(async () => []),
  appendExchange: jest.fn(),
  clearConversation: jest.fn(async () => true),
};

jest.unstable_mockModule('../../src/services/chatService.js', () => mockChat);
jest.unstable_mockModule('../../src/services/aiService.js', () => ({
  generateSummary: jest.fn(),
  chatWithTranscript: jest.fn(),
  generateSpeech: jest.fn(),
  extractEntities: jest.fn(),
  healthCheck: jest.fn(),
}));
jest.unstable_mockModule('../../src/services/supabaseService.js', () => ({
  fetchTranscriptById: jest.fn(),
  getCachedAIContent: jest.fn(),
  cacheAIContent: jest.fn(),
}));
jest.unstable_mockModule('../../src/config/logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const { default: config } = await import('../../src/config/index.js');
const { default: aiRoutes } = await import('../../src/routes/aiRoutes.js');
const { errorHandler } = await import('../../src/middleware/errorHandler.js');

const app = express();
app.use(express.json());
app.use('/api/v1/ai', aiRoutes);
app.use(errorHandler);

const TRANSCRIPT_ID = '3f2b8c1e-4d5a-4b6c-8e9f-0a1b2c3d4e5f';
const USER_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

// Same claims authService signs.
const token = jwt.sign({ sub: USER_ID, email: 'user@test.com' }, config.auth.jwtSecret, {
  expiresIn: '5m',
});
const auth = { Authorization: `Bearer ${token}` };

beforeEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  process.env = originalEnv;
});

describe('authentication', () => {
  it.each([
    ['post', '/api/v1/ai/chat'],
    ['get', `/api/v1/ai/chat/${TRANSCRIPT_ID}`],
    ['delete', `/api/v1/ai/chat/${TRANSCRIPT_ID}`],
    ['post', '/api/v1/ai/tts'],
    ['post', '/api/v1/ai/entities'],
  ])('%s %s answers 401 without a token', async (method, path) => {
    const res = await request(app)[method](path).send({});

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('saved chat with AI disabled', () => {
  it('confirms AI is disabled for these tests', () => {
    expect(config.ai.enabled).toBe(false);
  });

  it('GET /chat/:transcriptId returns the saved chat, not 503', async () => {
    const res = await request(app).get(`/api/v1/ai/chat/${TRANSCRIPT_ID}`).set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data.messages).toEqual([]);
    expect(mockChat.getMessages).toHaveBeenCalledWith(USER_ID, TRANSCRIPT_ID, { limit: 200 });
  });

  it('DELETE /chat/:transcriptId clears the saved chat, not 503', async () => {
    const res = await request(app).delete(`/api/v1/ai/chat/${TRANSCRIPT_ID}`).set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data.cleared).toBe(true);
    expect(mockChat.clearConversation).toHaveBeenCalledWith(USER_ID, TRANSCRIPT_ID);
  });

  it('POST /chat still answers 503 AI_NOT_CONFIGURED', async () => {
    const res = await request(app)
      .post('/api/v1/ai/chat')
      .set(auth)
      .send({ message: 'Hi', transcript: 'x'.repeat(200), transcriptId: TRANSCRIPT_ID });

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('AI_NOT_CONFIGURED');
  });

  it('GET /chat/:transcriptId rejects a non-UUID id with 400', async () => {
    const res = await request(app).get('/api/v1/ai/chat/not-a-uuid').set(auth);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
