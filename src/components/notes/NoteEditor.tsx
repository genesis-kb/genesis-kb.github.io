/**
 * NoteEditor - Inline note creation and editing widget
 * Supports both create and edit modes
 * Auto-growing textarea, keyboard shortcuts (Ctrl+Enter to save, Escape to cancel)
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Save, X, Eye, Edit3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Note, NoteColor } from '@/types/notes'
import { NoteTagInput } from './NoteTagInput'
import { MarkdownRenderer } from '../MarkdownRenderer'

interface NoteEditorProps {
  /** If provided, we're in edit mode */
  editingNote?: Note | null
  /** Pre-filled selected text from the transcript */
  selectedText?: string
  /** Called when the user saves */
  onSave: (data: { title: string; content: string; selectedText?: string; color: NoteColor; tags: string[] }) => void
  /** Called when the user cancels */
  onCancel: () => void
}

const COLORS: { id: NoteColor; class: string }[] = [
  { id: 'slate', class: 'bg-slate-500' },
  { id: 'blue', class: 'bg-blue-500' },
  { id: 'green', class: 'bg-green-500' },
  { id: 'amber', class: 'bg-amber-500' },
  { id: 'rose', class: 'bg-rose-500' },
  { id: 'purple', class: 'bg-purple-500' },
]

export function NoteEditor({
  editingNote,
  selectedText,
  onSave,
  onCancel,
}: NoteEditorProps) {
  const [title, setTitle] = useState(editingNote?.title === 'Untitled Note' ? '' : editingNote?.title || '')
  const [content, setContent] = useState(editingNote?.content || '')
  const [color, setColor] = useState<NoteColor>(editingNote?.color || 'slate')
  const [tags, setTags] = useState<string[]>(editingNote?.tags || [])
  const [showPreview, setShowPreview] = useState(false)
  
  const contentRef = useRef<HTMLTextAreaElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  const quoteText = editingNote?.selectedText || selectedText

  // Auto-focus: title input on create, content textarea on edit
  useEffect(() => {
    if (editingNote) {
      contentRef.current?.focus()
    } else {
      titleRef.current?.focus()
    }
  }, [editingNote])

  // Auto-grow textarea
  useEffect(() => {
    const textarea = contentRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.max(textarea.scrollHeight, 80)}px`
  }, [content])

  const handleSave = useCallback(() => {
    if (!content.trim()) return

    onSave({
      title: title.trim() || 'Untitled Note',
      content: content.trim(),
      selectedText: quoteText,
      color,
      tags,
    })
  }, [title, content, quoteText, color, tags, onSave])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        handleSave()
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
    },
    [handleSave, onCancel]
  )

  const isEdit = !!editingNote
  const canSave = content.trim().length > 0

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      <div
        className={cn(
          'p-4 rounded-lg border space-y-3',
          isEdit
            ? 'border-primary/30 bg-primary/5'
            : 'border-dashed border-border bg-secondary/30'
        )}
        onKeyDown={handleKeyDown}
      >
        {/* Selected text quote */}
        {quoteText && (
          <blockquote className="border-l-2 border-primary/40 pl-3 text-xs italic text-muted-foreground line-clamp-3">
            "{quoteText}"
          </blockquote>
        )}

        {/* Header: Title and Preview Toggle */}
        <div className="flex items-center gap-2">
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title (optional)"
            className={cn(
              'flex-1 px-3 py-2 rounded-md border border-border',
              'bg-background text-foreground text-sm font-medium',
              'placeholder:text-muted-foreground/60',
              'focus:outline-none focus:ring-2 focus:ring-primary/50'
            )}
          />
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-md border',
              'text-xs font-medium transition-colors',
              showPreview 
                ? 'bg-primary text-primary-foreground border-primary' 
                : 'bg-background text-muted-foreground border-border hover:bg-secondary'
            )}
          >
            {showPreview ? <Edit3 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showPreview ? 'Edit' : 'Preview'}
          </button>
        </div>

        {/* Content area */}
        {showPreview ? (
          <div className="min-h-[80px] p-3 rounded-md border border-border bg-background text-sm prose prose-sm dark:prose-invert max-w-none">
            {content.trim() ? (
              <MarkdownRenderer content={content} />
            ) : (
              <span className="text-muted-foreground italic">Nothing to preview</span>
            )}
          </div>
        ) : (
          <textarea
            ref={contentRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your note... (Markdown supported)"
            className={cn(
              'w-full px-3 py-2 rounded-md border border-border',
              'bg-background text-foreground text-sm',
              'placeholder:text-muted-foreground/60',
              'resize-none focus:outline-none focus:ring-2 focus:ring-primary/50',
              'min-h-[80px]'
            )}
            rows={3}
            spellCheck
          />
        )}

        {/* Tags */}
        <NoteTagInput tags={tags} onChange={setTags} />

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <div className="flex items-center gap-2">
            {/* Color picker */}
            <div className="flex items-center gap-1.5 p-1 rounded-full bg-background border border-border">
              {COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColor(c.id)}
                  className={cn(
                    'w-5 h-5 rounded-full transition-transform',
                    c.class,
                    color === c.id ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-110' : 'hover:scale-110 opacity-70'
                  )}
                  aria-label={`Select ${c.id} color`}
                />
              ))}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs text-muted-foreground font-mono">
              Ctrl+Enter to save
            </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md',
                'text-xs font-medium border border-border',
                'hover:bg-secondary transition-colors'
              )}
            >
              <X className="w-3.5 h-3.5" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md',
                'text-xs font-medium',
                'bg-primary text-primary-foreground',
                'hover:bg-primary/90 transition-colors',
                !canSave && 'opacity-50 cursor-not-allowed'
              )}
            >
              <Save className="w-3.5 h-3.5" />
              {isEdit ? 'Update' : 'Save'}
            </button>
          </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
