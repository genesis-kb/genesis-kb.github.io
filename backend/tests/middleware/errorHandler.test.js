/**
 * Unit Tests — errorHandler.js middleware
 *
 * Tests APIError class, notFoundHandler, errorHandler, and asyncHandler.
 */

import { jest } from '@jest/globals';
import {
  APIError,
  notFoundHandler,
  errorHandler,
  asyncHandler,
} from '../../src/middleware/errorHandler.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function createMockReq(overrides = {}) {
  return { method: 'GET', path: '/test', originalUrl: '/api/v1/test', ...overrides };
}

function createMockRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(data) {
      res.body = data;
      return res;
    },
  };
  return res;
}

// ─── APIError ───────────────────────────────────────────────────────────────

describe('APIError', () => {
  it('sets message, statusCode, code, and isOperational', () => {
    const err = new APIError('Something went wrong', 400, 'BAD_REQUEST');
    expect(err.message).toBe('Something went wrong');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
    expect(err.isOperational).toBe(true);
  });

  it('defaults to 500 and INTERNAL_ERROR', () => {
    const err = new APIError('Oops');
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('INTERNAL_ERROR');
  });

  it('is an instance of Error', () => {
    const err = new APIError('test');
    expect(err).toBeInstanceOf(Error);
  });

  it('has a stack trace', () => {
    const err = new APIError('test');
    expect(err.stack).toBeDefined();
  });
});

// ─── notFoundHandler ────────────────────────────────────────────────────────

describe('notFoundHandler', () => {
  it('calls next with a 404 APIError', () => {
    const req = createMockReq({ method: 'GET', originalUrl: '/api/v1/missing' });
    const next = jest.fn();

    notFoundHandler(req, createMockRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(APIError);
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toContain('GET');
    expect(err.message).toContain('/api/v1/missing');
  });
});

// ─── errorHandler ───────────────────────────────────────────────────────────

describe('errorHandler', () => {
  it('handles ValidationError → 400', () => {
    const err = new Error('Validation failed');
    err.name = 'ValidationError';

    const res = createMockRes();
    errorHandler(err, createMockReq(), res, jest.fn());

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('handles JsonWebTokenError → 401', () => {
    const err = new Error('jwt malformed');
    err.name = 'JsonWebTokenError';

    const res = createMockRes();
    errorHandler(err, createMockReq(), res, jest.fn());

    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
    expect(res.body.error.message).toBe('Invalid token');
  });

  it('handles ECONNREFUSED → 503', () => {
    const err = new Error('connect ECONNREFUSED');
    err.code = 'ECONNREFUSED';

    const res = createMockRes();
    errorHandler(err, createMockReq(), res, jest.fn());

    expect(res.statusCode).toBe(503);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('handles entity.parse.failed → 400 INVALID_JSON', () => {
    const err = new Error('entity parse failed');
    err.type = 'entity.parse.failed';

    const res = createMockRes();
    errorHandler(err, createMockReq(), res, jest.fn());

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('handles fetch-related error → 502', () => {
    const err = new Error('fetch failed for external service');

    const res = createMockRes();
    errorHandler(err, createMockReq(), res, jest.fn());

    expect(res.statusCode).toBe(502);
    expect(res.body.error.code).toBe('EXTERNAL_SERVICE_ERROR');
  });

  it('handles API key error → 500 CONFIG_ERROR', () => {
    const err = new Error('API key is invalid');

    const res = createMockRes();
    errorHandler(err, createMockReq(), res, jest.fn());

    expect(res.statusCode).toBe(500);
    expect(res.body.error.code).toBe('CONFIG_ERROR');
  });

  it('uses APIError statusCode and code when provided', () => {
    const err = new APIError('Not found', 404, 'NOT_FOUND');

    const res = createMockRes();
    errorHandler(err, createMockReq(), res, jest.fn());

    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('defaults unknown errors to 500', () => {
    const err = new Error('Something random');

    const res = createMockRes();
    errorHandler(err, createMockReq(), res, jest.fn());

    expect(res.statusCode).toBe(500);
  });

  it('response always has success: false', () => {
    const err = new APIError('test', 400);
    const res = createMockRes();
    errorHandler(err, createMockReq(), res, jest.fn());

    expect(res.body.success).toBe(false);
  });
});

// ─── asyncHandler ───────────────────────────────────────────────────────────

describe('asyncHandler', () => {
  it('calls next(err) when the async function rejects', async () => {
    const next = jest.fn();
    const error = new Error('async failure');
    const handler = asyncHandler(async () => {
      throw error;
    });

    await handler({}, {}, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  it('does not call next when the async function resolves', async () => {
    const next = jest.fn();
    const handler = asyncHandler(async (req, res) => {
      // success — no throw
    });

    await handler({}, {}, next);

    expect(next).not.toHaveBeenCalled();
  });
});
