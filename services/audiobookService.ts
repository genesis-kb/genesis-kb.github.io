/**
 * Audiobook Data Service
 * Handles all audiobook-related API communication.
 *
 * Progress tracking now uses JWT authentication (auto-injected by api.ts).
 * The backend extracts user identity from the token.
 */

import { api, APIError } from './api';
import config from './config';
import type { Audiobook, AudiobookRoadmap, AudioPlaylist, PlaylistsResponse, AudioEpisode } from '../types';

// ─── API Calls ─────────────────────────────────────────────

/**
 * Fetch all audiobook series
 */
export const getAudiobooks = async (): Promise<Audiobook[]> => {
  try {
    return await api.get<Audiobook[]>(config.endpoints.audiobooks);
  } catch (error) {
    if (error instanceof APIError) {
      console.error('API Error fetching audiobooks:', error.message, error.code);
    } else {
      console.error('Unexpected error fetching audiobooks:', error);
    }
    return [];
  }
};

/**
 * Fetch an audiobook roadmap with chapters and user progress.
 * User identity is extracted from the JWT by the backend (optionalAuth).
 * @param id - Audiobook series UUID
 */
export const getAudiobookRoadmap = async (id: string): Promise<AudiobookRoadmap | null> => {
  try {
    return await api.get<AudiobookRoadmap>(
      `${config.endpoints.audiobooks}/${id}/roadmap`
    );
  } catch (error) {
    if (error instanceof APIError && error.statusCode === 404) {
      console.warn('Audiobook not found:', id);
      return null;
    }
    throw error;
  }
};

/**
 * Save user progress for a chapter.
 * Requires authentication — user identity comes from the JWT.
 * @param chapterId - Chapter UUID
 * @param currentSeconds - Current playback position in seconds
 * @param completed - Whether the chapter is completed
 */
export const saveProgress = async (
  chapterId: string,
  currentSeconds: number,
  completed: boolean
): Promise<void> => {
  await api.post(config.endpoints.audiobookProgress, {
    chapter_id: chapterId,
    current_seconds: currentSeconds,
    completed,
  });
};

// ─── New Pipeline API Calls ────────────────────────────────

export const getPlaylists = async (params?: {
  status?: string;
  playlist_type?: string;
  source?: string;
  limit?: number;
  offset?: number;
}): Promise<PlaylistsResponse> => {
  try {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.playlist_type) query.append('playlist_type', params.playlist_type);
    if (params?.source) query.append('source', params.source);
    if (params?.limit != null) query.append('limit', params.limit.toString());
    if (params?.offset != null) query.append('offset', params.offset.toString());
    
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return await api.get<PlaylistsResponse>(`${config.endpoints.playlists}${queryString}`);
  } catch (error) {
    console.error('Error fetching playlists:', error);
    return { data: [], total: 0 };
  }
};

export const getPlaylistBySlug = async (slug: string): Promise<AudioPlaylist | null> => {
  try {
    return await api.get<AudioPlaylist>(`${config.endpoints.playlists}/${slug}`);
  } catch (error) {
    if (error instanceof APIError && error.statusCode === 404) {
      console.warn(`Playlist not found: ${slug}`);
      return null;
    }
    throw error;
  }
};

export const getEpisodeById = async (episodeId: string): Promise<AudioEpisode | null> => {
  try {
    return await api.get<AudioEpisode>(`${config.endpoints.episodes}/${episodeId}`);
  } catch (error) {
    if (error instanceof APIError && error.statusCode === 404) {
      console.warn(`Episode not found: ${episodeId}`);
      return null;
    }
    throw error;
  }
};

export default {
  getAudiobooks,
  getAudiobookRoadmap,
  saveProgress,
  getPlaylists,
  getPlaylistBySlug,
  getEpisodeById,
};
