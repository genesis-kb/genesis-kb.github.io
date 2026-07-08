import { useState, useCallback } from "react";
import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AudiobookHeader } from "@/components/audiobook/AudiobookHeader";
import { RoadmapTrack } from "@/components/audiobook/RoadmapTrack";
import { AudioPlayer } from "@/components/audiobook/AudioPlayer";
import { usePlaylistBySlug, useSaveProgress, AUDIOBOOK_QUERY_KEYS } from "@/hooks/useAudiobooks";
import type { RoadmapChapter, AudiobookRoadmap, AudioPlaylist } from "../../types";

const LearningPath = () => {
  const { id: slug } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data: playlist, isLoading, error } = usePlaylistBySlug(slug);
  const saveProgressMutation = useSaveProgress(playlist?.id, slug);

  const [activeChapter, setActiveChapter] = useState<RoadmapChapter | null>(null);

  // Map the new Playlist schema to the existing Roadmap structure
  const roadmap = useMemo<AudiobookRoadmap | null>(() => {
    if (!playlist) return null;

    const episodes = playlist.episodes || [];
    const chapters: RoadmapChapter[] = episodes.map((ep) => {
      const userProgress = ep.user_progress || null;
      const isCompleted = userProgress?.completed === true;
      const hasAudio = Boolean(ep.audio_url);

      // Simple status: completed if done, available if has audio, coming_soon if not
      let status: RoadmapChapter['status'];
      if (isCompleted) {
        status = 'completed';
      } else if (!hasAudio) {
        status = 'coming_soon';
      } else {
        status = 'available';
      }

      return {
        id: ep.id,
        audiobook_id: ep.playlist_id,
        chapter_number: ep.sequence_number,
        title: ep.title,
        description: ep.description,
        audio_url: ep.audio_url,
        duration_seconds: ep.duration_seconds ?? 0,
        transcript_summary: ep.transcript_summary || null,
        status,
        progress: userProgress
          ? {
              chapter_id: ep.id,
              current_seconds: userProgress.current_seconds,
              completed: userProgress.completed,
            }
          : null,
      };
    });

    return {
      audiobook: {
        id: playlist.id,
        title: playlist.title,
        description: playlist.description,
        thumbnail_url: playlist.cover_image_url,
        difficulty_level: playlist.difficulty_level || 'beginner',
        created_at: playlist.created_at,
        chapter_count: playlist.episode_count,
        total_duration_seconds: playlist.total_duration_seconds
      },
      chapters,
    };
  }, [playlist]);

  const handleSelectChapter = useCallback((chapter: RoadmapChapter) => {
    if (!chapter.audio_url) return;
    setActiveChapter(chapter);
  }, []);

  const handleClosePlayer = useCallback(() => {
    setActiveChapter(null);
  }, []);

  /**
   * Optimistically update the playlist cache so the UI reflects
   * changes immediately without waiting for a server round-trip.
   */
  const optimisticUpdate = useCallback(
    (chapterId: string, currentSeconds: number, completed: boolean) => {
      if (!slug) return;
      queryClient.setQueryData<AudioPlaylist | null>(
        AUDIOBOOK_QUERY_KEYS.playlist(slug),
        (old) => {
          if (!old?.episodes) return old ?? null;
          return {
            ...old,
            episodes: old.episodes.map((ep) => {
              if (ep.id !== chapterId) return ep;
              // NEVER downgrade completed from true → false
              const wasCompleted = ep.user_progress?.completed === true;
              return {
                ...ep,
                user_progress: {
                  current_seconds: currentSeconds,
                  completed: wasCompleted || completed,
                },
              };
            }),
          };
        }
      );
    },
    [slug, queryClient]
  );

  const handleComplete = useCallback(
    (chapterId: string, currentSeconds?: number) => {
      let finalSeconds = currentSeconds;
      if (finalSeconds === undefined && slug) {
        const cached = queryClient.getQueryData<AudioPlaylist | null>(
          AUDIOBOOK_QUERY_KEYS.playlist(slug)
        );
        const ep = cached?.episodes?.find((e) => e.id === chapterId);
        finalSeconds = ep?.user_progress?.current_seconds ?? 0;
      } else if (finalSeconds === undefined) {
        finalSeconds = 0;
      }

      // Optimistic: mark completed in cache immediately
      optimisticUpdate(chapterId, finalSeconds, true);
      saveProgressMutation.mutate({
        chapterId,
        currentSeconds: finalSeconds,
        completed: true,
      });
    },
    [saveProgressMutation, optimisticUpdate, queryClient, slug]
  );

  const handleProgressSave = useCallback(
    (chapterId: string, currentSeconds: number) => {
      // Optimistic: update seconds in cache immediately
      optimisticUpdate(chapterId, currentSeconds, false);
      saveProgressMutation.mutate({
        chapterId,
        currentSeconds,
        completed: false,
      });
    },
    [saveProgressMutation, optimisticUpdate]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-bitcoin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground font-mono">
            Loading learning path...
          </p>
        </div>
      </div>
    );
  }

  // Error / not found state
  if (error || !roadmap) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-12 text-center">
        <h2 className="font-display text-xl font-semibold mb-2">
          Audiobook not found
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          This learning path may have been removed or the link is incorrect.
        </p>
        <Link
          to="/audiobooks"
          className="inline-flex items-center gap-2 text-sm text-bitcoin hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to audiobooks
        </Link>
      </div>
    );
  }

  return (
    <div
      className={`max-w-[1400px] mx-auto px-4 sm:px-6 py-8 ${
        activeChapter ? "pb-32" : ""
      }`}
    >
      {/* Back link */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="mb-6"
      >
        <Link
          to="/audiobooks"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          All Audiobooks
        </Link>
      </motion.div>

      {/* Header */}
      <AudiobookHeader
        audiobook={roadmap.audiobook}
        chapters={roadmap.chapters}
        tags={playlist?.tags}
      />

      {/* Roadmap track */}
      <div className="mt-10">
        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center font-mono text-xs uppercase tracking-widest text-muted-foreground mb-6"
        >
          Learning Roadmap
        </motion.h2>

        <RoadmapTrack
          chapters={roadmap.chapters}
          onSelectChapter={handleSelectChapter}
        />
      </div>

      {/* Audio Player */}
      <AnimatePresence>
        {activeChapter && (
          <AudioPlayer
            key={activeChapter.id}
            chapter={activeChapter}
            onClose={handleClosePlayer}
            onComplete={handleComplete}
            onProgressSave={handleProgressSave}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default LearningPath;
