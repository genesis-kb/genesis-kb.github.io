/**
 * Unit Tests — hooks/useBookmarks.ts (Guest Mode only)
 *
 * Tests the localStorage-backed guest bookmark/highlight functionality.
 * We test the guest path since it has pure logic without needing React Query network mocks.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// Mock useAuth to return no user (guest mode)
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    token: null,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    openLoginModal: vi.fn(),
    closeLoginModal: vi.fn(),
    isLoginModalOpen: false,
  }),
}))

// Mock the bookmarks API services (not used in guest mode, but imported)
vi.mock('../../../services/bookmarksApiService', () => ({
  bookmarksApi: {
    getAll: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    delete: vi.fn(),
  },
  highlightsApi: {
    getAll: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    delete: vi.fn(),
    updateNote: vi.fn(),
  },
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock crypto.randomUUID
vi.stubGlobal('crypto', {
  randomUUID: () => 'mock-uuid-' + Math.random().toString(36).slice(2, 8),
})

import { useBookmarks } from '@/hooks/useBookmarks'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useBookmarks (Guest / localStorage mode)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('starts with empty bookmarks and highlights', () => {
    const { result } = renderHook(() => useBookmarks(), { wrapper: createWrapper() })

    expect(result.current.bookmarks).toEqual([])
    expect(result.current.highlights).toEqual([])
    expect(result.current.totalCount).toBe(0)
    expect(result.current.isLoading).toBe(false)
  })

  it('addBookmark adds a bookmark and isBookmarked returns true', () => {
    const { result } = renderHook(() => useBookmarks(), { wrapper: createWrapper() })

    act(() => {
      result.current.addBookmark({
        id: 't1',
        title: 'Test Talk',
        speakers: ['Alice'],
        event_date: '2024-01-01',
        loc: 'NYC',
      })
    })

    expect(result.current.bookmarks).toHaveLength(1)
    expect(result.current.bookmarks[0].id).toBe('t1')
    expect(result.current.bookmarks[0].conference).toBe('NYC')
    expect(result.current.isBookmarked('t1')).toBe(true)
    expect(result.current.isBookmarked('nonexistent')).toBe(false)
  })

  it('addBookmark is idempotent (no duplicates)', () => {
    const { result } = renderHook(() => useBookmarks(), { wrapper: createWrapper() })

    const transcript = { id: 't1', title: 'Talk', speakers: 'Alice', event_date: '2024', loc: 'SF' }

    act(() => {
      result.current.addBookmark(transcript)
    })
    act(() => {
      result.current.addBookmark(transcript) // duplicate
    })

    expect(result.current.bookmarks).toHaveLength(1)
  })

  it('removeBookmark removes by id', () => {
    const { result } = renderHook(() => useBookmarks(), { wrapper: createWrapper() })

    act(() => {
      result.current.addBookmark({ id: 't1', title: 'A', speakers: '', event_date: '', loc: '' })
      result.current.addBookmark({ id: 't2', title: 'B', speakers: '', event_date: '', loc: '' })
    })
    expect(result.current.bookmarks).toHaveLength(2)

    act(() => {
      result.current.removeBookmark('t1')
    })

    expect(result.current.bookmarks).toHaveLength(1)
    expect(result.current.bookmarks[0].id).toBe('t2')
  })

  it('addHighlight requires minimum 10 chars of text', () => {
    const { result } = renderHook(() => useBookmarks(), { wrapper: createWrapper() })

    act(() => {
      result.current.addHighlight('t1', 'Talk', 'short') // < 10 chars
    })
    expect(result.current.highlights).toHaveLength(0)

    act(() => {
      result.current.addHighlight('t1', 'Talk', 'This is a long enough highlight text')
    })
    expect(result.current.highlights).toHaveLength(1)
  })

  it('addHighlight truncates text over 500 chars', () => {
    const { result } = renderHook(() => useBookmarks(), { wrapper: createWrapper() })

    const longText = 'a'.repeat(600)

    act(() => {
      result.current.addHighlight('t1', 'Talk', longText)
    })

    expect(result.current.highlights[0].text.length).toBeLessThanOrEqual(503) // 500 + '...'
    expect(result.current.highlights[0].text.endsWith('...')).toBe(true)
  })

  it('removeHighlight removes by id', () => {
    const { result } = renderHook(() => useBookmarks(), { wrapper: createWrapper() })

    act(() => {
      result.current.addHighlight('t1', 'Talk', 'A highlight that is at least 10 characters')
    })
    const highlightId = result.current.highlights[0].id

    act(() => {
      result.current.removeHighlight(highlightId)
    })

    expect(result.current.highlights).toHaveLength(0)
  })

  it('updateHighlightNote updates the note field', () => {
    const { result } = renderHook(() => useBookmarks(), { wrapper: createWrapper() })

    act(() => {
      result.current.addHighlight('t1', 'Talk', 'A valid highlight text here')
    })
    const highlightId = result.current.highlights[0].id

    act(() => {
      result.current.updateHighlightNote(highlightId, 'My annotation')
    })

    expect(result.current.highlights[0].note).toBe('My annotation')
  })

  it('getHighlightsForTranscript filters by transcriptId', () => {
    const { result } = renderHook(() => useBookmarks(), { wrapper: createWrapper() })

    act(() => {
      result.current.addHighlight('t1', 'Talk 1', 'Highlight for talk one here')
      result.current.addHighlight('t2', 'Talk 2', 'Highlight for talk two here')
      result.current.addHighlight('t1', 'Talk 1', 'Another highlight for talk one')
    })

    const t1Highlights = result.current.getHighlightsForTranscript('t1')
    expect(t1Highlights).toHaveLength(2)

    const t2Highlights = result.current.getHighlightsForTranscript('t2')
    expect(t2Highlights).toHaveLength(1)
  })

  it('totalCount reflects bookmarks + highlights', () => {
    const { result } = renderHook(() => useBookmarks(), { wrapper: createWrapper() })

    act(() => {
      result.current.addBookmark({ id: 't1', title: 'A', speakers: '', event_date: '' })
      result.current.addHighlight('t1', 'A', 'Some highlight text that is long enough')
    })

    expect(result.current.totalCount).toBe(2)
  })

  it('speakers array is joined into a string', () => {
    const { result } = renderHook(() => useBookmarks(), { wrapper: createWrapper() })

    act(() => {
      result.current.addBookmark({
        id: 't1',
        title: 'Talk',
        speakers: ['Alice', 'Bob', 'Charlie'],
        event_date: '2024',
      })
    })

    expect(result.current.bookmarks[0].speakers).toBe('Alice, Bob, Charlie')
  })
})
