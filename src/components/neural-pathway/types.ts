/**
 * Neural Pathway Visualization Types
 *
 * Types for the real-time orchestration visualization showing
 * how prompts flow through KripTik's AI pipeline.
 */

export type NodeStatus =
  | 'idle'       // Not yet reached
  | 'pending'    // Queued, about to start
  | 'active'     // Currently processing
  | 'streaming'  // Receiving data
  | 'complete'   // Successfully finished
  | 'error'      // Failed
  | 'skipped';   // Bypassed

export type NodeType =
  | 'prompt'           // User input node (center)
  | 'intent-lock'      // Phase 0: Intent Contract creation
  | 'feature-decomp'   // Feature decomposition
  | 'agent-slot'       // Parallel agent assignment
  | 'code-gen'         // Code generation
  | 'file-write'       // File creation/modification
  | 'verification'     // Verification swarm
  | 'build'            // Compilation/build step
  | 'deploy'           // Deployment
  | 'complete';        // Final success state

export interface PathwayNode {
  id: string;
  type: NodeType;
  label: string;
  shortLabel?: string;           // For compact display
  status: NodeStatus;
  position: { x: number; y: number };  // Relative position
  angle?: number;                // Angle from center (for radial layout)
  distance?: number;             // Distance from center
  parentId?: string;             // Connection to parent node
  childIds?: string[];           // Connections to child nodes

  // Progress and timing
  progress?: number;             // 0-100 if applicable
  startedAt?: number;            // Timestamp
  completedAt?: number;          // Timestamp
  duration?: number;             // Milliseconds

  // Content for expansion
  expandable?: boolean;
  summary?: string;              // Brief description
  details?: NodeDetails;         // Full details for expanded view

  // Visual
  icon?: string;                 // Icon name
  color?: string;                // Override color
  size?: 'small' | 'medium' | 'large';
  pulseIntensity?: number;       // 0-1 for glow effect
}

export interface NodeDetails {
  // For code generation nodes
  filesModified?: Array<{
    path: string;
    additions: number;
    deletions: number;
    preview?: string;            // First few lines
  }>;

  // For verification nodes
  verificationResults?: {
    errorCheck?: { passed: boolean; score: number };
    codeQuality?: { passed: boolean; score: number };
    visualVerify?: { passed: boolean; score: number };
    securityScan?: { passed: boolean; score: number };
    placeholderCheck?: { passed: boolean; score: number };
    designStyle?: { passed: boolean; score: number };
  };

  // For agent nodes
  agentInfo?: {
    agentId: string;
    model: string;
    tokensUsed: number;
    thinking?: string;           // Truncated thinking
  };

  // For intent lock
  intentInfo?: {
    appType: string;
    appSoul: string;
    successCriteria: number;
    thinkingTokens: number;
  };

  // Generic content
  content?: string;
  code?: string;
  language?: string;
  error?: string;
}

export interface PathwayConnection {
  id: string;
  fromId: string;
  toId: string;
  status: 'inactive' | 'active' | 'pulsing' | 'complete';
  animated?: boolean;
  dataFlow?: boolean;            // Show data particles flowing
  label?: string;
}

export interface NeuralPathwayState {
  sessionId: string;
  promptText: string;
  startedAt: number;
  status: 'initializing' | 'processing' | 'verifying' | 'complete' | 'error';
  nodes: PathwayNode[];
  connections: PathwayConnection[];
  currentPhase: string;
  progress: number;              // Overall 0-100
  estimatedTimeRemaining?: number;

  // Metrics
  tokensUsed?: number;
  filesModified?: number;
  agentsActive?: number;
}

export interface OrchestrationEvent {
  type: 'node_update' | 'connection_update' | 'phase_change' | 'progress' | 'complete' | 'error';
  timestamp: number;
  sessionId: string;
  data: {
    nodeId?: string;
    node?: Partial<PathwayNode>;
    connectionId?: string;
    connection?: Partial<PathwayConnection>;
    phase?: string;
    progress?: number;
    message?: string;
    error?: string;
  };
}

// Hook return type
export interface UseNeuralPathwayReturn {
  state: NeuralPathwayState | null;
  isActive: boolean;
  expandedNodeId: string | null;
  setExpandedNodeId: (id: string | null) => void;
  getNodeDetails: (nodeId: string) => NodeDetails | null;
}

// Props for the main component
export interface NeuralPathwayProps {
  sessionId: string;
  promptText?: string;
  className?: string;
  compact?: boolean;             // Smaller version for inline use
  showLabels?: boolean;
  onNodeClick?: (node: PathwayNode) => void;
  onComplete?: () => void;
}
