/**
 * React Query keys for data that belongs to the signed-in user.
 *
 * Kept in one place so AuthContext can drop every user's cached data when
 * the signed-in user changes — otherwise the next person on the same tab
 * could see it until it went stale.
 */

import type { QueryClient } from '@tanstack/react-query'

export const NOTES_QUERY_KEY = ['notes'] as const
export const BOOKMARKS_KEY = ['bookmarks'] as const
export const HIGHLIGHTS_KEY = ['highlights'] as const

export const CHAT_HISTORY_ROOT = ['chatHistory'] as const
/** Saved AI chat of one user with one transcript. */
export const chatHistoryKey = (userId: string, transcriptId: string) =>
  [...CHAT_HISTORY_ROOT, userId, transcriptId] as const

/** Prefixes of every user-scoped query. */
export const USER_SCOPED_QUERY_KEYS = [
  CHAT_HISTORY_ROOT,
  NOTES_QUERY_KEY,
  BOOKMARKS_KEY,
  HIGHLIGHTS_KEY,
] as const

/**
 * Remove all cached user-scoped data (and cancel any fetch in flight for it).
 * Call whenever the signed-in user changes.
 */
export function removeUserScopedQueries(queryClient: QueryClient): void {
  for (const queryKey of USER_SCOPED_QUERY_KEYS) {
    void queryClient.cancelQueries({ queryKey })
    queryClient.removeQueries({ queryKey })
  }
}
