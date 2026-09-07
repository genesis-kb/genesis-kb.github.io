import { useState, KeyboardEvent } from 'react'
import { X, Hash } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NoteTagInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
}

export function NoteTagInput({ tags, onChange }: NoteTagInputProps) {
  const [input, setInput] = useState('')

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Prevent submitting the outer form/editor if we're just adding a tag
    if (e.key === 'Enter') {
      e.preventDefault()
      const newTag = input.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
      if (newTag && !tags.includes(newTag)) {
        onChange([...tags, newTag])
        setInput('')
      }
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      // Remove last tag on backspace when input is empty
      e.preventDefault()
      onChange(tags.slice(0, -1))
    }
  }

  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter((t) => t !== tagToRemove))
  }

  return (
    <div className="flex flex-wrap items-center gap-2 p-2 rounded-md border border-border bg-background">
      <Hash className="w-3.5 h-3.5 text-muted-foreground ml-1" />
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-secondary text-secondary-foreground text-xs font-medium"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="hover:bg-background/50 rounded-full p-0.5"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? "Add tags... (Press Enter)" : ""}
        className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground/60 focus:ring-0 p-0"
      />
    </div>
  )
}
