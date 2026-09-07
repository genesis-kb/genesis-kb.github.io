import { useState, useRef, useEffect } from "react";
import { Send, Bot, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { chatWithTranscript } from "../../services/geminiService";
import type { RawTranscript } from "../../types";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export const TranscriptChat = ({ 
  transcript,
  pendingPrompt,
  onPromptConsumed,
}: { 
  transcript: RawTranscript
  pendingPrompt?: string
  onPromptConsumed?: () => void
}) => {
  const transcriptText = transcript.corrected_text || transcript.raw_text || "";
  const speakerNames = Array.isArray(transcript.speakers)
    ? transcript.speakers.join(" and ")
    : transcript.speakers || "the speaker";

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Hi! I've analyzed "${transcript.title}". Ask me anything about the topics discussed by ${speakerNames}.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [chatHistory, setChatHistory] = useState<{ role: "user" | "model"; text: string }[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (pendingPrompt) {
      setInput(pendingPrompt);
      onPromptConsumed?.();
    }
  }, [pendingPrompt, onPromptConsumed]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setIsTyping(true);

    const updatedHistory = [...chatHistory, { role: "user" as const, text: userMsg }];

    try {
      const response = await chatWithTranscript(
        updatedHistory,
        userMsg,
        transcriptText,
        transcript.id
      );

      setChatHistory([
        ...updatedHistory,
        { role: "model" as const, text: response },
      ]);
      setMessages((prev) => [...prev, { role: "assistant", content: response }]);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-[500px] rounded-xl border border-border bg-card overflow-hidden">
      {/* Chat header */}
      <div className="px-4 py-3 border-b border-border bg-secondary/50 flex items-center gap-2">
        <Bot className="w-4 h-4 text-primary" />
        <span className="font-mono text-xs text-muted-foreground">AI Chat — Context: {transcript.title}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
            >
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[80%] px-4 py-2.5 rounded-xl text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-foreground"
                }`}
              >
                {msg.role === "assistant" ? (
                  <MarkdownRenderer content={msg.content} />
                ) : (
                  msg.content
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {isTyping && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="px-4 py-3 rounded-xl bg-secondary">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this transcript..."
            disabled={isTyping}
            className="flex-1 h-10 px-4 rounded-lg bg-secondary text-sm text-foreground placeholder:text-muted-foreground outline-none border border-border focus:border-primary/50 transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="h-10 w-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:scale-105 transition-transform"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
