/**
 * Topic-aware utilities for audiobook playlists.
 *
 * - Generates deterministic gradient thumbnails based on topic keywords
 * - Infers difficulty level from tags, title, and episode metadata
 */

import type { AudioPlaylist } from '../../../types';

// ─── Topic → Visual Theme Mapping ──────────────────────────────────────────

interface TopicTheme {
  gradient: string;
  icon: string;      // Emoji used as large background icon
  accent: string;    // Tailwind text color for the icon
  imageUrl: string;  // Curated Unsplash image URL for the topic
}

/**
 * Curated Unsplash image URLs for each Bitcoin/crypto topic.
 * All images are free to use (Unsplash license) and hotlink-friendly.
 * Appended with size params for consistent, fast loading.
 */
const IMG = (photoId: string) =>
  `https://images.unsplash.com/${photoId}?w=600&h=400&fit=crop&auto=format&q=80`;

/**
 * Topic keywords → visual themes + curated images.
 * Matched against playlist title, description, and tags (case-insensitive).
 * Order matters — first match wins.
 */
const TOPIC_THEMES: [string[], TopicTheme][] = [
  // Lightning Network
  [
    ['lightning', 'layer 2', 'l2', 'payment channel'],
    {
      gradient: 'from-yellow-400/80 via-amber-500/70 to-orange-400/60',
      icon: '⚡',
      accent: 'text-yellow-200',
      imageUrl: IMG('photo-1504639725590-34d0984388bd'),   // Lightning bolt / electricity
    },
  ],
  // Mining / Proof of Work
  [
    ['mining', 'proof of work', 'pow', 'hashrate', 'difficulty'],
    {
      gradient: 'from-slate-600/80 via-zinc-700/70 to-stone-600/60',
      icon: '⛏',
      accent: 'text-stone-300',
      imageUrl: IMG('photo-1516245834210-c4c142787335'),   // Server racks / hardware
    },
  ],
  // Cryptography / Keys / Security
  [
    ['cryptography', 'encryption', 'keys', 'private key', 'public key', 'security', 'signature', 'sha-256'],
    {
      gradient: 'from-emerald-600/80 via-teal-700/70 to-cyan-600/60',
      icon: '🔐',
      accent: 'text-emerald-200',
      imageUrl: IMG('photo-1558494949-ef010cbdcc31'),   // Digital security / padlock
    },
  ],
  // Transactions / UTXO
  [
    ['transaction', 'utxo', 'output', 'input', 'segwit', 'taproot'],
    {
      gradient: 'from-blue-600/80 via-indigo-700/70 to-violet-600/60',
      icon: '📊',
      accent: 'text-blue-200',
      imageUrl: IMG('photo-1551288049-bebda4e38f71'),   // Data flow / dashboard
    },
  ],
  // Network / Nodes / P2P
  [
    ['network', 'node', 'peer', 'p2p', 'gossip', 'mempool', 'consensus'],
    {
      gradient: 'from-cyan-600/80 via-sky-700/70 to-blue-600/60',
      icon: '🌐',
      accent: 'text-cyan-200',
      imageUrl: IMG('photo-1451187580459-43490279c0fa'),   // Network globe / connections
    },
  ],
  // Wallet
  [
    ['wallet', 'address', 'bip-39', 'seed', 'hd wallet', 'mnemonic'],
    {
      gradient: 'from-violet-600/80 via-purple-700/70 to-fuchsia-600/60',
      icon: '👛',
      accent: 'text-violet-200',
      imageUrl: IMG('photo-1621416894569-0f39ed31d247'),   // Crypto wallet / phone
    },
  ],
  // Privacy
  [
    ['privacy', 'coinjoin', 'anonymity', 'mixing', 'confidential'],
    {
      gradient: 'from-gray-700/80 via-slate-800/70 to-zinc-700/60',
      icon: '🛡',
      accent: 'text-gray-300',
      imageUrl: IMG('photo-1555949963-ff9fe0c870eb'),   // Dark hooded figure / anonymous
    },
  ],
  // Economics / Markets
  [
    ['economics', 'market', 'inflation', 'monetary', 'supply', 'halving', 'scarcity'],
    {
      gradient: 'from-green-600/80 via-emerald-700/70 to-teal-600/60',
      icon: '📈',
      accent: 'text-green-200',
      imageUrl: IMG('photo-1611974789855-9c2a0a7236a3'),   // Stock chart / trading
    },
  ],
  // Smart Contracts / Scripting
  [
    ['smart contract', 'script', 'opcode', 'multisig', 'timelock'],
    {
      gradient: 'from-orange-600/80 via-red-700/70 to-rose-600/60',
      icon: '📜',
      accent: 'text-orange-200',
      imageUrl: IMG('photo-1526374965328-7f61d4dc18c5'),   // Code / matrix green
    },
  ],
  // Blockchain / Blocks
  [
    ['blockchain', 'block', 'chain', 'merkle', 'header'],
    {
      gradient: 'from-indigo-600/80 via-blue-700/70 to-sky-600/60',
      icon: '🔗',
      accent: 'text-indigo-200',
      imageUrl: IMG('photo-1639322537228-f710d846310a'),   // Blockchain visualization
    },
  ],
  // DeFi / Finance
  [
    ['defi', 'finance', 'lending', 'yield', 'staking'],
    {
      gradient: 'from-purple-600/80 via-violet-700/70 to-indigo-600/60',
      icon: '🏦',
      accent: 'text-purple-200',
      imageUrl: IMG('photo-1642790106117-e829e14a795f'),   // DeFi / crypto charts
    },
  ],
  // History / Culture
  [
    ['history', 'cypherpunk', 'movement', 'origin', 'philosophy'],
    {
      gradient: 'from-amber-700/80 via-yellow-800/70 to-orange-700/60',
      icon: '📖',
      accent: 'text-amber-200',
      imageUrl: IMG('photo-1618044619888-009e412ea9e2'),   // Vintage / retro tech
    },
  ],
  // Bitcoin / Cryptocurrency core (Moved to bottom as a fallback before DEFAULT)
  [
    ['bitcoin', 'btc', 'satoshi', 'genesis block', 'nakamoto'],
    {
      gradient: 'from-amber-500/80 via-orange-600/70 to-yellow-500/60',
      icon: '₿',
      accent: 'text-amber-200',
      imageUrl: IMG('photo-1639762681485-074b7f938ba0'),   // Gold Bitcoin coin
    },
  ],
];

