import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, RotateCcw, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { chatWithTranscript } from "../../services/aiService";
import { APIError } from "../../services/api";
import type { RawTranscript } from "../../types";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { LoginPrompt } from "./LoginPrompt";
import { useAuth } from "@/hooks/useAuth";
import { useChatHistory } from "@/hooks/useChatHistory";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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

  const { user, isLoading: isAuthLoading, logout, openLoginModal } = useAuth();
  const history = useChatHistory(transcript.id);

  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  // Messages shown after the saved chat but never saved themselves: the
  // question awaiting a reply, then — if the call fails — that question plus
  // the error reply. Sending again replaces them (a failed pair is dropped),
  // and a successful reply moves the exchange into the saved chat (history).
  // Parents key this component by transcript, so none of this carries over
  // to another transcript.
  const [transient, setTransient] = useState<Message[]>([]);
  const [isConfirmingNewChat, setIsConfirmingNewChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages: Message[] = [
    ...history.messages.map(({ role, content }) => ({ role, content })),
    ...transient,
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isTyping]);

  useEffect(() => {
    if (pendingPrompt) {
      setInput(pendingPrompt);
      onPromptConsumed?.();
    }
  }, [pendingPrompt, onPromptConsumed]);

  // An expired or revoked session: sign out so the login prompt takes over.
  const endSession = () => {
    logout();
    openLoginModal();
  };

  const historyUnauthorized =
    history.error instanceof APIError && history.error.statusCode === 401;

  useEffect(() => {
    if (historyUnauthorized) endSession();
    // endSession only wraps stable AuthContext callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyUnauthorized]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    const userMsg = input.trim();
    setInput("");
    setTransient([{ role: "user", content: userMsg }]);
    setIsTyping(true);

    try {
      const reply = await chatWithTranscript(userMsg, transcriptText, transcript.id);

      if (reply.unauthorized) {
        // Keep the question so it can be sent again after signing back in.
        setInput(userMsg);
        setTransient([]);
        endSession();
        return;
      }

      if (reply.failed) {
        setTransient((prev) => [...prev, { role: "assistant", content: reply.message }]);
        return;
      }

      await history.appendExchange(userMsg, reply.message);
      setTransient([]);
      if (!reply.saved) {
        toast.warning("This reply couldn't be saved and won't appear after a reload.");
      }
    } finally {
      setIsTyping(false);
    }
  };

  const handleNewChat = async () => {
    try {
      await history.clear();
      setTransient([]);
    } catch (error) {
      console.error("Clear chat error:", error);
      toast.error("Couldn't start a new chat. Please try again.");
    }
  };

  if (isAuthLoading) {
    return (
      <div
        role="status"
        className="flex items-center justify-center gap-2 h-[500px] rounded-xl border border-border bg-card text-sm text-muted-foreground"
      >
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading…
      </div>
    );
  }

  if (!user) {
    return <LoginPrompt message="Sign in to chat with this transcript. Your chats are saved to your account." />;
  }

  const isBusy = isTyping || history.isClearing;
  // Sending before the saved chat has loaded would show the new exchange
  // without the older messages, so wait for (or retry) the load.
  const isInputDisabled = isBusy || history.isLoading || !!history.error;
  const showGreeting = !history.isLoading && !history.error && messages.length === 0;

  return (
    <div className="flex flex-col h-[500px] rounded-xl border border-border bg-card overflow-hidden">
      {/* Chat header */}
      <div className="px-4 py-3 border-b border-border bg-secondary/50 flex items-center gap-2">
        <Bot className="w-4 h-4 text-primary shrink-0" />
        <span className="font-mono text-xs text-muted-foreground truncate">AI Chat — Context: {transcript.title}</span>
        <AlertDialog open={isConfirmingNewChat} onOpenChange={setIsConfirmingNewChat}>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              disabled={isBusy || messages.length === 0}
              className="ml-auto shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-md font-mono text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 disabled:pointer-events-none"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              New chat
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Start a new chat?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes your saved chat about "{transcript.title}". This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleNewChat}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete chat
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" aria-live="polite">
        {history.isLoading && (
          <div role="status" className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading your chat…
          </div>
        )}

        {history.error && !historyUnauthorized && (
          <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
            <p>Couldn't load your saved chat.</p>
            <button
              type="button"
              onClick={history.refetch}
              className="px-3 py-1.5 rounded-md border border-border text-xs hover:bg-secondary transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {showGreeting && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="max-w-[80%] px-4 py-2.5 rounded-xl text-sm leading-relaxed bg-secondary text-foreground">
              <MarkdownRenderer
                content={`Hi! I've analyzed "${transcript.title}". Ask me anything about the topics discussed by ${speakerNames}.`}
              />
            </div>
          </div>
        )}

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
            disabled={isInputDisabled}
            className="flex-1 h-10 px-4 rounded-lg bg-secondary text-sm text-foreground placeholder:text-muted-foreground outline-none border border-border focus:border-primary/50 transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isInputDisabled}
            aria-label="Send message"
            className="h-10 w-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:scale-105 transition-transform"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
