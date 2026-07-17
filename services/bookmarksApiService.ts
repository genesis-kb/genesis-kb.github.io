/**
 * Bookmarks & Highlights API Service
 * Handles all HTTP calls to the bookmarks and highlights endpoints.
 * All endpoints require authentication (JWT auto-injected by api.ts).
 */

import api from './api';
import type { Bookmark, Highlight } from '@/types/bookmarks';

// ─── Backend row shapes (snake_case) ────────────────────────────────────────

interface BookmarkRow {
  id: string;
  transcript_id: string;
  title: string;
  speakers: string | null;
  event_date: string | null;
  conference: string | null;
  created_at: string;
}

interface HighlightRow {
  id: string;
  transcript_id: string;
  transcript_title: string | null;
  text: string;
  note: string | null;
  color: string;
  is_underline: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Row → Frontend shape transformers ──────────────────────────────────────

function rowToBookmark(row: BookmarkRow): Bookmark {
  return {
    id: row.transcript_id, // Bookmark.id is the transcript_id (matches existing convention)
    title: row.title,
    speakers: row.speakers || '',
    event_date: row.event_date || '',
    conference: row.conference || 'Unknown',
    savedAt: new Date(row.created_at).getTime(),
  };
}

function rowToHighlight(row: HighlightRow): Highlight {
  return {
    id: row.id,
    transcriptId: row.transcript_id,
    transcriptTitle: row.transcript_title || '',
    text: row.text,
    note: row.note || undefined,
    color: row.color,
    isUnderline: row.is_underline,
    savedAt: new Date(row.created_at).getTime(),
  };
}

// ─── Bookmarks API ──────────────────────────────────────────────────────────

export const bookmarksApi = {
  /**
   * Fetch all bookmarks for the authenticated user.
   */
  getAll: async (): Promise<Bookmark[]> => {
    const rows = await api.get<BookmarkRow[]>('/api/v1/bookmarks');
    return rows.map(rowToBookmark);
  },

  /**
   * Create a bookmark.
   */
  create: async (data: {
    transcriptId: string;
    title: string;
    speakers?: string;
    eventDate?: string;
    conference?: string;
  }): Promise<Bookmark> => {
    const row = await api.post<BookmarkRow>('/api/v1/bookmarks', {
      transcript_id: data.transcriptId,
      title: data.title,
      speakers: data.speakers,
      event_date: data.eventDate,
      conference: data.conference,
    });
    return rowToBookmark(row);
  },

  /**
   * Delete a bookmark by transcript ID.
   */
  delete: async (transcriptId: string): Promise<void> => {
    await api.delete(`/api/v1/bookmarks/${encodeURIComponent(transcriptId)}`);
  },
};

// ─── Highlights API ─────────────────────────────────────────────────────────

export const highlightsApi = {
  /**
   * Fetch all highlights, optionally filtered by transcript.
   */
  getAll: async (transcriptId?: string): Promise<Highlight[]> => {
    const qs = transcriptId ? `?transcript_id=${encodeURIComponent(transcriptId)}` : '';
    const rows = await api.get<HighlightRow[]>(`/api/v1/highlights${qs}`);
    return rows.map(rowToHighlight);
  },

  /**
   * Create a highlight.
   */
  create: async (data: {
    transcriptId: string;
    transcriptTitle?: string;
    text: string;
    note?: string;
    color?: string;
    isUnderline?: boolean;
  }): Promise<Highlight> => {
    const row = await api.post<HighlightRow>('/api/v1/highlights', {
      transcript_id: data.transcriptId,
      transcript_title: data.transcriptTitle,
      text: data.text,
      note: data.note,
      color: data.color,
      is_underline: data.isUnderline,
    });
    return rowToHighlight(row);
  },

  /**
   * Update a highlight's note.
   */
  updateNote: async (id: string, note: string): Promise<Highlight> => {
    const row = await api.put<HighlightRow>(`/api/v1/highlights/${id}`, { note });
    return rowToHighlight(row);
  },

  /**
   * Delete a highlight.
   */
  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/v1/highlights/${id}`);
  },
};

export default { bookmarksApi, highlightsApi };
