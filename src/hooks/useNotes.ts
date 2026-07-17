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
    staleTime: 30 * 1000,  // 30s
    gcTime: 5 * 60 * 1000, // 5min cache
  })

  // ─── Mutations (with optimistic updates) ────────────────────

  const createMutation = useMutation({
    mutationFn: (params: CreateNoteParams) => notesApi.create(params),
    onMutate: async (params) => {
      await queryClient.cancelQueries({ queryKey: NOTES_QUERY_KEY })
      const previous = queryClient.getQueryData<Note[]>(NOTES_QUERY_KEY)
      queryClient.setQueryData<Note[]>(NOTES_QUERY_KEY, (old = []) => [
        ...old,
        {
          id: crypto.randomUUID(), // temporary, replaced on settle
          transcriptId: params.transcriptId,
          transcriptTitle: params.transcriptTitle || '',
          title: params.title || 'Untitled Note',
          content: params.content,
          selectedText: params.selectedText,
          pinned: false,
          color: params.color || 'slate',
          tags: params.tags || [],
          isConcept: params.isConcept || false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ])
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(NOTES_QUERY_KEY, context.previous)
      toast.error('Failed to save note')
    },
    onSuccess: () => toast.success('Note saved'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: NOTES_QUERY_KEY }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Pick<Note, 'title' | 'content' | 'tags' | 'isConcept' | 'pinned'>> }) =>
      notesApi.update(id, updates),
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: NOTES_QUERY_KEY })
      const previous = queryClient.getQueryData<Note[]>(NOTES_QUERY_KEY)
      queryClient.setQueryData<Note[]>(NOTES_QUERY_KEY, (old = []) =>
        old.map((n) => (n.id === id ? { ...n, ...updates, updatedAt: Date.now() } : n))
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(NOTES_QUERY_KEY, context.previous)
      toast.error('Failed to update note')
    },
    onSuccess: () => toast.success('Note updated'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: NOTES_QUERY_KEY }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => notesApi.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: NOTES_QUERY_KEY })
      const previous = queryClient.getQueryData<Note[]>(NOTES_QUERY_KEY)
      queryClient.setQueryData<Note[]>(NOTES_QUERY_KEY, (old = []) =>
        old.filter((n) => n.id !== id)
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(NOTES_QUERY_KEY, context.previous)
      toast.error('Failed to delete note')
    },
    onSuccess: () => toast.success('Note deleted'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: NOTES_QUERY_KEY }),
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
