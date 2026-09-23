import { useState, useEffect, useRef, useMemo } from "react";
import { Play, Pause, Download, Volume2, SkipForward, SkipBack, Loader2, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { generateSpeech, decodeAudioData } from "../../services/aiService";
import { getTranscriptById } from "../../services/dataService";
import type { Talk } from "../../types";
import { useConferences } from "@/hooks/useTranscripts";

const AudioGeneration = () => {
  const [selectedTalk, setSelectedTalk] = useState<{ talk: Talk; conferenceName: string } | null>(null);
  const { data: conferences = [], isLoading } = useConferences();

  // Audio state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
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

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const allTalks = useMemo(
    () => conferences.flatMap((conf) => conf.talks.map((talk) => ({ talk, conferenceName: conf.name }))),
    [conferences]
  );

  useEffect(() => {
    if (!selectedTalk && allTalks.length > 0) {
      setSelectedTalk(allTalks[0]);
    }
  }, [allTalks, selectedTalk]);

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

  const resetAudio = () => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch {
        // Ignore cleanup errors during teardown.
      }
      sourceNodeRef.current = null;
    }
    cancelAnimationFrame(animFrameRef.current);
    audioBufferRef.current = null;
    pauseOffsetRef.current = 0;
    startTimeRef.current = 0;
    setIsPlaying(false);
    setIsGenerated(false);
    setProgress(0);
    setCurrentTime("00:00");
    setTotalDuration("00:00");
    setError(null);
  };

  const handleSelectTalk = (item: { talk: Talk; conferenceName: string }) => {
    resetAudio();
    setSelectedTalk(item);
  };

  const handleGenerate = async () => {
    if (!selectedTalk || isGenerating) return;
    setIsGenerating(true);
    setError(null);

    try {
      let sourceText = selectedTalk.talk.summary || selectedTalk.talk.transcript || "";

      // On-demand fallback: if lean list data has no usable text, fetch detail payload for this talk.
      if (!sourceText.trim()) {
        const detail = await getTranscriptById(selectedTalk.talk.id);
        sourceText = detail?.summary || detail?.corrected_text || detail?.raw_text || "";
      }

      const textToSpeak = sourceText.slice(0, 5000);
      if (textToSpeak.trim().length === 0) {
        setError("No text available for audio generation.");
        return;
      }

      const speech = await generateSpeech(textToSpeak, selectedTalk.talk.id);

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      const buffer = await decodeAudioData(speech, audioContextRef.current);
      audioBufferRef.current = buffer;
      setTotalDuration(formatTime(buffer.duration));
      setIsGenerated(true);
    } catch (err) {
      console.error("TTS error:", err);
      setError(err instanceof Error ? err.message : "Failed to generate audio.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePlayPause = () => {
    if (!audioBufferRef.current || !audioContextRef.current) return;

    if (isPlaying) {
      cancelAnimationFrame(animFrameRef.current);
      if (sourceNodeRef.current) {
        pauseOffsetRef.current += audioContextRef.current.currentTime - startTimeRef.current;
        sourceNodeRef.current.stop();
        sourceNodeRef.current = null;
      }
      setIsPlaying(false);
    } else {
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBufferRef.current;
      source.connect(audioContextRef.current.destination);
      source.onended = () => {
        setIsPlaying(false);
        setProgress(100);
        cancelAnimationFrame(animFrameRef.current);
      };
      startTimeRef.current = audioContextRef.current.currentTime;
      source.start(0, pauseOffsetRef.current);
      sourceNodeRef.current = source;
      setIsPlaying(true);

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

  if (isLoading) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-center gap-3 py-20">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
          <span className="text-sm text-muted-foreground font-mono">Loading transcripts...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono mb-6">
        <Link to="/" className="hover:text-foreground">Home</Link>
        <span>/</span>
        <span className="text-primary">Audio</span>
      </div>

      <h1 className="font-display text-3xl font-bold mb-2">AI Audio Generation</h1>
      <p className="text-muted-foreground mb-8 max-w-2xl">
        Convert transcripts and summaries into narrated audio experiences powered by AI text-to-speech.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Transcript list */}
        <div className="lg:col-span-1 space-y-2">
          <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">Select Transcript</h3>
          {allTalks.length === 0 && (
            <p className="text-sm text-muted-foreground font-mono py-4">No transcripts available.</p>
          )}
          {allTalks.slice(0, 10).map((item) => (
            <motion.button
              key={item.talk.id}
              onClick={() => handleSelectTalk(item)}
              className={`w-full text-left p-3 rounded-lg border transition-all ${
                selectedTalk?.talk.id === item.talk.id
                  ? "border-primary/30 bg-primary/5"
                  : "border-border bg-card hover:border-primary/20"
              }`}
            >
              <div className="font-medium text-sm truncate">{item.talk.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{item.talk.speaker}</div>
            </motion.button>
          ))}
        </div>

        {/* Player & controls */}
        <div className="lg:col-span-2 space-y-6">
          {selectedTalk ? (
            <>
              {/* Audio player */}
              <div className="rounded-2xl border border-border bg-card p-6">
                <div className="mb-4">
                  <h2 className="font-display font-bold text-lg">{selectedTalk.talk.title}</h2>
                  <p className="text-sm text-muted-foreground">{selectedTalk.talk.speaker}</p>
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm mb-4">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {!isGenerated ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground mb-4">
                      Generate AI-narrated audio from this transcript.
                    </p>
                    <button
                      onClick={handleGenerate}
                      disabled={isGenerating}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-display font-semibold text-sm hover:scale-[1.02] transition-transform disabled:opacity-50"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Generating...
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
                    {/* Waveform visualization */}
                    <div className="relative h-16 mb-4 flex items-center gap-0.5 overflow-hidden rounded-lg bg-secondary p-2">
                      {Array.from({ length: 80 }).map((_, i) => (
                        <motion.div
                          key={i}
                          className="flex-1 rounded-full"
                          style={{
                            backgroundColor: i < (progress / 100) * 80 ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.2)",
                            height: `${20 + ((i * 7 + 13) % 60)}%`,
                          }}
                          animate={isPlaying ? { height: [`${20 + ((i * 7 + 13) % 60)}%`, `${20 + ((i * 11 + 7) % 60)}%`] } : {}}
                          transition={{ repeat: Infinity, duration: 0.5 + (i % 5) * 0.1 }}
                        />
                      ))}
                    </div>

                    {/* Progress bar */}
                    <div className="flex items-center gap-3 mb-4">
                      <span className="font-mono text-xs text-muted-foreground">{currentTime}</span>
                      <div
                        className="flex-1 h-1.5 rounded-full bg-secondary cursor-pointer"
                        onClick={(e) => {
                          if (!audioBufferRef.current) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const pct = ((e.clientX - rect.left) / rect.width) * 100;
                          const newOffset = (pct / 100) * audioBufferRef.current.duration;
                          pauseOffsetRef.current = newOffset;
                          setProgress(pct);
                          setCurrentTime(formatTime(newOffset));
                          if (isPlaying && sourceNodeRef.current) {
                            cancelAnimationFrame(animFrameRef.current);
                            sourceNodeRef.current.stop();
                            sourceNodeRef.current = null;
                            setIsPlaying(false);
                            setTimeout(() => handlePlayPause(), 50);
                          }
                        }}
                      >
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                      </div>
                      <span className="font-mono text-xs text-muted-foreground">{totalDuration}</span>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center justify-center gap-4">
                      <button
                        onClick={() => {
                          if (!audioBufferRef.current) return;
                          const skipAmount = 5;
                          const duration = audioBufferRef.current.duration;
                          let newOffset = pauseOffsetRef.current;
                          if (isPlaying && audioContextRef.current) {
                            newOffset = audioContextRef.current.currentTime - startTimeRef.current + pauseOffsetRef.current;
                          }
                          newOffset = Math.max(newOffset - skipAmount, 0);
                          pauseOffsetRef.current = newOffset;
                          setProgress((newOffset / duration) * 100);
                          setCurrentTime(formatTime(newOffset));
                          if (isPlaying) {
                            cancelAnimationFrame(animFrameRef.current);
                            if (sourceNodeRef.current) { sourceNodeRef.current.stop(); sourceNodeRef.current = null; }
                            setIsPlaying(false);
                            setTimeout(() => handlePlayPause(), 50);
                          }
                        }}
                        className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <SkipBack className="w-5 h-5" />
                      </button>
                      <button
                        onClick={handlePlayPause}
                        className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center glow-bitcoin hover:scale-105 transition-transform"
                      >
                        {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                      </button>
                      <button
                        onClick={() => {
                          if (!audioBufferRef.current) return;
                          const skipAmount = 5;
                          const duration = audioBufferRef.current.duration;
                          let newOffset = pauseOffsetRef.current;
                          if (isPlaying && audioContextRef.current) {
                            newOffset = audioContextRef.current.currentTime - startTimeRef.current + pauseOffsetRef.current;
                          }
                          newOffset = Math.min(newOffset + skipAmount, duration);
                          pauseOffsetRef.current = newOffset;
                          setProgress((newOffset / duration) * 100);
                          setCurrentTime(formatTime(newOffset));
                          if (isPlaying) {
                            cancelAnimationFrame(animFrameRef.current);
                            if (sourceNodeRef.current) { sourceNodeRef.current.stop(); sourceNodeRef.current = null; }
                            setIsPlaying(false);
                            setTimeout(() => handlePlayPause(), 50);
                          }
                        }}
                        className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <SkipForward className="w-5 h-5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground text-sm font-mono">
              Select a transcript to generate audio.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AudioGeneration;
