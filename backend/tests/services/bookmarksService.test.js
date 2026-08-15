/**
 * Unit Tests — bookmarksService.js
 *
 * Tests all CRUD operations for bookmarks and highlights.
 * Mocks: query (from dbPool), logger.
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
  fetchBookmarksByUser,
  isBookmarked,
  createBookmark,
  deleteBookmark,
  fetchHighlightsByUser,
  createHighlight,
  updateHighlight,
  deleteHighlight,
} = await import('../../src/services/bookmarksService.js');

beforeEach(() => {
  mockQuery.mockReset();
});

// ─── Bookmarks ──────────────────────────────────────────────────────────────

describe('fetchBookmarksByUser', () => {
  it('returns rows from the query', async () => {
    const rows = [{ id: 'b1', transcript_id: 't1', title: 'Talk 1' }];
    mockQuery.mockResolvedValueOnce({ rows });

    const result = await fetchBookmarksByUser('user-1');
    expect(result).toEqual(rows);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('WHERE user_id'), ['user-1']);
  });
});

describe('isBookmarked', () => {
  it('returns true when bookmark exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    expect(await isBookmarked('user-1', 'transcript-1')).toBe(true);
  });

  it('returns false when bookmark does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    expect(await isBookmarked('user-1', 'transcript-1')).toBe(false);
  });
});

describe('createBookmark', () => {
  it('returns the inserted row on new bookmark', async () => {
    const row = { id: 'b1', transcript_id: 't1', title: 'Talk' };
    mockQuery.mockResolvedValueOnce({ rows: [row] });

    const result = await createBookmark('user-1', {
      transcript_id: 't1',
      title: 'Talk',
    });
    expect(result).toEqual(row);
  });

  it('fetches existing row when ON CONFLICT fires (0 rows returned)', async () => {
    // INSERT returns 0 rows (conflict)
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // SELECT for existing row
    const existing = { id: 'b1', transcript_id: 't1', title: 'Talk' };
    mockQuery.mockResolvedValueOnce({ rows: [existing] });

    const result = await createBookmark('user-1', {
      transcript_id: 't1',
      title: 'Talk',
    });
    expect(result).toEqual(existing);
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });
});

describe('deleteBookmark', () => {
  it('returns true when bookmark is deleted', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'b1' }] });
    expect(await deleteBookmark('user-1', 't1')).toBe(true);
  });

  it('returns false when bookmark is not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    expect(await deleteBookmark('user-1', 't-missing')).toBe(false);
  });
});

// ─── Highlights ─────────────────────────────────────────────────────────────

describe('fetchHighlightsByUser', () => {
  it('fetches without transcript filter when transcriptId is null', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await fetchHighlightsByUser('user-1');
    const sql = mockQuery.mock.calls[0][0];
    expect(sql).not.toContain('transcript_id = $2');
  });

  it('includes transcript filter when transcriptId is provided', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await fetchHighlightsByUser('user-1', 'transcript-abc');
    const sql = mockQuery.mock.calls[0][0];
    expect(sql).toContain('transcript_id = $2');
    expect(mockQuery.mock.calls[0][1]).toEqual(['user-1', 'transcript-abc']);
  });
});

describe('createHighlight', () => {
  it('inserts with defaults for optional fields', async () => {
    const row = { id: 'h1', text: 'highlighted text', color: 'default' };
    mockQuery.mockResolvedValueOnce({ rows: [row] });

    const result = await createHighlight('user-1', {
      transcript_id: 't1',
      text: 'highlighted text',
    });
    expect(result).toEqual(row);

    // Check that defaults were passed
    const values = mockQuery.mock.calls[0][1];
    expect(values).toContain('default'); // color default
    expect(values).toContain(false); // is_underline default
  });
});

describe('updateHighlight', () => {
  it('updates note and color when both provided', async () => {
    const row = { id: 'h1', note: 'updated', color: 'yellow' };
    mockQuery.mockResolvedValueOnce({ rows: [row] });

    const result = await updateHighlight('user-1', 'h1', {
      note: 'updated',
      color: 'yellow',
    });
    expect(result).toEqual(row);
    const sql = mockQuery.mock.calls[0][0];
    expect(sql).toContain('note = $1');
    expect(sql).toContain('color = $2');
  });

  it('ignores fields not in allowed list', async () => {
    const row = { id: 'h1', note: 'test' };
    mockQuery.mockResolvedValueOnce({ rows: [row] });

    await updateHighlight('user-1', 'h1', {
      note: 'test',
      hacker_field: 'DROP TABLE',
    });
    const sql = mockQuery.mock.calls[0][0];
    expect(sql).not.toContain('hacker_field');
  });

  it('returns existing row when no allowed fields are provided', async () => {
    const existing = { id: 'h1', note: 'old' };
    mockQuery.mockResolvedValueOnce({ rows: [existing] });

    const result = await updateHighlight('user-1', 'h1', {});
    expect(result).toEqual(existing);
    const sql = mockQuery.mock.calls[0][0];
    expect(sql).toContain('SELECT');
  });

  it('returns null when highlight is not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await updateHighlight('user-1', 'h-missing', { note: 'x' });
    expect(result).toBeNull();
  });
});

describe('deleteHighlight', () => {
  it('returns true when highlight is deleted', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'h1' }] });
    expect(await deleteHighlight('user-1', 'h1')).toBe(true);
  });

  it('returns false when highlight is not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    expect(await deleteHighlight('user-1', 'h-missing')).toBe(false);
  });
});
