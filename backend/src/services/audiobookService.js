/**
 * Audiobook Database Service
 *
 * All data lives in a single set of tables:
 *   - public.audio_playlists      (both manual SQL seeds + pipeline)
 *   - public.audio_episodes       (both manual SQL seeds + pipeline)
 *   - audiobooks.user_progress    (per-user playback tracking)
 *
 * The `source` column on audio_playlists tracks origin ('manual' | 'pipeline').
 *
 * Uses the shared connection pool from dbPool.js.
 */

import { query } from './dbPool.js';
import logger from '../config/logger.js';

// ─── Hard limits ────────────────────────────────────────────────────────────
export const PLAYLIST_MAX_LIMIT = 100;
export const PLAYLIST_DEFAULT_LIMIT = 50;

// ─── Playlists ──────────────────────────────────────────────────────────────

/**
 * List playlists with optional filters and pagination.
 *
 * @param {Object} opts
 * @param {string} [opts.status]         - Filter by status ('draft'|'published'|'archived')
 * @param {string} [opts.playlist_type]  - Filter by type ('series'|'collection')
 * @param {string} [opts.source]         - Filter by source ('manual'|'pipeline')
 * @param {number} [opts.limit]          - Page size (1-100, default 50)
 * @param {number} [opts.offset]         - Offset (default 0)
 * @returns {Promise<{data: Array, total: number}>}
 */
export const listPlaylists = async ({ status, playlist_type, source, limit, offset } = {}) => {
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || PLAYLIST_DEFAULT_LIMIT, 1), PLAYLIST_MAX_LIMIT);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

  const conditions = [];
  const values = [];

  // Default to 'published' so draft/archived rows are never leaked
  // unless the caller explicitly requests a different status.
  values.push(status || 'published');
  conditions.push(`status = $${values.length}`);

  if (playlist_type) {
    values.push(playlist_type);
    conditions.push(`playlist_type = $${values.length}`);
  }
  if (source) {
    values.push(source);
    conditions.push(`source = $${values.length}`);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  // Fetch count and page in parallel
  const [countResult, rowsResult] = await Promise.all([
    query(
      `SELECT COUNT(*)::int AS total FROM public.audio_playlists ${where}`,
      values
    ),
    query(
      `SELECT
         id, title, slug, description, playlist_type,
         cover_image_url, tags, status, source,
         difficulty_level,
         total_duration_seconds, episode_count,
         created_at, updated_at
       FROM public.audio_playlists
       ${where}
       ORDER BY created_at DESC
       LIMIT $${values.length + 1}
       OFFSET $${values.length + 2}`,
      [...values, safeLimit, safeOffset]
    ),
  ]);

  logger.info(`listPlaylists: ${rowsResult.rows.length}/${countResult.rows[0].total} returned`);
  return { data: rowsResult.rows, total: countResult.rows[0].total };
};

/**
 * Fetch a single playlist by slug, including all episodes ordered by sequence_number.
 *
 * @param {string} slug
 * @param {string|null} userId - Optional user ID for progress tracking
 * @returns {Promise<Object|null>}  Playlist with an `episodes` array, or null if not found.
 */
export const getPlaylistBySlug = async (slug, userId = null) => {
  logger.info(`getPlaylistBySlug: ${slug} (user=${userId})`);

  const queries = [
    query(
      `SELECT
         id, title, slug, description, playlist_type,
         cover_image_url, tags, status, source,
         difficulty_level,
         total_duration_seconds, episode_count,
         created_at, updated_at
       FROM public.audio_playlists
       WHERE slug = $1 AND status = 'published'`,
      [slug]
    ),
    query(
      `SELECT
         id, playlist_id, title, description, sequence_number,
         audio_url, duration_seconds, source_url, status,
         transcript_summary, chapters, metadata, created_at
       FROM public.audio_episodes
       WHERE playlist_id = (
         SELECT id FROM public.audio_playlists WHERE slug = $1 AND status = 'published'
       )
       ORDER BY sequence_number ASC`,
      [slug]
    ),
  ];

  const [playlistResult, episodesResult] = await Promise.all(queries);

  if (playlistResult.rows.length === 0) return null;

  // Fetch user progress if userId is provided
  let progressMap = {};
  if (userId) {
    const progressRows = await fetchEpisodeProgress(userId, playlistResult.rows[0].id);
    progressMap = Object.fromEntries(
      progressRows.map((p) => [p.chapter_id, p])
    );
  }

  // Merge progress into each episode
  const episodes = episodesResult.rows.map((ep) => {
    const progress = progressMap[ep.id] || null;
    return {
      ...ep,
      user_progress: progress
        ? {
            current_seconds: progress.current_seconds,
            completed: progress.completed,
          }
        : null,
    };
  });

  return {
    ...playlistResult.rows[0],
    episodes,
  };
};

