/**
 * Unit Tests — migrateLibrary.ts
 *
 * Tests the schema migration logic that upgrades localStorage data
 * from legacy formats to the current v2 schema.
 */

import { describe, it, expect } from 'vitest'
import { migrateLibrary } from '@/lib/migrateLibrary'
import { DEFAULT_LIBRARY } from '@/types/bookmarks'

describe('migrateLibrary', () => {
  // ─── Fresh / Invalid Input ───────────────────────────────────────────────

  it('returns DEFAULT_LIBRARY for null input', () => {
    const result = migrateLibrary(null)
    expect(result).toEqual(DEFAULT_LIBRARY)
  })

  it('returns DEFAULT_LIBRARY for undefined input', () => {
    const result = migrateLibrary(undefined)
    expect(result).toEqual(DEFAULT_LIBRARY)
  })

  it('returns DEFAULT_LIBRARY for a non-object primitive', () => {
    expect(migrateLibrary('string')).toEqual(DEFAULT_LIBRARY)
    expect(migrateLibrary(42)).toEqual(DEFAULT_LIBRARY)
    expect(migrateLibrary(true)).toEqual(DEFAULT_LIBRARY)
  })

  // ─── v1 → v2 Migration ──────────────────────────────────────────────────

  it('migrates v1 data (no version field) to v2, preserving bookmarks', () => {
    const v1Data = {
      bookmarks: [
        { id: 't1', title: 'Talk 1', speakers: 'Alice', event_date: '2024-01-01', conference: 'BTC Conf', savedAt: 1000 },
      ],
    }

    const result = migrateLibrary(v1Data)
    expect(result.version).toBe(2)
    expect(result.bookmarks).toHaveLength(1)
    expect(result.bookmarks[0].id).toBe('t1')
    expect(result.highlights).toEqual([]) // Added by migration
  })

  it('migrates explicit version: 1 to v2', () => {
    const v1Data = {
      version: 1,
      bookmarks: [{ id: 'b1', title: 'B1', speakers: 'X', event_date: '', conference: '', savedAt: 0 }],
    }

    const result = migrateLibrary(v1Data)
    expect(result.version).toBe(2)
    expect(result.highlights).toEqual([])
    expect(result.bookmarks).toHaveLength(1)
  })

  it('handles v1 with missing bookmarks array', () => {
    const result = migrateLibrary({ version: 1 })
    expect(result.version).toBe(2)
    expect(result.bookmarks).toEqual([])
    expect(result.highlights).toEqual([])
  })

  // ─── v2 Pass-Through ────────────────────────────────────────────────────

  it('returns v2 data as-is when shape is valid', () => {
    const v2Data = {
      version: 2,
      bookmarks: [
        { id: 'b1', title: 'Talk', speakers: 'Alice', event_date: '2024-01-01', conference: 'Conf', savedAt: 123 },
      ],
      highlights: [
        { id: 'h1', transcriptId: 'b1', transcriptTitle: 'Talk', text: 'sample text', savedAt: 456 },
      ],
    }

    const result = migrateLibrary(v2Data)
    expect(result).toBe(v2Data) // same reference, no copy
  })

  // ─── Unknown Future Versions ─────────────────────────────────────────────

  it('resets to DEFAULT_LIBRARY for unknown future version', () => {
    const futureData = {
      version: 99,
      bookmarks: [],
      highlights: [],
      someFutureField: true,
    }

    const result = migrateLibrary(futureData)
    expect(result).toEqual(DEFAULT_LIBRARY)
  })

  it('resets when version is 2 but shape is invalid (bookmarks not array)', () => {
    const badShape = {
      version: 2,
      bookmarks: 'not-an-array',
      highlights: [],
    }

    const result = migrateLibrary(badShape)
    expect(result).toEqual(DEFAULT_LIBRARY)
  })
})
