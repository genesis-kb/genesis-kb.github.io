/**
 * Notes Routes
 * All endpoints require authentication.
 *
 * GET    /           — Fetch all notes (optionally filtered by ?transcript_id=)
 * POST   /           — Create a new note
 * PUT    /:id        — Update a note
 * DELETE /:id        — Delete a note
 */

import { Router } from 'express';
import * as notesController from '../controllers/notesController.js';
import { requireAuth } from '../middleware/auth.js';
import { userDataLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// All notes routes require authentication and rate limiting
router.use(requireAuth);
router.use(userDataLimiter);

router.get('/', notesController.getNotes);
router.post('/', notesController.createNote);
router.put('/:id', notesController.updateNote);
router.delete('/:id', notesController.deleteNote);

export default router;
