/**
 * Unit Tests — responseHelper.js
 *
 * Tests all response utility functions with mock Express res objects.
 */

import {
  sendSuccess,
  sendCreated,
  sendNoContent,
  sendPaginated,
} from '../../src/utils/responseHelper.js';

/**
 * Create a mock Express response object.
 */
function createMockRes() {
  const res = {
    statusCode: null,
    body: null,
    _sent: false,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(data) {
      res.body = data;
      return res;
    },
    send(data) {
      res._sent = true;
      res.body = data;
      return res;
    },
  };
  return res;
}

// ─── sendSuccess ────────────────────────────────────────────────────────────

describe('sendSuccess', () => {
  it('sends 200 by default', () => {
    const res = createMockRes();
    sendSuccess(res, { foo: 'bar' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, data: { foo: 'bar' } });
  });

  it('sends a custom status code', () => {
    const res = createMockRes();
    sendSuccess(res, 'ok', null, 202);
    expect(res.statusCode).toBe(202);
  });

  it('includes message when provided', () => {
    const res = createMockRes();
    sendSuccess(res, [], 'Found items');
    expect(res.body.message).toBe('Found items');
  });

  it('omits message when not provided', () => {
    const res = createMockRes();
    sendSuccess(res, []);
    expect(res.body).not.toHaveProperty('message');
  });
});

// ─── sendCreated ────────────────────────────────────────────────────────────

describe('sendCreated', () => {
  it('sends 201 status', () => {
    const res = createMockRes();
    sendCreated(res, { id: 1 });
    expect(res.statusCode).toBe(201);
  });

  it('includes default message', () => {
    const res = createMockRes();
    sendCreated(res, { id: 1 });
    expect(res.body.message).toBe('Resource created successfully');
  });

  it('uses custom message when provided', () => {
    const res = createMockRes();
    sendCreated(res, { id: 1 }, 'User created');
    expect(res.body.message).toBe('User created');
  });
});

// ─── sendNoContent ──────────────────────────────────────────────────────────

describe('sendNoContent', () => {
  it('sends 204 status', () => {
    const res = createMockRes();
    sendNoContent(res);
    expect(res.statusCode).toBe(204);
    expect(res._sent).toBe(true);
  });
});

// ─── sendPaginated ──────────────────────────────────────────────────────────

describe('sendPaginated', () => {
  it('calculates totalPages correctly', () => {
    const res = createMockRes();
    sendPaginated(res, [1, 2, 3], { page: 1, limit: 3, total: 10 });
    expect(res.body.pagination.totalPages).toBe(4); // ceil(10/3) = 4
  });

  it('sets hasNext to true on first page with more data', () => {
    const res = createMockRes();
    sendPaginated(res, [1, 2], { page: 1, limit: 2, total: 5 });
    expect(res.body.pagination.hasNext).toBe(true);
    expect(res.body.pagination.hasPrev).toBe(false);
  });

  it('sets hasPrev to true on page 2+', () => {
    const res = createMockRes();
    sendPaginated(res, [3, 4], { page: 2, limit: 2, total: 5 });
    expect(res.body.pagination.hasPrev).toBe(true);
  });

  it('sets hasNext to false on last page', () => {
    const res = createMockRes();
    sendPaginated(res, [5], { page: 3, limit: 2, total: 5 });
    expect(res.body.pagination.hasNext).toBe(false);
  });

  it('handles total=0 edge case', () => {
    const res = createMockRes();
    sendPaginated(res, [], { page: 1, limit: 10, total: 0 });
    expect(res.body.pagination.totalPages).toBe(0);
    expect(res.body.pagination.hasNext).toBe(false);
    expect(res.body.pagination.hasPrev).toBe(false);
  });

  it('includes success: true and data in response', () => {
    const res = createMockRes();
    sendPaginated(res, ['a', 'b'], { page: 1, limit: 2, total: 2 });
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(['a', 'b']);
  });
});
