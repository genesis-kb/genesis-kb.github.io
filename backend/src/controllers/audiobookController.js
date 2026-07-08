/**
 * Audiobook Controller
 * Handles all audiobook-related API endpoints.
 *
 * All data is served from a single set of unified tables:
 *   public.audio_playlists / audio_episodes / audiobooks.user_progress
 */

import * as audiobookService from '../services/audiobookService.js';
import { sendSuccess } from '../utils/responseHelper.js';
import { APIError } from '../middleware/errorHandler.js';
import logger from '../config/logger.js';

// UUID v4 format: 8-4-4-4-12 hex digits
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUUID = (value) => typeof value === 'string' && UUID_RE.test(value);

// Slug: lowercase letters, digits, hyphens only
const SLUG_RE = /^[a-z0-9-]+$/;
const isSlug = (value) => typeof value === 'string' && value.length > 0 && SLUG_RE.test(value);

// Upper bound for current_seconds (24 hours — no single episode should exceed this)
const MAX_SECONDS = 86400;

// ─── Playlist / Episode Handlers ─────────────────────────────────────────────

/**
 * List playlists with optional filtering and pagination.
 * GET /api/v1/audiobooks/playlists
 *
 * Query params:
 *   status        (optional) – 'draft' | 'published' | 'archived'
 *   playlist_type (optional) – 'series' | 'collection'
 *   source        (optional) – 'manual' | 'pipeline'
 *   limit         (optional, default 50, max 100)
 *   offset        (optional, default 0)
 */
export const getPlaylists = async (req, res) => {
  const VALID_STATUSES = new Set(['draft', 'published', 'archived']);
  const VALID_TYPES    = new Set(['series', 'collection']);
  const VALID_SOURCES  = new Set(['manual', 'pipeline']);

  const { status, playlist_type, source, limit, offset } = req.query;

  if (status && !VALID_STATUSES.has(status)) {
    throw new APIError(
      `Invalid status. Must be one of: ${[...VALID_STATUSES].join(', ')}`,
      400, 'VALIDATION_ERROR'
    );
  }
  if (playlist_type && !VALID_TYPES.has(playlist_type)) {
    throw new APIError(
      `Invalid playlist_type. Must be one of: ${[...VALID_TYPES].join(', ')}`,
      400, 'VALIDATION_ERROR'
    );
  }
  if (source && !VALID_SOURCES.has(source)) {
    throw new APIError(
      `Invalid source. Must be one of: ${[...VALID_SOURCES].join(', ')}`,
      400, 'VALIDATION_ERROR'
    );
  }

  logger.info('Controller: getPlaylists', { status, playlist_type, source, limit, offset });

  const result = await audiobookService.listPlaylists({ status, playlist_type, source, limit, offset });

  sendSuccess(res, result);
};

/**
 * Get a single playlist by slug, including all episodes ordered by sequence_number.
 * GET /api/v1/audiobooks/playlists/:slug
 */
export const getPlaylistBySlug = async (req, res) => {
  const { slug } = req.params;

  if (!isSlug(slug)) {
    throw new APIError('Invalid slug format', 400, 'VALIDATION_ERROR');
  }

  // Read user ID for progress tracking
  const rawUserId = req.headers['x-user-id'] || req.get('x-user-id') || null;
  const userId = rawUserId && isUUID(rawUserId) ? rawUserId : null;

  logger.info(`Controller: getPlaylistBySlug: ${slug} (user=${userId})`);

  const playlist = await audiobookService.getPlaylistBySlug(slug, userId);

  if (!playlist) {
    throw new APIError('Playlist not found', 404, 'NOT_FOUND');
  }

  sendSuccess(res, playlist);
};

/**
 * Get a single episode by UUID.
 * GET /api/v1/audiobooks/episodes/:episode_id
 */
