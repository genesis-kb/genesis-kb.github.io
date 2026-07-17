/**
 * Bookmarks & Highlights Controller
 * Handles HTTP request/response for bookmarks and highlights endpoints.
 * All routes require authentication (req.user.id from JWT).
 */

import { asyncHandler, APIError } from '../middleware/errorHandler.js';
import * as bookmarksService from '../services/bookmarksService.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Bookmarks ──────────────────────────────────────────────────────────────

/**
 * GET /api/v1/bookmarks
 * Fetch all bookmarks for the authenticated user.
 */
export const getBookmarks = asyncHandler(async (req, res) => {
  const bookmarks = await bookmarksService.fetchBookmarksByUser(req.user.id);
  res.json({ success: true, data: bookmarks });
});

/**
 * POST /api/v1/bookmarks
 * Create a bookmark.
 * Body: { transcript_id, title, speakers?, event_date?, conference? }
 */
export const createBookmark = asyncHandler(async (req, res) => {
  const { transcript_id, title } = req.body;

  if (!transcript_id || typeof transcript_id !== 'string') {
    throw new APIError('transcript_id is required', 400, 'VALIDATION_ERROR');
  }

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    throw new APIError('title is required', 400, 'VALIDATION_ERROR');
  }

  const bookmark = await bookmarksService.createBookmark(req.user.id, req.body);
  res.status(201).json({ success: true, data: bookmark });
});

/**
 * DELETE /api/v1/bookmarks/:transcript_id
 * Remove a bookmark by transcript ID.
 */
export const deleteBookmark = asyncHandler(async (req, res) => {
  const { transcript_id } = req.params;

  if (!transcript_id || typeof transcript_id !== 'string') {
    throw new APIError('Invalid transcript_id', 400, 'VALIDATION_ERROR');
  }

  const deleted = await bookmarksService.deleteBookmark(req.user.id, transcript_id);

  if (!deleted) {
    throw new APIError('Bookmark not found', 404, 'NOT_FOUND');
  }

  res.json({ success: true, data: { deleted: true } });
});


// ─── Highlights ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/highlights
 * Fetch all highlights for the authenticated user.
 * Optional query: ?transcript_id=xxx to filter by transcript.
 */
export const getHighlights = asyncHandler(async (req, res) => {
  const { transcript_id } = req.query;
  const highlights = await bookmarksService.fetchHighlightsByUser(req.user.id, transcript_id || null);
  res.json({ success: true, data: highlights });
});

/**
 * POST /api/v1/highlights
 * Create a highlight.
 * Body: { transcript_id, transcript_title?, text, note?, color?, is_underline? }
 */
export const createHighlight = asyncHandler(async (req, res) => {
  const { transcript_id, text } = req.body;

  if (!transcript_id || typeof transcript_id !== 'string') {
    throw new APIError('transcript_id is required', 400, 'VALIDATION_ERROR');
  }

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new APIError('text is required', 400, 'VALIDATION_ERROR');
  }

  // Cap text at 500 characters
  if (text.length > 500) {
    req.body.text = text.slice(0, 500) + '...';
  }

  const highlight = await bookmarksService.createHighlight(req.user.id, req.body);
  res.status(201).json({ success: true, data: highlight });
});

/**
 * PUT /api/v1/highlights/:id
 * Update a highlight (note, color).
 */
export const updateHighlight = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!UUID_RE.test(id)) {
    throw new APIError('Invalid highlight ID format', 400, 'VALIDATION_ERROR');
  }

  const highlight = await bookmarksService.updateHighlight(req.user.id, id, req.body);

  if (!highlight) {
    throw new APIError('Highlight not found', 404, 'NOT_FOUND');
  }

  res.json({ success: true, data: highlight });
});

/**
 * DELETE /api/v1/highlights/:id
 * Delete a highlight.
 */
export const deleteHighlight = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!UUID_RE.test(id)) {
    throw new APIError('Invalid highlight ID format', 400, 'VALIDATION_ERROR');
  }

  const deleted = await bookmarksService.deleteHighlight(req.user.id, id);

  if (!deleted) {
    throw new APIError('Highlight not found', 404, 'NOT_FOUND');
  }

  res.json({ success: true, data: { deleted: true } });
});

export default {
  getBookmarks,
  createBookmark,
  deleteBookmark,
  getHighlights,
  createHighlight,
  updateHighlight,
  deleteHighlight,
};
