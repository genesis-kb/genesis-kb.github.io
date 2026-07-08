import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { getUserId } from "../../../services/audiobookService";
import config from "../../../services/config";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  X,
  Gauge,
  CheckCircle,
  ChevronUp,
  ChevronDown,
  Headphones,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { MarkdownRenderer } from "../MarkdownRenderer";
import type { RoadmapChapter } from "../../../types";

interface AudioPlayerProps {
  chapter: RoadmapChapter;
  onClose: () => void;
  onComplete: (chapterId: string, currentSeconds?: number) => void;
  onProgressSave: (chapterId: string, currentSeconds: number) => void;
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
const DEFAULT_SPEED_INDEX = 2; // 1x
const SAVE_INTERVAL_MS = 5000;

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

export const AudioPlayer = ({
  chapter,
  onClose,
  onComplete,
  onProgressSave,
}: AudioPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const lastSaveRef = useRef<number>(Date.now());
  const isCompletedRef = useRef(chapter.status === "completed");
  const onProgressSaveRef = useRef(onProgressSave);
  const onCompleteRef = useRef(onComplete);
  const lastTimeRef = useRef(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(chapter.duration_seconds || 0);
  const [speedIndex, setSpeedIndex] = useState(DEFAULT_SPEED_INDEX);
  const [expanded, setExpanded] = useState(false);
  const [isCompleted, setIsCompleted] = useState(chapter.status === "completed");

  // Keep refs in sync with latest values
  useEffect(() => { isCompletedRef.current = isCompleted; }, [isCompleted]);
  useEffect(() => { onProgressSaveRef.current = onProgressSave; }, [onProgressSave]);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  // Initialize audio with resume position
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoaded = () => {
      setDuration(audio.duration || chapter.duration_seconds);
      // Resume from saved position
      if (chapter.progress?.current_seconds) {
        audio.currentTime = chapter.progress.current_seconds;
        setCurrentTime(chapter.progress.current_seconds);
      }
    };

    const handleTimeUpdate = () => {
      const time = audio.currentTime;
      lastTimeRef.current = time;
      setCurrentTime(time);

      // Auto-complete at 95% — check BEFORE auto-save to avoid race
      const dur = audio.duration || chapter.duration_seconds;
      if (dur > 0 && time / dur >= 0.95 && !isCompletedRef.current) {
        isCompletedRef.current = true;
        setIsCompleted(true);
        onCompleteRef.current(chapter.id, time);
        // Reset save timer so the next auto-save doesn't immediately fire with completed:false
        lastSaveRef.current = Date.now();
        return; // Skip the auto-save below — completion already persisted
      }

      // Periodic auto-save — but ONLY if not yet completed
      // (once completed, onComplete already saved the final state)
      if (!isCompletedRef.current) {
        const now = Date.now();
        if (now - lastSaveRef.current >= SAVE_INTERVAL_MS) {
          lastSaveRef.current = now;
          onProgressSaveRef.current(chapter.id, time);
        }
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      if (!isCompletedRef.current) {
        isCompletedRef.current = true;
        setIsCompleted(true);
        onCompleteRef.current(chapter.id, audio.currentTime);
      }
    };

    audio.addEventListener("loadedmetadata", handleLoaded);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoaded);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [chapter.id, chapter.progress?.current_seconds, chapter.duration_seconds]);

  // Save progress on unmount — fire-and-forget via sendBeacon/fetch keepalive
  // to avoid triggering React Query state updates on an unmounted component.
  useEffect(() => {
    return () => {
      const payload = JSON.stringify({
        user_id: getUserId(),
        chapter_id: chapter.id,
        current_seconds: lastTimeRef.current,
        completed: isCompletedRef.current,
      });

      const url = `${config.apiUrl}${config.endpoints.audiobookProgress}`;

      // Prefer sendBeacon — it's guaranteed to fire even during page unload
      const blob = new Blob([payload], { type: 'application/json' });
      const sent = navigator.sendBeacon?.(url, blob);

      // Fallback: fetch with keepalive (same guarantee, wider header support)
      if (!sent) {
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        }).catch(() => { /* best-effort — nothing to do on failure */ });
      }
    };
  }, [chapter.id]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      // If already completed, fire onComplete to preserve the flag;
      // otherwise fire onProgressSave (which sends completed:false)
      if (isCompletedRef.current) {
        onComplete(chapter.id, audio.currentTime);
      } else {
        onProgressSave(chapter.id, audio.currentTime);
      }
    } else {
      audio.play()
        .then(() => {
          setIsPlaying(true);
          // Reset the save timer so the first auto-save fires
          // a full SAVE_INTERVAL_MS after playback starts
          lastSaveRef.current = Date.now();
        })
        .catch((err) => {
          console.error("Playback failed:", err);
          setIsPlaying(false);
        });
    }
  }, [isPlaying, chapter.id, onProgressSave, onComplete]);

  const handleSkip = useCallback(
    (direction: "back" | "forward") => {
      const audio = audioRef.current;
      if (!audio) return;
      const skip = 10;
      audio.currentTime =
        direction === "forward"
          ? Math.min(audio.currentTime + skip, audio.duration || duration)
          : Math.max(audio.currentTime - skip, 0);
      setCurrentTime(audio.currentTime);
    },
    [duration]
  );

  const cycleSpeed = useCallback(() => {
    const nextIndex = (speedIndex + 1) % SPEED_OPTIONS.length;
    setSpeedIndex(nextIndex);
    if (audioRef.current) {
      audioRef.current.playbackRate = SPEED_OPTIONS[nextIndex];
    }
  }, [speedIndex]);

  const handleScrub = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const bar = progressBarRef.current;
      const audio = audioRef.current;
      if (!bar || !audio) return;
      const rect = bar.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      audio.currentTime = pct * (audio.duration || duration);
      setCurrentTime(audio.currentTime);
    },
    [duration]
  );

  const handleClose = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      // Preserve completed flag on close
      if (isCompletedRef.current) {
        onComplete(chapter.id, audioRef.current.currentTime);
      } else {
        onProgressSave(chapter.id, audioRef.current.currentTime);
      }
    }
    onClose();
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Generate deterministic waveform bars
  const bars = useMemo(() => Array.from({ length: 50 }, (_, i) => ({
    height: 20 + Math.sin(i * 0.5) * 15 + ((i * 7 + 13) % 25),
  })), []);

  // Guard: if audio_url is missing, don't render the player at all
  if (!chapter.audio_url) {
    return null;
  }

  return (
    <>
      {/* Hidden audio element */}
      <audio ref={audioRef} src={chapter.audio_url} preload="metadata" />

      {/* Player bar */}
      <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-2xl"
          id="audiobook-player"
        >
          {/* Expanded panel */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden border-b border-border"
              >
                <div className="max-w-3xl mx-auto px-4 py-6 max-h-[40vh] overflow-y-auto">
                  {/* Waveform visualization */}
                  <div className="relative h-16 mb-6 flex items-end gap-[2px] rounded-lg overflow-hidden">
                    {bars.map((bar, i) => {
                      const isActive = (i / bars.length) * 100 <= progress;
                      return (
                        <motion.div
                          key={i}
                          className={`flex-1 rounded-sm transition-colors duration-200 ${
                            isActive ? "bg-bitcoin" : "bg-secondary"
                          }`}
                          style={{ height: `${bar.height}%` }}
                          animate={
                            isPlaying && isActive
                              ? {
                                  scaleY: [1, 1.2, 1],
                                  opacity: [0.8, 1, 0.8],
                                }
                              : {}
                          }
                          transition={{
                            duration: 0.4,
                            repeat: Infinity,
                            delay: i * 0.02,
                          }}
                        />
                      );
                    })}
                  </div>

                  {/* Chapter description */}
                  {chapter.description && (
                    <p className="text-sm text-muted-foreground mb-4">
                      {chapter.description}
                    </p>
                  )}

                  {/* Transcript summary (markdown) */}
                  {chapter.transcript_summary && (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <MarkdownRenderer content={chapter.transcript_summary} />
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main controls bar */}
          <div className="max-w-3xl mx-auto px-4 py-3">
            {/* Scrub bar */}
            <div
              ref={progressBarRef}
              onClick={handleScrub}
              onKeyDown={(e) => {
                const audio = audioRef.current;
                if (!audio) return;
                switch (e.key) {
                  case "ArrowRight":
                  case "ArrowUp":
                    e.preventDefault();
                    handleSkip("forward");
                    break;
                  case "ArrowLeft":
                  case "ArrowDown":
                    e.preventDefault();
                    handleSkip("back");
                    break;
                  case "Home":
                    e.preventDefault();
                    audio.currentTime = 0;
                    setCurrentTime(0);
                    break;
                  case "End":
                    e.preventDefault();
                    audio.currentTime = audio.duration || duration;
                    setCurrentTime(audio.currentTime);
                    break;
                  case "PageUp":
                    e.preventDefault();
                    audio.currentTime = Math.min(audio.currentTime + 30, audio.duration || duration);
                    setCurrentTime(audio.currentTime);
                    break;
                  case "PageDown":
                    e.preventDefault();
                    audio.currentTime = Math.max(audio.currentTime - 30, 0);
                    setCurrentTime(audio.currentTime);
                    break;
                }
              }}
              role="slider"
              aria-orientation="horizontal"
              tabIndex={0}
              aria-valuemin={0}
              aria-valuemax={duration}
              aria-valuenow={currentTime}
              aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
              aria-label="Seek progress"
              className="relative h-1.5 bg-secondary rounded-full mb-3 cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bitcoin focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            >
              <div
                className="absolute top-0 left-0 h-full bg-bitcoin rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-bitcoin shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ left: `${progress}%` }}
              />
            </div>

            {/* Time labels */}
            <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-3">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>

            {/* Controls row */}
            <div className="flex items-center justify-between">
              {/* Left: chapter info */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isCompleted
                      ? "bg-terminal/10 text-terminal"
                      : "bg-bitcoin/10 text-bitcoin"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <Headphones className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-display font-semibold truncate">
                    {chapter.title}
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground">
                    Chapter {chapter.chapter_number}
                    {isCompleted && " · Completed"}
                  </p>
                </div>
              </div>

              {/* Center: playback controls */}
              <div className="flex items-center gap-3 mx-4">
                <button
                  onClick={() => handleSkip("back")}
                  className="relative w-9 h-9 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors group"
                  aria-label="Skip back 10 seconds"
                >
                  <RotateCcw className="w-4 h-4 text-foreground" />
                  <span className="absolute inset-0 flex items-center justify-center text-[8px] font-mono font-bold text-foreground mt-[1px]">10</span>
                </button>

                <button
                  onClick={togglePlay}
                  className="w-12 h-12 rounded-full bg-bitcoin text-white flex items-center justify-center glow-bitcoin hover:scale-105 transition-transform"
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5" />
                  ) : (
                    <Play className="w-5 h-5 ml-0.5" />
                  )}
                </button>

                <button
                  onClick={() => handleSkip("forward")}
                  className="relative w-9 h-9 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors group"
                  aria-label="Skip forward 10 seconds"
                >
                  <RotateCw className="w-4 h-4 text-foreground" />
                  <span className="absolute inset-0 flex items-center justify-center text-[8px] font-mono font-bold text-foreground mt-[1px]">10</span>
                </button>
              </div>

              {/* Right: speed + expand + close */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={cycleSpeed}
                  className="flex items-center gap-1 h-7 px-2 rounded-md bg-secondary text-xs font-mono text-foreground hover:bg-secondary/80 transition-colors"
                  aria-label={`Playback speed: ${SPEED_OPTIONS[speedIndex]}x`}
                >
                  <Gauge className="w-3 h-3" />
                  {SPEED_OPTIONS[speedIndex]}×
                </button>

                <button
                  onClick={() => setExpanded(!expanded)}
                  className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
                  aria-label={expanded ? "Collapse player" : "Expand player"}
                >
                  {expanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronUp className="w-4 h-4" />
                  )}
                </button>

                <button
                  onClick={handleClose}
                  className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-colors"
                  aria-label="Close player"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
    </>
  );
};

export default AudioPlayer;
