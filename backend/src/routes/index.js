/**
 * Routes Index
 * Combines all route modules into a single router
 */

import { Router } from 'express';
import authRoutes from './authRoutes.js';
import transcriptRoutes from './transcriptRoutes.js';
import aiRoutes from './aiRoutes.js';
import healthRoutes from './healthRoutes.js';
import audiobookRoutes from './audiobookRoutes.js';
import notesRoutes from './notesRoutes.js';
import bookmarksRoutes from './bookmarksRoutes.js';

const router = Router();

// Mount route modules
router.use('/auth', authRoutes);
router.use('/transcripts', transcriptRoutes);
router.use('/ai', aiRoutes);
router.use('/health', healthRoutes);
router.use('/audiobooks', audiobookRoutes);
router.use('/notes', notesRoutes);
router.use('/', bookmarksRoutes);

// API documentation endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Bitcoin Transcripts API v1',
    version: '1.0.0',
    documentation: {
      endpoints: {
        auth: {
          'POST /api/v1/auth/register': 'Create a new user account',
          'POST /api/v1/auth/login': 'Authenticate and receive JWT',
          'GET /api/v1/auth/me': 'Get current user profile (requires auth)',
        },
        transcripts: {
          'GET /api/v1/transcripts/conferences/summary': 'Get lean conference summary',
          'GET /api/v1/transcripts': 'Get all raw transcripts',
          'GET /api/v1/transcripts/conferences': 'Get transcripts grouped by conference',
          'GET /api/v1/transcripts/search?q=query': 'Search transcripts',
          'GET /api/v1/transcripts/:id': 'Get single transcript by ID',
        },
        ai: {
          'POST /api/v1/ai/summary': 'Generate transcript summary',
          'POST /api/v1/ai/chat': 'Chat with transcript context',
          'POST /api/v1/ai/tts': 'Generate speech from text',
          'POST /api/v1/ai/entities': 'Extract entities from transcript',
        },
        audiobooks: {
          'GET /api/v1/audiobooks/playlists': 'List playlists (status, playlist_type, source, limit, offset)',
          'GET /api/v1/audiobooks/playlists/:slug': 'Get playlist by slug with ordered episodes',
          'GET /api/v1/audiobooks/episodes/:episode_id': 'Get single episode by UUID',
          'GET /api/v1/audiobooks': 'List all audiobook series',
          'GET /api/v1/audiobooks/:id/roadmap': 'Get audiobook roadmap with chapters and progress',
          'POST /api/v1/audiobooks/progress': 'Save user playback progress',
        },
        notes: {
          'GET /api/v1/notes': 'Fetch all notes (auth required, optional ?transcript_id=)',
          'POST /api/v1/notes': 'Create a new note (auth required)',
          'PUT /api/v1/notes/:id': 'Update a note (auth required)',
          'DELETE /api/v1/notes/:id': 'Delete a note (auth required)',
        },
        bookmarks: {
          'GET /api/v1/bookmarks': 'List all bookmarks (auth required)',
          'POST /api/v1/bookmarks': 'Create a bookmark (auth required)',
          'DELETE /api/v1/bookmarks/:transcript_id': 'Remove a bookmark (auth required)',
        },
        highlights: {
          'GET /api/v1/highlights': 'List highlights (auth required, optional ?transcript_id=)',
          'POST /api/v1/highlights': 'Create a highlight (auth required)',
          'PUT /api/v1/highlights/:id': 'Update highlight note (auth required)',
          'DELETE /api/v1/highlights/:id': 'Delete a highlight (auth required)',
        },
        health: {
          'GET /api/v1/health': 'Basic health check',
          'GET /api/v1/health/detailed': 'Detailed service health check',
        },
      },
    },
  });
});

export default router;
