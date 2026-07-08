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
  tags: string[] | object;
  categories: string[] | object;
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

