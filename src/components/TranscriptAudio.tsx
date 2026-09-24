import { useState, useRef, useCallback, useEffect } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, Loader2, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { loadSpeechAudio, loadStoredSpeechAudio } from "../../services/aiService";
import { useAuth } from "@/hooks/useAuth";
import type { RawTranscript } from "../../types";

export const TranscriptAudio = ({ transcript }: { transcript: RawTranscript }) => {
  const { user } = useAuth();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingStored, setIsLoadingStored] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState("00:00");
  const [totalDuration, setTotalDuration] = useState("00:00");
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseOffsetRef = useRef<number>(0);
  const animFrameRef = useRef<number>(0);

  const speakerNames = Array.isArray(transcript.speakers)
    ? transcript.speakers.join(" & ")
    : transcript.speakers || "the speaker";

  // Cleanup AudioContext and animation frames on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.stop();
        } catch {
          // Ignore cleanup errors during teardown.
        }
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {
          // Ignore cleanup errors during teardown.
        });
      }
    };
  }, []);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const updateProgress = useCallback(() => {
    if (!audioContextRef.current || !audioBufferRef.current || !isPlaying) return;

    const elapsed = audioContextRef.current.currentTime - startTimeRef.current + pauseOffsetRef.current;
    const duration = audioBufferRef.current.duration;
    const pct = Math.min((elapsed / duration) * 100, 100);

    setProgress(pct);
    setCurrentTime(formatTime(elapsed));

    if (pct < 100) {
      animFrameRef.current = requestAnimationFrame(updateProgress);
    } else {
      setIsPlaying(false);
      setProgress(100);
    }
  }, [isPlaying]);

  const showAudio = async (wav: ArrayBuffer) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }

    const buffer = await audioContextRef.current.decodeAudioData(wav);
    audioBufferRef.current = buffer;
    setTotalDuration(formatTime(buffer.duration));
    setIsGenerated(true);
  };

  // Show audio someone already generated as soon as the player opens.
  // Signed-out users can't read stored audio, so skip the check for them.
  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    setIsLoadingStored(true);

    loadStoredSpeechAudio(transcript.id, "summary")
      .then((wav) => (wav && !cancelled ? showAudio(wav) : undefined))
      .catch(() => {
        // Nothing to show yet — the Generate button still works.
      })
      .finally(() => {
        if (!cancelled) setIsLoadingStored(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript.id, user?.id]);

  const handleGenerate = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setError(null);

    try {
      // The backend reads the summary (or the transcript when there is none),
      // generating the audio only the first time anyone asks for it.
      await showAudio(await loadSpeechAudio(transcript.id, "summary"));
    } catch (err) {
      console.error("TTS generation error:", err);
      setError(err instanceof Error ? err.message : "Failed to generate audio.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePlayPause = () => {
    if (!audioBufferRef.current || !audioContextRef.current) return;

    if (isPlaying) {
      // Pause
      cancelAnimationFrame(animFrameRef.current);
      if (sourceNodeRef.current) {
        pauseOffsetRef.current += audioContextRef.current.currentTime - startTimeRef.current;
        sourceNodeRef.current.stop();
        sourceNodeRef.current = null;
      }
      setIsPlaying(false);
    } else {
      // Play. A context created before any user gesture (stored audio loaded
      // on open) starts suspended, so resume it on this click.
      if (audioContextRef.current.state === "suspended") {
        void audioContextRef.current.resume();
      }
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBufferRef.current;
      source.connect(audioContextRef.current.destination);

      source.onended = () => {
        if (isPlaying) {
          setIsPlaying(false);
          setProgress(100);
          cancelAnimationFrame(animFrameRef.current);
        }
      };

      startTimeRef.current = audioContextRef.current.currentTime;
      source.start(0, pauseOffsetRef.current);
      sourceNodeRef.current = source;
      setIsPlaying(true);

      // Start progress updates
      const tick = () => {
        if (!audioContextRef.current || !audioBufferRef.current) return;
        const elapsed = audioContextRef.current.currentTime - startTimeRef.current + pauseOffsetRef.current;
        const duration = audioBufferRef.current.duration;
        const pct = Math.min((elapsed / duration) * 100, 100);
        setProgress(pct);
        setCurrentTime(formatTime(elapsed));
        if (pct < 100) {
          animFrameRef.current = requestAnimationFrame(tick);
        } else {
          setIsPlaying(false);
        }
      };
      animFrameRef.current = requestAnimationFrame(tick);
    }
  };

  const handleSkip = (direction: "back" | "forward") => {
    if (!audioBufferRef.current) return;
    const skipAmount = 5; // seconds
    const duration = audioBufferRef.current.duration;
    let newOffset = pauseOffsetRef.current;

    if (isPlaying && audioContextRef.current) {
      newOffset = audioContextRef.current.currentTime - startTimeRef.current + pauseOffsetRef.current;
    }

    newOffset = direction === "forward"
      ? Math.min(newOffset + skipAmount, duration)
      : Math.max(newOffset - skipAmount, 0);

    pauseOffsetRef.current = newOffset;
    setProgress((newOffset / duration) * 100);
    setCurrentTime(formatTime(newOffset));

    if (isPlaying) {
      // Restart from new position
      cancelAnimationFrame(animFrameRef.current);
      if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
      }
      handlePlayPause();
    }
  };

  // Generate waveform bars deterministically
  const bars = Array.from({ length: 60 }, (_, i) => ({
    height: 20 + Math.sin(i * 0.5) * 15 + ((i * 7 + 13) % 20),
  }));

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className={`w-2 h-2 rounded-full ${isGenerated ? "bg-primary" : "bg-muted-foreground"} ${isPlaying ? "animate-pulse" : ""}`} />
          <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
            {isGenerated ? "AI-Generated Audio" : "Audio Generation"}
          </span>
        </div>

        <h4 className="font-display font-semibold mb-1">{transcript.title}</h4>
        <p className="text-sm text-muted-foreground mb-6">
          {isGenerated ? `Narrated summary by ${speakerNames}` : "Generate AI narration for this transcript"}
        </p>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!isGenerated ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground mb-4">
              Click below to generate AI-narrated audio from this transcript using text-to-speech.
            </p>
            <button
              onClick={handleGenerate}
              disabled={isGenerating || isLoadingStored}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-display font-semibold text-sm hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating Audio...
                </>
              ) : isLoadingStored ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading Audio...
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4" />
                  Generate Audio
                </>
              )}
            </button>
          </div>
        ) : (
          <>
            {/* Waveform */}
            <div className="relative h-16 mb-4 flex items-end gap-[2px] rounded-lg overflow-hidden">
              {bars.map((bar, i) => {
                const isActive = (i / bars.length) * 100 <= progress;
                return (
                  <motion.div
                    key={i}
                    className={`flex-1 rounded-sm transition-colors duration-200 ${isActive ? "bg-primary" : "bg-secondary"}`}
                    style={{ height: `${bar.height}%` }}
                    animate={isPlaying && isActive ? { scaleY: [1, 1.2, 1], opacity: [0.8, 1, 0.8] } : {}}
                    transition={{ duration: 0.4, repeat: Infinity, delay: i * 0.02 }}
                  />
                );
              })}
            </div>

            {/* Progress bar */}
            <div
              className="relative h-1 bg-secondary rounded-full mb-4 cursor-pointer"
              onClick={(e) => {
                if (!audioBufferRef.current) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = ((e.clientX - rect.left) / rect.width) * 100;
                const duration = audioBufferRef.current.duration;
                const newOffset = (pct / 100) * duration;
                pauseOffsetRef.current = newOffset;
                setProgress(pct);
                setCurrentTime(formatTime(newOffset));

                if (isPlaying && sourceNodeRef.current) {
                  cancelAnimationFrame(animFrameRef.current);
                  sourceNodeRef.current.stop();
                  sourceNodeRef.current = null;
                  setIsPlaying(false);
                  // Re-trigger play from new position
                  setTimeout(() => handlePlayPause(), 50);
                }
              }}
            >
              <div className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
              <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary shadow-lg" style={{ left: `${progress}%` }} />
            </div>

            {/* Time */}
            <div className="flex justify-between text-xs font-mono text-muted-foreground mb-6">
              <span>{currentTime}</span>
              <span>{totalDuration}</span>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => handleSkip("back")}
                className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
              >
                <SkipBack className="w-4 h-4 text-foreground" />
              </button>
              <button
                onClick={handlePlayPause}
                className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center glow-bitcoin hover:scale-105 transition-transform"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>
              <button
                onClick={() => handleSkip("forward")}
                className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
              >
                <SkipForward className="w-4 h-4 text-foreground" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
