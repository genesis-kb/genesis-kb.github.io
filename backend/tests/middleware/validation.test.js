/**
 * Unit Tests — validation.js middleware
 *
 * Tests the validate() middleware function and key validationRules.
 * Uses express-validator in integration: runs validators against mock requests.
 */

import { jest } from '@jest/globals';
import { validationResult } from 'express-validator';
import { validate, validationRules } from '../../src/middleware/validation.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Run a set of express-validator middleware chains against a mock request,
 * then call the validate() middleware to check results.
 */
async function runValidation(rules, reqData) {
  const req = {
    body: reqData.body || {},
    params: reqData.params || {},
    query: reqData.query || {},
    headers: reqData.headers || {},
  };
  const res = {};
  const errors = [];

  // Run each validator middleware
  for (const rule of rules) {
    await rule.run(req);
  }

  // Now run the validate middleware
  const next = jest.fn();
  validate(req, res, next);

  return { req, next };
}

// ─── validate() middleware ──────────────────────────────────────────────────

describe('validate', () => {
  it('calls next() with no args when there are no validation errors', async () => {
    const { next } = await runValidation(validationRules.login, {
      body: { email: 'user@test.com', password: 'password123' },
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(); // no args = success
  });

  it('calls next(error) with 400 VALIDATION_ERROR when errors exist', async () => {
    const { next } = await runValidation(validationRules.login, {
      body: { email: '', password: '' },
    });
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
  });
});

// ─── validationRules.register ───────────────────────────────────────────────

describe('validationRules.register (authRegister)', () => {
  const rules = validationRules.authRegister;

  it('passes with valid email and password', async () => {
    const { next } = await runValidation(rules, {
      body: { email: 'valid@test.com', password: 'password123' },
    });
    // next called without error
    expect(next.mock.calls[0][0]).toBeUndefined();
  });

  it('fails with invalid email format', async () => {
    const { next } = await runValidation(rules, {
      body: { email: 'not-an-email', password: 'password123' },
    });
    const err = next.mock.calls[0][0];
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(400);
    expect(err.message).toContain('email');
  });

  it('fails when password is shorter than 8 chars', async () => {
    const { next } = await runValidation(rules, {
      body: { email: 'user@test.com', password: 'short' },
    });
    const err = next.mock.calls[0][0];
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(400);
  });
});

// ─── validationRules.login ──────────────────────────────────────────────────

describe('validationRules.login (authLogin)', () => {
  const rules = validationRules.authLogin;

  it('fails when email is empty', async () => {
    const { next } = await runValidation(rules, {
      body: { email: '', password: 'password123' },
    });
    const err = next.mock.calls[0][0];
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(400);
  });

  it('fails when password is empty', async () => {
    const { next } = await runValidation(rules, {
      body: { email: 'user@test.com', password: '' },
    });
    const err = next.mock.calls[0][0];
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(400);
  });
});

// ─── validationRules.search ─────────────────────────────────────────────────

describe('validationRules.search', () => {
  const rules = validationRules.search;

  it('fails when query is shorter than 2 chars', async () => {
    const { next } = await runValidation(rules, {
      query: { q: 'a' },
    });
    const err = next.mock.calls[0][0];
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(400);
  });

  it('passes with a valid query', async () => {
    const { next } = await runValidation(rules, {
      query: { q: 'bitcoin lightning' },
    });
    expect(next.mock.calls[0][0]).toBeUndefined();
  });

  it('fails when page is not a positive integer', async () => {
    const { next } = await runValidation(rules, {
      query: { q: 'bitcoin', page: '-1' },
    });
    const err = next.mock.calls[0][0];
    expect(err).toBeDefined();
  });
});

// ─── validationRules.chat ───────────────────────────────────────────────────

describe('validationRules.chat', () => {
  const rules = validationRules.chat;

  it('fails when message is missing', async () => {
    const { next } = await runValidation(rules, {
      body: { transcript: 'x'.repeat(200), transcriptId: '3f2b8c1e-4d5a-4b6c-8e9f-0a1b2c3d4e5f' },
    });
    const err = next.mock.calls[0][0];
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(400);
  });

  it('fails when transcript is shorter than 100 chars', async () => {
    const { next } = await runValidation(rules, {
      body: { message: 'Hello', transcript: 'short', transcriptId: '3f2b8c1e-4d5a-4b6c-8e9f-0a1b2c3d4e5f' },
    });
    const err = next.mock.calls[0][0];
    expect(err).toBeDefined();
  });

  it('fails when transcriptId is missing', async () => {
    const { next } = await runValidation(rules, {
      body: { message: 'Hello', transcript: 'x'.repeat(200) },
    });
    expect(next.mock.calls[0][0]).toBeDefined();
  });

  it('fails when transcriptId is not a UUID', async () => {
    const { next } = await runValidation(rules, {
      body: { message: 'Hello', transcript: 'x'.repeat(200), transcriptId: 'not-a-uuid' },
    });
    expect(next.mock.calls[0][0]).toBeDefined();
  });

  it('passes with valid message, long transcript and transcriptId', async () => {
    const { next } = await runValidation(rules, {
      body: { message: 'Explain this', transcript: 'x'.repeat(200), transcriptId: '3f2b8c1e-4d5a-4b6c-8e9f-0a1b2c3d4e5f' },
    });
    expect(next.mock.calls[0][0]).toBeUndefined();
  });
});

// ─── validationRules.chatHistory ────────────────────────────────────────────

describe('validationRules.chatHistory', () => {
  const rules = validationRules.chatHistory;

  it('passes with a UUID transcriptId param', async () => {
    const { next } = await runValidation(rules, { params: { transcriptId: '3f2b8c1e-4d5a-4b6c-8e9f-0a1b2c3d4e5f' } });
    expect(next.mock.calls[0][0]).toBeUndefined();
  });

  it('fails with a non-UUID transcriptId param', async () => {
    const { next } = await runValidation(rules, { params: { transcriptId: 'abc' } });
    expect(next.mock.calls[0][0]).toBeDefined();
  });
});

// ─── validationRules.ttsAudio / ttsGenerate ─────────────────────────────────

describe('validationRules.ttsAudio', () => {
  const rules = validationRules.ttsAudio;
  const params = { transcriptId: '3f2b8c1e-4d5a-4b6c-8e9f-0a1b2c3d4e5f' };

  it.each(['transcript', 'summary'])('passes with source "%s"', async (source) => {
    const { next } = await runValidation(rules, { params, query: { source } });
    expect(next.mock.calls[0][0]).toBeUndefined();
  });

  it('fails without a source', async () => {
    const { next } = await runValidation(rules, { params });
    expect(next.mock.calls[0][0]).toBeDefined();
  });

  it('fails with a non-UUID transcriptId param', async () => {
    const { next } = await runValidation(rules, { params: { transcriptId: 'abc' }, query: { source: 'summary' } });
    expect(next.mock.calls[0][0]).toBeDefined();
  });
});

describe('validationRules.ttsGenerate', () => {
  const rules = validationRules.ttsGenerate;
  const params = { transcriptId: '3f2b8c1e-4d5a-4b6c-8e9f-0a1b2c3d4e5f' };

  it('passes with a known source in the body', async () => {
    const { next } = await runValidation(rules, { params, body: { source: 'summary' } });
    expect(next.mock.calls[0][0]).toBeUndefined();
  });

  it('fails with an unknown source', async () => {
    const { next } = await runValidation(rules, { params, body: { source: 'arbitrary text' } });
    expect(next.mock.calls[0][0]).toBeDefined();
  });
});
