/**
 * NoteCard - Individual note display card
 * Displays note content with actions for edit, pin, and delete
 * Uses framer-motion for layout animations on pin/unpin reorder
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Pin, Edit2, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import type { Note, NoteColor } from '@/types/notes'
import { MarkdownRenderer } from '../MarkdownRenderer'
import { Hash } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface NoteCardProps {
  note: Note
  onEdit: (note: Note) => void
  onDelete: (id: string) => void
  onTogglePin: (id: string) => void
}

const colorBorderMap: Record<NoteColor, string> = {
  slate: 'border-l-slate-500',
  blue: 'border-l-blue-500',
  green: 'border-l-green-500',
  amber: 'border-l-amber-500',
  rose: 'border-l-rose-500',
  purple: 'border-l-purple-500',
}

const colorBgMap: Record<NoteColor, string> = {
  slate: 'bg-slate-500/5',
  blue: 'bg-blue-500/5',
  green: 'bg-green-500/5',
  amber: 'bg-amber-500/5',
  rose: 'bg-rose-500/5',
  purple: 'bg-purple-500/5',
}

export function NoteCard({ note, onEdit, onDelete, onTogglePin }: NoteCardProps) {
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  const relativeTime = formatDistanceToNow(note.updatedAt, { addSuffix: true })
  const color = note.color || 'slate'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
      transition={{ duration: 0.2 }}
      className={cn(
        'group p-4 rounded-lg border transition-colors border-l-4',
        colorBorderMap[color],
        note.pinned
          ? cn('border-y-primary/30 border-r-primary/30', colorBgMap[color])
          : cn('border-y-border border-r-border bg-card hover:border-y-primary/20 hover:border-r-primary/20')
      )}
    >
      <div className="space-y-2">
        {/* Header: title + actions */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {note.pinned && (
              <Pin className="w-3.5 h-3.5 text-primary shrink-0 fill-primary" />
            )}
            <h4 className="font-medium text-sm text-foreground truncate">
              {note.title}
            </h4>
          </div>

          {/* Action buttons — visible on hover or always on mobile */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity sm:opacity-0">
            <button
              onClick={() => onEdit(note)}
              className="p-1.5 rounded hover:bg-secondary transition-colors"
              aria-label="Edit note"
              title="Edit"
            >
              <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <button
              onClick={() => onTogglePin(note.id)}
              className="p-1.5 rounded hover:bg-secondary transition-colors"
              aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
              title={note.pinned ? 'Unpin' : 'Pin'}
            >
              <Pin
                className={cn(
                  'w-3.5 h-3.5',
                  note.pinned
                    ? 'text-primary fill-primary'
                    : 'text-muted-foreground'
                )}
              />
            </button>
            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
              <AlertDialogTrigger asChild>
                <button
                  className="p-1.5 rounded hover:bg-destructive/10 transition-colors"
                  aria-label="Delete note"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete note?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete "{note.title}". This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(note.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Selected text quote */}
        {note.selectedText && (
          <blockquote className="border-l-2 border-primary/40 pl-3 text-xs italic text-muted-foreground line-clamp-2">
            "{note.selectedText}"
          </blockquote>
        )}

        {/* Content preview */}
        {note.content && (
          <div className="text-sm text-foreground/80 line-clamp-4 prose prose-sm dark:prose-invert max-w-none [&>*:last-child]:mb-0 [&>*:first-child]:mt-0">
            <MarkdownRenderer content={note.content} />
          </div>
        )}

        {/* Tags */}
        {note.tags && note.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <Hash className="w-3 h-3 text-muted-foreground opacity-70" />
            {note.tags.map(tag => (
              <span key={tag} className="px-1.5 py-0.5 rounded-sm bg-secondary text-secondary-foreground text-[10px] font-medium opacity-80">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer: timestamp */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-mono">
            {relativeTime}
          </span>
          {note.createdAt !== note.updatedAt && (
            <span className="text-xs text-muted-foreground/60 font-mono">
              edited
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}
