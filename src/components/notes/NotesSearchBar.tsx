import { Search, Filter, SortDesc } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NoteColor } from '@/types/notes'

interface NotesSearchBarProps {
  searchQuery: string
  setSearchQuery: (q: string) => void
  colorFilter: NoteColor | 'all'
  setColorFilter: (c: NoteColor | 'all') => void
  sortBy: 'newest' | 'oldest' | 'az'
  setSortBy: (s: 'newest' | 'oldest' | 'az') => void
}

export function NotesSearchBar({
  searchQuery,
  setSearchQuery,
  colorFilter,
  setColorFilter,
  sortBy,
  setSortBy,
}: NotesSearchBarProps) {
  return (
    <div className="flex flex-col sm:flex-row items-center gap-2 p-3 bg-secondary/20 border-b border-border">
      <div className="relative flex-1 w-full">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search notes or tags..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-1.5 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
      </div>
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <div className="relative flex items-center">
          <Filter className="absolute left-2.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <select
            value={colorFilter}
            onChange={(e) => setColorFilter(e.target.value as NoteColor | 'all')}
            className="pl-8 pr-6 py-1.5 rounded-md border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 appearance-none cursor-pointer"
          >
            <option value="all">All Colors</option>
            <option value="slate">Slate</option>
            <option value="blue">Blue</option>
            <option value="green">Green</option>
            <option value="amber">Amber</option>
            <option value="rose">Rose</option>
            <option value="purple">Purple</option>
          </select>
        </div>
        <div className="relative flex items-center">
          <SortDesc className="absolute left-2.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest' | 'az')}
            className="pl-8 pr-6 py-1.5 rounded-md border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 appearance-none cursor-pointer"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="az">A to Z</option>
          </select>
        </div>
      </div>
    </div>
  )
}