/**
 * Fetch a single playlist by UUID.
 *
 * @param {string} playlistId - UUID
 * @returns {Promise<Object|null>}
 */
export const getPlaylistById = async (playlistId) => {
  logger.info(`getPlaylistById: ${playlistId}`);

  const [playlistResult, episodesResult] = await Promise.all([
    query(
      `SELECT
         id, title, slug, description, playlist_type,
         cover_image_url, tags, status, source,
         difficulty_level,
         total_duration_seconds, episode_count,
         created_at, updated_at
       FROM public.audio_playlists
       WHERE id = $1 AND status = 'published'`,
      [playlistId]
    ),
    query(
      `SELECT
         id, playlist_id, title, description, sequence_number,
         audio_url, duration_seconds, source_url, status,
         transcript_summary, chapters, metadata, created_at
       FROM public.audio_episodes
       WHERE playlist_id = $1
       ORDER BY sequence_number ASC`,
      [playlistId]
    ),
  ]);

  if (playlistResult.rows.length === 0) return null;

  return {
    ...playlistResult.rows[0],
    episodes: episodesResult.rows,
  };
};

/**
 * Fetch a single episode by UUID.
 *
 * @param {string} episodeId - UUID
 * @returns {Promise<Object|null>}
 */
export const getEpisodeById = async (episodeId) => {
  logger.info(`getEpisodeById: ${episodeId}`);

  const result = await query(
    `SELECT
       ep.id, ep.playlist_id, ep.title, ep.description, ep.sequence_number,
       ep.audio_url, ep.duration_seconds, ep.source_url, ep.status,
       ep.transcript_summary, ep.chapters, ep.metadata, ep.created_at
     FROM public.audio_episodes ep
     JOIN public.audio_playlists pl ON pl.id = ep.playlist_id
     WHERE ep.id = $1 AND pl.status = 'published'`,
    [episodeId]
  );

  return result.rows[0] || null;
};


// ─── Backward-compatible wrappers ───────────────────────────────────────────
// These reshape the unified data to match the Audiobook/Chapter types
// expected by the frontend API consumers.

/**
 * Fetch all audiobooks (legacy shape for listing page).
 * Reads from audio_playlists, mapping fields to Audiobook shape.
 *
 * @returns {Promise<Array>}
 */
export const fetchAllAudiobooks = async () => {
  logger.info('Fetching all audiobook series...');

  const result = await query(`
    SELECT
      id,
      title,
      description,
      cover_image_url   AS thumbnail_url,
      difficulty_level,
      created_at,
      episode_count     AS chapter_count,
      total_duration_seconds
    FROM public.audio_playlists
    WHERE status = 'published'
    ORDER BY created_at DESC
  `);

  logger.info(`Fetched ${result.rows.length} audiobook series`);
  return result.rows;
};

/**
 * Fetch a single audiobook with all chapters sorted by sequence (roadmap shape).
 * Reads from audio_playlists + audio_episodes.
 *
 * @param {string} audiobookId - UUID of the playlist
 * @returns {Promise<{audiobook: Object, chapters: Array}|null>}
 */
