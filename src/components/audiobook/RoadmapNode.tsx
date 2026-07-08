import { motion } from "framer-motion";
import {
  Play,
  CheckCircle,
  Clock,
  Headphones,
} from "lucide-react";
import type { RoadmapChapter } from "../../../types";
import { formatDuration } from "./constants";

interface RoadmapNodeProps {
  chapter: RoadmapChapter;
  index: number;
  isLeft: boolean;
  onSelect: (chapter: RoadmapChapter) => void;
}

export const RoadmapNode = ({
  chapter,
  index,
  isLeft,
  onSelect,
}: RoadmapNodeProps) => {
  const isCompleted = chapter.status === "completed";
  const isMissingAudio = !chapter.audio_url;

  // Resume percentage for in-progress chapters (available + has progress)
  const resumePct =
    !isCompleted && !isMissingAudio && chapter.progress && chapter.duration_seconds > 0
      ? Math.min(
          100,
          Math.max(
            0,
            Math.round(
              (chapter.progress.current_seconds / chapter.duration_seconds) * 100
            )
          )
        )
      : 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: isLeft ? -40 : 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: "easeOut" }}
      className={`flex items-center gap-4 md:gap-6 w-full ${
        isLeft ? "md:flex-row" : "md:flex-row-reverse"
      } flex-row`}
    >
      {/* Node circle */}
      <button
        disabled={isMissingAudio}
        onClick={() => !isMissingAudio && onSelect(chapter)}
        className={`relative shrink-0 w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring
          ${
            isMissingAudio
              ? "bg-muted border-2 border-border cursor-not-allowed opacity-50"
              : isCompleted
              ? "bg-terminal/20 border-2 border-terminal cursor-pointer hover:scale-105"
              : "bg-bitcoin/10 border-2 border-bitcoin cursor-pointer hover:scale-110"
          }
        `}
        id={`roadmap-node-${chapter.chapter_number}`}
        aria-label={`Chapter ${chapter.chapter_number}: ${chapter.title} — ${chapter.status}`}
      >
        {/* Pulse ring for available (non-completed) nodes */}
        {!isCompleted && !isMissingAudio && (
          <span className="absolute inset-0 rounded-full animate-ping bg-bitcoin/20" />
        )}

        {isCompleted && !isMissingAudio && <CheckCircle className="w-6 h-6 text-terminal" />}
        {!isCompleted && !isMissingAudio && <Play className="w-5 h-5 text-bitcoin ml-0.5" />}
        {isMissingAudio && <Clock className="w-5 h-5 text-muted-foreground" />}

        {/* Chapter number badge */}
        <span
          className={`absolute -top-1 -right-1 w-5 h-5 rounded-full text-[10px] font-mono font-bold flex items-center justify-center
            ${
              isMissingAudio
                ? "bg-muted text-muted-foreground"
                : isCompleted
                ? "bg-terminal text-white"
                : "bg-bitcoin text-white"
            }
          `}
        >
          {chapter.chapter_number}
        </span>
      </button>

      {/* Info card */}
      <motion.div
        whileHover={!isMissingAudio ? { scale: 1.02 } : {}}
        whileTap={!isMissingAudio ? { scale: 0.98 } : {}}
        onClick={() => !isMissingAudio && onSelect(chapter)}
        className={`flex-1 rounded-xl p-4 border transition-all duration-200 max-w-md
          ${
            isMissingAudio
              ? "bg-muted/30 border-border/50 cursor-not-allowed opacity-60"
              : isCompleted
              ? "bg-terminal/5 border-terminal/30 cursor-pointer hover:border-terminal/50 hover:shadow-lg hover:shadow-terminal/5"
              : "bg-card border-bitcoin/30 cursor-pointer hover:border-bitcoin/50 hover:shadow-lg hover:shadow-bitcoin/10 glow-bitcoin"
          }
          ${isLeft ? "md:text-left" : "md:text-right"} text-left
        `}
      >
        <h3
          className={`font-display font-semibold text-sm md:text-base ${
            isMissingAudio ? "text-muted-foreground" : "text-foreground"
          }`}
        >
          {chapter.title}
        </h3>
        {chapter.description && (
          <p
            className={`text-xs mt-1 line-clamp-2 ${
              isMissingAudio ? "text-muted-foreground/60" : "text-muted-foreground"
            }`}
          >
            {chapter.description}
          </p>
        )}

        <div
          className={`flex items-center gap-3 mt-2 text-[11px] font-mono ${
            isMissingAudio ? "text-muted-foreground/50" : "text-muted-foreground"
          } ${isLeft ? "md:justify-start" : "md:justify-end"} justify-start`}
        >
          {chapter.audio_url ? (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDuration(chapter.duration_seconds)}
            </span>
          ) : (
            <span className="flex items-center gap-1 italic text-muted-foreground/70">
              <Clock className="w-3 h-3" />
              Coming soon
            </span>
          )}
          {!isCompleted && resumePct > 0 && (
            <span className="flex items-center gap-1 text-bitcoin">
              <Headphones className="w-3 h-3" />
              {resumePct}% done
            </span>
          )}
          {isCompleted && (
            <span className="flex items-center gap-1 text-terminal">
              <CheckCircle className="w-3 h-3" />
              Completed
            </span>
          )}
        </div>

        {/* Mini progress bar for in-progress chapters */}
        {!isCompleted && resumePct > 0 && (
          <div className="mt-2 h-1 w-full rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full bg-bitcoin rounded-full transition-all"
              style={{ width: `${resumePct}%` }}
            />
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default RoadmapNode;
