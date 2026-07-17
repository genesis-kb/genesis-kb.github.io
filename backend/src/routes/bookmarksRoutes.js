/**
 * Bookmarks & Highlights Routes
 * All endpoints require authentication.
 *
 * Bookmarks:
 *   GET    /bookmarks              — Fetch all bookmarks
 *   POST   /bookmarks              — Create a bookmark
 *   DELETE /bookmarks/:transcript_id — Remove a bookmark
 *
 * Highlights:
 *   GET    /highlights             — Fetch all highlights (optional ?transcript_id=)
 *   POST   /highlights             — Create a highlight
 *   PUT    /highlights/:id         — Update a highlight
 *   DELETE /highlights/:id         — Delete a highlight
 */

import { Router } from 'express';
import * as bookmarksController from '../controllers/bookmarksController.js';
import { requireAuth } from '../middleware/auth.js';
import { userDataLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// All routes require authentication and rate limiting
router.use(requireAuth);
router.use(userDataLimiter);

// Bookmarks
router.get('/bookmarks', bookmarksController.getBookmarks);
router.post('/bookmarks', bookmarksController.createBookmark);
router.delete('/bookmarks/:transcript_id', bookmarksController.deleteBookmark);

// Highlights
router.get('/highlights', bookmarksController.getHighlights);
router.post('/highlights', bookmarksController.createHighlight);
router.put('/highlights/:id', bookmarksController.updateHighlight);
router.delete('/highlights/:id', bookmarksController.deleteHighlight);

export default router;
