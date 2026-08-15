/**
 * Unit Tests — bookmarksController.js
 *
 * Tests controller validation logic and response formatting.
 * Mocks: bookmarksService.
 */

import { jest } from '@jest/globals';

const mockBookmarksService = {
  fetchBookmarksByUser: jest.fn(),
  createBookmark: jest.fn(),
  deleteBookmark: jest.fn(),
  fetchHighlightsByUser: jest.fn(),
  createHighlight: jest.fn(),
  updateHighlight: jest.fn(),
  deleteHighlight: jest.fn(),
};

jest.unstable_mockModule('../../src/services/bookmarksService.js', () => mockBookmarksService);

jest.unstable_mockModule('../../src/config/logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const {
  getBookmarks,
  createBookmark,
  deleteBookmark,
  getHighlights,
  createHighlight,
  updateHighlight,
  deleteHighlight,
} = await import('../../src/controllers/bookmarksController.js');

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
  jest.clearAllMocks();
});

// ─── Bookmarks ──────────────────────────────────────────────────────────────

describe('createBookmark', () => {
  it('calls next with 400 when transcript_id is missing', async () => {
    const req = { user: { id: 'u1' }, body: { title: 'Talk' } };
    const res = createMockRes();
    const next = jest.fn();

    await createBookmark(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    }));
  });

  it('calls next with 400 when title is missing', async () => {
    const req = { user: { id: 'u1' }, body: { transcript_id: 't1' } };
    const res = createMockRes();
    const next = jest.fn();

    await createBookmark(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 400,
    }));
  });

  it('calls next with 400 when title is blank', async () => {
    const req = { user: { id: 'u1' }, body: { transcript_id: 't1', title: '   ' } };
    const res = createMockRes();
    const next = jest.fn();

    await createBookmark(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 400,
    }));
  });

  it('returns 201 on success', async () => {
    const bookmark = { id: 'b1', transcript_id: 't1', title: 'Talk' };
    mockBookmarksService.createBookmark.mockResolvedValueOnce(bookmark);

    const req = { user: { id: 'u1' }, body: { transcript_id: 't1', title: 'Talk' } };
    const res = createMockRes();
    const next = jest.fn();

    await createBookmark(req, res, next);
    expect(res.statusCode).toBe(201);
    expect(res.body.data).toEqual(bookmark);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('deleteBookmark', () => {
  it('calls next with 404 when bookmark not found', async () => {
    mockBookmarksService.deleteBookmark.mockResolvedValueOnce(false);

    const req = { user: { id: 'u1' }, params: { transcript_id: 't-missing' } };
    const res = createMockRes();
    const next = jest.fn();

    await deleteBookmark(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 404,
    }));
  });

  it('returns 200 with deleted: true on success', async () => {
    mockBookmarksService.deleteBookmark.mockResolvedValueOnce(true);

    const req = { user: { id: 'u1' }, params: { transcript_id: 't1' } };
    const res = createMockRes();
    const next = jest.fn();

    await deleteBookmark(req, res, next);
    expect(res.body.data.deleted).toBe(true);
    expect(next).not.toHaveBeenCalled();
  });
});

// ─── Highlights ─────────────────────────────────────────────────────────────

describe('createHighlight', () => {
  it('calls next with 400 when text is missing', async () => {
    const req = { user: { id: 'u1' }, body: { transcript_id: 't1' } };
    const res = createMockRes();
    const next = jest.fn();

    await createHighlight(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 400,
    }));
  });

  it('truncates text longer than 500 chars', async () => {
    const longText = 'x'.repeat(600);
    const highlight = { id: 'h1', text: longText.slice(0, 500) + '...' };
    mockBookmarksService.createHighlight.mockResolvedValueOnce(highlight);

    const req = {
      user: { id: 'u1' },
      body: { transcript_id: 't1', text: longText },
    };
    const res = createMockRes();
    const next = jest.fn();

    await createHighlight(req, res, next);

    // Verify that req.body.text was truncated before passing to service
    expect(req.body.text).toBe(longText.slice(0, 500) + '...');
    expect(res.statusCode).toBe(201);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('updateHighlight', () => {
  it('calls next with 400 for invalid UUID format', async () => {
    const req = { user: { id: 'u1' }, params: { id: 'not-a-uuid' }, body: { note: 'x' } };
    const res = createMockRes();
    const next = jest.fn();

    await updateHighlight(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    }));
  });

  it('calls next with 404 when highlight not found', async () => {
    mockBookmarksService.updateHighlight.mockResolvedValueOnce(null);

    const req = {
      user: { id: 'u1' },
      params: { id: '00000000-0000-0000-0000-000000000000' },
      body: { note: 'updated' },
    };
    const res = createMockRes();
    const next = jest.fn();

    await updateHighlight(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 404,
    }));
  });
});

describe('deleteHighlight', () => {
  it('calls next with 400 for invalid UUID format', async () => {
    const req = { user: { id: 'u1' }, params: { id: 'bad' } };
    const res = createMockRes();
    const next = jest.fn();

    await deleteHighlight(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 400,
    }));
  });

  it('calls next with 404 when highlight not found', async () => {
    mockBookmarksService.deleteHighlight.mockResolvedValueOnce(false);

    const req = {
      user: { id: 'u1' },
      params: { id: '00000000-0000-0000-0000-000000000000' },
    };
    const res = createMockRes();
    const next = jest.fn();

    await deleteHighlight(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 404,
    }));
  });
});
