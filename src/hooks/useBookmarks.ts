/**
 * Core hook for Bookmark & Highlights management
 * DUAL-MODE: API-backed for authenticated users, localStorage for guests
 *
 * Authenticated users:
 *   - React Query manages server state (fetch, cache, optimistic updates)
 *   - Stale time: bookmarks 60s, highlights 30s
 *   - Optimistic updates for instant UI feedback
 *
 * Guest users:
 *   - Falls back to existing localStorage implementation (bookmarkStore)
 *   - Cross-tab sync via StorageEvent
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  bookmarkStore,
  STORAGE_KEY,
  isBookmarkStorePersistent,
} from '@/lib/bookmarkStore'
import { migrateLibrary } from '@/lib/migrateLibrary'
import { useAuth } from './useAuth'
import { bookmarksApi, highlightsApi } from '../../services/bookmarksApiService'
import {
  Bookmark,
  Highlight,
  LibraryState,
} from '@/types/bookmarks'

const LIBRARY_SYNC_EVENT = 'btc-library-sync'
const PRIVATE_MODE_NOTICE_KEY = 'btc-library-private-mode-notice-shown'

// ─── React Query keys ───────────────────────────────────────────────────────
const BOOKMARKS_KEY = ['bookmarks'] as const
const HIGHLIGHTS_KEY = ['highlights'] as const

/**
 * Represents a transcript object with the fields we need to snapshot
 */
interface Transcript {
  id: string
  title: string
  speakers: string | string[]
  event_date: string
  loc?: string
}

export interface UseBookmarksReturn {
  bookmarks: Bookmark[]
  highlights: Highlight[]
  isBookmarked: (id: string) => boolean
  addBookmark: (transcript: Transcript) => void
  removeBookmark: (id: string) => void
  addHighlight: (
    transcriptId: string,
    transcriptTitle: string,
    text: string,
    note?: string,
    color?: string,
    isUnderline?: boolean
  ) => void
  removeHighlight: (id: string) => void
  updateHighlightNote: (id: string, note: string) => void
  getHighlightsForTranscript: (transcriptId: string) => Highlight[]
  totalCount: number
  isPersistent: boolean
  showPrivateModeNotice: boolean
  isLoading: boolean
}

// ─── Authenticated Mode (React Query + API) ────────────────────────────────

