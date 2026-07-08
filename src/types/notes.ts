/**
 * Note-Taking Feature TypeScript Interfaces
 * All types are centralized here to prevent duplication
 * Mirrors the pattern in bookmarks.ts
 */

export type NoteColor = 'slate' | 'blue' | 'green' | 'amber' | 'rose' | 'purple'

export interface Note {
  id: string                   // crypto.randomUUID()
  transcriptId: string         // which transcript this belongs to
  transcriptTitle: string      // snapshot for display
  title: string                // user-provided title (default: "Untitled Note")
  content: string              // note body (markdown for Phase 2)
  selectedText?: string        // optional quoted text from transcript
  paragraphRef?: number        // optional link to a transcript paragraph index
  pinned: boolean              // pin to top of list
  color?: NoteColor            // color theme for the note
  tags?: string[]              // user-defined tags
  isConcept?: boolean          // whether this note is a concept card
  position?: { x: number; y: number } // spatial position on the whiteboard
  createdAt: number            // Date.now()
  updatedAt: number            // Date.now()
}

export interface NotesState {
  version: number              // schema version for migrations
  notes: Note[]
}

export const DEFAULT_NOTES: NotesState = {
  version: 2,
  notes: [],
}

export interface CreateNoteParams {
  transcriptId: string
  transcriptTitle: string
  title?: string
  content: string
  selectedText?: string
  paragraphRef?: number
  color?: NoteColor
  tags?: string[]
  isConcept?: boolean
  position?: { x: number; y: number }
}
