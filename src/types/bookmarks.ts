/**
 * Bookmark & Highlights Feature TypeScript Interfaces
 * All types are centralized here to prevent duplication
 */

export interface Bookmark {
  id: string // transcript UUID
  title: string // snapshot at save time
  speakers: string // snapshot at save time
  event_date: string // snapshot at save time
  conference: string // snapshot at save time
  savedAt: number // Date.now()
  deleted?: boolean // true if not found in React Query cache
}

export interface Highlight {
  id: string // crypto.randomUUID()
  transcriptId: string // which transcript
  transcriptTitle: string // snapshot for display in /library
  text: string // selected passage, max 500 chars
  note?: string // optional user annotation
  color?: string // highlight color
  isUnderline?: boolean // if true, render as underline
  savedAt: number // Date.now()
  deleted?: boolean // true if source transcript not in cache
}

export interface LibraryState {
  version: number // schema version number for migrations
  bookmarks: Bookmark[]
  highlights: Highlight[]
}

export const DEFAULT_LIBRARY: LibraryState = {
  version: 2,
  bookmarks: [],
  highlights: [],
}