function useAuthenticatedBookmarks(): UseBookmarksReturn {
  const queryClient = useQueryClient()

  // ─── Queries ────────────────────────────────────────────
  const {
    data: bookmarks = [],
    isLoading: isBookmarksLoading,
  } = useQuery<Bookmark[]>({
    queryKey: BOOKMARKS_KEY,
    queryFn: () => bookmarksApi.getAll(),
    staleTime: 60 * 1000,  // 60s — bookmarks change infrequently
    gcTime: 10 * 60 * 1000, // 10min cache
  })

  const {
    data: highlights = [],
    isLoading: isHighlightsLoading,
  } = useQuery<Highlight[]>({
    queryKey: HIGHLIGHTS_KEY,
    queryFn: () => highlightsApi.getAll(),
    staleTime: 30 * 1000,  // 30s
    gcTime: 5 * 60 * 1000, // 5min cache
  })

  // ─── Bookmark Mutations (with optimistic updates) ──────

  const addBookmarkMutation = useMutation({
    mutationFn: (transcript: Transcript) => {
      const speakersStr = Array.isArray(transcript.speakers)
        ? transcript.speakers.join(', ')
        : transcript.speakers
      return bookmarksApi.create({
        transcriptId: transcript.id,
        title: transcript.title,
        speakers: speakersStr,
        eventDate: transcript.event_date,
        conference: transcript.loc || 'Unknown',
      })
    },
    onMutate: async (transcript) => {
      await queryClient.cancelQueries({ queryKey: BOOKMARKS_KEY })
      const previous = queryClient.getQueryData<Bookmark[]>(BOOKMARKS_KEY)
      const speakersStr = Array.isArray(transcript.speakers)
        ? transcript.speakers.join(', ')
        : transcript.speakers
      queryClient.setQueryData<Bookmark[]>(BOOKMARKS_KEY, (old = []) => [
        ...old,
        {
          id: transcript.id,
          title: transcript.title,
          speakers: speakersStr,
          event_date: transcript.event_date,
          conference: transcript.loc || 'Unknown',
          savedAt: Date.now(),
        },
      ])
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(BOOKMARKS_KEY, context.previous)
      }
      toast.error('Failed to save bookmark')
    },
    onSuccess: () => {
      toast.success('Bookmarked')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: BOOKMARKS_KEY })
    },
  })

  const removeBookmarkMutation = useMutation({
    mutationFn: (id: string) => bookmarksApi.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: BOOKMARKS_KEY })
      const previous = queryClient.getQueryData<Bookmark[]>(BOOKMARKS_KEY)
      queryClient.setQueryData<Bookmark[]>(BOOKMARKS_KEY, (old = []) =>
        old.filter((b) => b.id !== id)
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(BOOKMARKS_KEY, context.previous)
      }
      toast.error('Failed to remove bookmark')
    },
    onSuccess: () => {
      toast.success('Removed from library')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: BOOKMARKS_KEY })
    },
  })

  // ─── Highlight Mutations (with optimistic updates) ─────

  const addHighlightMutation = useMutation({
    mutationFn: (data: {
      transcriptId: string
      transcriptTitle: string
      text: string
      note?: string
      color?: string
      isUnderline?: boolean
    }) => highlightsApi.create(data),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: HIGHLIGHTS_KEY })
      const previous = queryClient.getQueryData<Highlight[]>(HIGHLIGHTS_KEY)
      queryClient.setQueryData<Highlight[]>(HIGHLIGHTS_KEY, (old = []) => [
        ...old,
        {
          id: crypto.randomUUID(), // temporary ID, replaced on settle
          transcriptId: data.transcriptId,
          transcriptTitle: data.transcriptTitle,
          text: data.text,
          note: data.note,
          color: data.color,
          isUnderline: data.isUnderline,
          savedAt: Date.now(),
        },
      ])
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(HIGHLIGHTS_KEY, context.previous)
      }
      toast.error('Failed to save highlight')
    },
    onSuccess: () => {
      toast.success('Highlight saved')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: HIGHLIGHTS_KEY })
    },
  })

  const removeHighlightMutation = useMutation({
    mutationFn: (id: string) => highlightsApi.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: HIGHLIGHTS_KEY })
      const previous = queryClient.getQueryData<Highlight[]>(HIGHLIGHTS_KEY)
      queryClient.setQueryData<Highlight[]>(HIGHLIGHTS_KEY, (old = []) =>
        old.filter((h) => h.id !== id)
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(HIGHLIGHTS_KEY, context.previous)
      }
      toast.error('Failed to remove highlight')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: HIGHLIGHTS_KEY })
    },
  })

  const updateHighlightNoteMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      highlightsApi.updateNote(id, note),
    onMutate: async ({ id, note }) => {
      await queryClient.cancelQueries({ queryKey: HIGHLIGHTS_KEY })
      const previous = queryClient.getQueryData<Highlight[]>(HIGHLIGHTS_KEY)
      queryClient.setQueryData<Highlight[]>(HIGHLIGHTS_KEY, (old = []) =>
        old.map((h) => (h.id === id ? { ...h, note } : h))
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(HIGHLIGHTS_KEY, context.previous)
      }
      toast.error('Failed to save note')
    },
    onSuccess: () => {
      toast.success('Note saved')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: HIGHLIGHTS_KEY })
    },
  })

  // ─── Stable callbacks ─────────────────────────────────

  const isBookmarked = useCallback(
    (id: string) => bookmarks.some((b) => b.id === id),
    [bookmarks]
  )

  const addBookmark = useCallback(
    (transcript: Transcript) => {
      if (bookmarks.some((b) => b.id === transcript.id)) return
      addBookmarkMutation.mutate(transcript)
    },
    [bookmarks, addBookmarkMutation]
  )

  const removeBookmark = useCallback(
    (id: string) => removeBookmarkMutation.mutate(id),
    [removeBookmarkMutation]
  )

  const addHighlight = useCallback(
    (
      transcriptId: string,
      transcriptTitle: string,
      text: string,
      note?: string,
      color?: string,
      isUnderline?: boolean
    ) => {
      if (text.trim().length < 10) return
      const truncatedText = text.length > 500 ? text.slice(0, 500) + '...' : text
      addHighlightMutation.mutate({
        transcriptId,
        transcriptTitle,
        text: truncatedText,
        note: note?.trim(),
        color,
        isUnderline,
      })
    },
    [addHighlightMutation]
  )

  const removeHighlight = useCallback(
    (id: string) => removeHighlightMutation.mutate(id),
    [removeHighlightMutation]
  )

  const updateHighlightNote = useCallback(
    (id: string, note: string) => updateHighlightNoteMutation.mutate({ id, note }),
    [updateHighlightNoteMutation]
  )

  const getHighlightsForTranscript = useCallback(
    (transcriptId: string) => highlights.filter((h) => h.transcriptId === transcriptId),
    [highlights]
  )

  return {
    bookmarks,
    highlights,
    isBookmarked,
    addBookmark,
    removeBookmark,
    addHighlight,
    removeHighlight,
    updateHighlightNote,
    getHighlightsForTranscript,
    totalCount: bookmarks.length + highlights.length,
    isPersistent: true,
    showPrivateModeNotice: false,
    isLoading: isBookmarksLoading || isHighlightsLoading,
  }
}

