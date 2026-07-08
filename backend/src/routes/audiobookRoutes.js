/**
 * Audiobook Routes
 * Defines all audiobook-related API endpoints.
 *
 *   GET  /api/v1/audiobooks/playlists             — List playlists
 *   GET  /api/v1/audiobooks/playlists/:slug        — Get playlist by slug
 *   GET  /api/v1/audiobooks/episodes/:episode_id   — Get single episode
 *   GET  /api/v1/audiobooks                        — List all (Audiobook shape)
 *   GET  /api/v1/audiobooks/:id/roadmap            — Get roadmap with progress
 *   POST /api/v1/audiobooks/progress               — Save user progress
 */

import { Router } from 'express';
import * as audiobookController from '../controllers/audiobookController.js';
import { asyncHandler } from '../middleware/index.js';

const router = Router();

// ─── Playlist / Episode endpoints ─────────────────────────────────────────────

/**
 * @route   GET /api/v1/audiobooks/playlists
 * @desc    List all playlists (library / browse view)
 * @access  Public
 * @query   status, playlist_type, source, limit (max 100, default 50), offset (default 0)
 */
router.get(
  '/playlists',
  asyncHandler(audiobookController.getPlaylists)
);

/**
 * @route   GET /api/v1/audiobooks/playlists/:slug
 * @desc    Get a single playlist by slug, with all episodes ordered by sequence_number
 * @access  Public
 */
router.get(
  '/playlists/:slug',
  asyncHandler(audiobookController.getPlaylistBySlug)
);

/**
 * @route   GET /api/v1/audiobooks/episodes/:episode_id
 * @desc    Get a single episode by UUID (deep-link support)
 * @access  Public
 */
router.get(
  '/episodes/:episode_id',
  asyncHandler(audiobookController.getEpisodeById)
);

// ─── Audiobook shape endpoints ────────────────────────────────────────────────

/**
 * @route   GET /api/v1/audiobooks
 * @desc    Get all audiobook series (Audiobook shape)
 * @access  Public
 */
router.get(
  '/',
  asyncHandler(audiobookController.getAllAudiobooks)
);

/**
 * @route   GET /api/v1/audiobooks/:id/roadmap
 * @desc    Get a single audiobook with sorted chapters and user progress
 * @access  Public
 * @header  x-user-id - Client session ID for progress tracking
 */
router.get(
  '/:id/roadmap',
  asyncHandler(audiobookController.getAudiobookRoadmap)
);

/**
 * @route   POST /api/v1/audiobooks/progress
 * @desc    Save user playback progress (timestamp + completion status)
 * @access  Public
 */
router.post(
  '/progress',
  asyncHandler(audiobookController.saveProgress)
);

export default router;
