import { motion } from "framer-motion";
import { BookOpen, Clock, BarChart3, CheckCircle } from "lucide-react";
import type { Audiobook, RoadmapChapter } from "../../../types";
import { difficultyConfig, formatDuration } from "./constants";
import { inferDifficulty, getTopicImageUrl } from "./topicUtils";

interface AudiobookHeaderProps {
  audiobook: Audiobook;
  chapters: RoadmapChapter[];
  /** Tags from the playlist — used for dynamic difficulty inference & auto-thumbnails */
  tags?: string[];
}

export const AudiobookHeader = ({ audiobook, chapters, tags = [] }: AudiobookHeaderProps) => {
  const completedCount = chapters.filter((c) => c.status === "completed").length;
  const totalCount = chapters.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Dynamic difficulty from tags + title + description
  const diffKey = inferDifficulty({
    difficulty_level: audiobook.difficulty_level,
    title: audiobook.title,
    description: audiobook.description,
    tags,
  });
  const difficulty = difficultyConfig[diffKey] || difficultyConfig.beginner;

  // Playlist-like shape for TopicImageUrl
  const thumbnailProps = { title: audiobook.title, description: audiobook.description, tags, cover_image_url: audiobook.thumbnail_url || null };
  const imageUrl = getTopicImageUrl(thumbnailProps);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative rounded-2xl border border-border overflow-hidden bg-card"
    >
      {/* Background: image thumbnail */}
      <div className="absolute inset-0">
        <img
          src={imageUrl}
          alt=""
          className="w-full h-full object-cover opacity-15 dark:opacity-10"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/80 to-card/40" />
      </div>

      <div className="relative p-6 md:p-8">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Thumbnail */}
          <div className="shrink-0">
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-xl overflow-hidden border border-border shadow-lg">
              <img
                src={imageUrl}
                alt={audiobook.title}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            {/* Difficulty badge */}
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold uppercase tracking-wider border ${difficulty.color} mb-3`}
            >
              <BarChart3 className="w-3 h-3" />
              {difficulty.label}
            </span>

            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-2">
              {audiobook.title}
            </h1>

            {audiobook.description && (
              <p className="text-sm md:text-base text-muted-foreground leading-relaxed mb-4 max-w-2xl">
                {audiobook.description}
              </p>
            )}

            {/* Stats row */}
            <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                {totalCount} Chapters
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {formatDuration(audiobook.total_duration_seconds)}
              </span>
              <span className="flex items-center gap-1.5 text-terminal">
                <CheckCircle className="w-3.5 h-3.5" />
                {completedCount}/{totalCount} Completed
              </span>
            </div>

            {/* Overall progress bar */}
            <div className="mt-4 max-w-xs">
              <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-1">
                <span>Progress</span>
                <span>{progressPct}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-bitcoin to-terminal rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default AudiobookHeader;
