/**
 * Unit Tests — notesService.js
 *
 * Tests all CRUD operations for notes.
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
  fetchNotesByUser,
  fetchNotesByTranscript,
  fetchNoteById,
  createNote,
  updateNote,
  deleteNote,
} = await import('../../src/services/notesService.js');

beforeEach(() => {
  mockQuery.mockReset();
});

// ─── fetchNotesByUser ───────────────────────────────────────────────────────

describe('fetchNotesByUser', () => {
  it('returns rows sorted pinned-first, then by updated_at desc', async () => {
    const rows = [
      { id: 'n1', pinned: true, title: 'Pinned' },
      { id: 'n2', pinned: false, title: 'Regular' },
    ];
    mockQuery.mockResolvedValueOnce({ rows });

    const result = await fetchNotesByUser('user-1');
    expect(result).toEqual(rows);
    const sql = mockQuery.mock.calls[0][0];
    expect(sql).toContain('ORDER BY pinned DESC, updated_at DESC');
  });
});

// ─── fetchNotesByTranscript ─────────────────────────────────────────────────

describe('fetchNotesByTranscript', () => {
  it('filters by both userId and transcriptId', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await fetchNotesByTranscript('user-1', 'transcript-abc');

    expect(mockQuery.mock.calls[0][1]).toEqual(['user-1', 'transcript-abc']);
    const sql = mockQuery.mock.calls[0][0];
    expect(sql).toContain('user_id = $1');
    expect(sql).toContain('transcript_id = $2');
  });
});

// ─── fetchNoteById ──────────────────────────────────────────────────────────

describe('fetchNoteById', () => {
  it('returns note row when found', async () => {
    const note = { id: 'n1', title: 'My Note' };
    mockQuery.mockResolvedValueOnce({ rows: [note] });

    const result = await fetchNoteById('user-1', 'n1');
    expect(result).toEqual(note);
  });

  it('returns null when not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await fetchNoteById('user-1', 'nonexistent');
    expect(result).toBeNull();
  });
});

// ─── createNote ─────────────────────────────────────────────────────────────

describe('createNote', () => {
  it('inserts note with default values for optional fields', async () => {
    const row = { id: 'n1', title: 'Untitled Note', pinned: false };
    mockQuery.mockResolvedValueOnce({ rows: [row] });

    const result = await createNote('user-1', {
      transcript_id: 't1',
      content: 'Some content',
    });
    expect(result).toEqual(row);

    // Check defaults passed to query
    const values = mockQuery.mock.calls[0][1];
    expect(values).toContain('Untitled Note'); // default title
    expect(values).toContain(false); // pinned default
    expect(values).toContain('{}'); // tags default
  });

  it('uses provided title when given', async () => {
    const row = { id: 'n1', title: 'Custom Title' };
    mockQuery.mockResolvedValueOnce({ rows: [row] });

    await createNote('user-1', {
      transcript_id: 't1',
      content: 'Content',
      title: 'Custom Title',
    });

    const values = mockQuery.mock.calls[0][1];
    expect(values).toContain('Custom Title');
  });
});

// ─── updateNote ─────────────────────────────────────────────────────────────

describe('updateNote', () => {
  it('builds SET clause for a single field', async () => {
    const row = { id: 'n1', title: 'Updated' };
    mockQuery.mockResolvedValueOnce({ rows: [row] });

    await updateNote('user-1', 'n1', { title: 'Updated' });

    const sql = mockQuery.mock.calls[0][0];
    expect(sql).toContain('SET title = $1');
    expect(sql).toContain('updated_at = NOW()');
  });

  it('builds SET clause for multiple fields', async () => {
    const row = { id: 'n1', title: 'T', content: 'C' };
    mockQuery.mockResolvedValueOnce({ rows: [row] });

    await updateNote('user-1', 'n1', { title: 'T', content: 'C' });

    const sql = mockQuery.mock.calls[0][0];
    expect(sql).toContain('title = $1');
    expect(sql).toContain('content = $2');
  });

  it('delegates to fetchNoteById when no allowed fields provided', async () => {
    const existing = { id: 'n1', title: 'Existing' };
    mockQuery.mockResolvedValueOnce({ rows: [existing] });

    const result = await updateNote('user-1', 'n1', {});
    expect(result).toEqual(existing);

    // Should be a SELECT, not an UPDATE
    const sql = mockQuery.mock.calls[0][0];
    expect(sql).toContain('SELECT');
    expect(sql).not.toContain('UPDATE');
  });

  it('returns null when note is not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await updateNote('user-1', 'n-missing', { title: 'X' });
    expect(result).toBeNull();
  });
});

// ─── deleteNote ─────────────────────────────────────────────────────────────

describe('deleteNote', () => {
  it('returns true when note is deleted', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'n1' }] });
    expect(await deleteNote('user-1', 'n1')).toBe(true);
  });

  it('returns false when note is not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    expect(await deleteNote('user-1', 'n-missing')).toBe(false);
  });
});
