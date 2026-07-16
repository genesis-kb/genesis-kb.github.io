/**
 * Notes Controller
 * Handles HTTP request/response for notes endpoints.
 * All routes require authentication (req.user.id from JWT).
 */

import { asyncHandler, APIError } from '../middleware/errorHandler.js';
import * as notesService from '../services/notesService.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/v1/notes
 * Fetch all notes for the authenticated user.
 * Optional query: ?transcript_id=xxx to filter by transcript.
 */
export const getNotes = asyncHandler(async (req, res) => {
  const { transcript_id } = req.query;

  let notes;
  if (transcript_id) {
    notes = await notesService.fetchNotesByTranscript(req.user.id, transcript_id);
  } else {
    notes = await notesService.fetchNotesByUser(req.user.id);
  }

  res.json({ success: true, data: notes });
});

/**
 * POST /api/v1/notes
 * Create a new note.
 * Body: { transcript_id, transcript_title?, title?, content, selected_text?, pinned?, is_concept?, tags? }
 */
export const createNote = asyncHandler(async (req, res) => {
  const { transcript_id, content } = req.body;

  if (!transcript_id || typeof transcript_id !== 'string') {
    throw new APIError('transcript_id is required', 400, 'VALIDATION_ERROR');
  }

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    throw new APIError('content is required', 400, 'VALIDATION_ERROR');
  }

  const note = await notesService.createNote(req.user.id, req.body);
  res.status(201).json({ success: true, data: note });
});

/**
 * PUT /api/v1/notes/:id
 * Update a note. Only the owner can update.
 * Body: { title?, content?, pinned?, is_concept?, tags?, selected_text? }
 */
export const updateNote = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!UUID_RE.test(id)) {
    throw new APIError('Invalid note ID format', 400, 'VALIDATION_ERROR');
  }

  const note = await notesService.updateNote(req.user.id, id, req.body);

  if (!note) {
    throw new APIError('Note not found', 404, 'NOT_FOUND');
  }

  res.json({ success: true, data: note });
});

/**
 * DELETE /api/v1/notes/:id
 * Delete a note. Only the owner can delete.
 */
export const deleteNote = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!UUID_RE.test(id)) {
    throw new APIError('Invalid note ID format', 400, 'VALIDATION_ERROR');
  }

  const deleted = await notesService.deleteNote(req.user.id, id);

  if (!deleted) {
    throw new APIError('Note not found', 404, 'NOT_FOUND');
  }

  res.json({ success: true, data: { deleted: true } });
});

export default {
  getNotes,
  createNote,
  updateNote,
  deleteNote,
};