/** Fallback theme when no topic matches */
const DEFAULT_THEME: TopicTheme = {
  gradient: 'from-bitcoin/60 via-signal/50 to-bitcoin/40',
  icon: '🎧',
  accent: 'text-bitcoin/60',
  imageUrl: IMG('photo-1639762681485-074b7f938ba0'),   // Default: gold Bitcoin
};

/**
 * Test whether a keyword appears in the haystack as a whole word (or phrase).
 * Uses word-boundary anchors so e.g. 'block' won't match inside 'blockchain'.
 */
const keywordMatches = (haystack: string, keyword: string): boolean => {
  // Escape regex-special chars, then wrap in word boundaries
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(haystack);
};

export const getTopicTheme = (playlist: Pick<AudioPlaylist, 'title' | 'description' | 'tags'>): TopicTheme => {
  const haystack = [
    playlist.title,
    playlist.description ?? '',
    ...(Array.isArray(playlist.tags) ? playlist.tags : []),
  ].join(' ').toLowerCase();

  for (const [keywords, theme] of TOPIC_THEMES) {
    if (keywords.some((kw) => keywordMatches(haystack, kw))) {
      return theme;
    }
  }
  return DEFAULT_THEME;
};

/**
 * Get the best image URL for a playlist.
 * Returns the playlist's own cover_image_url if set, otherwise a curated
 * Unsplash image matched to the playlist's topic.
 */
export const getTopicImageUrl = (playlist: Pick<AudioPlaylist, 'title' | 'description' | 'tags' | 'cover_image_url'>): string => {
  if (playlist.cover_image_url) return playlist.cover_image_url;
  return getTopicTheme(playlist).imageUrl;
};

// ─── Difficulty Inference ──────────────────────────────────────────────────

type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';

/** Keywords that signal a specific difficulty level */
const DIFFICULTY_SIGNALS: Record<DifficultyLevel, string[]> = {
  beginner: [
    'beginner', 'beginners', 'introduction', 'intro', 'getting started',
    'basics', 'basic', 'fundamentals', 'fundamental', 'overview', 'guide',
    'what is', 'first steps', '101', 'primer', 'newcomer',
  ],
  intermediate: [
    'intermediate', 'deep dive', 'how it works', 'under the hood',
    'architecture', 'protocol', 'implementation', 'internals',
    'in depth', 'in-depth', 'mechanism', 'detailed',
  ],
  advanced: [
    'advanced', 'expert', 'mastering', 'optimization', 'research',
    'formal verification', 'zero knowledge', 'zk-proof', 'cryptanalysis',
    'game theory', 'covenant', 'miniscript', 'schnorr', 'musig',
  ],
};

/**
 * Infer difficulty level from playlist metadata.
 *
 * Priority:
 * 1. Explicit difficulty_level from DB (if not null/default)
 * 2. Tag-based detection (tags often contain 'beginner', 'advanced', etc.)
 * 3. Title + description keyword matching
 * 4. Fallback: 'beginner'
 */
export const inferDifficulty = (playlist: Pick<AudioPlaylist, 'difficulty_level' | 'title' | 'description' | 'tags'>): DifficultyLevel => {
  // 1. If already set explicitly in the DB
  if (playlist.difficulty_level) {
    return playlist.difficulty_level;
  }

  const haystack = [
    ...(Array.isArray(playlist.tags) ? playlist.tags : []),
    playlist.title,
    playlist.description ?? '',
  ].join(' ').toLowerCase();

  // 2. Check for advanced first (so "advanced beginner" → advanced)
  if (DIFFICULTY_SIGNALS.advanced.some((kw) => keywordMatches(haystack, kw))) {
    return 'advanced';
  }

  // 3. Then intermediate
  if (DIFFICULTY_SIGNALS.intermediate.some((kw) => keywordMatches(haystack, kw))) {
    return 'intermediate';
  }

  // 4. Then beginner
  if (DIFFICULTY_SIGNALS.beginner.some((kw) => keywordMatches(haystack, kw))) {
    return 'beginner';
  }

  // 5. Fallback
  return 'beginner';
};
