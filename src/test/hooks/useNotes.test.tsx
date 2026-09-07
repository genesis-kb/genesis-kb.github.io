/**
 * Unit Tests — hooks/useNotes.ts
 *
 * Tests the Notes hook with React Query.
 * Mocks the notesApi to test add, update, delete, togglePin, and filtering.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// Mock useAuth
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'test@test.com' },
    token: 'mock-token',
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    openLoginModal: vi.fn(),
    closeLoginModal: vi.fn(),
    isLoginModalOpen: false,
  }),
}))

// Mock notesApi — factory must not reference variables from outer scope
vi.mock('../../../services/notesService', () => ({
  notesApi: {
    getAll: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(undefined),
  },
  default: {
    getAll: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock crypto.randomUUID
vi.stubGlobal('crypto', {
  randomUUID: () => 'temp-uuid-' + Math.random().toString(36).slice(2, 8),
})

import { useNotes } from '@/hooks/useNotes'
import { notesApi } from '../../../services/notesService'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(notesApi.getAll).mockResolvedValue([])
  })

  it('starts with empty notes and isLoading', async () => {
    const { result } = renderHook(() => useNotes(), { wrapper: createWrapper() })

    // Initially loading, then resolves
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.notes).toEqual([])
    expect(result.current.noteCount).toBe(0)
  })

  it('fetches notes from the API on mount', async () => {
    const mockNotes = [
      {
        id: 'n1',
        transcriptId: 't1',
        transcriptTitle: 'Talk',
        title: 'My Note',
        content: 'Some content',
        pinned: false,
        createdAt: 1000,
        updatedAt: 1000,
      },
    ]
    vi.mocked(notesApi.getAll).mockResolvedValueOnce(mockNotes)

    const { result } = renderHook(() => useNotes(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.notes).toHaveLength(1)
    })

    expect(result.current.notes[0].title).toBe('My Note')
    expect(result.current.noteCount).toBe(1)
  })

  it('getNotesForTranscript filters and sorts (pinned first, then by updatedAt desc)', async () => {
    const mockNotes = [
      { id: 'n1', transcriptId: 't1', transcriptTitle: 'Talk', title: 'Old', content: '', pinned: false, createdAt: 100, updatedAt: 100 },
      { id: 'n2', transcriptId: 't1', transcriptTitle: 'Talk', title: 'Pinned', content: '', pinned: true, createdAt: 50, updatedAt: 50 },
      { id: 'n3', transcriptId: 't1', transcriptTitle: 'Talk', title: 'Recent', content: '', pinned: false, createdAt: 200, updatedAt: 200 },
      { id: 'n4', transcriptId: 't2', transcriptTitle: 'Other', title: 'Other', content: '', pinned: false, createdAt: 300, updatedAt: 300 },
    ]
    vi.mocked(notesApi.getAll).mockResolvedValueOnce(mockNotes)

    const { result } = renderHook(() => useNotes(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.notes).toHaveLength(4)
    })

    const t1Notes = result.current.getNotesForTranscript('t1')
    expect(t1Notes).toHaveLength(3)
    expect(t1Notes[0].title).toBe('Pinned') // pinned first
    expect(t1Notes[1].title).toBe('Recent') // higher updatedAt
    expect(t1Notes[2].title).toBe('Old')

    const t2Notes = result.current.getNotesForTranscript('t2')
    expect(t2Notes).toHaveLength(1)
  })

  it('addNote calls the create API', async () => {
    vi.mocked(notesApi.create).mockResolvedValueOnce({ id: 'n-new', title: 'New Note' } as any)

    const { result } = renderHook(() => useNotes(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.addNote({
        transcriptId: 't1',
        transcriptTitle: 'Talk',
        content: 'My new note content',
      })
    })

    await waitFor(() => {
      expect(notesApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          transcriptId: 't1',
          content: 'My new note content',
        })
      )
    })
  })

  it('deleteNote calls the delete API', async () => {
    vi.mocked(notesApi.getAll).mockResolvedValueOnce([
      { id: 'n1', transcriptId: 't1', transcriptTitle: 'Talk', title: 'Del Me', content: '', pinned: false, createdAt: 1, updatedAt: 1 },
    ])
    vi.mocked(notesApi.delete).mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useNotes(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.notes).toHaveLength(1))

    act(() => {
      result.current.deleteNote('n1')
    })

    await waitFor(() => {
      expect(notesApi.delete).toHaveBeenCalledWith('n1')
    })
  })

  it('updateNote calls the update API', async () => {
    vi.mocked(notesApi.getAll).mockResolvedValueOnce([
      { id: 'n1', transcriptId: 't1', transcriptTitle: 'Talk', title: 'Old Title', content: 'old', pinned: false, createdAt: 1, updatedAt: 1 },
    ])
    vi.mocked(notesApi.update).mockResolvedValueOnce({} as any)

    const { result } = renderHook(() => useNotes(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.notes).toHaveLength(1))

    act(() => {
      result.current.updateNote('n1', { title: 'New Title', content: 'Updated content' })
    })

    await waitFor(() => {
      expect(notesApi.update).toHaveBeenCalledWith('n1', expect.objectContaining({
        title: 'New Title',
        content: 'Updated content',
      }))
    })
  })

  it('togglePin calls update with inverted pinned state', async () => {
    vi.mocked(notesApi.getAll).mockResolvedValueOnce([
      { id: 'n1', transcriptId: 't1', transcriptTitle: 'Talk', title: 'Note', content: '', pinned: false, createdAt: 1, updatedAt: 1 },
    ])
    vi.mocked(notesApi.update).mockResolvedValueOnce({} as any)

    const { result } = renderHook(() => useNotes(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.notes).toHaveLength(1))

    act(() => {
      result.current.togglePin('n1')
    })

    await waitFor(() => {
      expect(notesApi.update).toHaveBeenCalledWith('n1', { pinned: true })
    })
  })
})