// ─── Guest Mode (localStorage) ─────────────────────────────────────────────

function useGuestBookmarks(): UseBookmarksReturn {
  const [showPrivateModeNotice, setShowPrivateModeNotice] = useState(false)

  // Lazy initializer - load from storage once on mount
  const [library, setLibrary] = useState<LibraryState>(() =>
    bookmarkStore.load()
  )

  // Persist to storage whenever library changes
  useEffect(() => {
    const persisted = bookmarkStore.save(library)
    if (persisted !== library) {
      setLibrary(persisted)
      return
    }

    // Keep multiple hook instances in the same tab synchronized.
    window.dispatchEvent(
      new CustomEvent<LibraryState>(LIBRARY_SYNC_EVENT, { detail: library })
    )
  }, [library])

  // Cross-tab sync - listen for storage events from other tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = migrateLibrary(JSON.parse(e.newValue))
          setLibrary(parsed)
        } catch {
          // Corrupted data from other tab — ignore silently
        }
      }
    }

    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    const onSameTabSync = (event: Event) => {
      const nextLibrary = (event as CustomEvent<LibraryState>).detail
      setLibrary((prev) => (prev === nextLibrary ? prev : nextLibrary))
    }

    window.addEventListener(LIBRARY_SYNC_EVENT, onSameTabSync)
    return () => window.removeEventListener(LIBRARY_SYNC_EVENT, onSameTabSync)
  }, [])

  useEffect(() => {
    if (isBookmarkStorePersistent) return

    if (sessionStorage.getItem(PRIVATE_MODE_NOTICE_KEY) === '1') return

    setShowPrivateModeNotice(true)
    sessionStorage.setItem(PRIVATE_MODE_NOTICE_KEY, '1')
  }, [])

  /**
   * Add a bookmark for a transcript
   * Idempotent - safe against double-clicks, won't create duplicates
   */
  const addBookmark = useCallback((transcript: Transcript) => {
    let wasAdded = false

    setLibrary((prev) => {
      // Check if already bookmarked
      if (prev.bookmarks.some((b) => b.id === transcript.id)) {
        return prev
      }

      wasAdded = true

      // Build snapshot from transcript
      const speakersStr = Array.isArray(transcript.speakers)
        ? transcript.speakers.join(', ')
        : transcript.speakers

      const bookmark: Bookmark = {
        id: transcript.id,
        title: transcript.title,
        speakers: speakersStr,
        event_date: transcript.event_date,
        conference: transcript.loc || 'Unknown',
        savedAt: Date.now(),
      }

      const nextLibrary = {
        ...prev,
        bookmarks: [...prev.bookmarks, bookmark],
      }
      return nextLibrary
    })

    if (wasAdded) {
      toast.success('Bookmarked')
    }
  }, [])

  /**
   * Remove a bookmark by ID
   */
  const removeBookmark = useCallback((id: string) => {
    setLibrary((prev) => ({
      ...prev,
      bookmarks: prev.bookmarks.filter((b) => b.id !== id),
    }))

    toast.success('Removed from library')
  }, [])

  /**
   * Check if a transcript is bookmarked
   * Wrapped in useCallback for stable reference in child components
   */
  const isBookmarked = useCallback(
    (id: string) => library.bookmarks.some((b) => b.id === id),
    [library.bookmarks]
  )

  /**
   * Add a highlight - validates text, caps at 500 chars
   */
  const addHighlight = useCallback(
    (
      transcriptId: string,
      transcriptTitle: string,
      text: string,
      note?: string,
      color?: string,
      isUnderline?: boolean
    ) => {
      // Validate - minimum 10 characters
      if (text.trim().length < 10) {
        return
      }

      // Cap text at 500 characters
      const truncatedText =
        text.length > 500 ? text.slice(0, 500) + '...' : text

      setLibrary((prev) => {
        const highlight: Highlight = {
          id: crypto.randomUUID(),
          transcriptId,
          transcriptTitle,
          text: truncatedText,
          note: note?.trim(),
          color,
          isUnderline,
          savedAt: Date.now(),
        }

        return {
          ...prev,
          highlights: [...prev.highlights, highlight],
        }
      })

      toast.success('Highlight saved')
    },
    []
  )

  /**
   * Remove a highlight by ID
   */
  const removeHighlight = useCallback((id: string) => {
    setLibrary((prev) => ({
      ...prev,
      highlights: prev.highlights.filter((h) => h.id !== id),
    }))
  }, [])

  /**
   * Update the note on a highlight
   */
  const updateHighlightNote = useCallback((id: string, note: string) => {
    setLibrary((prev) => ({
      ...prev,
      highlights: prev.highlights.map((h) =>
        h.id === id ? { ...h, note } : h
      ),
    }))

    toast.success('Note saved')
  }, [])

  /**
   * Get all highlights for a specific transcript
   * Wrapped in useCallback for stable reference
   */
  const getHighlightsForTranscript = useCallback(
    (transcriptId: string) =>
      library.highlights.filter((h) => h.transcriptId === transcriptId),
    [library.highlights]
  )

  return {
    bookmarks: library.bookmarks,
    highlights: library.highlights,
    isBookmarked,
    addBookmark,
    removeBookmark,
    addHighlight,
    removeHighlight,
    updateHighlightNote,
    getHighlightsForTranscript,
    totalCount: library.bookmarks.length + library.highlights.length,
    isPersistent: isBookmarkStorePersistent,
    showPrivateModeNotice,
    isLoading: false,
  }
}

// ─── Main Hook (Dual-Mode Switch) ───────────────────────────────────────────

export function useBookmarks(): UseBookmarksReturn {
  const { user } = useAuth()

  // We must call BOTH hooks unconditionally (React rules of hooks)
  // but only use the result from the active mode.
  const authedResult = useAuthenticatedBookmarks()
  const guestResult = useGuestBookmarks()

  // When authenticated, use API-backed mode; otherwise localStorage
  return user ? authedResult : guestResult
}
