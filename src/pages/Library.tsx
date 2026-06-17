/**
 * Library Page - shows saved bookmarks and highlights
 * Handles all states: empty, loading, deleted items, normal display
 * Implements tab switching and inline note editing
 */

import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useBookmarks } from '@/hooks/useBookmarks'
import { useNotes } from '@/hooks/useNotes'
import { useBookmarkReconciliation } from '@/hooks/useBookmarkReconciliation'
import { NoteCard } from '@/components/notes/NoteCard'
import {
  AlertCircle,
  Trash2,
  Edit2,
  Check,
  X,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Format relative time like "5 days ago"
 */
function formatRelativeTime(savedAt: number): string {
  const now = Date.now()
  const elapsed = now - savedAt
  const seconds = Math.floor(elapsed / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  return 'just now'
}

type TabType = 'bookmarks' | 'highlights' | 'notes'

export default function Library() {
  const {
    bookmarks,
    highlights,
    removeBookmark,
    removeHighlight,
    updateHighlightNote,
    totalCount,
    showPrivateModeNotice,
  } = useBookmarks()

  const {
    reconciledBookmarks,
    reconciledHighlights,
    isLoading,
    deletedBookmarkCount,
  } = useBookmarkReconciliation(bookmarks, highlights)

  const { notes, deleteNote, togglePin } = useNotes()

  const [activeTab, setActiveTab] = useState<TabType>('bookmarks')
  const [editingHighlightId, setEditingHighlightId] = useState<string | null>(
    null
  )
  const [editNoteValue, setEditNoteValue] = useState('')

  const sortedNotes = useMemo(
    () => [...notes].sort((a, b) => b.updatedAt - a.updatedAt),
    [notes]
  )

  // Sort bookmarks by savedAt descending
  const sortedBookmarks = useMemo(
    () => [...reconciledBookmarks].sort((a, b) => b.savedAt - a.savedAt),
    [reconciledBookmarks]
  )

  // Sort highlights by savedAt descending
  const sortedHighlights = useMemo(
    () => [...reconciledHighlights].sort((a, b) => b.savedAt - a.savedAt),
    [reconciledHighlights]
  )

  // State: empty library
  if (totalCount === 0 && notes.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center space-y-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-secondary">
            <AlertCircle className="w-8 h-8 text-muted-foreground" />
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-bold font-display">
              Your library is empty
            </h1>
            <p className="text-muted-foreground text-lg">
              Bookmark any transcript to start building your reading list.
            </p>
          </div>

          <Link
            to="/conferences"
            className={cn(
              'inline-flex items-center gap-2 px-6 py-3 rounded-lg',
              'bg-primary text-primary-foreground font-medium',
              'hover:bg-primary/90 transition-colors'
            )}
          >
            Explore Conferences
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold font-display mb-2">My Library</h1>
          <p className="text-muted-foreground">
            Your personal collection of saved transcripts and highlights
          </p>
        </div>

        {/* Cache loading indicator */}
        {isLoading && totalCount > 0 && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100 text-sm">
            <div className="animate-spin">
              <div className="w-4 h-4 border-2 border-blue-900 dark:border-blue-100 border-t-transparent rounded-full" />
            </div>
            <span>Verifying…</span>
          </div>
        )}

        {showPrivateModeNotice && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Bookmarks won't persist in private mode.</span>
          </div>
        )}

        {/* Deleted items warning */}
        {deletedBookmarkCount > 0 && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              {deletedBookmarkCount} bookmarked transcript
              {deletedBookmarkCount > 1 ? 's' : ''} were removed from the site.
            </span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 border-b border-border">
          <button
            onClick={() => setActiveTab('bookmarks')}
            className={cn(
              'px-4 py-2 font-medium text-sm transition-colors',
              'border-b-2 -mb-[2px]',
              activeTab === 'bookmarks'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            Saved ({sortedBookmarks.length})
          </button>
          <button
            onClick={() => setActiveTab('highlights')}
            className={cn(
              'px-4 py-2 font-medium text-sm transition-colors',
              'border-b-2 -mb-[2px]',
              activeTab === 'highlights'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            Highlights ({sortedHighlights.length})
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={cn(
              'px-4 py-2 font-medium text-sm transition-colors',
              'border-b-2 -mb-[2px]',
              activeTab === 'notes'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            Notes ({sortedNotes.length})
          </button>
        </div>

        {/* Bookmarks Tab */}
        {activeTab === 'bookmarks' && (
          <div className="space-y-4">
            {sortedBookmarks.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No saved transcripts yet
              </p>
            ) : (
              sortedBookmarks.map((bookmark) => (
                <div
                  key={bookmark.id}
                  className={cn(
                    'p-4 rounded-lg border transition-all',
                    bookmark.deleted
                      ? 'bg-muted/30 border-muted-foreground/20 opacity-60'
                      : 'bg-card border-border hover:border-primary/30'
                  )}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {bookmark.deleted ? (
                          <h3 className="font-semibold line-through text-foreground">
                            {bookmark.title}
                          </h3>
                        ) : (
                          <Link
                            to={`/transcript/${bookmark.id}`}
                            className="font-semibold text-foreground hover:text-primary transition-colors"
                          >
                            {bookmark.title}
                          </Link>
                        )}

                        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <span>{bookmark.speakers}</span>
                          <span>•</span>
                          <span>{bookmark.event_date}</span>
                          <span>•</span>
                          <span>{bookmark.conference}</span>
                        </div>
                      </div>

                      {bookmark.deleted ? (
                        <button
                          onClick={() => removeBookmark(bookmark.id)}
                          className="px-3 py-1.5 rounded-md text-xs font-medium border border-border hover:bg-secondary transition-colors shrink-0"
                          aria-label="Dismiss"
                        >
                          Dismiss
                        </button>
                      ) : (
                        <button
                          onClick={() => removeBookmark(bookmark.id)}
                          className="p-2 hover:bg-secondary rounded transition-colors shrink-0"
                          aria-label="Remove bookmark"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Saved {formatRelativeTime(bookmark.savedAt)}</span>
                      {bookmark.deleted && (
                        <span className="px-2 py-1 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100">
                          Removed from site
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Highlights Tab */}
        {activeTab === 'highlights' && (
          <div className="space-y-4">
            {sortedHighlights.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No highlights saved yet
              </p>
            ) : (
              sortedHighlights.map((highlight) => (
                <div
                  key={highlight.id}
                  className={cn(
                    'p-4 rounded-lg border transition-all',
                    highlight.deleted
                      ? 'bg-muted/30 border-muted-foreground/20'
                      : 'bg-card border-border'
                  )}
                >
                  <div className="space-y-3">
                    <blockquote className="border-l-2 border-primary/50 pl-3 italic text-foreground/80">
                      "{highlight.text}"
                    </blockquote>

                    {/* Note section */}
                    {editingHighlightId === highlight.id ? (
                      <div className="space-y-2 bg-muted/30 p-3 rounded">
                        <textarea
                          value={editNoteValue}
                          onChange={(e) =>
                            setEditNoteValue(e.target.value)
                          }
                          placeholder="Add a note..."
                          className={cn(
                            'w-full px-2 py-1.5 rounded border border-border',
                            'bg-background text-foreground text-sm',
                            'resize-none focus:outline-none focus:ring-2 focus:ring-primary',
                            'font-mono'
                          )}
                          rows={3}
                          spellCheck={true}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              updateHighlightNote(
                                highlight.id,
                                editNoteValue
                              )
                              setEditingHighlightId(null)
                            }}
                            className={cn(
                              'flex items-center gap-1 px-3 py-1 rounded text-sm',
                              'bg-primary text-primary-foreground hover:bg-primary/90',
                              'transition-colors'
                            )}
                          >
                            <Check className="w-4 h-4" />
                            Save
                          </button>
                          <button
                            onClick={() =>
                              setEditingHighlightId(null)
                            }
                            className={cn(
                              'flex items-center gap-1 px-3 py-1 rounded text-sm',
                              'border border-border hover:bg-secondary',
                              'transition-colors'
                            )}
                          >
                            <X className="w-4 h-4" />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      highlight.note && (
                        <div className="bg-muted/30 p-3 rounded space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm text-foreground/90">
                              {highlight.note}
                            </p>
                            <button
                              onClick={() => {
                                setEditingHighlightId(highlight.id)
                                setEditNoteValue(highlight.note || '')
                              }}
                              className="p-1 hover:bg-secondary rounded transition-colors shrink-0"
                              aria-label="Edit note"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )
                    )}

                    {/* Source transcript */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span>From:</span>
                        {highlight.deleted ? (
                          <span className="font-medium">
                            {highlight.transcriptTitle}
                          </span>
                        ) : (
                          <Link
                            to={`/transcript/${highlight.transcriptId}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {highlight.transcriptTitle}
                          </Link>
                        )}
                        {highlight.deleted && (
                          <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100">
                            Source removed
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => removeHighlight(highlight.id)}
                        className="p-1 hover:bg-secondary rounded transition-colors"
                        aria-label="Remove highlight"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      Saved {formatRelativeTime(highlight.savedAt)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Notes Tab */}
        {activeTab === 'notes' && (
          <div className="space-y-6">
            {sortedNotes.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No notes yet
              </p>
            ) : (
              sortedNotes.map((note) => (
                <div key={note.id} className="relative">
                  <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground px-1">
                    <span>From:</span>
                    <Link
                      to={`/transcript/${note.transcriptId}?tab=notes`}
                      className="font-medium text-primary hover:underline"
                    >
                      {note.transcriptTitle}
                    </Link>
                  </div>
                  <NoteCard
                    note={note}
                    onEdit={() => window.location.href = `/transcript/${note.transcriptId}?tab=notes`}
                    onDelete={deleteNote}
                    onTogglePin={togglePin}
                  />
                </div>
              ))
            )}
          </div>
        )}

        {/* Info note at bottom */}
        <div className="mt-12 pt-6 border-t border-border text-xs text-muted-foreground text-center">
          <p>
            Bookmarks and highlights are saved in this browser only. They will
            be lost if you clear your browser data.
          </p>
        </div>
      </div>
    </div>
  )
}
