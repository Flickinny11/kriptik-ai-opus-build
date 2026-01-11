/**
 * Neural Pathway Events Hook
 * 
 * Connects to real-time orchestration events via SSE or WebSocket
 * and transforms them into neural pathway visualization state.
 */

import { useState, useEffect, useCallback } from 'react';
import type { 
  NeuralPathwayState, 
  PathwayNode, 
  OrchestrationEvent,
  NodeStatus,
  NodeDetails 
} from '@/components/neural-pathway/types';

// Map orchestration event types to node IDs
const EVENT_TO_NODE_MAP: Record<string, string> = {
  'intent_lock_start': 'intent-lock',
  'intent_lock_complete': 'intent-lock',
  'feature_decomposition_start': 'feature-decomp',
  'feature_decomposition_complete': 'feature-decomp',
  'agent_assigned': 'agent-1',
  'agent_1_active': 'agent-1',
  'agent_2_active': 'agent-2',
  'agent_3_active': 'agent-3',
  'code_generation_start': 'code-gen',
  'code_generation_complete': 'code-gen',
  'file_write': 'code-gen',
  'verification_start': 'verification',
  'verification_complete': 'verification',
  'build_start': 'build',
  'build_complete': 'build',
  'deploy_start': 'deploy',
  'deploy_complete': 'deploy',
  'complete': 'complete',
};

interface UseNeuralPathwayEventsReturn {
  state: NeuralPathwayState | null;
  isConnected: boolean;
  error: string | null;
}

