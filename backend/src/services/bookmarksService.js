/**
 * Bookmarks & Highlights Database Service
 * Handles all CRUD operations for user bookmarks and text highlights.
 * All queries are scoped to a single user_id (from JWT).
 */

import { query } from './dbPool.js';
import logger from '../config/logger.js';

// ─── Bookmarks ──────────────────────────────────────────────────────────────

/**
 * Fetch all bookmarks for a user, sorted by creation date (newest first).
 * @param {string} userId - User UUID
 * @returns {Promise<Array>}
 */
export const fetchBookmarksByUser = async (userId) => {
  const result = await query(
    `SELECT id, transcript_id, title, speakers, event_date, conference, created_at
     FROM bookmarks
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );

  logger.info(`Fetched ${result.rows.length} bookmarks for user ${userId}`);
  return result.rows;
};

/**
 * Check if a transcript is bookmarked by the user.
 * @param {string} userId
 * @param {string} transcriptId
 * @returns {Promise<boolean>}
 */
export const isBookmarked = async (userId, transcriptId) => {
  const result = await query(
    `SELECT 1 FROM bookmarks WHERE user_id = $1 AND transcript_id = $2`,
    [userId, transcriptId]
  );
  return result.rows.length > 0;
};

/**
 * Create a bookmark. Uses ON CONFLICT to make it idempotent (no duplicate error).
 * @param {string} userId
 * @param {Object} data - { transcript_id, title, speakers?, event_date?, conference? }
 * @returns {Promise<Object>} Created or existing bookmark row
 */
export const createBookmark = async (userId, data) => {
  const { transcript_id, title, speakers, event_date, conference } = data;

  const result = await query(
    `INSERT INTO bookmarks (user_id, transcript_id, title, speakers, event_date, conference)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, transcript_id) DO NOTHING
     RETURNING id, transcript_id, title, speakers, event_date, conference, created_at`,
    [userId, transcript_id, title, speakers || null, event_date || null, conference || null]
  );

  // If ON CONFLICT fired, fetch the existing row
  if (result.rows.length === 0) {
    const existing = await query(
      `SELECT id, transcript_id, title, speakers, event_date, conference, created_at
       FROM bookmarks
       WHERE user_id = $1 AND transcript_id = $2`,
      [userId, transcript_id]
    );
    return existing.rows[0];
  }

  logger.info(`Created bookmark for user ${userId}: ${transcript_id}`);
  return result.rows[0];
};

/**
 * Delete a bookmark by transcript_id (scoped to user).
 * @param {string} userId
 * @param {string} transcriptId
 * @returns {Promise<boolean>} true if deleted, false if not found
 */
export const deleteBookmark = async (userId, transcriptId) => {
  const result = await query(
    `DELETE FROM bookmarks WHERE user_id = $1 AND transcript_id = $2 RETURNING id`,
    [userId, transcriptId]
  );

  if (result.rows.length === 0) return false;

  logger.info(`Deleted bookmark for user ${userId}: ${transcriptId}`);
  return true;
};


// ─── Highlights ─────────────────────────────────────────────────────────────

/**
 * Fetch all highlights for a user, optionally filtered by transcript.
 * @param {string} userId
 * @param {string} [transcriptId] - Optional transcript filter
 * @returns {Promise<Array>}
 */
export const fetchHighlightsByUser = async (userId, transcriptId = null) => {
  let sql = `SELECT id, transcript_id, transcript_title, text, note,
                    color, is_underline, created_at, updated_at
             FROM highlights
             WHERE user_id = $1`;
  const values = [userId];

  if (transcriptId) {
    sql += ` AND transcript_id = $2`;
    values.push(transcriptId);
  }

  sql += ` ORDER BY created_at DESC`;

  const result = await query(sql, values);
  return result.rows;
};

/**
 * Create a new highlight.
 * @param {string} userId
 * @param {Object} data
 * @returns {Promise<Object>} Created highlight row
 */
export const createHighlight = async (userId, data) => {
  const { transcript_id, transcript_title, text, note, color, is_underline } = data;

  const result = await query(
    `INSERT INTO highlights
       (user_id, transcript_id, transcript_title, text, note, color, is_underline)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, transcript_id, transcript_title, text, note,
               color, is_underline, created_at, updated_at`,
    [
      userId,
      transcript_id,
      transcript_title || null,
      text,
      note || null,
      color || 'default',
      is_underline || false,
    ]
  );

  logger.info(`Created highlight ${result.rows[0].id} for user ${userId}`);
  return result.rows[0];
};

/**
 * Update a highlight's note (scoped to user).
 * @param {string} userId
 * @param {string} highlightId
 * @param {Object} updates - { note? }
 * @returns {Promise<Object|null>} Updated highlight row or null
 */
export const updateHighlight = async (userId, highlightId, updates) => {
  const allowed = ['note', 'color'];
  const setClauses = [];
  const values = [];
  let paramIndex = 1;

  for (const key of allowed) {
    if (updates[key] !== undefined) {
      setClauses.push(`${key} = $${paramIndex}`);
      values.push(updates[key]);
      paramIndex++;
    }
  }

  if (setClauses.length === 0) {
    // Nothing to update — return existing
    const result = await query(
      `SELECT id, transcript_id, transcript_title, text, note,
              color, is_underline, created_at, updated_at
       FROM highlights
       WHERE id = $1 AND user_id = $2`,
      [highlightId, userId]
    );
    return result.rows[0] || null;
  }

  values.push(highlightId, userId);

  const result = await query(
    `UPDATE highlights
     SET ${setClauses.join(', ')}, updated_at = NOW()
     WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
     RETURNING id, transcript_id, transcript_title, text, note,
               color, is_underline, created_at, updated_at`,
    values
  );

  if (result.rows.length === 0) return null;

  logger.info(`Updated highlight ${highlightId} for user ${userId}`);
  return result.rows[0];
};

/**
 * Delete a highlight (scoped to user).
 * @param {string} userId
 * @param {string} highlightId
 * @returns {Promise<boolean>} true if deleted, false if not found
 */
export const deleteHighlight = async (userId, highlightId) => {
  const result = await query(
    `DELETE FROM highlights WHERE id = $1 AND user_id = $2 RETURNING id`,
    [highlightId, userId]
  );

  if (result.rows.length === 0) return false;

  logger.info(`Deleted highlight ${highlightId} for user ${userId}`);
  return true;
};

export default {
  fetchBookmarksByUser,
  isBookmarked,
  createBookmark,
  deleteBookmark,
  fetchHighlightsByUser,
  createHighlight,
  updateHighlight,
  deleteHighlight,
};