export const fetchAudiobookRoadmap = async (audiobookId) => {
  logger.info(`Fetching audiobook roadmap: ${audiobookId}`);

  const playlist = await getPlaylistById(audiobookId);
  if (!playlist) return null;

  const audiobook = {
    id: playlist.id,
    title: playlist.title,
    description: playlist.description,
    thumbnail_url: playlist.cover_image_url,
    difficulty_level: playlist.difficulty_level || 'beginner',
    created_at: playlist.created_at,
    chapter_count: playlist.episode_count,
    total_duration_seconds: playlist.total_duration_seconds,
  };

  const chapters = playlist.episodes.map(ep => ({
    id: ep.id,
    audiobook_id: ep.playlist_id,
    chapter_number: ep.sequence_number,
    title: ep.title,
    description: ep.description,
    audio_url: ep.audio_url,
    duration_seconds: ep.duration_seconds || 0,
    transcript_summary: ep.transcript_summary || null,
  }));

  return { audiobook, chapters };
};


// ─── User Progress ──────────────────────────────────────────────────────────

/**
 * Fetch user progress for all episodes in a playlist.
 *
 * @param {string} userId
 * @param {string} playlistId
 * @returns {Promise<Array>}
 */
export const fetchUserProgress = async (userId, playlistId) => {
  logger.info(`Fetching user progress: user=${userId}, playlist=${playlistId}`);

  const result = await query(
    `SELECT up.*
     FROM audiobooks.user_progress up
     JOIN public.audio_episodes ep ON ep.id = up.chapter_id
     WHERE up.user_id = $1 AND ep.playlist_id = $2`,
    [userId, playlistId]
  );

  return result.rows;
};

/**
 * Fetch user progress for all episodes in a playlist.
 *
 * @param {string} userId
 * @param {string} playlistId - UUID of the playlist
 * @returns {Promise<Array>}
 */
export const fetchEpisodeProgress = async (userId, playlistId) => {
  logger.info(`Fetching episode progress: user=${userId}, playlist=${playlistId}`);

  const result = await query(
    `SELECT up.chapter_id, up.current_seconds, up.completed, up.updated_at
     FROM audiobooks.user_progress up
     JOIN public.audio_episodes ep ON ep.id = up.chapter_id
     WHERE up.user_id = $1 AND ep.playlist_id = $2`,
    [userId, playlistId]
  );

  return result.rows;
};

/**
 * Upsert user progress for an episode.
 *
 * @param {string} userId
 * @param {string} episodeId - UUID of the episode
 * @param {number} currentSeconds
 * @param {boolean} completed
 */
export const upsertProgress = async (userId, episodeId, currentSeconds, completed) => {
  logger.info(`Upserting progress: user=${userId}, episode=${episodeId}, seconds=${currentSeconds}, completed=${completed}`);

  await query(
    `INSERT INTO audiobooks.user_progress (user_id, chapter_id, current_seconds, completed, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (user_id, chapter_id)
     DO UPDATE SET
       current_seconds = EXCLUDED.current_seconds,
       completed       = audiobooks.user_progress.completed OR EXCLUDED.completed,
       updated_at      = NOW()`,
    [userId, episodeId, currentSeconds, completed]
  );
};

/**
 * Fetch a single episode by ID (used for progress validation).
 * Returns in chapter shape with audiobook_id mapped.
 *
 * @param {string} episodeId - UUID
 * @returns {Promise<Object|null>}
 */
export const fetchChapterById = async (episodeId) => {
  const episode = await getEpisodeById(episodeId);
  if (!episode) return null;

  return {
    id: episode.id,
    audiobook_id: episode.playlist_id,
    chapter_number: episode.sequence_number,
    title: episode.title,
    description: episode.description,
    audio_url: episode.audio_url,
    duration_seconds: episode.duration_seconds || 0,
    transcript_summary: episode.transcript_summary || null,
  };
};

export default {
  listPlaylists,
  getPlaylistBySlug,
  getPlaylistById,
  getEpisodeById,
  fetchAllAudiobooks,
  fetchAudiobookRoadmap,
  fetchUserProgress,
  fetchEpisodeProgress,
  upsertProgress,
  fetchChapterById,
};
