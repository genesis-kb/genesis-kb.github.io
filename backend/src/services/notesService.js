/**
 * Notes Database Service
 * Handles all CRUD operations for user notes.
 * All queries are scoped to a single user_id (from JWT).
 */

import { query } from './dbPool.js';
import logger from '../config/logger.js';

/**
 * Fetch all notes for a user, sorted: pinned first, then by updated_at desc.
 * @param {string} userId - User UUID
 * @returns {Promise<Array>}
 */
export const fetchNotesByUser = async (userId) => {
  logger.info(`Fetching notes for user: ${userId}`);

  const result = await query(
    `SELECT id, transcript_id, transcript_title, title, content,
            selected_text, pinned, is_concept, tags,
            created_at, updated_at
     FROM notes
     WHERE user_id = $1
     ORDER BY pinned DESC, updated_at DESC`,
    [userId]
  );

  logger.info(`Fetched ${result.rows.length} notes for user ${userId}`);
  return result.rows;
};

/**
 * Fetch notes for a user scoped to a specific transcript.
 * @param {string} userId - User UUID
 * @param {string} transcriptId - Transcript ID
 * @returns {Promise<Array>}
 */
export const fetchNotesByTranscript = async (userId, transcriptId) => {
  const result = await query(
    `SELECT id, transcript_id, transcript_title, title, content,
            selected_text, pinned, is_concept, tags,
            created_at, updated_at
     FROM notes
     WHERE user_id = $1 AND transcript_id = $2
     ORDER BY pinned DESC, updated_at DESC`,
    [userId, transcriptId]
  );

  return result.rows;
};

/**
 * Get a single note by ID (scoped to user).
 * @param {string} userId - User UUID
 * @param {string} noteId - Note UUID
 * @returns {Promise<Object|null>}
 */
export const fetchNoteById = async (userId, noteId) => {
  const result = await query(
    `SELECT id, transcript_id, transcript_title, title, content,
            selected_text, pinned, is_concept, tags,
            created_at, updated_at
     FROM notes
     WHERE id = $1 AND user_id = $2`,
    [noteId, userId]
  );

  return result.rows[0] || null;
};

/**
 * Create a new note.
 * @param {string} userId - User UUID
 * @param {Object} data - Note fields
 * @returns {Promise<Object>} Created note row
 */
export const createNote = async (userId, data) => {
  const {
    transcript_id,
    transcript_title,
    title,
    content,
    selected_text,
    pinned,
    is_concept,
    tags,
  } = data;

  const result = await query(
    `INSERT INTO notes
       (user_id, transcript_id, transcript_title, title, content,
        selected_text, pinned, is_concept, tags)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, transcript_id, transcript_title, title, content,
               selected_text, pinned, is_concept, tags,
               created_at, updated_at`,
    [
      userId,
      transcript_id,
      transcript_title || null,
      title || 'Untitled Note',
      content,
      selected_text || null,
      pinned || false,
      is_concept || false,
      tags || '{}',
    ]
  );

  logger.info(`Created note ${result.rows[0].id} for user ${userId}`);
  return result.rows[0];
};

/**
 * Update an existing note.
 * Only the owner (user_id) can update.
 * @param {string} userId - User UUID
 * @param {string} noteId - Note UUID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object|null>} Updated note row or null if not found
 */
export const updateNote = async (userId, noteId, updates) => {
  // Build SET clause dynamically from provided fields
  const allowed = ['title', 'content', 'pinned', 'is_concept', 'tags', 'selected_text'];
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
    // Nothing to update — just return the existing note
    return fetchNoteById(userId, noteId);
  }

  // user_id and note id are the final params
  values.push(noteId, userId);

  const result = await query(
    `UPDATE notes
     SET ${setClauses.join(', ')}, updated_at = NOW()
     WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
     RETURNING id, transcript_id, transcript_title, title, content,
               selected_text, pinned, is_concept, tags,
               created_at, updated_at`,
    values
  );

  if (result.rows.length === 0) return null;

  logger.info(`Updated note ${noteId} for user ${userId}`);
  return result.rows[0];
};

/**
 * Delete a note (only the owner can delete).
 * @param {string} userId - User UUID
 * @param {string} noteId - Note UUID
 * @returns {Promise<boolean>} true if deleted, false if not found
 */
export const deleteNote = async (userId, noteId) => {
  const result = await query(
    `DELETE FROM notes WHERE id = $1 AND user_id = $2 RETURNING id`,
    [noteId, userId]
  );

  if (result.rows.length === 0) return false;

  logger.info(`Deleted note ${noteId} for user ${userId}`);
  return true;
};

export default {
  fetchNotesByUser,
  fetchNotesByTranscript,
  fetchNoteById,
  createNote,
  updateNote,
  deleteNote,
};
