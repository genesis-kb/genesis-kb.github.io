import { Link, useLocation, useNavigate } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";
import { Search, Menu, X, Zap, Globe, FileText, Users, Clock, ArrowRight, Bookmark } from "lucide-react";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { SearchResult, PaginatedResponse } from "../../types";
import { useBookmarks } from "@/hooks/useBookmarks";
import { useConferences, useSearch } from "@/hooks/useTranscripts";
import { useAuth } from "@/hooks/useAuth";
import { LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { label: "Explore", path: "/topics" },
  { label: "Conferences", path: "/conferences" },
  { label: "Audiobooks", path: "/audiobooks" },
  { label: "About", path: "/about" },
];

const RECENT_SEARCHES_KEY = "bitscribe_recent_searches";
const MAX_RECENT_SEARCHES = 5;

const getRecentSearches = (): string[] => {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveRecentSearch = (query: string) => {
  const trimmed = query.trim();
  if (trimmed.length < 2) return;
  const recent = getRecentSearches().filter((s) => s !== trimmed);
  recent.unshift(trimmed);
  localStorage.setItem(
    RECENT_SEARCHES_KEY,
    JSON.stringify(recent.slice(0, MAX_RECENT_SEARCHES))
  );
};

const clearRecentSearches = () => {
  localStorage.removeItem(RECENT_SEARCHES_KEY);
};

const SEARCH_SUGGESTIONS = [
  "lightning network",
  "Satoshi Nakamoto",
  "mining",
  "privacy",
  "taproot",
];

/** Skeleton loader card shown while search is in-flight */
const SearchSkeleton = () => (
  <div className="px-4 py-3 flex items-start gap-3 animate-pulse">
    <div className="w-4 h-4 rounded bg-muted mt-0.5 shrink-0" />
    <div className="flex-1 min-w-0 space-y-2">
      <div className="h-4 bg-muted rounded w-3/4" />
      <div className="h-3 bg-muted rounded w-1/2" />
      <div className="h-3 bg-muted rounded w-full" />
    </div>
  </div>
);

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>(getRecentSearches());
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  const { user, logout, openLoginModal } = useAuth();
  // Get bookmark count for nav badge
  const { totalCount } = useBookmarks();

  // Fetch stats for ticker tape
  const { data: tickerConferences = [] } = useConferences();
  const tickerStats = useMemo(() => {
    const total = tickerConferences.reduce((s, c) => s + c.talks.length, 0);
    const speakers = new Set(tickerConferences.flatMap((c) => c.talks.map((t) => t.speaker))).size;
    return {
      transcripts: total > 0 ? total.toLocaleString() : "—",
      archives: tickerConferences.length > 0 ? String(tickerConferences.length) : "—",
      speakers: speakers > 0 ? `${speakers}+` : "—",
    };
  }, [tickerConferences]);

  const { data: searchResponse, isFetching: searchLoading } = useSearch(
    debouncedSearchQuery,
    searchOpen
  );
  const searchResults = searchResponse?.data ?? [];
  const searchPagination = searchResponse?.pagination ?? null;
  const isDebouncingSearch = searchQuery.trim().length >= 2 && debouncedSearchQuery !== searchQuery.trim();
  const isSearching = isDebouncingSearch || searchLoading;

  useEffect(() => {
    const trimmedQuery = searchQuery.trim();

    if (trimmedQuery.length < 2) {
      setDebouncedSearchQuery("");
      return;
    }

    const timeoutId = setTimeout(() => {
      setDebouncedSearchQuery(trimmedQuery);
    }, 350);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  useEffect(() => {
    if (debouncedSearchQuery.length >= 2 && searchResponse) {
      saveRecentSearch(debouncedSearchQuery);
      setRecentSearches(getRecentSearches());
    }
  }, [debouncedSearchQuery, searchResponse]);

  // Keyboard shortcut to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setSearchQuery("");
        setDebouncedSearchQuery("");
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Debounced search
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleResultClick = (transcriptId: string) => {
    setSearchOpen(false);
    setSearchQuery("");
    setDebouncedSearchQuery("");
    navigate(`/transcript/${transcriptId}`);
  };

  const handleRecentSearchClick = (query: string) => {
    setSearchQuery(query);
  };

  const handleClearRecent = () => {
    clearRecentSearches();
    setRecentSearches([]);
  };

  /** Helper: format speaker display from string[] or string */
  const formatSpeakers = (speakers: string[] | string): string => {
    if (Array.isArray(speakers)) return speakers.join(", ");
    return speakers || "";
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top ticker tape */}
      <div className="h-7 bg-secondary border-b border-border overflow-hidden relative">
        <div className="flex animate-ticker whitespace-nowrap items-center h-full">
          {[...Array(3)].map((_, i) => (
            <span key={i} className="inline-flex items-center gap-6 px-4 font-mono text-[10px] text-muted-foreground tracking-wider uppercase">
              <span className="flex items-center gap-1"><Zap className="w-2.5 h-2.5 text-bitcoin" /> {tickerStats.transcripts} Transcripts</span>
              <span>•</span>
              <span>{tickerStats.archives} Conference Archives</span>
              <span>•</span>
              <span className="flex items-center gap-1"><Globe className="w-2.5 h-2.5 text-signal" /> 4 Languages</span>
              <span>•</span>
              <span>{tickerStats.speakers} Speakers</span>
              <span>•</span>
              <span>AI-Powered Search</span>
              <span className="mx-8">│</span>
            </span>
          ))}
        </div>
      </div>

      {/* Main nav */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center glow-bitcoin">
              <span className="text-primary-foreground font-mono font-bold text-sm">₿</span>
            </div>
            <span className="font-display font-semibold text-lg tracking-tight">
              Bitscribe
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  location.pathname.startsWith(item.path)
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <Link
              to="/library"
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 relative ${
                location.pathname === "/library"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <Bookmark className="w-4 h-4" />
              <span>Library</span>
              {totalCount > 0 && (
                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  {totalCount > 99 ? "99+" : totalCount}
                </span>
              )}
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            {/* Search trigger */}
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Search transcripts"
              className="flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-secondary text-muted-foreground text-sm hover:border-primary/30 transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline font-mono text-xs">Search...</span>
              <kbd className="hidden sm:inline-flex h-5 px-1.5 rounded bg-muted text-[10px] font-mono items-center border border-border">{navigator.platform?.includes("Mac") ? "⌘K" : "Ctrl+K"}</kbd>
            </button>

            <ThemeToggle />

            {/* Auth button/avatar */}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background">
                    <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-display font-bold text-xs uppercase overflow-hidden">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.name || user.email} className="w-full h-full object-cover" />
                      ) : (
                        (user.name || user.email).charAt(0)
                      )}
                    </div>
                    <span className="text-sm font-medium hidden sm:inline-block max-w-[100px] truncate">
                      {user.name || user.email.split('@')[0]}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem className="flex flex-col items-start gap-1 p-3 pointer-events-none text-muted-foreground focus:bg-transparent">
                    <span className="text-sm font-medium text-foreground">{user.name || 'User'}</span>
                    <span className="text-xs truncate max-w-full">{user.email}</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer">
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => logout()} className="cursor-pointer text-destructive focus:text-destructive">
                    <LogOut className="w-4 h-4 mr-2" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button
                onClick={openLoginModal}
                className="hidden sm:inline-flex items-center justify-center h-9 px-4 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors whitespace-nowrap"
              >
                Sign In
              </button>
            )}

            {/* Mobile menu */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              className="md:hidden w-9 h-9 rounded-lg border border-border bg-secondary flex items-center justify-center ml-1"
            >
              {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden border-t border-border overflow-hidden"
            >
              <nav className="p-4 flex flex-col gap-1">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      location.pathname.startsWith(item.path)
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
                <Link
                  to="/library"
                  onClick={() => setMobileOpen(false)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 relative ${
                    location.pathname === "/library"
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  <Bookmark className="w-4 h-4" />
                  <span>Library</span>
                  {totalCount > 0 && (
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold ml-auto">
                      {totalCount > 99 ? "99+" : totalCount}
                    </span>
                  )}
                </Link>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Search overlay */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-start justify-center pt-[15vh]"
            onClick={() => setSearchOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="w-full max-w-xl mx-4 bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 p-4 border-b border-border">
                <Search className="w-5 h-5 text-muted-foreground" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search transcripts, speakers, topics..."
                  aria-label="Search transcripts"
                  className="flex-1 bg-transparent text-foreground text-sm outline-none placeholder:text-muted-foreground"
                />
                <kbd className="h-6 px-2 rounded bg-muted text-[10px] font-mono flex items-center border border-border text-muted-foreground">ESC</kbd>
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
                {/* Skeleton loaders while searching */}
                {isSearching && (
                  <div className="py-2">
                    {[1, 2, 3, 4].map((i) => (
                      <SearchSkeleton key={i} />
                    ))}
                  </div>
                )}

                {/* Recent searches when input is empty/short */}
                {!isSearching && searchQuery.trim().length < 2 && (
                  <div className="py-4">
                    {recentSearches.length > 0 && (
                      <div className="mb-4">
                        <div className="px-4 flex items-center justify-between mb-2">
                          <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Recent Searches</span>
                          <button
                            onClick={handleClearRecent}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            Clear
                          </button>
                        </div>
                        {recentSearches.map((recent) => (
                          <button
                            key={recent}
                            onClick={() => handleRecentSearchClick(recent)}
                            className="w-full px-4 py-2 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
                          >
                            <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="text-sm text-foreground truncate">{recent}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="px-4">
                      <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Try searching for</span>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {SEARCH_SUGGESTIONS.map((suggestion) => (
                          <button
                            key={suggestion}
                            onClick={() => handleRecentSearchClick(suggestion)}
                            className="px-2.5 py-1 rounded-md bg-muted text-xs text-foreground hover:bg-muted/80 transition-colors"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {!isSearching && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                  <div className="flex flex-col items-center justify-center gap-3 py-10">
                    <Search className="w-8 h-8 text-muted-foreground/50" />
                    <span className="text-sm text-muted-foreground font-mono">No results found for "{searchQuery}"</span>
                    <span className="text-xs text-muted-foreground">Try different keywords or check spelling</span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {SEARCH_SUGGESTIONS.slice(0, 3).map((s) => (
                        <button
                          key={s}
                          onClick={() => handleRecentSearchClick(s)}
                          className="px-2.5 py-1 rounded-md bg-muted text-xs text-foreground hover:bg-muted/80 transition-colors flex items-center gap-1"
                        >
                          <ArrowRight className="w-3 h-3" />
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Search results */}
                {!isSearching && searchResults.length > 0 && (
                  <div className="py-2">
                    {searchPagination && (
                      <div className="px-4 py-1.5 text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                        {searchPagination.total} result{searchPagination.total !== 1 ? "s" : ""}
                      </div>
                    )}
                    {searchResults.map((result) => (
                      <button
                        key={result.id}
                        onClick={() => handleResultClick(result.id)}
                        className="w-full px-4 py-3 flex items-start gap-3 hover:bg-muted/50 transition-colors text-left"
                      >
                        <FileText className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-sm font-medium text-foreground truncate [&_mark]:bg-bitcoin/20 [&_mark]:text-bitcoin [&_mark]:rounded-sm [&_mark]:px-0.5"
                            dangerouslySetInnerHTML={{ __html: result.headline_title || result.title }}
                          />
                          {result.speakers && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Users className="w-3 h-3" />
                              {formatSpeakers(result.speakers)}
                            </p>
                          )}
                          {(result.headline_content || result.snippet) && (
                            <p
                              className="text-xs text-muted-foreground mt-1 line-clamp-2 [&_mark]:bg-bitcoin/20 [&_mark]:text-bitcoin [&_mark]:rounded-sm [&_mark]:px-0.5"
                              dangerouslySetInnerHTML={{ __html: result.headline_content || result.snippet || "" }}
                            />
                          )}
                          {result.event_date && (
                            <p className="text-[10px] text-muted-foreground/70 mt-1 font-mono">
                              {result.event_date}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main>{children}</main>

      {/* Footer */}
      <footer className="border-t border-border bg-secondary/50">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-mono font-bold text-xs">₿</span>
                </div>
                <span className="font-display font-semibold">Bitscribe</span>
              </div>
              <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
                The open knowledge base for Bitcoin — searchable transcripts from conferences, podcasts, and technical talks spanning over a decade.
              </p>
            </div>
            <div>
              <h4 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">Navigate</h4>
              <div className="flex flex-col gap-2">
                <Link to="/categories" className="text-sm text-foreground hover:text-primary transition-colors">Categories</Link>
                <Link to="/conferences" className="text-sm text-foreground hover:text-primary transition-colors">Conferences</Link>
                <Link to="/about" className="text-sm text-foreground hover:text-primary transition-colors">About</Link>
              </div>
            </div>
            {/* <div>
              <h4 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">Ecosystem</h4>
              <div className="flex flex-col gap-2">
                <a href="https://bitcoindevs.xyz/" target="_blank" rel="noopener" className="text-sm text-foreground hover:text-primary transition-colors">Bitcoin Devs</a>
                <a href="https://chat.bitcoinsearch.xyz/" target="_blank" rel="noopener" className="text-sm text-foreground hover:text-primary transition-colors">ChatBTC</a>
                <a href="https://bitcoinsearch.xyz/" target="_blank" rel="noopener" className="text-sm text-foreground hover:text-primary transition-colors">Bitcoin Search</a>
              </div>
            </div> */}
          </div>
        </div>
      </footer>
    </div>
  );
};
