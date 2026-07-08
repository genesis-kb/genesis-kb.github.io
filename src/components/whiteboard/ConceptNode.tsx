import { Handle, Position } from '@xyflow/react';
import { Note } from '@/types/notes';
import { Tag, StickyNote } from 'lucide-react';

export function ConceptNode({ data }: { data: any }) {
  const note = data?.note;
  
  if (!note) {
    return (
      <div className="bg-red-500 text-white p-4 rounded-md z-50 relative pointer-events-auto">
        <p className="text-xs">Error: Note data missing</p>
        <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-red-800" />
      </div>
    );
  }
  
  return (
    <div className="bg-card border-2 border-amber-500/50 rounded-xl shadow-lg w-64 overflow-hidden group hover:border-amber-500 transition-colors z-50 opacity-100 visible pointer-events-auto relative">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-amber-500" />
      
      <div className="p-3 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2">
        <StickyNote className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <h3 className="font-medium text-sm text-foreground truncate">{note.title || "Concept"}</h3>
      </div>
      
      <div className="p-3 bg-card/80 backdrop-blur-sm">
        {note.selectedText ? (
          <p className="text-xs text-muted-foreground italic mb-3 line-clamp-4 leading-relaxed">
            "{note.selectedText}"
          </p>
        ) : note.content ? (
          <p className="text-xs text-muted-foreground mb-3 line-clamp-4 leading-relaxed">
            {note.content}
          </p>
        ) : null}
        
        {note.tags && note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {note.tags.map(tag => (
              <span key={tag} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-300 font-medium">
                <Tag className="w-2.5 h-2.5" /> {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-amber-500" />
    </div>
  );
}
