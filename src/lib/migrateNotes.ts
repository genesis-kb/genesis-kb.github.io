/**
 * Schema migration logic for Notes localStorage data
 * Handles graceful transformation of old data shapes to current schema version
 * Mirrors the pattern in migrateLibrary.ts
 */

import { NotesState, DEFAULT_NOTES } from '@/types/notes'

function isV2NotesState(value: unknown): value is NotesState {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>

  return (
    data.version === 2 &&
    Array.isArray(data.notes)
  )
}

export function migrateNotes(raw: unknown): NotesState {
  // completely missing or wrong type — start fresh
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_NOTES }

  const data = raw as Record<string, unknown>

  // current version — use as-is when shape is valid
  if (isV2NotesState(data)) return data

  if (data.version === 1 && Array.isArray(data.notes)) {
    return {
      ...DEFAULT_NOTES,
      notes: data.notes
        .filter((n: unknown): n is Record<string, unknown> => typeof n === 'object' && n !== null)
        .map((note: Record<string, unknown>) => ({
          ...note,
          color: note.color || 'slate',
          tags: Array.isArray(note.tags) ? note.tags : [],
        } as any)),
      version: 2,
    }
  }

  if (!data.version) {
    return {
      ...DEFAULT_NOTES,
      notes: Array.isArray(data.notes) ? data.notes
        .filter((n: unknown): n is Record<string, unknown> => typeof n === 'object' && n !== null)
        .map((note: Record<string, unknown>) => ({
          ...note,
          color: note.color || 'slate',
          tags: Array.isArray(note.tags) ? note.tags : [],
        } as any)) : [],
      version: 2,
    }
  }

  // unknown future version loaded in older app — reset safely
  return { ...DEFAULT_NOTES }
}
