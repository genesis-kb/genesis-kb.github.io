import { useState, useCallback, useEffect } from 'react';
import { Node, Edge, Connection, addEdge, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange } from '@xyflow/react';

const STORAGE_KEY = 'btc-whiteboard-graphs';

export function useWhiteboard(transcriptId: string) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from local storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY}-${transcriptId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.nodes) setNodes(parsed.nodes);
        if (parsed.edges) setEdges(parsed.edges);
      }
    } catch (e) {
      console.error("Failed to load whiteboard state:", e);
    }
    setIsLoaded(true);
  }, [transcriptId]);

  // Save to local storage
  useEffect(() => {
    if (!isLoaded) return;
    const timer = setTimeout(() => {
      localStorage.setItem(`${STORAGE_KEY}-${transcriptId}`, JSON.stringify({ nodes, edges }));
    }, 500); // debounce
    return () => clearTimeout(timer);
  }, [nodes, edges, transcriptId, isLoaded]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );
  
  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    []
  );

  return { nodes, setNodes, onNodesChange, edges, setEdges, onEdgesChange, onConnect, isLoaded };
}