export const getEpisodeById = async (req, res) => {
  const { episode_id } = req.params;

  if (!isUUID(episode_id)) {
    throw new APIError('Invalid episode ID format', 400, 'VALIDATION_ERROR');
  }

  logger.info(`Controller: getEpisodeById: ${episode_id}`);

  const episode = await audiobookService.getEpisodeById(episode_id);

  if (!episode) {
    throw new APIError('Episode not found', 404, 'NOT_FOUND');
  }

  sendSuccess(res, episode);
};

// ─── Audiobook Shape Handlers ────────────────────────────────────────────────

const buildRoadmapChapters = (roadmap, progressMap) => {
  return roadmap.chapters.map((chapter) => {
    const progress = progressMap[chapter.id] || null;

    let status = 'available';
    if (progress?.completed) {
      status = 'completed';
    } else if (!chapter.audio_url) {
      status = 'coming_soon';
    }

    return {
      ...chapter,
      status,
      progress: progress
        ? {
            chapter_id: progress.chapter_id,
            current_seconds: progress.current_seconds,
            completed: progress.completed,
          }
        : null,
    };
  });
};

/**
 * Get all audiobook series.
 * GET /api/v1/audiobooks
 */
export const getAllAudiobooks = async (req, res) => {
  logger.info('Controller: Getting all audiobooks');

  const audiobooks = await audiobookService.fetchAllAudiobooks();
  sendSuccess(res, audiobooks, `Found ${audiobooks.length} audiobook series`);
};

/**
 * Get a single audiobook roadmap with chapters and user progress.
 * GET /api/v1/audiobooks/:id/roadmap
 *
 * Headers:
 *   x-user-id (string) — client-generated session ID for progress tracking
 */
export const getAudiobookRoadmap = async (req, res) => {
  const { id } = req.params;

  if (!isUUID(id)) {
    throw new APIError('Invalid audiobook ID format', 400, 'VALIDATION_ERROR');
  }

  const rawUserId = req.headers['x-user-id'] || req.get('x-user-id') || null;
  const userId = rawUserId && isUUID(rawUserId) ? rawUserId : null;

  logger.info(`Controller: Getting audiobook roadmap: ${id} (user=${userId})`);

  const roadmap = await audiobookService.fetchAudiobookRoadmap(id);

  if (!roadmap) {
    throw new APIError(`Audiobook not found with ID: ${id}`, 404, 'NOT_FOUND');
  }

  // Merge user progress into chapters
  let progressMap = {};
  if (userId) {
    const progressRows = await audiobookService.fetchUserProgress(userId, id);
    progressMap = Object.fromEntries(
      progressRows.map((p) => [p.chapter_id, p])
    );
  }

  const chapters = buildRoadmapChapters(roadmap, progressMap);

  sendSuccess(res, {
    audiobook: roadmap.audiobook,
    chapters,
  });
};

/**
 * Save user progress for an episode.
 * POST /api/v1/audiobooks/progress
 *
 * Body: { user_id, chapter_id, current_seconds, completed }
 */
export const saveProgress = async (req, res) => {
  const { user_id, chapter_id, current_seconds, completed } = req.body;

  if (!isUUID(user_id)) {
    throw new APIError('user_id must be a valid UUID', 400, 'VALIDATION_ERROR');
  }
  if (!isUUID(chapter_id)) {
    throw new APIError('chapter_id must be a valid UUID', 400, 'VALIDATION_ERROR');
  }

  const seconds = typeof current_seconds === 'number' && Number.isFinite(current_seconds)
    ? Math.max(0, Math.min(current_seconds, MAX_SECONDS))
    : 0;
  const isCompleted = typeof completed === 'boolean' ? completed : false;

  try {
    await audiobookService.upsertProgress(user_id, chapter_id, seconds, isCompleted);
  } catch (error) {
    // 23503 is Postgres foreign_key_violation code
    if (error.code === '23503') {
      throw new APIError('Episode not found', 404, 'NOT_FOUND');
    }
    throw error;
  }

  sendSuccess(res, { saved: true }, 'Progress saved');
};

export default {
  getPlaylists,
  getPlaylistBySlug,
  getEpisodeById,
  getAllAudiobooks,
  getAudiobookRoadmap,
  saveProgress,
};
