/**
 * Core hook for Notes management
 * All business logic lives here - components are pure rendering layers
 * Backed by the authenticated Notes API — requires login.
 * Uses React Query for data fetching and cache management.
 */

import { useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { notesApi } from '../../services/notesService'
import { useAuth } from './useAuth'
import type {
  Note,
  CreateNoteParams,
} from '@/types/notes'

const NOTES_QUERY_KEY = ['notes'] as const

export interface UseNotesReturn {
  notes: Note[]
  getNotesForTranscript: (transcriptId: string) => Note[]
  addNote: (params: CreateNoteParams) => void
  updateNote: (id: string, updates: Partial<Pick<Note, 'title' | 'content' | 'color' | 'tags' | 'isConcept' | 'position'>>) => void
  deleteNote: (id: string) => void
  togglePin: (id: string) => void
  noteCount: number
  isLoading: boolean
}

export function useNotes(): UseNotesReturn {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  // ─── Query ─────────────────────────────────────────────────
  const { data: notes = [], isLoading } = useQuery<Note[]>({
    queryKey: NOTES_QUERY_KEY,
    queryFn: () => notesApi.getAll(),
    enabled: !!user,
    staleTime: 30 * 1000, // 30s
  })

  // ─── Mutations ─────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (params: CreateNoteParams) => notesApi.create(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTES_QUERY_KEY })
      toast.success('Note saved')
    },
    onError: () => {
      toast.error('Failed to save note')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Pick<Note, 'title' | 'content' | 'tags' | 'isConcept' | 'pinned'>> }) =>
      notesApi.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTES_QUERY_KEY })
      toast.success('Note updated')
    },
    onError: () => {
      toast.error('Failed to update note')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => notesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTES_QUERY_KEY })
      toast.success('Note deleted')
    },
    onError: () => {
      toast.error('Failed to delete note')
    },
  })

  // ─── Stable callbacks ─────────────────────────────────────

  /**
   * Get all notes for a specific transcript, sorted: pinned first, then by updatedAt desc
   */
  const getNotesForTranscript = useCallback(
    (transcriptId: string) =>
      notes
        .filter((n) => n.transcriptId === transcriptId)
        .sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
          return b.updatedAt - a.updatedAt
        }),
    [notes]
  )

  /**
   * Create a new note
   */
  const addNote = useCallback(
    (params: CreateNoteParams) => {
      createMutation.mutate(params)
    },
    [createMutation]
  )

  /**
   * Update a note's fields
   */
  const updateNote = useCallback(
    (id: string, updates: Partial<Pick<Note, 'title' | 'content' | 'color' | 'tags' | 'isConcept' | 'position'>>) => {
      updateMutation.mutate({ id, updates })
    },
    [updateMutation]
  )

  /**
   * Delete a note by ID
   */
  const deleteNote = useCallback(
    (id: string) => {
      deleteMutation.mutate(id)
    },
    [deleteMutation]
  )

  /**
   * Toggle pin state of a note
   */
  const togglePin = useCallback(
    (id: string) => {
      const note = notes.find((n) => n.id === id)
      if (!note) return
      updateMutation.mutate({ id, updates: { pinned: !note.pinned } })
    },
    [notes, updateMutation]
  )

  return useMemo(() => ({
    notes,
    getNotesForTranscript,
    addNote,
    updateNote,
    deleteNote,
    togglePin,
    noteCount: notes.length,
    isLoading,
  }), [notes, getNotesForTranscript, addNote, updateNote, deleteNote, togglePin, isLoading])
}
