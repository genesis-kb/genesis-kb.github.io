/**
 * Floating toolbar for selecting and saving text highlights
 * Appears when user selects 10+ characters inside the transcript reader
 * Handles both desktop and mobile interactions
 */

import { useEffect, useRef, useState } from 'react'
import { Copy, X, StickyNote, Languages, Bot, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useBookmarks } from '@/hooks/useBookmarks'
import { cn } from '@/lib/utils'

interface HighlightToolbarProps {
  containerRef: React.RefObject<HTMLDivElement>
  transcriptId: string
  transcriptTitle: string
  onAddNote?: (selectedText: string) => void
  onExtractConcept?: (selectedText: string) => void
  onAskAI?: (selectedText: string) => void
  onTranslate?: (selectedText: string, targetLanguage: string) => void
}

export function HighlightToolbar({
  containerRef,
  transcriptId,
  transcriptTitle,
  onAddNote,
  onExtractConcept,
  onAskAI,
  onTranslate,
}: HighlightToolbarProps) {
  const { addHighlight } = useBookmarks()

  const [toolbarVisible, setToolbarVisible] = useState(false)
  const [toolbarPosition, setToolbarPosition] = useState({ top: 0, left: 0 })
  const [selectedText, setSelectedText] = useState('')
  const [showTranslateMenu, setShowTranslateMenu] = useState(false)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const isSavingRef = useRef(false)

  useEffect(() => {
    if (!toolbarRef.current) return

    toolbarRef.current.style.top = `${toolbarPosition.top}px`
    toolbarRef.current.style.left = `${toolbarPosition.left}px`
  }, [toolbarPosition])

  /**
   * Handle text selection - show toolbar
   */
  useEffect(() => {
    const handleSelection = (event: MouseEvent | TouchEvent) => {
      if (
        toolbarRef.current &&
        event.target instanceof Node &&
        toolbarRef.current.contains(event.target)
      ) {
        return
      }

      const selection = window.getSelection()
      if (!selection) return

      const selectedStr = selection.toString().trim()

      // Require at least 10 characters
      if (selectedStr.length < 10) {
        setToolbarVisible(false)
        return
      }

      try {
        const range = selection.getRangeAt(0)
        const rect = range.getBoundingClientRect()

        if (rect.width === 0 && rect.height === 0) {
          setToolbarVisible(false)
          return
        }

        // Position toolbar above selection with scroll offset
        let top = rect.top + window.scrollY - 50
        let left = rect.left + window.scrollX + rect.width / 2 - 120

        // Clamp to container bounds
        const container = containerRef.current
        if (container) {
          const containerRect = container.getBoundingClientRect()
          const containerTop = containerRect.top + window.scrollY
          const containerLeft = containerRect.left + window.scrollX
          const relativeTop = top - containerTop
          const relativeLeft = left - containerLeft
          const maxLeft = Math.max(0, container.clientWidth - 240)

          top = Math.max(0, relativeTop)
          left = Math.max(0, Math.min(relativeLeft, maxLeft))
        }

        setToolbarPosition({ top: Math.max(0, top), left: Math.max(0, left) })
        setSelectedText(selectedStr)
        setShowTranslateMenu(false)
        setToolbarVisible(true)
      } catch {
        setToolbarVisible(false)
      }
    }

    const container = containerRef.current
    if (!container) return

    container.addEventListener('mouseup', handleSelection)
    container.addEventListener('touchend', handleSelection)

    return () => {
      container.removeEventListener('mouseup', handleSelection)
      container.removeEventListener('touchend', handleSelection)
    }
  }, [containerRef])

  /**
   * Handle clicking outside toolbar to dismiss
   */
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        toolbarRef.current &&
        !toolbarRef.current.contains(e.target as Node)
      ) {
        setToolbarVisible(false)
      }
    }

    if (toolbarVisible) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [toolbarVisible])

  useEffect(() => {
    if (!toolbarVisible) {
      setShowTranslateMenu(false)
      setSelectedText('')
    }
  }, [toolbarVisible])

  /**
   * Save highlight with optional style
   */
  const handleSaveStyle = (color?: string, isUnderline?: boolean) => {
    if (!selectedText.trim() || isSavingRef.current) return

    isSavingRef.current = true

    try {
      addHighlight(
        transcriptId,
        transcriptTitle,
        selectedText,
        undefined,
        color,
        isUnderline
      )

      // Reset state
      setToolbarVisible(false)
      setSelectedText('')
    } finally {
      isSavingRef.current = false
    }
  }

  const handleCopySelectedText = async () => {
    if (!selectedText.trim()) return

    try {
      await navigator.clipboard.writeText(selectedText)
      toast.success('Copied selection')
      setToolbarVisible(false)
    } catch {
      toast.error('Could not copy selection')
    }
  }

  if (!toolbarVisible) return null

  return (
    <div
      ref={toolbarRef}
      className="absolute bg-card border border-border rounded-lg shadow-lg p-2 z-50 flex flex-col gap-2 min-w-[200px]"
    >
      {showTranslateMenu ? (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground px-1">Translate to:</span>
          <div className="flex flex-wrap gap-1">
            {['English', 'Spanish', 'French', 'German', 'Hindi', 'Chinese'].map(lang => (
              <button
                key={lang}
                onClick={() => {
                  onTranslate?.(selectedText, lang)
                  setToolbarVisible(false)
                  setShowTranslateMenu(false)
                }}
                className="px-2 py-1 text-xs rounded bg-secondary/50 border border-border/50 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
              >
                {lang}
              </button>
            ))}
          </div>
          <button 
            onClick={() => setShowTranslateMenu(false)}
            className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground text-center"
          >
            Cancel
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 border-b border-border pb-2 px-1">
            <button onClick={() => handleSaveStyle('yellow')} className="w-5 h-5 rounded-full bg-yellow-400 hover:scale-110 transition-transform shadow-sm" aria-label="Highlight Yellow" />
            <button onClick={() => handleSaveStyle('green')} className="w-5 h-5 rounded-full bg-green-400 hover:scale-110 transition-transform shadow-sm" aria-label="Highlight Green" />
            <button onClick={() => handleSaveStyle('blue')} className="w-5 h-5 rounded-full bg-blue-400 hover:scale-110 transition-transform shadow-sm" aria-label="Highlight Blue" />
            <button onClick={() => handleSaveStyle('pink')} className="w-5 h-5 rounded-full bg-pink-400 hover:scale-110 transition-transform shadow-sm" aria-label="Highlight Pink" />
            <div className="w-px h-4 bg-border mx-1" />
            <button onClick={() => handleSaveStyle(undefined, true)} className="px-1.5 py-0.5 rounded hover:bg-secondary font-serif font-bold underline transition-colors text-sm" aria-label="Underline">
              U
            </button>
          </div>
          <div className="flex items-center justify-between gap-1 px-1">
            <div className="flex items-center gap-1">
              <button onClick={handleCopySelectedText} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Copy"><Copy className="w-4 h-4" /></button>
              {onAddNote && <button onClick={() => { onAddNote(selectedText); setToolbarVisible(false); }} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Add Note"><StickyNote className="w-4 h-4" /></button>}
              {onExtractConcept && <button onClick={() => { onExtractConcept(selectedText); setToolbarVisible(false); }} className="p-1.5 rounded hover:bg-secondary text-amber-500 hover:text-amber-600 transition-colors" title="Extract Concept"><Sparkles className="w-4 h-4" /></button>}
            </div>
            <div className="flex items-center gap-1 border-l border-border pl-1">
              {onAskAI && <button onClick={() => { onAskAI(selectedText); setToolbarVisible(false); }} className="p-1.5 rounded hover:bg-secondary text-primary transition-colors flex items-center gap-1" title="Ask AI"><Bot className="w-4 h-4" /><span className="text-[10px] font-medium uppercase tracking-wider">Ask AI</span></button>}
              {onTranslate && <button onClick={() => setShowTranslateMenu(true)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Translate"><Languages className="w-4 h-4" /></button>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
