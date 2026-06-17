import { useEffect, useMemo, useState, useCallback } from 'react';
import { ReactFlow, Controls, Background, MiniMap, Panel, ReactFlowProvider, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useWhiteboard } from '@/hooks/useWhiteboard';
import { useNotes } from '@/hooks/useNotes';
import { Note } from '@/types/notes';
import { ConceptNode } from './ConceptNode';
import { Network, Plus, Trash2 } from 'lucide-react';

const nodeTypes = {
  concept: ConceptNode,
};

interface TranscriptWhiteboardProps {
  transcriptId: string;
}

export function TranscriptWhiteboard({ transcriptId }: TranscriptWhiteboardProps) {
  const { nodes, setNodes, onNodesChange, edges, onEdgesChange, onConnect, isLoaded } = useWhiteboard(transcriptId);
  const { getNotesForTranscript, deleteNote } = useNotes();
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const handleSelectionChange = useCallback(({ nodes }: { nodes: any[] }) => {
    setSelectedNodeIds(nodes.map(n => n.id));
  }, []);
  
  const allNotes = getNotesForTranscript(transcriptId);
  const conceptNotes = useMemo(() => allNotes.filter(n => n.isConcept), [allNotes]);
  
  // Sync nodes with concept notes
  useEffect(() => {
    if (!isLoaded) return;
    setNodes(prevNodes => {
      let changed = false;
      const prevNodesMap = new Map(prevNodes.map(n => [n.id, n]));
      
      const newConceptNodes = conceptNotes.map((note, index) => {
        const existing = prevNodesMap.get(note.id);
        if (existing) {
          // Check if data changed
          const existingNote = existing.data?.note as Note | undefined;
          if (existingNote?.updatedAt !== note.updatedAt) {
            changed = true;
            return { ...existing, data: { ...existing.data, note } };
          }
          return existing;
        } else {
          // New concept note added!
          changed = true;
          return {
            id: note.id,
            type: 'concept',
            position: { x: 300 + (index * 40), y: 150 + (index * 40) }, // Moved away from top-left panel
            data: { note },
          };
        }
      });

      // Keep non-concept nodes
      const otherNodes = prevNodes.filter(n => n.type !== 'concept');
      
      // Detect deletions
      const prevConceptNodesCount = prevNodes.filter(n => n.type === 'concept').length;
      if (prevConceptNodesCount !== conceptNotes.length) {
        changed = true;
      }

      if (!changed) return prevNodes;
      return [...otherNodes, ...newConceptNodes];
    });
  }, [conceptNotes, setNodes, isLoaded]);

  const handleDeleteSelected = () => {
    selectedNodeIds.forEach(id => {
      deleteNote(id);
    });
    setSelectedNodeIds([]);
  };

  if (!isLoaded) return <div className="w-full h-full min-h-[600px] flex items-center justify-center">Loading whiteboard...</div>;

  return (
    <div style={{ width: '100%', height: '600px' }} className="rounded-xl border border-border bg-card overflow-hidden relative">
      <ReactFlowProvider>
        <FitViewOnLoad nodesCount={nodes.length} />
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          minZoom={0.1}
          maxZoom={1.5}
          style={{ width: '100%', height: '100%' }}
          onSelectionChange={handleSelectionChange}
        >
          <Background gap={24} size={2} color="rgba(150, 150, 150, 0.2)" />
          <Controls className="bg-card border-border fill-foreground" />
          <MiniMap 
            nodeColor={(n) => n.type === 'concept' ? 'rgba(245, 158, 11, 0.5)' : '#eee'}
            maskColor="rgba(0,0,0,0.1)"
            className="bg-card border border-border rounded-lg shadow-sm"
          />
          
          <Panel position="top-left" className="bg-card/90 backdrop-blur border border-border rounded-lg p-3 shadow-sm m-4 z-50">
            <div className="flex items-center gap-2 mb-2">
              <Network className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-semibold">Concept Graph ({conceptNotes.length})</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Highlight text in the transcript and click<br/>
              <strong>Extract Concept</strong> to add nodes here.
            </p>
            {selectedNodeIds.length > 0 && (
              <button 
                onClick={handleDeleteSelected}
                className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-md text-xs font-medium transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Selected ({selectedNodeIds.length})
              </button>
            )}
          </Panel>
        </ReactFlow>
      </ReactFlowProvider>
      

    </div>
  );
}

function FitViewOnLoad({ nodesCount }: { nodesCount: number }) {
  const { fitView } = useReactFlow();
  
  useEffect(() => {
    if (nodesCount > 0) {
      setTimeout(() => {
        fitView({ padding: 0.2, duration: 800 });
      }, 200);
    }
  }, [nodesCount, fitView]);
  
  return null;
}
