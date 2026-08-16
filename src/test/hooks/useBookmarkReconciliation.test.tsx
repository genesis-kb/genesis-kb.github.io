/**
 * Unit Tests — hooks/useBookmarkReconciliation.ts
 *
 * Tests the reconciliation hook that cross-references bookmarks/highlights
 * against the React Query transcript cache to flag deleted items
 * and refresh stale snapshot fields.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import type { Bookmark, Highlight } from '@/types/bookmarks'
import { useBookmarkReconciliation } from '@/hooks/useBookmarkReconciliation'

function createWrapper(initialTranscripts?: Array<{ id: string; title: string; speakers: string | string[]; event_date: string }>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  // Pre-seed the transcripts cache if provided
  if (initialTranscripts) {
    queryClient.setQueryData(['transcripts'], initialTranscripts)
  }
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useBookmarkReconciliation', () => {
  const baseBookmarks: Bookmark[] = [
    { id: 't1', title: 'Old Title', speakers: 'Old Speaker', event_date: '2023', conference: 'Conf', savedAt: 1 },
    { id: 't2', title: 'Talk 2', speakers: 'Bob', event_date: '2024', conference: 'Conf 2', savedAt: 2 },
  ]

  const baseHighlights: Highlight[] = [
    { id: 'h1', transcriptId: 't1', transcriptTitle: 'Old Title', text: 'some text', savedAt: 1 },
    { id: 'h2', transcriptId: 't3', transcriptTitle: 'Deleted Talk', text: 'orphan text', savedAt: 2 },
  ]

  it('returns bookmarks as-is when transcript cache is not loaded', async () => {
    // Don't pre-seed cache
    const { result } = renderHook(
      () => useBookmarkReconciliation(baseBookmarks, baseHighlights),
      { wrapper: createWrapper() } // no initial transcripts
    )

    await waitFor(() => {
      expect(result.current.reconciledBookmarks).toEqual(baseBookmarks)
      expect(result.current.reconciledHighlights).toEqual(baseHighlights)
    })
  })

  it('flags bookmarks as deleted when transcript is missing from cache', async () => {
    const liveTranscripts = [
      { id: 't1', title: 'Updated Title', speakers: 'New Speaker', event_date: '2024' },
      // t2 is missing from live data → should be flagged as deleted
    ]

    const { result } = renderHook(
      () => useBookmarkReconciliation(baseBookmarks, baseHighlights),
      { wrapper: createWrapper(liveTranscripts) }
    )

    await waitFor(() => {
      const t1 = result.current.reconciledBookmarks.find(b => b.id === 't1')
      const t2 = result.current.reconciledBookmarks.find(b => b.id === 't2')

      expect(t1?.deleted).toBe(false)
      expect(t2?.deleted).toBe(true)
    })
  })

  it('refreshes stale snapshot fields from live cache', async () => {
    const liveTranscripts = [
      { id: 't1', title: 'Updated Title', speakers: ['New Speaker A', 'New Speaker B'], event_date: '2024-06' },
      { id: 't2', title: 'Talk 2 Updated', speakers: 'Bob Updated', event_date: '2024-07' },
    ]

    const { result } = renderHook(
      () => useBookmarkReconciliation(baseBookmarks, baseHighlights),
      { wrapper: createWrapper(liveTranscripts) }
    )

    await waitFor(() => {
      const t1 = result.current.reconciledBookmarks.find(b => b.id === 't1')

      // Title should be refreshed from live data
      expect(t1?.title).toBe('Updated Title')
      // Array speakers should be joined
      expect(t1?.speakers).toBe('New Speaker A, New Speaker B')
      // Event date should be refreshed
      expect(t1?.event_date).toBe('2024-06')
    })
  })

  it('flags highlights as deleted when source transcript is missing', async () => {
    const liveTranscripts = [
      { id: 't1', title: 'Talk 1', speakers: 'Alice', event_date: '2024' },
      // t3 is NOT in live data
    ]

    const { result } = renderHook(
      () => useBookmarkReconciliation(baseBookmarks, baseHighlights),
      { wrapper: createWrapper(liveTranscripts) }
    )

    await waitFor(() => {
      const h1 = result.current.reconciledHighlights.find(h => h.id === 'h1')
      const h2 = result.current.reconciledHighlights.find(h => h.id === 'h2')

      expect(h1?.deleted).toBe(false) // t1 exists
      expect(h2?.deleted).toBe(true)  // t3 doesn't exist
    })
  })

  it('counts deleted bookmarks correctly', async () => {
    const liveTranscripts = [
      { id: 't1', title: 'Talk 1', speakers: 'A', event_date: '2024' },
      // t2 missing
    ]

    const { result } = renderHook(
      () => useBookmarkReconciliation(baseBookmarks, baseHighlights),
      { wrapper: createWrapper(liveTranscripts) }
    )

    await waitFor(() => {
      expect(result.current.deletedBookmarkCount).toBe(1)
    })
  })

  it('returns zero deleted count when all transcripts are live', async () => {
    const liveTranscripts = [
      { id: 't1', title: 'T1', speakers: 'A', event_date: '2024' },
      { id: 't2', title: 'T2', speakers: 'B', event_date: '2024' },
      { id: 't3', title: 'T3', speakers: 'C', event_date: '2024' },
    ]

    const { result } = renderHook(
      () => useBookmarkReconciliation(baseBookmarks, baseHighlights),
      { wrapper: createWrapper(liveTranscripts) }
    )

    await waitFor(() => {
      expect(result.current.deletedBookmarkCount).toBe(0)
      expect(result.current.reconciledHighlights.every(h => !h.deleted)).toBe(true)
    })
  })
})
