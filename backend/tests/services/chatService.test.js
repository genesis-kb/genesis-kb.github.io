/**
 * Unit Tests — chatService.js
 *
 * Tests saved-chat reads, the exchange transaction, and clearing.
 * Mocks: dbPool (query + pooled client), logger.
 */

import { jest } from '@jest/globals';

const mockQuery = jest.fn();
const mockClient = { query: jest.fn(), release: jest.fn() };
const mockPool = { connect: jest.fn(async () => mockClient) };
const mockGetPool = jest.fn(() => mockPool);

jest.unstable_mockModule('../../src/services/dbPool.js', () => ({
  query: mockQuery,
  getPool: mockGetPool,
}));
jest.unstable_mockModule('../../src/config/logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const { getMessages, appendExchange, clearConversation } = await import(
  '../../src/services/chatService.js'
);

/** SQL text of every statement sent on the pooled client, in order. */
const clientStatements = () => mockClient.query.mock.calls.map(([sql]) => sql.trim());

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── getMessages ────────────────────────────────────────────────────────────

describe('getMessages', () => {
  it('returns messages oldest first', async () => {
    // The query selects newest first so LIMIT keeps the latest messages.
    mockQuery.mockResolvedValueOnce({
      rows: [
        { role: 'assistant', content: 'A2' },
        { role: 'user', content: 'Q2' },
        { role: 'assistant', content: 'A1' },
      ],
    });

    const messages = await getMessages('u1', 't1');

    expect(messages.map((m) => m.content)).toEqual(['A1', 'Q2', 'A2']);
    expect(mockQuery.mock.calls[0][1]).toEqual(['u1', 't1']);
    expect(mockQuery.mock.calls[0][0]).not.toContain('LIMIT');
  });

  it('limits to the last N messages when asked', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await getMessages('u1', 't1', { limit: 10 });

    expect(mockQuery.mock.calls[0][0]).toContain('LIMIT $3');
    expect(mockQuery.mock.calls[0][1]).toEqual(['u1', 't1', 10]);
  });
});

// ─── appendExchange ─────────────────────────────────────────────────────────

describe('appendExchange', () => {
  it('upserts the conversation and saves both messages in one transaction', async () => {
    mockClient.query.mockImplementation(async (sql) =>
      sql.includes('chat_conversations') ? { rows: [{ id: 'c1' }] } : { rows: [] }
    );

    await appendExchange('u1', 't1', 'Question', 'Answer');

    const statements = clientStatements();
    expect(statements[0]).toBe('BEGIN');
    expect(statements[1]).toContain('INSERT INTO chat_conversations');
    expect(statements[1]).toContain('ON CONFLICT (user_id, transcript_id)');
    expect(statements.at(-1)).toBe('COMMIT');

    const inserts = mockClient.query.mock.calls.filter(([sql]) =>
      sql.includes('INSERT INTO chat_messages')
    );
    expect(inserts.map(([sql, params]) => [sql.includes("'user'"), params])).toEqual([
      [true, ['c1', 'Question']],
      [false, ['c1', 'Answer']],
    ]);
    expect(mockClient.release).toHaveBeenCalledTimes(1);
    expect(mockClient.release).toHaveBeenCalledWith(undefined);
  });

  it('rolls back, releases the client and throws DATABASE_ERROR on failure', async () => {
    mockClient.query.mockImplementation(async (sql) => {
      if (sql.includes('chat_conversations')) return { rows: [{ id: 'c1' }] };
      if (sql.includes("'assistant'")) throw new Error('insert failed');
      return { rows: [] };
    });

    await expect(appendExchange('u1', 't1', 'Question', 'Answer')).rejects.toMatchObject({
      statusCode: 500,
      code: 'DATABASE_ERROR',
    });

    const statements = clientStatements();
    expect(statements).toContain('ROLLBACK');
    expect(statements).not.toContain('COMMIT');
    expect(mockClient.release).toHaveBeenCalledTimes(1);
    expect(mockClient.release).toHaveBeenCalledWith(undefined);
  });

  it.each([
    ['BEGIN', (sql) => sql === 'BEGIN'],
    ['the conversation upsert', (sql) => sql.includes('chat_conversations')],
  ])('rolls back and throws DATABASE_ERROR when %s fails', async (_label, failsOn) => {
    mockClient.query.mockImplementation(async (sql) => {
      if (failsOn(sql)) throw new Error('statement failed');
      return { rows: [] };
    });

    await expect(appendExchange('u1', 't1', 'Q', 'A')).rejects.toMatchObject({
      code: 'DATABASE_ERROR',
    });

    const statements = clientStatements();
    expect(statements).toContain('ROLLBACK');
    expect(statements.some((sql) => sql.includes('INSERT INTO chat_messages'))).toBe(false);
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  it('discards the connection when ROLLBACK itself fails', async () => {
    const rollbackError = new Error('connection lost');
    mockClient.query.mockImplementation(async (sql) => {
      if (sql === 'ROLLBACK') throw rollbackError;
      if (sql.includes('chat_conversations')) throw new Error('upsert failed');
      return { rows: [] };
    });

    await expect(appendExchange('u1', 't1', 'Q', 'A')).rejects.toMatchObject({
      code: 'DATABASE_ERROR',
    });

    expect(mockClient.release).toHaveBeenCalledTimes(1);
    expect(mockClient.release).toHaveBeenCalledWith(rollbackError);
  });

  it('throws DATABASE_ERROR when no connection can be acquired', async () => {
    mockPool.connect.mockRejectedValueOnce(new Error('pool exhausted'));

    await expect(appendExchange('u1', 't1', 'Q', 'A')).rejects.toMatchObject({
      statusCode: 500,
      code: 'DATABASE_ERROR',
    });
    expect(mockClient.query).not.toHaveBeenCalled();
    expect(mockClient.release).not.toHaveBeenCalled();
  });

  it('throws DATABASE_ERROR when the pool cannot be created', async () => {
    mockGetPool.mockImplementationOnce(() => {
      throw new Error('DATABASE_URL configuration is missing');
    });

    await expect(appendExchange('u1', 't1', 'Q', 'A')).rejects.toMatchObject({
      code: 'DATABASE_ERROR',
    });
  });
});

// ─── clearConversation ──────────────────────────────────────────────────────

describe('clearConversation', () => {
  it('deletes the conversation scoped to the user and transcript', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });

    await expect(clearConversation('u1', 't1')).resolves.toBe(true);
    expect(mockQuery.mock.calls[0][0]).toContain('DELETE FROM chat_conversations');
    expect(mockQuery.mock.calls[0][1]).toEqual(['u1', 't1']);
  });

  it('returns false when there was nothing to clear', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0 });

    await expect(clearConversation('u1', 't1')).resolves.toBe(false);
  });
});
