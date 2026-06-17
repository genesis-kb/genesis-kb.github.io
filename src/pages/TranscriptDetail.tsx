import { useParams, Link, useLocation } from "react-router-dom";
import { useEffect, useState, useMemo, useRef } from "react";

import { Calendar, Mic, Tag, Download, Copy, FileText, MessageSquare, Headphones, Loader2, RefreshCw, ChevronDown, ChevronUp, ScrollText, StickyNote, Network, Trash2, X, Maximize, Minimize } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { TranscriptChat } from "@/components/TranscriptChat";
import { TranscriptAudio } from "@/components/TranscriptAudio";
import { TranscriptWhiteboard } from "@/components/whiteboard/TranscriptWhiteboard";
import { TranscriptNotes } from "@/components/notes/TranscriptNotes";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { BookmarkButton } from "@/components/BookmarkButton";
import { HighlightToolbar } from "@/components/HighlightToolbar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useBookmarks } from "@/hooks/useBookmarks";
import { useNotes } from "@/hooks/useNotes";
import { toast } from "sonner";
import { formatDate, cn } from "@/lib/utils";
import { generateSummary } from "../../services/geminiService";
import type { RawTranscript } from "../../types";
import { useTranscript } from "@/hooks/useTranscripts";

type TabType = "summary" | "transcript" | "chat" | "audio" | "notes" | "whiteboard";

const TranscriptDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(false);
  const [showFullTranscript, setShowFullTranscript] = useState(false);
  const locationState = useLocation();

  const initialTab = useMemo(() => {
    const params = new URLSearchParams(locationState.search);
    const tabParam = params.get("tab");
    if (tabParam === "notes" || tabParam === "transcript" || tabParam === "summary" || tabParam === "chat" || tabParam === "audio" || tabParam === "whiteboard") {
      return tabParam as TabType;
    }
    return "summary";
  }, [locationState.search]);

  type RightTabType = "none" | "notes" | "chat" | "canvas";
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [rightTab, setRightTab] = useState<RightTabType>("none");
  const [focusMode, setFocusMode] = useState(false);
  const [isRightPanelFullScreen, setIsRightPanelFullScreen] = useState(false);
  const [isLeftPanelFullScreen, setIsLeftPanelFullScreen] = useState(false);
  const [pendingNoteText, setPendingNoteText] = useState<string | undefined>(undefined);
  const [pendingChatPrompt, setPendingChatPrompt] = useState<string | undefined>(undefined);

  const transcriptRef = useRef<HTMLDivElement>(null);
  const { getHighlightsForTranscript, removeHighlight, updateHighlightNote } = useBookmarks();
  const { getNotesForTranscript, addNote } = useNotes();
  const { data, isLoading, error } = useTranscript(id);
  const transcript = data ?? null;

  // Auto-generate AI summary when transcript loads
  useEffect(() => {
    let cancelled = false;

    const fetchSummary = async () => {
      if (!transcript) return;
      const transcriptText = transcript.corrected_text || transcript.raw_text || "";
      if (transcript.summary) {
        setAiSummary(transcript.summary);
        return;
      }
      if (transcriptText.length < 100) return;

      setSummaryLoading(true);
      try {
        const summary = await generateSummary(transcriptText, transcript.id);
        if (!cancelled) {
          setAiSummary(summary);
          setSummaryError(false);
        }
      } catch (error) {
        console.error("Error generating summary:", error);
        if (!cancelled) {
          setSummaryError(true);
        }
      } finally {
        if (!cancelled) {
          setSummaryLoading(false);
        }
      }
    };

    fetchSummary();
    return () => { cancelled = true; };
  }, [transcript]);

  // All hooks MUST be called before any early returns (Rules of Hooks)
  const speakersList = useMemo(() => {
    if (!transcript) return [];
    if (Array.isArray(transcript.speakers)) return transcript.speakers;
    if (typeof transcript.speakers === "string") return transcript.speakers.split(",").map((s) => s.trim());
    return [];
  }, [transcript]);

  const tags = useMemo(() => {
    if (!transcript) return [];
    if (Array.isArray(transcript.tags) && transcript.tags.length > 0) return transcript.tags as string[];
    if (Array.isArray(transcript.categories) && transcript.categories.length > 0) return transcript.categories as string[];
    return [];
  }, [transcript]);

  const transcriptBody = useMemo(() => {
    if (!transcript) return "";
    return transcript.corrected_text || transcript.raw_text || "";
  }, [transcript]);

  const displayDate = transcript?.event_date || "";

  const location = useMemo(() => {
    if (transcript?.conference) return transcript.conference;
    if (transcript?.channel_name) return transcript.channel_name;
    if (!transcript?.loc) return "";
    return transcript.loc.split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  }, [transcript]);

  const handleAskAI = (selectedText: string) => {
    setPendingChatPrompt(`Regarding this quote:\n"${selectedText}"\n\n`);
    setActiveTab("transcript");
    setRightTab("chat");
    setIsRightPanelFullScreen(false);
    setIsLeftPanelFullScreen(false);
  };

  const handleExtractConcept = (selectedText: string) => {
    if (!transcript) return;
    addNote({
      transcriptId: transcript.id,
      transcriptTitle: transcript.title,
      title: "New Concept",
      content: "",
      selectedText,
      isConcept: true,
      tags: ["concept"]
    });
    toast.success("Concept extracted to Canvas!");
    setActiveTab("transcript");
    setRightTab("canvas");
    setIsRightPanelFullScreen(false);
    setIsLeftPanelFullScreen(false);
  };

  const handleTranslate = (selectedText: string, targetLanguage: string) => {
    setPendingChatPrompt(`Please translate the following text to ${targetLanguage}:\n"${selectedText}"`);
    setActiveTab("transcript");
    setRightTab("chat");
    setIsRightPanelFullScreen(false);
    setIsLeftPanelFullScreen(false);
  };

  // Parse transcript into paragraphs (group consecutive non-empty lines)
  const transcriptParagraphs = useMemo(() => {
    if (!transcriptBody) return [];
    const lines = transcriptBody.split("\n");
    const paragraphs: { text: string; startLine: number }[] = [];
    let current: string[] = [];
    let paraIndex = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === "") {
        if (current.length > 0) {
          paragraphs.push({ text: current.join(" "), startLine: paraIndex++ });
          current = [];
        }
      } else {
        current.push(line);
      }
    }
    if (current.length > 0) {
      paragraphs.push({ text: current.join(" "), startLine: paraIndex });
    }
    return paragraphs;
  }, [transcriptBody]);

  if (isLoading) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-16 text-center">
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
          <span className="text-sm text-muted-foreground font-mono">Loading transcript...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-16 text-center">
        <h1 className="font-display text-2xl font-bold mb-2">Unable to load transcript</h1>
        <p className="text-sm text-muted-foreground mb-4">Failed to load transcript. Please check your connection and try again.</p>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:scale-[1.02] transition-transform"
        >
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  if (!transcript) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-16 text-center">
        <h1 className="font-display text-2xl font-bold mb-2">Transcript not found</h1>
        <p className="text-sm text-muted-foreground mb-4">The transcript you're looking for doesn't exist or has been removed.</p>
        <Link to="/conferences" className="text-primary font-mono text-sm hover:underline">Back to conferences</Link>
      </div>
    );
  }

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast("Link copied to clipboard!");
  };

  const handleDownload = () => {
    const content = `# ${transcript.title}\n\nSpeakers: ${speakersList.join(", ")}\nDate: ${displayDate}\nLocation: ${location}\n\n## Summary\n${aiSummary || "No summary available"}\n\n## Transcript\n${transcriptBody}`;
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${transcript.title.replace(/[^a-zA-Z0-9]/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Downloading transcript as Markdown");
  };

  const handleRetrySummary = () => {
    setSummaryError(false);
    setSummaryLoading(true);
    const text = transcript.corrected_text || transcript.raw_text || "";
    generateSummary(text, transcript.id)
      .then((s) => { setAiSummary(s); setSummaryError(false); })
      .catch(() => setSummaryError(true))
      .finally(() => setSummaryLoading(false));
  };

  const INITIAL_PARAGRAPHS = 20;
  const visibleParagraphs = showFullTranscript
    ? transcriptParagraphs
    : transcriptParagraphs.slice(0, INITIAL_PARAGRAPHS);
  const hasMoreParagraphs = transcriptParagraphs.length > INITIAL_PARAGRAPHS;
  const transcriptHighlights = id ? getHighlightsForTranscript(id) : [];
  const transcriptNotesCount = id ? getNotesForTranscript(id).length : 0;

  const tabs: { id: TabType; label: string; icon: typeof FileText; count?: number }[] = [
    { id: "summary", label: "Summary", icon: FileText },
    { id: "transcript", label: "Transcript", icon: ScrollText },
    { id: "chat", label: "Chat", icon: MessageSquare },
    { id: "whiteboard", label: "Canvas", icon: Network },
    { id: "audio", label: "Audio", icon: Headphones },
    { id: "notes", label: "Notes", icon: StickyNote, count: transcriptNotesCount },
  ];

  return (
    <div className={cn("mx-auto transition-all duration-300 flex flex-col", focusMode ? "max-w-[1920px] w-full px-2 sm:px-4 py-2 h-[calc(100vh-80px)]" : "max-w-[1400px] w-full px-4 sm:px-6 py-8")}>
      {/* Breadcrumb - Hidden in Focus Mode */}
      {!focusMode && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono mb-6 flex-wrap">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <span>/</span>
          <Link to="/conferences" className="hover:text-foreground">{location}</Link>
          <span>/</span>
          <span className="text-primary truncate">{transcript.title}</span>
        </div>
      )}

      <div className={cn("flex flex-col lg:flex-row transition-all duration-300", focusMode ? "gap-4 flex-1 min-h-0" : "gap-8")}>
        {/* Main content */}
        <article className={cn("min-w-0 transition-all duration-300 flex flex-col", rightTab !== "none" ? (isLeftPanelFullScreen ? "w-full" : "flex-1 lg:w-1/2") : "flex-1", focusMode && isRightPanelFullScreen ? "hidden lg:hidden" : "")}>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={cn("flex flex-col", focusMode ? "flex-1 min-h-0" : "")}>
            {/* Header - Hidden in Focus Mode */}
            {!focusMode && (
              <div className="mb-6">
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono mb-3">
                  <span className="px-2 py-0.5 rounded bg-primary/10 text-primary uppercase">transcript</span>
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(displayDate, { day: "numeric", month: "long", year: "numeric" })}</span>
                </div>

                <h1 className="font-display text-3xl sm:text-4xl font-bold leading-tight mb-4">{transcript.title}</h1>

                <div className="flex items-center gap-4 mb-4 flex-wrap">
                  {speakersList.map((speaker) => (
                    <span key={speaker} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Mic className="w-4 h-4 text-primary" />
                      {speaker}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-2 flex-wrap mb-4">
                  {tags.slice(0, 8).map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary text-xs font-mono text-muted-foreground">
                      <Tag className="w-3 h-3" /> {tag}
                    </span>
                  ))}
                  {tags.length > 8 && (
                    <span className="text-xs text-muted-foreground font-mono">+{tags.length - 8} more</span>
                  )}
                </div>

                {/* Action bar */}
                <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-card relative flex-wrap">
                  {transcript && (
                    <BookmarkButton
                      transcript={{
                        id: transcript.id,
                        title: transcript.title,
                        speakers: Array.isArray(transcript.speakers)
                          ? transcript.speakers.join(", ")
                          : transcript.speakers,
                        event_date: transcript.event_date,
                        loc: location || "Unknown",
                      }}
                      size="md"
                      showLabel
                    />
                  )}
                  <button
                    onClick={handleShare}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" /> Share
                  </button>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> Download
                  </button>
                </div>
              </div>
            )}

            {focusMode ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-2 rounded-xl bg-secondary border border-border/50 mb-4 shrink-0">
                <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar flex-1">
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => { setRightTab("notes"); setIsLeftPanelFullScreen(false); }} className={cn("flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all", rightTab === "notes" ? "bg-primary/10 text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                      <StickyNote className="w-4 h-4" /> Notes
                    </button>
                    <button onClick={() => { setRightTab("chat"); setIsLeftPanelFullScreen(false); }} className={cn("flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all", rightTab === "chat" ? "bg-primary/10 text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                      <MessageSquare className="w-4 h-4" /> Chat
                    </button>
                    <button onClick={() => { setRightTab("canvas"); setIsLeftPanelFullScreen(false); }} className={cn("flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all", rightTab === "canvas" ? "bg-primary/10 text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                      <Network className="w-4 h-4" /> Canvas
                    </button>
                  </div>
                </div>
                <button 
                  onClick={() => { setFocusMode(false); setRightTab("none"); setActiveTab("transcript"); setIsRightPanelFullScreen(false); setIsLeftPanelFullScreen(false); }}
                  className="flex items-center gap-2 px-4 py-2 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-lg text-sm font-bold transition-colors shrink-0"
                >
                  <X className="w-4 h-4" /> Exit Notes Mode
                </button>
              </div>
            ) : (
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-1 p-1 rounded-xl bg-secondary overflow-x-auto hide-scrollbar">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                        if (tab.id === "notes") {
                            setActiveTab("transcript");
                            setRightTab("notes");
                            setFocusMode(true);
                            return;
                        }
                        setActiveTab(tab.id);
                        if (tab.id === "chat" || tab.id === "whiteboard") {
                            setRightTab("none");
                            setFocusMode(false);
                            setIsRightPanelFullScreen(false);
                            setIsLeftPanelFullScreen(false);
                        }
                    }}
                    className={`flex items-center gap-1.5 flex-1 min-w-max px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      activeTab === tab.id
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                    {tab.count !== undefined && tab.count > 0 && (
                      <span className="ml-1 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold leading-none">
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
            )}

            {/* Tab content */}
            <AnimatePresence mode="wait">
              {activeTab === "summary" && (
                <motion.div key="summary" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  {/* Summary */}
                  <div className="p-5 rounded-xl border border-primary/20 bg-primary/5">
                    <h3 className="font-mono text-xs uppercase tracking-widest text-primary mb-2">AI Summary</h3>
                    {summaryLoading ? (
                      <div className="flex items-center gap-2 py-4">
                        <Loader2 className="w-4 h-4 text-primary animate-spin" />
                        <span className="text-sm text-muted-foreground">Generating AI summary...</span>
                      </div>
                    ) : summaryError ? (
                      <div className="flex items-center gap-3 py-4">
                        <p className="text-sm text-muted-foreground">Failed to generate summary.</p>
                        <button onClick={handleRetrySummary} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:scale-[1.02] transition-transform">
                          <RefreshCw className="w-3 h-3" /> Retry
                        </button>
                      </div>
                    ) : aiSummary ? (
                      <MarkdownRenderer content={aiSummary} />
                    ) : (
                      <p className="text-sm text-muted-foreground">No summary available for this transcript.</p>
                    )}
                  </div>
                </motion.div>

              )}

              {(activeTab === "transcript" || activeTab === "notes") && (
                <motion.div key="transcript-view" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className={cn("flex flex-col", focusMode ? "flex-1 min-h-0" : "")}>
                  {/* Transcript viewer */}
                  <div ref={transcriptRef} className={cn("relative rounded-xl border border-border bg-card overflow-hidden flex flex-col", focusMode ? "flex-1 min-h-0" : "")}>
                    {/* Transcript header bar */}
                    <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-secondary/50">
                      <div className="flex items-center gap-3">
                        <ScrollText className="w-4 h-4 text-primary" />
                        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Full Transcript</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                        {speakersList.length > 0 && (
                          <span className="flex items-center gap-1.5 hidden sm:flex">
                            <Mic className="w-3 h-3" />
                            {speakersList.join(", ")}
                          </span>
                        )}
                        <span className="hidden sm:inline">{transcriptParagraphs.length} paragraphs</span>
                        {focusMode && (
                          <button onClick={() => setIsLeftPanelFullScreen(!isLeftPanelFullScreen)} className="p-1 hover:bg-secondary rounded-md text-muted-foreground transition-colors ml-2" title={isLeftPanelFullScreen ? "Minimize Panel" : "Maximize Panel"}>
                            {isLeftPanelFullScreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Transcript body */}
                    <div className={cn("divide-y divide-border/50", focusMode ? "overflow-y-auto flex-1 min-h-0" : "")}>
                      {visibleParagraphs.map((para, idx) => (
                        (() => {
                          const matchingHighlights = transcriptHighlights.filter((highlight) =>
                            highlight.text.endsWith("...")
                              ? para.text.includes(highlight.text.slice(0, -3))
                              : para.text.includes(highlight.text)
                          );
                          const hasMatchingHighlight = matchingHighlights.length > 0;

                          const renderText = () => {
                            if (!hasMatchingHighlight) return para.text;

                            // 1. Find all matches
                            type Match = { start: number; end: number; highlight: typeof matchingHighlights[0] };
                            const matches: Match[] = [];

                            matchingHighlights.forEach(h => {
                              const hText = h.text.endsWith("...") ? h.text.slice(0, -3) : h.text;
                              if (!hText) return;

                              let startIndex = 0;
                              while ((startIndex = para.text.indexOf(hText, startIndex)) !== -1) {
                                matches.push({ start: startIndex, end: startIndex + hText.length, highlight: h });
                                startIndex += hText.length;
                              }
                            });

                            if (matches.length === 0) return para.text;

                            // 2. Sort matches by start index
                            matches.sort((a, b) => a.start - b.start);

                            // 3. Resolve overlaps (keep the earliest that doesn't overlap)
                            const resolvedMatches: Match[] = [];
                            let lastEnd = 0;
                            for (const m of matches) {
                              if (m.start >= lastEnd) {
                                resolvedMatches.push(m);
                                lastEnd = m.end;
                              }
                            }

                            // 4. Build elements
                            const elements: React.ReactNode[] = [];
                            let currentPos = 0;

                            resolvedMatches.forEach((m, idx) => {
                              if (m.start > currentPos) {
                                elements.push(<span key={`text-${idx}`}>{para.text.slice(currentPos, m.start)}</span>);
                              }

                              let highlightClass = "";
                              if (m.highlight.isUnderline) {
                                highlightClass = "underline decoration-primary/40 decoration-2 underline-offset-4 font-medium text-foreground";
                              } else if (m.highlight.color === 'yellow') {
                                highlightClass = "bg-yellow-400/40 text-yellow-950 dark:text-yellow-100 px-1 py-0.5 rounded-sm";
                              } else if (m.highlight.color === 'green') {
                                highlightClass = "bg-green-400/40 text-green-950 dark:text-green-100 px-1 py-0.5 rounded-sm";
                              } else if (m.highlight.color === 'blue') {
                                highlightClass = "bg-blue-400/40 text-blue-950 dark:text-blue-100 px-1 py-0.5 rounded-sm";
                              } else if (m.highlight.color === 'pink') {
                                highlightClass = "bg-pink-400/40 text-pink-950 dark:text-pink-100 px-1 py-0.5 rounded-sm";
                              } else {
                                highlightClass = "bg-primary/20 text-primary px-1 py-0.5 rounded-sm font-medium";
                              }

                              if (focusMode) {
                                elements.push(
                                  <Popover key={`mark-${idx}`}>
                                    <PopoverTrigger asChild>
                                      <mark className={`${highlightClass} cursor-pointer hover:opacity-80 transition-opacity`}>
                                        {para.text.slice(m.start, m.end)}
                                      </mark>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-64 p-3 z-50" sideOffset={5}>
                                      <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                          <h4 className="font-medium text-sm">Highlight Options</h4>
                                          <button 
                                            onClick={() => removeHighlight(m.highlight.id)}
                                            className="p-1 text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                                            title="Remove highlight"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                        <div className="space-y-1.5">
                                          <label className="text-xs text-muted-foreground">Note (optional)</label>
                                          <textarea 
                                            className="w-full text-sm p-2 rounded-md border border-border bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                                            rows={3}
                                            placeholder="Add a note..."
                                            defaultValue={m.highlight.note || ""}
                                            onBlur={(e) => updateHighlightNote(m.highlight.id, e.target.value)}
                                          />
                                        </div>
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                );
                              } else {
                                elements.push(
                                  <mark key={`mark-${idx}`} className={highlightClass}>
                                    {para.text.slice(m.start, m.end)}
                                  </mark>
                                );
                              }

                              currentPos = m.end;
                            });

                            if (currentPos < para.text.length) {
                              elements.push(<span key="text-end">{para.text.slice(currentPos)}</span>);
                            }

                            return <>{elements}</>;
                          };

                          return (
                            <div
                              key={para.startLine}
                              className={`flex gap-0 ${idx % 2 === 0 ? "bg-card" : "bg-secondary/20"
                                } hover:bg-secondary/40 transition-colors group`}
                            >
                              <div className="w-12 sm:w-16 shrink-0 border-r border-border/50 flex flex-col items-center py-4">
                                <span className="text-[10px] font-mono text-muted-foreground/50 select-none group-hover:text-primary/50 transition-colors">
                                  {para.startLine}
                                </span>
                              </div>
                              <div className="flex-1 py-4 px-4 sm:px-5">
                                <p className="text-sm sm:text-[15px] leading-relaxed text-foreground/90 font-[system-ui,_-apple-system,_'Segoe_UI',_sans-serif]">
                                  {renderText()}
                                </p>
                              </div>
                            </div>
                          );
                        })()
                      ))}
                    </div>

                    {/* Show more/less */}
                    {hasMoreParagraphs && (
                      <div className={`border-t border-border ${!showFullTranscript ? "relative" : ""
                        }`}>
                        {!showFullTranscript && (
                          <div className="absolute -top-16 left-0 right-0 h-16 bg-gradient-to-t from-card to-transparent pointer-events-none" />
                        )}
                        <div className="flex justify-center py-4 bg-secondary/30">
                          <button
                            onClick={() => setShowFullTranscript(!showFullTranscript)}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border bg-card text-sm font-mono text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors shadow-sm"
                          >
                            {showFullTranscript ? (
                              <><ChevronUp className="w-4 h-4" /> Show less</>
                            ) : (
                              <><ChevronDown className="w-4 h-4" /> Show all {transcriptParagraphs.length} paragraphs</>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {transcript && id && focusMode && (
                      <HighlightToolbar
                        containerRef={transcriptRef}
                        transcriptId={id}
                        transcriptTitle={transcript.title}
                        onAddNote={(text) => {
                          setPendingNoteText(text);
                          setActiveTab("transcript");
                          setRightTab("notes");
                          setFocusMode(true);
                        }}
                        onExtractConcept={handleExtractConcept}
                        onAskAI={handleAskAI}
                        onTranslate={handleTranslate}
                      />
                    )}
                  </div>
                </motion.div>
              )}

              {activeTab === "chat" && (
                <motion.div key="chat" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className={cn(focusMode && "h-full")}>
                  <TranscriptChat
                    transcript={transcript}
                    pendingPrompt={pendingChatPrompt}
                    onPromptConsumed={() => setPendingChatPrompt(undefined)}
                  />
                </motion.div>
              )}

              {activeTab === "audio" && (
                <motion.div key="audio" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className={cn(focusMode && "h-full")}>
                  <TranscriptAudio transcript={transcript} />
                </motion.div>
              )}

              {activeTab === "whiteboard" && id && (
                <motion.div key="whiteboard" className={cn("w-full flex flex-col", focusMode ? "h-full" : "h-full min-h-[600px]")} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <TranscriptWhiteboard transcriptId={id} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </article>

        {/* Right sidebar */}
        <aside className={cn("shrink-0 transition-all duration-300 flex flex-col", rightTab !== "none" ? (focusMode ? (isRightPanelFullScreen ? "w-full" : "w-full lg:w-1/2") : "w-full lg:w-1/2 max-w-[600px]") : "w-full lg:w-72", focusMode && isLeftPanelFullScreen ? "hidden lg:hidden" : "")}>
          <div className={cn(focusMode ? "h-full flex flex-col gap-4" : "space-y-6 sticky top-20")}>
            {rightTab !== "none" ? (
              <>
              <motion.div
                key="split-sidebar"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn("flex flex-col rounded-xl border border-border bg-card overflow-hidden shadow-sm", focusMode ? "flex-1 min-h-0" : "h-[calc(100vh-160px)]")}
              >
                <div className="p-4 border-b border-border bg-secondary/30 flex items-center justify-between shrink-0">
                   <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                     {rightTab === "notes" && <><StickyNote className="w-4 h-4" /> Notes</>}
                     {rightTab === "chat" && <><MessageSquare className="w-4 h-4" /> Chat</>}
                     {rightTab === "canvas" && <><Network className="w-4 h-4" /> Canvas</>}
                   </h3>
                   <div className="flex items-center gap-1">
                     {focusMode && (
                       <button onClick={() => setIsRightPanelFullScreen(!isRightPanelFullScreen)} className="p-1 hover:bg-secondary rounded-md text-muted-foreground transition-colors" title={isRightPanelFullScreen ? "Minimize Panel" : "Maximize Panel"}>
                         {isRightPanelFullScreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                       </button>
                     )}
                     {!focusMode && (
                       <button onClick={() => { setRightTab("none"); setFocusMode(false); setIsRightPanelFullScreen(false); setIsLeftPanelFullScreen(false); }} className="p-1 hover:bg-secondary rounded-md text-muted-foreground transition-colors">
                         <X className="w-4 h-4" />
                         <span className="sr-only">Close</span>
                       </button>
                     )}
                   </div>
                </div>
                <div className="flex-1 overflow-y-auto min-h-0 bg-card p-4">
                  {rightTab === "notes" && (
                    <TranscriptNotes
                      transcriptId={id!}
                      transcriptTitle={transcript.title}
                      pendingSelectedText={pendingNoteText}
                      onPendingTextConsumed={() => setPendingNoteText(undefined)}
                    />
                  )}
                  {rightTab === "chat" && (
                    <TranscriptChat 
                      transcript={transcript} 
                      pendingPrompt={pendingChatPrompt}
                      onPromptConsumed={() => setPendingChatPrompt(undefined)}
                    />
                  )}
                  {rightTab === "canvas" && (
                    <div className="h-full">
                      <TranscriptWhiteboard transcriptId={id!} />
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Audio player collapsable in focus mode */}
              {focusMode && (
                <div className="rounded-xl border border-border bg-card overflow-hidden shrink-0 shadow-sm">
                  <details className="group">
                    <summary className="p-3 bg-secondary/50 font-mono text-xs uppercase tracking-widest text-muted-foreground flex items-center justify-between cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                      <div className="flex items-center gap-2">
                        <Headphones className="w-4 h-4 text-primary" />
                        Audio Player
                      </div>
                      <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="border-t border-border bg-card max-h-[300px] overflow-y-auto">
                      <TranscriptAudio transcript={transcript} />
                    </div>
                  </details>
                </div>
              )}
              </>
            ) : (
              <motion.div
                key="default-sidebar"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                {/* Speakers */}
                <div className="p-5 rounded-xl border border-border bg-card">
                  <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">Speakers</h3>
                  <div className="space-y-2">
                    {speakersList.map((s) => (
                      <div key={s} className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                          <Mic className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <span className="text-sm">{s}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Source info */}
                <div className="p-5 rounded-xl border border-border bg-card">
                  <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">Source</h3>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div><span className="text-foreground font-medium">{location || "Unknown"}</span></div>
                    <div className="font-mono text-xs">{formatDate(displayDate, { day: "numeric", month: "long", year: "numeric" })}</div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default TranscriptDetail;
