/**
 * TranscriptNotes - Main notes panel rendered in the "Notes" tab
 * Handles note list display, creation, editing, and empty state
 * Uses useNotes hook for all business logic
 */

import { useState, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { StickyNote, Plus, Highlighter, Sparkles, Pencil, Trash2 } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useNotes } from '@/hooks/useNotes'
import { useBookmarks } from '@/hooks/useBookmarks'
import { NoteCard } from './NoteCard'
import { NoteEditor } from './NoteEditor'
import { NotesSearchBar } from './NotesSearchBar'
import type { Note, NoteColor } from '@/types/notes'
import { cn } from '@/lib/utils'

interface TranscriptNotesProps {
  transcriptId: string
  transcriptTitle: string
  /** Pre-filled selected text from the HighlightToolbar "Add Note" action */
  pendingSelectedText?: string
  /** Called after consuming the pending text so the parent can clear it */
  onPendingTextConsumed?: () => void
}

export function TranscriptNotes({
  transcriptId,
  transcriptTitle,
  pendingSelectedText,
  onPendingTextConsumed,
}: TranscriptNotesProps) {
  const {
    getNotesForTranscript,
    addNote,
    updateNote,
    deleteNote,
    togglePin,
  } = useNotes()

  const { getHighlightsForTranscript, removeHighlight, updateHighlightNote } = useBookmarks()

  const [activeTab, setActiveTab] = useState<'notes' | 'highlights' | 'concepts'>('notes')

  const [isCreating, setIsCreating] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  
  const [editingHighlightId, setEditingHighlightId] = useState<string | null>(null)
  const [editNoteValue, setEditNoteValue] = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [colorFilter, setColorFilter] = useState<NoteColor | 'all'>('all')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'az'>('newest')

  const rawNotes = getNotesForTranscript(transcriptId)
  const rawHighlights = getHighlightsForTranscript(transcriptId)
  
  const standardNotes = rawNotes.filter(n => !n.isConcept)
  const conceptNotes = rawNotes.filter(n => n.isConcept)

  // Auto-open editor when pendingSelectedText arrives
  const [consumedText, setConsumedText] = useState<string | undefined>(undefined)
  if (pendingSelectedText && pendingSelectedText !== consumedText) {
    setConsumedText(pendingSelectedText)
    setActiveTab('notes')
    setIsCreating(true)
    setEditingNote(null)
    onPendingTextConsumed?.()
  }

  const handleCreate = useCallback(
    (data: { title: string; content: string; selectedText?: string; color: NoteColor; tags: string[] }) => {
      addNote({
        transcriptId,
        transcriptTitle,
        title: data.title,
        content: data.content,
        selectedText: data.selectedText,
        color: data.color,
        tags: data.tags,
        isConcept: activeTab === 'concepts',
      })
      setIsCreating(false)
      setConsumedText(undefined)
    },
    [addNote, transcriptId, transcriptTitle, activeTab]
  )

  const handleUpdate = useCallback(
    (data: { title: string; content: string; color: NoteColor; tags: string[] }) => {
      if (!editingNote) return
      updateNote(editingNote.id, {
        title: data.title,
        content: data.content,
        color: data.color,
        tags: data.tags,
      })
      setEditingNote(null)
    },
    [editingNote, updateNote]
  )

  const handleEdit = useCallback((note: Note) => {
    setEditingNote(note)
    setIsCreating(false)
  }, [])

  const handleCancelCreate = useCallback(() => {
    setIsCreating(false)
    setConsumedText(undefined)
  }, [])

  const handleCancelEdit = useCallback(() => {
    setEditingNote(null)
  }, [])

  // Derived state: filtered and sorted notes
  const activeNotesList = activeTab === 'concepts' ? conceptNotes : standardNotes
  const notes = activeNotesList.filter(note => {
    // 1. Search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const matchesTitle = note.title.toLowerCase().includes(q)
      const matchesContent = note.content.toLowerCase().includes(q)
      const matchesTags = note.tags?.some(t => t.toLowerCase().includes(q))
      if (!matchesTitle && !matchesContent && !matchesTags) return false
    }
    // 2. Color filter
    if (colorFilter !== 'all' && (note.color || 'slate') !== colorFilter) {
      return false
    }
    return true
  }).sort((a, b) => {
    // Pinned notes always first
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    
    // Sort logic
    if (sortBy === 'newest') return b.updatedAt - a.updatedAt
    if (sortBy === 'oldest') return a.updatedAt - b.updatedAt
    if (sortBy === 'az') return a.title.localeCompare(b.title)
    
    return 0
  })

  return (
    <div className="flex flex-col h-full rounded-xl border border-border bg-card overflow-hidden">
      {/* Header Tabs */}
      <div className="flex items-center px-2 pt-2 border-b border-border bg-secondary/30 shrink-0">
        <div className="flex space-x-1">
          <button
            onClick={() => setActiveTab('notes')}
            className={cn("px-4 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-2", activeTab === 'notes' ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-t-lg")}
          >
            <StickyNote className="w-3.5 h-3.5" />
            Notes
            {standardNotes.length > 0 && <span className="ml-1 bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded-full text-[10px]">{standardNotes.length}</span>}
          </button>
          <button
            onClick={() => setActiveTab('highlights')}
            className={cn("px-4 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-2", activeTab === 'highlights' ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-t-lg")}
          >
            <Highlighter className="w-3.5 h-3.5" />
            Highlights
            {rawHighlights.length > 0 && <span className="ml-1 bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded-full text-[10px]">{rawHighlights.length}</span>}
          </button>
          <button
            onClick={() => setActiveTab('concepts')}
            className={cn("px-4 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-2", activeTab === 'concepts' ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-t-lg")}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Concepts
            {conceptNotes.length > 0 && <span className="ml-1 bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded-full text-[10px]">{conceptNotes.length}</span>}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-foreground flex items-center gap-2">
             {activeTab === 'notes' && <><StickyNote className="w-4 h-4 text-primary" /> Your Notes</>}
             {activeTab === 'highlights' && <><Highlighter className="w-4 h-4 text-primary" /> Your Highlights</>}
             {activeTab === 'concepts' && <><Sparkles className="w-4 h-4 text-amber-500" /> Extracted Concepts</>}
          </span>
        </div>
        {(activeTab === 'notes' || activeTab === 'concepts') && !isCreating && !editingNote && (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New {activeTab === 'concepts' ? 'Concept' : 'Note'}
          </button>
        )}
      </div>

      {(activeTab === 'notes' || activeTab === 'concepts') && activeNotesList.length > 0 && (
        <NotesSearchBar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          colorFilter={colorFilter}
          setColorFilter={setColorFilter}
          sortBy={sortBy}
          setSortBy={setSortBy}
        />
      )}

      {/* Content */}
      <ScrollArea className="flex-1">
        {activeTab === 'highlights' ? (
           <div className="p-4 space-y-3">
              {rawHighlights.length === 0 ? (
                 <div className="text-center py-12 space-y-3">
                   <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-secondary">
                     <Highlighter className="w-6 h-6 text-muted-foreground" />
                   </div>
                   <div className="space-y-1">
                     <p className="text-sm font-medium text-foreground">No highlights yet</p>
                     <p className="text-xs text-muted-foreground">Select text in the transcript to add a highlight.</p>
                   </div>
                 </div>
              ) : (
                rawHighlights.map(highlight => (
                  <div key={highlight.id} className="relative group p-4 rounded-xl border border-border/50 bg-card hover:border-border transition-colors">
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      <button onClick={() => {
                        setEditingHighlightId(highlight.id);
                        setEditNoteValue(highlight.note || '');
                      }} className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors" title="Edit Note">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => removeHighlight(highlight.id)} className="p-1.5 text-muted-foreground hover:text-destructive rounded-md hover:bg-destructive/10 transition-colors" title="Delete Highlight">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    
                    <div className="pr-12 space-y-3">
                      <div className="pl-3 border-l-2 border-primary/50 py-1">
                        <p className="text-sm text-foreground leading-relaxed">
                          "{highlight.text}"
                        </p>
                      </div>

                      {editingHighlightId === highlight.id ? (
                        <div className="mt-3 space-y-2">
                          <textarea
                            autoFocus
                            value={editNoteValue}
                            onChange={(e) => setEditNoteValue(e.target.value)}
                            placeholder="Add a note to this highlight..."
                            className="w-full min-h-[80px] p-2 text-sm bg-background border border-border rounded-md resize-y focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setEditingHighlightId(null)} className="px-3 py-1.5 text-xs font-medium hover:bg-secondary rounded-md transition-colors">
                              Cancel
                            </button>
                            <button onClick={() => {
                              updateHighlightNote(highlight.id, editNoteValue);
                              setEditingHighlightId(null);
                            }} className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors">
                              Save
                            </button>
                          </div>
                        </div>
                      ) : highlight.note && (
                        <div className="mt-2 text-sm text-muted-foreground bg-secondary/30 p-2.5 rounded-lg flex gap-2">
                          <Pencil className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary/70" />
                          <p>{highlight.note}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
           </div>
        ) : (
          <div className="p-4 space-y-3">
            {/* Create editor */}
            <AnimatePresence>
              {isCreating && (
                <NoteEditor
                  selectedText={consumedText}
                  onSave={handleCreate}
                  onCancel={handleCancelCreate}
                />
              )}
            </AnimatePresence>

            {/* Edit editor */}
            <AnimatePresence>
              {editingNote && (
                <NoteEditor
                  editingNote={editingNote}
                  onSave={handleUpdate}
                  onCancel={handleCancelEdit}
                />
              )}
            </AnimatePresence>

            {/* Note cards */}
            <AnimatePresence mode="popLayout">
              {notes.map((note) =>
                // Don't show card for the note currently being edited
                editingNote?.id === note.id ? null : (
                  <NoteCard
                    key={note.id}
                    note={note}
                    onEdit={handleEdit}
                    onDelete={deleteNote}
                    onTogglePin={togglePin}
                  />
                )
              )}
            </AnimatePresence>

            {/* Empty state */}
            {activeNotesList.length === 0 && !isCreating && (
              <div className="text-center py-12 space-y-3">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-secondary">
                  {activeTab === 'concepts' ? (
                    <Sparkles className="w-6 h-6 text-muted-foreground" />
                  ) : (
                    <StickyNote className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {activeTab === 'concepts' ? 'No concepts yet' : 'No notes yet'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {activeTab === 'concepts' 
                      ? 'Extract concepts from the transcript to build your knowledge graph.' 
                      : 'Create a note to capture your thoughts while reading this transcript.'}
                  </p>
                </div>
                <button
                  onClick={() => setIsCreating(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create your first {activeTab === 'concepts' ? 'concept' : 'note'}
                </button>
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
