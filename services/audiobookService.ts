/**
 * Audiobook Data Service
 * Handles all audiobook-related API communication
 */

import { api, APIError } from './api';
import config from './config';
import type { Audiobook, AudiobookRoadmap, AudioPlaylist, PlaylistsResponse, AudioEpisode } from '../types';

// ─── Anonymous User ID ─────────────────────────────────────

const USER_ID_KEY = 'bitscribe_user_id';

/**
 * Get or create an anonymous user ID for progress tracking.
 * Stored in localStorage — future-compatible with auth.
 */
export const getUserId = (): string => {
  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem(USER_ID_KEY, userId);
  }
  return userId;
};

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
 * Fetch an audiobook roadmap with chapters and user progress
 * @param id - Audiobook series UUID
 */
export const getAudiobookRoadmap = async (id: string): Promise<AudiobookRoadmap | null> => {
  const userId = getUserId();
  try {
    return await api.get<AudiobookRoadmap>(
      `${config.endpoints.audiobooks}/${id}/roadmap`,
      { headers: { 'x-user-id': userId } }
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
 * Save user progress for a chapter
 * @param chapterId - Chapter UUID
 * @param currentSeconds - Current playback position in seconds
 * @param completed - Whether the chapter is completed
 */
export const saveProgress = async (
  chapterId: string,
  currentSeconds: number,
  completed: boolean
): Promise<void> => {
  const userId = getUserId();
  try {
    await api.post(config.endpoints.audiobookProgress, {
      user_id: userId,
      chapter_id: chapterId,
      current_seconds: currentSeconds,
      completed,
    });
  } catch (error) {
    // Don't throw — progress saves should not break the user experience
    console.error('Error saving progress:', error);
  }
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
  const userId = getUserId();
  try {
    return await api.get<AudioPlaylist>(`${config.endpoints.playlists}/${slug}`, {
      headers: { 'x-user-id': userId },
    });
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
  getUserId,
  getAudiobooks,
  getAudiobookRoadmap,
  saveProgress,
  getPlaylists,
  getPlaylistBySlug,
  getEpisodeById,
};
