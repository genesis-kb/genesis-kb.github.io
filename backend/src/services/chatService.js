/**
 * Chat History Database Service
 * Persists each user's AI chat per transcript.
 * All queries are scoped to a single user_id (from JWT).
 */

import { getPool, query } from './dbPool.js';
import { APIError } from '../middleware/errorHandler.js';
import logger from '../config/logger.js';

/**
 * Fetch the most recent messages of a user's chat with a transcript.
 * @param {string} userId - User UUID
 * @param {string} transcriptId - Transcript ID
 * @param {Object} [options]
 * @param {number} [options.limit] - Return only the last N messages
 * @returns {Promise<Array<{role: string, content: string, created_at: string}>>}
 *   Oldest first
 */
export const getMessages = async (userId, transcriptId, { limit } = {}) => {
  // Role breaks timestamp ties so a question always sorts before its answer.
  const result = await query(
    `SELECT m.role, m.content, m.created_at
     FROM chat_messages m
     JOIN chat_conversations c ON c.id = m.conversation_id
     WHERE c.user_id = $1 AND c.transcript_id = $2
     ORDER BY m.created_at DESC, CASE m.role WHEN 'user' THEN 1 ELSE 0 END
     ${limit ? 'LIMIT $3' : ''}`,
    limit ? [userId, transcriptId, limit] : [userId, transcriptId]
  );

  // Selected newest first so LIMIT keeps the latest messages; return oldest first.
  return result.rows.reverse();
};

/**
 * Save one question/answer pair, creating the conversation if needed.
 * Runs in a single transaction so a chat never keeps a question without
 * its answer.
 * @param {string} userId - User UUID
 * @param {string} transcriptId - Transcript ID
 * @param {string} userText - The user's message
 * @param {string} assistantText - The model's reply
 */
export const appendExchange = async (userId, transcriptId, userText, assistantText) => {
  let client;
  try {
    client = await getPool().connect();
  } catch (error) {
    logger.error('Failed to get a database connection for chat exchange', {
      error: error.message,
    });
    throw new APIError('Database query failed', 500, 'DATABASE_ERROR');
  }

  // Passed to release(): a truthy value makes pg discard the connection
  // instead of returning it to the pool.
  let brokenConnection;

  try {
    await client.query('BEGIN');

    const conversation = await client.query(
      `INSERT INTO chat_conversations (user_id, transcript_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, transcript_id) DO UPDATE SET updated_at = NOW()
       RETURNING id`,
      [userId, transcriptId]
    );
    const conversationId = conversation.rows[0].id;

    // clock_timestamp(), not NOW(): NOW() is fixed for the whole transaction.
    await client.query(
      `INSERT INTO chat_messages (conversation_id, role, content, created_at)
       VALUES ($1, 'user', $2, clock_timestamp())`,
      [conversationId, userText]
    );
    await client.query(
      `INSERT INTO chat_messages (conversation_id, role, content, created_at)
       VALUES ($1, 'assistant', $2, clock_timestamp())`,
      [conversationId, assistantText]
    );

    await client.query('COMMIT');
    logger.info(`Saved chat exchange for user ${userId}: ${transcriptId}`);
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      // The connection is in an unknown transaction state; don't reuse it.
      brokenConnection = rollbackError;
    }
    logger.error('Failed to save chat exchange', { error: error.message });
    throw new APIError('Database query failed', 500, 'DATABASE_ERROR');
  } finally {
    client.release(brokenConnection);
  }
};

/**
 * Delete a user's chat with a transcript (messages cascade).
 * @param {string} userId - User UUID
 * @param {string} transcriptId - Transcript ID
 * @returns {Promise<boolean>} true if a conversation was deleted
 */
export const clearConversation = async (userId, transcriptId) => {
  const result = await query(
    `DELETE FROM chat_conversations WHERE user_id = $1 AND transcript_id = $2`,
    [userId, transcriptId]
  );

  logger.info(`Cleared chat for user ${userId}: ${transcriptId}`);
  return result.rowCount > 0;
};

export default {
  getMessages,
  appendExchange,
  clearConversation,
};
