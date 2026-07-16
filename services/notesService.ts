/**
 * Notes API Service
 * Handles all HTTP calls to the notes endpoints.
 * All endpoints require authentication (JWT auto-injected by api.ts).
 */

import api from './api';
import type { Note, CreateNoteParams } from '@/types/notes';

/** Backend note row shape (snake_case) */
interface NoteRow {
  id: string;
  transcript_id: string;
  transcript_title: string | null;
  title: string;
  content: string;
  selected_text: string | null;
  pinned: boolean;
  is_concept: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
}

/** Transform a backend row (snake_case) into the frontend Note shape (camelCase). */
function rowToNote(row: NoteRow): Note {
  return {
    id: row.id,
    transcriptId: row.transcript_id,
    transcriptTitle: row.transcript_title || '',
    title: row.title,
    content: row.content,
    selectedText: row.selected_text || undefined,
    pinned: row.pinned,
    color: 'slate', // backend doesn't store color — default
    tags: row.tags || [],
    isConcept: row.is_concept,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

export const notesApi = {
  /**
   * Fetch all notes for the authenticated user.
   * Optionally scoped to a specific transcript.
   */
  getAll: async (transcriptId?: string): Promise<Note[]> => {
    const qs = transcriptId ? `?transcript_id=${encodeURIComponent(transcriptId)}` : '';
    const rows = await api.get<NoteRow[]>(`/api/v1/notes${qs}`);
    return rows.map(rowToNote);
  },

  /**
   * Create a new note.
   */
  create: async (params: CreateNoteParams): Promise<Note> => {
    const row = await api.post<NoteRow>('/api/v1/notes', {
      transcript_id: params.transcriptId,
      transcript_title: params.transcriptTitle,
      title: params.title,
      content: params.content,
      selected_text: params.selectedText,
      is_concept: params.isConcept,
      tags: params.tags,
    });
    return rowToNote(row);
  },

  /**
   * Update a note.
   */
  update: async (
    id: string,
    updates: Partial<Pick<Note, 'title' | 'content' | 'tags' | 'isConcept' | 'pinned'>>
  ): Promise<Note> => {
    const body: Record<string, unknown> = {};
    if (updates.title !== undefined) body.title = updates.title;
    if (updates.content !== undefined) body.content = updates.content;
    if (updates.tags !== undefined) body.tags = updates.tags;
    if (updates.isConcept !== undefined) body.is_concept = updates.isConcept;
    if (updates.pinned !== undefined) body.pinned = updates.pinned;

    const row = await api.put<NoteRow>(`/api/v1/notes/${id}`, body);
    return rowToNote(row);
  },

  /**
   * Delete a note.
   */
  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/v1/notes/${id}`);
  },
};

export default notesApi;
