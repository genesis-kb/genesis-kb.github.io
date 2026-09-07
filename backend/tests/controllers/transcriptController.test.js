/**
 * Unit Tests — transcriptController.js
 *
 * Tests validation, pagination logic, and missing data handling.
 * Mocks: dbPool (query).
 */

import { jest } from '@jest/globals';

const mockQuery = jest.fn();
jest.unstable_mockModule('../../src/services/dbPool.js', () => ({
  query: mockQuery,
}));

jest.unstable_mockModule('../../src/config/logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const {
  getConferences,
  getTranscriptById,
  searchTranscripts,
  getConferenceSummary,
} = await import('../../src/controllers/transcriptController.js');

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { res.statusCode = code; return res; },
    json(data) { res.body = data; return res; },
  };
  return res;
}

beforeEach(() => {
  mockQuery.mockReset();
});

// ─── getConferences ─────────────────────────────────────────────────────────

describe('getConferences', () => {
  it('returns 200 with empty array when DB is empty', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const req = {};
    const res = createMockRes();

    await getConferences(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

// ─── getTranscriptById ──────────────────────────────────────────────────────

describe('getTranscriptById', () => {
  it('throws 404 when transcript is not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // not found

    const req = { params: { id: 'missing' } };
    const res = createMockRes();

    try {
      await getTranscriptById(req, res);
      throw new Error('Expected to throw');
    } catch (err) {
      expect(err.statusCode).toBe(404);
      expect(err.code).toBe('NOT_FOUND');
    }
  });

  it('returns 200 with transcript data when found', async () => {
    const row = { id: 't1', title: 'Talk' };
    mockQuery.mockResolvedValueOnce({ rows: [row] }); // transcript
    mockQuery.mockResolvedValueOnce({ rows: [] });    // chunks (empty for now)

    const req = { params: { id: 't1' } };
    const res = createMockRes();

    await getTranscriptById(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toMatchObject(row);
  });
});

// ─── searchTranscripts ──────────────────────────────────────────────────────

describe('searchTranscripts', () => {
  it('calculates pagination correctly (hasNext, hasPrev)', async () => {
    const items = Array.from({ length: 20 }, (_, i) => ({ id: `t${i}` }));
    // Return 20 items for searchResult (First call in Promise.all)
    mockQuery.mockResolvedValueOnce({ rows: items });
    // Return total count 50 for countResult (Second call in Promise.all)
    mockQuery.mockResolvedValueOnce({ rows: [{ total: '50' }] });

    // page 1, limit 20
    const req = { query: { q: 'bitcoin', page: '1', limit: '20' } };
    const res = createMockRes();

    await searchTranscripts(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 50,
      totalPages: 3, // ceil(50/20)
      hasNext: true,
      hasPrev: false,
    });
  });
});

// ─── getConferenceSummary ───────────────────────────────────────────────────

describe('getConferenceSummary', () => {
  it('clamps limit to maximum of 1000', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    
    // Request with limit 5000
    const req = { query: { limit: '5000' } };
    const res = createMockRes();
    res.set = jest.fn(); // mock res.set

    await getConferenceSummary(req, res);

    // SQL should contain LIMIT 1000, not 5000
    const sql = mockQuery.mock.calls[0][0];
    const values = mockQuery.mock.calls[0][1];
    
    // Limit is passed as parameter $1 (or similar), let's check values array
    // Based on controller, limit is $1, offset is $2
    expect(values[0]).toBe(1000); 
  });
});
