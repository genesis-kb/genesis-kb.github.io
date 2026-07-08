/**
 * Routes Index
 * Combines all route modules into a single router
 */

import { Router } from 'express';
import transcriptRoutes from './transcriptRoutes.js';
import aiRoutes from './aiRoutes.js';
import healthRoutes from './healthRoutes.js';
import audiobookRoutes from './audiobookRoutes.js';

const router = Router();

// Mount route modules
router.use('/transcripts', transcriptRoutes);
router.use('/ai', aiRoutes);
router.use('/health', healthRoutes);
router.use('/audiobooks', audiobookRoutes);

// API documentation endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Bitcoin Transcripts API v1',
    version: '1.0.0',
    documentation: {
      endpoints: {
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
        health: {
          'GET /api/v1/health': 'Basic health check',
          'GET /api/v1/health/detailed': 'Detailed service health check',
        },
      },
    },
  });
});

export default router;
