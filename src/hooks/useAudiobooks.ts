/**
 * Audiobook React Query Hooks
 * Follows the same pattern as useTranscripts.ts
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAudiobooks,
  getAudiobookRoadmap,
  saveProgress,
  getPlaylists,
  getPlaylistBySlug,
} from '../../services/audiobookService';
import type { Audiobook, AudiobookRoadmap, AudioPlaylist, PlaylistsResponse, PlaylistsParams } from '../../types';

export const AUDIOBOOK_QUERY_KEYS = {
  all: ['audiobooks'] as const,
  roadmap: (id: string) => ['audiobook', 'roadmap', id] as const,
  playlists: (params?: PlaylistsParams) => ['audio_playlists', params] as const,
  playlist: (slug: string) => ['audio_playlist', slug] as const,
} as const;

/**
 * Fetch all audiobook series
 */
export const useAudiobooks = (enabled = true) =>
  useQuery<Audiobook[]>({
    queryKey: AUDIOBOOK_QUERY_KEYS.all,
    queryFn: getAudiobooks,
    enabled,
  });

/**
 * Fetch a single audiobook roadmap (series + chapters + progress)
 */
export const useAudiobookRoadmap = (id: string | undefined, enabled = true) =>
  useQuery<AudiobookRoadmap | null>({
    queryKey: id ? AUDIOBOOK_QUERY_KEYS.roadmap(id) : ['audiobook', 'roadmap', 'disabled'],
    queryFn: () => {
      if (!id) return null;
      return getAudiobookRoadmap(id);
    },
    enabled: enabled && Boolean(id),
    staleTime: 30 * 1000, // 30s — refresh often since progress changes
  });

/**
 * Mutation to save user progress on a chapter.
 * Automatically invalidates the roadmap query to update node states.
 */
export const useSaveProgress = (audiobookId?: string, playlistSlug?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      chapterId,
      currentSeconds,
      completed,
    }: {
      chapterId: string;
      currentSeconds: number;
      completed: boolean;
    }) => saveProgress(chapterId, currentSeconds, completed),
    onSuccess: () => {
      // Invalidate legacy roadmap query
      if (audiobookId) {
        queryClient.invalidateQueries({
          queryKey: AUDIOBOOK_QUERY_KEYS.roadmap(audiobookId),
        });
      }
      // Invalidate new pipeline playlist query
      if (playlistSlug) {
        queryClient.invalidateQueries({
          queryKey: AUDIOBOOK_QUERY_KEYS.playlist(playlistSlug),
        });
      }
    },
  });
};

// ─── New Pipeline Hooks ────────────────────────────────────

export const usePlaylists = (params?: PlaylistsParams) =>
  useQuery<PlaylistsResponse>({
    queryKey: AUDIOBOOK_QUERY_KEYS.playlists(params),
    queryFn: () => getPlaylists(params),
  });

export const usePlaylistBySlug = (slug: string | undefined) =>
  useQuery<AudioPlaylist | null>({
    queryKey: slug ? AUDIOBOOK_QUERY_KEYS.playlist(slug) : ['audio_playlist', 'disabled'],
    queryFn: () => {
      if (!slug) return null;
      return getPlaylistBySlug(slug);
    },
    enabled: Boolean(slug),
    staleTime: 30 * 1000, // 30s — refresh often since progress changes
  });

export default {
  useAudiobooks,
  useAudiobookRoadmap,
  useSaveProgress,
  usePlaylists,
  usePlaylistBySlug,
};
