/**
 * Storage abstraction layer for Notes
 * Supports localStorage and in-memory fallback
 * Mirrors the pattern in bookmarkStore.ts
 */

import { NotesState, DEFAULT_NOTES } from '@/types/notes'
import { migrateNotes } from './migrateNotes'
import { toast } from 'sonner'

export const NOTES_STORAGE_KEY = 'btc-notes'

/**
 * Storage interface - all implementations must follow this contract
 */
export interface NoteStore {
  load(): NotesState
  save(state: NotesState): NotesState
}

/**
 * Check if localStorage is available and working
 */
function isLocalStorageAvailable(): boolean {
  try {
    const key = '__btc_notes_test__'
    localStorage.setItem(key, '1')
    localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

/**
 * LocalNoteStore - persists to browser localStorage
 * Handles quota exceeded by pruning oldest 20% of unpinned notes
 */
class LocalNoteStore implements NoteStore {
  load(): NotesState {
    try {
      const raw = localStorage.getItem(NOTES_STORAGE_KEY)
      if (!raw) return { ...DEFAULT_NOTES }

      const parsed = JSON.parse(raw)
      return migrateNotes(parsed)
    } catch {
      // Corrupted JSON in localStorage - wipe and start fresh
      try {
        localStorage.removeItem(NOTES_STORAGE_KEY)
      } catch {
        // ignore removal errors
      }
      return { ...DEFAULT_NOTES }
    }
  }

  save(state: NotesState): NotesState {
    try {
      localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(state))
      return state
    } catch (error) {
      // Check if this is a quota exceeded error
      if (
        error instanceof DOMException &&
        (error.code === 22 ||
          error.code === 1014 ||
          error.name === 'QuotaExceededError' ||
          error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
      ) {
        // Prune oldest 20% of unpinned notes sorted by updatedAt ascending
        const unpinnedNotes = state.notes
          .filter((n) => !n.pinned)
          .sort((a, b) => a.updatedAt - b.updatedAt)

        const notesToPrune = Math.ceil(unpinnedNotes.length * 0.2)
        if (notesToPrune > 0) {
          const pruneIds = new Set(
            unpinnedNotes.slice(0, notesToPrune).map((n) => n.id)
          )
          const prunedNotes = state.notes.filter((n) => !pruneIds.has(n.id))

          const updatedState = {
            ...state,
            notes: prunedNotes,
          }

          // Retry once
          try {
            localStorage.setItem(
              NOTES_STORAGE_KEY,
              JSON.stringify(updatedState)
            )
            return updatedState
          } catch {
            toast.warning('Storage full — some old notes were removed')
            return updatedState
          }
        }

        toast.warning('Storage full — some old notes were removed')
        return state
      }

      // Other errors - log but don't crash
      console.error('Failed to save notes:', error)
      return state
    }
  }
}

/**
 * InMemoryNoteStore - stores data only in RAM, loses on page refresh
 * Used as fallback when localStorage is unavailable (private/incognito mode)
 */
class InMemoryNoteStore implements NoteStore {
  private state: NotesState = { ...DEFAULT_NOTES }

  load(): NotesState {
    return this.state
  }

  save(state: NotesState): NotesState {
    this.state = state
    return this.state
  }
}

const hasPersistentStorage = isLocalStorageAvailable()

/**
 * Active store instance - chosen at runtime based on localStorage availability
 * Components import and use this singleton, never the classes directly
 */
export const noteStore: NoteStore = hasPersistentStorage
  ? new LocalNoteStore()
  : new InMemoryNoteStore()

export const isNoteStorePersistent = hasPersistentStorage
