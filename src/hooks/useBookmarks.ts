/**
 * Core hook for Bookmark & Highlights management
 * All business logic lives here - components are pure rendering layers
 * Handles persistence, cross-tab sync, and all mutations
 */

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  bookmarkStore,
  STORAGE_KEY,
  isBookmarkStorePersistent,
} from '@/lib/bookmarkStore'
import { migrateLibrary } from '@/lib/migrateLibrary'
import {
  Bookmark,
  Highlight,
  LibraryState,
} from '@/types/bookmarks'

const LIBRARY_SYNC_EVENT = 'btc-library-sync'
const PRIVATE_MODE_NOTICE_KEY = 'btc-library-private-mode-notice-shown'

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
}

export function useBookmarks(): UseBookmarksReturn {
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
  }
}
