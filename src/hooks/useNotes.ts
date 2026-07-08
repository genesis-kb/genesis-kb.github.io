/**
 * Core hook for Notes management
 * All business logic lives here - components are pure rendering layers
 * Handles persistence, cross-tab sync, and all mutations
 * Mirrors the pattern in useBookmarks.ts
 */

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  noteStore,
  NOTES_STORAGE_KEY,
  isNoteStorePersistent,
} from '@/lib/noteStore'
import { migrateNotes } from '@/lib/migrateNotes'
import {
  Note,
  NotesState,
  CreateNoteParams,
} from '@/types/notes'

const NOTES_SYNC_EVENT = 'btc-notes-sync'

export interface UseNotesReturn {
  notes: Note[]
  getNotesForTranscript: (transcriptId: string) => Note[]
  addNote: (params: CreateNoteParams) => string
  updateNote: (id: string, updates: Partial<Pick<Note, 'title' | 'content' | 'color' | 'tags' | 'isConcept' | 'position'>>) => void
  deleteNote: (id: string) => void
  togglePin: (id: string) => void
  noteCount: number
  isPersistent: boolean
}

export function useNotes(): UseNotesReturn {
  // Lazy initializer - load from storage once on mount
  const [state, setState] = useState<NotesState>(() => noteStore.load())

  // Persist to storage whenever state changes
  useEffect(() => {
    const persisted = noteStore.save(state)
    if (persisted !== state) {
      setState(persisted)
      return
    }

    // Keep multiple hook instances in the same tab synchronized
    window.dispatchEvent(
      new CustomEvent<NotesState>(NOTES_SYNC_EVENT, { detail: state })
    )
  }, [state])

  // Cross-tab sync - listen for storage events from other tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === NOTES_STORAGE_KEY && e.newValue) {
        try {
          const parsed = migrateNotes(JSON.parse(e.newValue))
          setState(parsed)
        } catch {
          // Corrupted data from other tab — ignore silently
        }
      }
    }

    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Same-tab sync across multiple hook instances
  useEffect(() => {
    const onSameTabSync = (event: Event) => {
      const nextState = (event as CustomEvent<NotesState>).detail
      setState((prev) => (prev === nextState ? prev : nextState))
    }

    window.addEventListener(NOTES_SYNC_EVENT, onSameTabSync)
    return () => window.removeEventListener(NOTES_SYNC_EVENT, onSameTabSync)
  }, [])

  /**
   * Get all notes for a specific transcript, sorted: pinned first, then by updatedAt desc
   */
  const getNotesForTranscript = useCallback(
    (transcriptId: string) =>
      state.notes
        .filter((n) => n.transcriptId === transcriptId)
        .sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
          return b.updatedAt - a.updatedAt
        }),
    [state.notes]
  )

  /**
   * Create a new note — returns the generated note ID
   */
  const addNote = useCallback((params: CreateNoteParams): string => {
    const now = Date.now()
    const id = crypto.randomUUID()

    const note: Note = {
      id,
      transcriptId: params.transcriptId,
      transcriptTitle: params.transcriptTitle,
      title: params.title?.trim() || 'Untitled Note',
      content: params.content,
      selectedText: params.selectedText,
      paragraphRef: params.paragraphRef,
      color: params.color || 'slate',
      tags: params.tags || [],
      isConcept: params.isConcept || false,
      position: params.position,
      pinned: false,
      createdAt: now,
      updatedAt: now,
    }

    setState((prev) => {
      const nextState = {
        ...prev,
        notes: [...prev.notes, note],
      };
      noteStore.save(nextState);
      return nextState;
    })

    toast.success('Note saved')
    return id
  }, [])

  /**
   * Update a note's fields
   */
  const updateNote = useCallback(
    (id: string, updates: Partial<Pick<Note, 'title' | 'content' | 'color' | 'tags' | 'isConcept' | 'position'>>) => {
      setState((prev) => {
        const nextState = {
          ...prev,
          notes: prev.notes.map((n) =>
            n.id === id
              ? {
                  ...n,
                  ...updates,
                  title: updates.title?.trim() || n.title,
                  updatedAt: Date.now(),
                }
              : n
          ),
        };
        noteStore.save(nextState);
        return nextState;
      })

      toast.success('Note updated')
    },
    []
  )

  /**
   * Delete a note by ID
   */
  const deleteNote = useCallback((id: string) => {
    setState((prev) => {
      const nextState = {
        ...prev,
        notes: prev.notes.filter((n) => n.id !== id),
      };
      noteStore.save(nextState);
      return nextState;
    })

    toast.success('Note deleted')
  }, [])

  /**
   * Toggle pin state of a note
   */
  const togglePin = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      notes: prev.notes.map((n) =>
        n.id === id
          ? { ...n, pinned: !n.pinned, updatedAt: Date.now() }
          : n
      ),
    }))
  }, [])

  return {
    notes: state.notes,
    getNotesForTranscript,
    addNote,
    updateNote,
    deleteNote,
    togglePin,
    noteCount: state.notes.length,
    isPersistent: isNoteStorePersistent,
  }
}
