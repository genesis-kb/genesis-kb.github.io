/**
 * Shared TypeScript type definitions
 * Maps to the backend API response shapes
 */

/**
 * A single talk within a conference (from backend /api/v1/transcripts/conferences)
 */
export interface Talk {
  id: string;
  title: string;
  speaker: string;
  speakers?: string[];
  conference?: string;
  topics?: string[];
  duration: string;
  date: string;
  transcript: string;
  summary: string | null;
  tags: string[];
  transcriptBy: string;
}

/**
 * Conference grouping of talks (from backend /api/v1/transcripts/conferences)
 */
export interface Conference {
  id: string;
  name: string;
  location: string;
  year: number;
  talks: Talk[];
}

/**
 * Raw transcript row from the database (from backend /api/v1/transcripts/:id)
 */
export interface RawTranscript {
  id: string;
  title: string;
  speakers: string[] | string;
  event_date: string;
  loc: string;
  conference?: string;
  channel_name?: string;
  raw_text: string;
  corrected_text: string | null;
  summary: string | null;
  tags: string[];
  categories: string[];
  topics?: string[] | object;
  status?: string;
  duration_seconds?: number;
}

/**
 * Entity extraction result (from backend /api/v1/ai/entities)
 */
export interface Entities {
  speakers: string[];
  topics: string[];
  technicalConcepts: string[];
  organizations: string[];
  keyQuotes: string[];
  sentiment: string;
}

/**
 * A single full-text search result row (from search_transcripts_fts RPC)
 */
export interface SearchResult {
  id: string;
  title: string;
  speakers: string[] | string;
  event_date: string;
  loc: string;
  tags: string[] | object;
  categories: string[] | object;
  summary: string | null;
  conference?: string;
  channel_name?: string;
  status?: string;
  snippet?: string;
  rank: number;
  headline_title?: string;
  headline_content?: string;
}

/**
 * Paginated API response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ─── Audiobook Learning Roadmap Types ──────────────────────

/** Audiobook series */
export interface Audiobook {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
  created_at: string;
  chapter_count: number;
  total_duration_seconds: number;
}

/** Individual chapter within an audiobook */
export interface AudiobookChapter {
  id: string;
  audiobook_id: string;
  chapter_number: number;
  title: string;
  description: string | null;
  audio_url: string | null;
  duration_seconds: number;
  transcript_summary: string | null;
}

/** User's progress on a single chapter */
export interface ChapterProgress {
  chapter_id: string;
  current_seconds: number;
  completed: boolean;
}

/** Chapter merged with user progress and play status */
export interface RoadmapChapter extends AudiobookChapter {
  status: 'available' | 'completed' | 'coming_soon';
  progress: ChapterProgress | null;
}

/** Full roadmap API response */
export interface AudiobookRoadmap {
  audiobook: Audiobook;
  chapters: RoadmapChapter[];
}

// ─── New Pipeline Types (Playlists / Episodes) ───────────────

/** A timestamped chapter marker within an audio episode (stored as JSONB). */
export interface EpisodeChapterMarker {
  title: string;
  start_seconds: number;
  end_seconds?: number;
}

export interface AudioEpisode {
  id: string;
  playlist_id: string;
  title: string;
  description: string | null;
  sequence_number: number;
  audio_url: string | null;
  duration_seconds: number | null;
  source_url: string | null;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  transcript_summary: string | null;
  chapters: EpisodeChapterMarker[];
  metadata: Record<string, unknown>;
  created_at: string;
  /** User-specific progress — present when fetched with x-user-id header */
  user_progress?: {
    current_seconds: number;
    completed: boolean;
  } | null;
}

export interface AudioPlaylist {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  playlist_type: 'series' | 'collection';
  cover_image_url: string | null;
  tags: string[];
  status: 'draft' | 'published' | 'archived';
  source: 'manual' | 'pipeline';
  difficulty_level: 'beginner' | 'intermediate' | 'advanced' | null;
  total_duration_seconds: number;
  episode_count: number;
  created_at: string;
  updated_at: string;
  episodes?: AudioEpisode[]; // Only present when fetched by slug
}

export interface PlaylistsResponse {
  data: AudioPlaylist[];
  total: number;
}

export interface PlaylistsParams {
  status?: 'draft' | 'published' | 'archived';
  playlist_type?: 'series' | 'collection';
  source?: 'manual' | 'pipeline';
  limit?: number;
  offset?: number;
}