export function useNeuralPathwayEvents(sessionId: string): UseNeuralPathwayEventsReturn {
  const [state, setState] = useState<NeuralPathwayState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Update a specific node's status
  const updateNode = useCallback((nodeId: string, updates: Partial<PathwayNode>) => {
    setState(prev => {
      if (!prev) return prev;
      
      return {
        ...prev,
        nodes: prev.nodes.map(node => 
          node.id === nodeId ? { ...node, ...updates } : node
        ),
      };
    });
  }, []);
  
  // Set node status and update related nodes
  const setNodeActive = useCallback((nodeId: string, details?: NodeDetails) => {
    setState(prev => {
      if (!prev) return prev;
      
      const nodes = prev.nodes.map(node => {
        if (node.id === nodeId) {
          return { 
            ...node, 
            status: 'active' as NodeStatus, 
            startedAt: Date.now(),
            details,
          };
        }
        // Set previous active nodes to streaming or complete
        if (node.status === 'active') {
          return { ...node, status: 'streaming' as NodeStatus };
        }
        return node;
      });
      
      return { ...prev, nodes };
    });
  }, []);
  
  const setNodeComplete = useCallback((nodeId: string, details?: NodeDetails) => {
    setState(prev => {
      if (!prev) return prev;
      
      const nodes = prev.nodes.map(node => {
        if (node.id === nodeId) {
          return { 
            ...node, 
            status: 'complete' as NodeStatus, 
            completedAt: Date.now(),
            duration: node.startedAt ? Date.now() - node.startedAt : undefined,
            details: { ...node.details, ...details },
          };
        }
        return node;
      });
      
      return { ...prev, nodes };
    });
  }, []);
  
  // Handle incoming events
  const handleEvent = useCallback((event: OrchestrationEvent) => {
    const { type, data } = event;
    
    switch (type) {
      case 'node_update': {
        if (data.nodeId && data.node) {
          updateNode(data.nodeId, data.node);
        }
        break;
      }
      
      case 'phase_change': {
        if (data.phase) {
          setState(prev => prev ? { ...prev, currentPhase: data.phase! } : prev);
          
          // Find corresponding node and activate or complete it
          const nodeId = EVENT_TO_NODE_MAP[data.phase];
          if (nodeId) {
            // If it's a completion event, mark the node complete
            if (data.phase.endsWith('_complete')) {
              setNodeComplete(nodeId);
            } else {
              setNodeActive(nodeId);
            }
          }
        }
        break;
      }
      
      case 'progress': {
        if (data.progress !== undefined) {
          setState(prev => prev ? { ...prev, progress: data.progress! } : prev);
        }
        break;
      }
      
      case 'complete': {
        setState(prev => prev ? { 
          ...prev, 
          status: 'complete',
          progress: 100,
          nodes: prev.nodes.map(n => ({
            ...n,
            status: n.status === 'idle' ? 'skipped' : 'complete' as NodeStatus,
          })),
        } : prev);
        break;
      }
      
      case 'error': {
        if (data.nodeId) {
          updateNode(data.nodeId, { 
            status: 'error', 
            details: { error: data.error } 
          });
        }
        setError(data.error || 'Unknown error');
        break;
      }
    }
  }, [updateNode, setNodeActive, setNodeComplete]);
  
  // Connect to event stream
  useEffect(() => {
    if (!sessionId) return;
    
    // Initialize state
    setState({
      sessionId,
      promptText: '',
      startedAt: Date.now(),
      status: 'initializing',
      nodes: [],
      connections: [],
      currentPhase: 'Initializing...',
      progress: 0,
    });
    
    // Simulate events for demo (SSE endpoint will be connected when backend is ready)
    // When ready, use: new EventSource(`${API_URL}/api/orchestration/${sessionId}/events`)
    const simulateEvents = () => {
      setIsConnected(true);
      
      // Simulate the orchestration flow
      const events: Array<{ delay: number; event: Partial<OrchestrationEvent> }> = [
        { delay: 100, event: { type: 'phase_change', data: { phase: 'intent_lock_start', message: 'Creating Intent Contract...' } } },
        { delay: 2000, event: { type: 'progress', data: { progress: 15 } } },
        { delay: 3500, event: { type: 'phase_change', data: { phase: 'intent_lock_complete' } } },
        { delay: 4000, event: { type: 'phase_change', data: { phase: 'feature_decomposition_start', message: 'Analyzing features...' } } },
        { delay: 4500, event: { type: 'progress', data: { progress: 25 } } },
        { delay: 6000, event: { type: 'phase_change', data: { phase: 'feature_decomposition_complete' } } },
        { delay: 6500, event: { type: 'phase_change', data: { phase: 'agent_1_active', message: 'Parallel agents starting...' } } },
        { delay: 7000, event: { type: 'phase_change', data: { phase: 'agent_2_active' } } },
        { delay: 7500, event: { type: 'phase_change', data: { phase: 'agent_3_active' } } },
        { delay: 8000, event: { type: 'progress', data: { progress: 40 } } },
        { delay: 10000, event: { type: 'phase_change', data: { phase: 'code_generation_start', message: 'Generating code...' } } },
        { delay: 12000, event: { type: 'progress', data: { progress: 60 } } },
        { delay: 15000, event: { type: 'phase_change', data: { phase: 'code_generation_complete' } } },
        { delay: 16000, event: { type: 'phase_change', data: { phase: 'verification_start', message: 'Running verification swarm...' } } },
        { delay: 18000, event: { type: 'progress', data: { progress: 75 } } },
        { delay: 20000, event: { type: 'phase_change', data: { phase: 'verification_complete' } } },
        { delay: 21000, event: { type: 'phase_change', data: { phase: 'build_start', message: 'Building...' } } },
        { delay: 23000, event: { type: 'progress', data: { progress: 85 } } },
        { delay: 25000, event: { type: 'phase_change', data: { phase: 'build_complete' } } },
        { delay: 26000, event: { type: 'phase_change', data: { phase: 'deploy_start', message: 'Deploying...' } } },
        { delay: 28000, event: { type: 'progress', data: { progress: 95 } } },
        { delay: 30000, event: { type: 'complete', data: { message: 'Complete!' } } },
      ];
      
      const timeouts: NodeJS.Timeout[] = [];
      
      events.forEach(({ delay, event }) => {
        const timeout = setTimeout(() => {
          handleEvent({
            type: event.type as OrchestrationEvent['type'],
            timestamp: Date.now(),
            sessionId,
            data: event.data || {},
          });
          
          // Update current phase display
          if (event.data?.message) {
            setState(prev => prev ? { ...prev, currentPhase: event.data!.message! } : prev);
          }
        }, delay);
        timeouts.push(timeout);
      });
      
      return () => timeouts.forEach(t => clearTimeout(t));
    };
    
    // Use simulation for now, SSE endpoint will be enabled when ready
    const cleanup = simulateEvents();
    
    return () => {
      cleanup?.();
    };
  }, [sessionId, handleEvent]);
  
  return { state, isConnected, error };
}
