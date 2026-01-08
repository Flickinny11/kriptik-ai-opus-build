/**
 * Multi-Agent Reasoning Swarm Types
 *
 * Types for parallel reasoning with multiple specialized agents.
 * Based on Anthropic's multi-agent research system patterns.
 */

import type { TokenUsage, ModelTier, ProviderType } from '../types.js';

// ============================================================================
// Simplified Reasoning Step for Swarm Results
// ============================================================================

/**
 * Simplified reasoning step for swarm synthesis
 */
export interface SwarmReasoningStep {
  /** Step number */
  step: number;
  /** Thought description */
  thought: string;
  /** Reasoning content */
  reasoning: string;
  /** Conclusion */
  conclusion: string;
  /** Confidence score */
  confidence: number;
}

// ============================================================================
// Agent Types
// ============================================================================

/**
 * Agent roles in the swarm
 */
export type AgentRole =
  | 'lead'        // Orchestrates other agents, creates plan
  | 'analyst'     // Analyzes requirements and constraints
  | 'critic'      // Challenges assumptions, finds flaws
  | 'creative'    // Generates novel approaches
  | 'implementer' // Focuses on concrete steps
  | 'synthesizer'; // Combines insights

/**
 * Agent status
 */
export type AgentStatus = 'idle' | 'thinking' | 'complete' | 'error';

/**
 * A reasoning agent in the swarm
 */
export interface SwarmAgent {
  /** Unique identifier */
  id: string;
  /** Agent's role */
  role: AgentRole;
  /** Model tier to use */
  modelTier: ModelTier;
  /** Current status */
  status: AgentStatus;
  /** System prompt for this agent */
  systemPrompt: string;
  /** Current task assigned */
  currentTask: string | null;
  /** Result from this agent */
  result: AgentResult | null;
  /** Token usage */
  tokenUsage: TokenUsage;
  /** Latency in ms */
  latencyMs: number;
  /** Created timestamp */
  createdAt: Date;
  /** Metadata */
  metadata: Record<string, unknown>;
}

/**
 * Result from an agent
 */
export interface AgentResult {
  /** Agent ID */
  agentId: string;
  /** Agent's role */
  role: AgentRole;
  /** The agent's output/reasoning */
  output: string;
  /** Confidence in output (0-1) */
  confidence: number;
  /** Key insights generated */
  insights: string[];
  /** Concerns or issues raised */
  concerns: string[];
  /** Suggestions for other agents or synthesis */
  suggestions: string[];
  /** Token usage */
  tokenUsage: TokenUsage;
  /** Latency */
  latencyMs: number;
}

// ============================================================================
// Conflict Types
// ============================================================================

/**
 * Conflict type
 */
export type ConflictType = 'contradiction' | 'confidence_disparity' | 'approach' | 'coverage';

/**
 * Conflict between agent outputs
 */
export interface Conflict {
  /** Conflict ID */
  id: string;
  /** Type of conflict */
  type: ConflictType;
  /** Agents involved */
  agents: string[];
  /** Description of conflict */
  description: string;
  /** Conflict severity */
  severity: 'low' | 'medium' | 'high';
  /** Positions from each agent */
  points: Array<{
    agentId: string;
    position: string;
    support: number;
  }>;
}

/**
 * Resolution strategy
 */
export type ConflictResolutionStrategy = 'voting' | 'synthesis' | 'arbitration' | 'hybrid';

/**
 * Resolved conflict
 */
export interface ConflictResolution {
  /** Conflict ID */
  conflictId: string;
  /** Strategy used */
  strategy: ConflictResolutionStrategy;
  /** Outcome */
  outcome: string;
  /** Confidence */
  confidence: number;
  /** Reasoning */
  reasoning: string;
}

// ============================================================================
// Swarm Configuration
// ============================================================================

/**
 * Swarm configuration
 */
export interface SwarmConfig {
  /** Model tier for lead agent */
  leadModelTier: ModelTier;
  /** Model tier for other agents */
  agentModelTier: ModelTier;
  /** Maximum number of agents */
  maxAgents: number;
  /** How many agents to run in parallel */
  parallelAgents: number;
  /** Enable structured debate between agents */
  enableDebate: boolean;
  /** Number of debate rounds */
  debateRounds: number;
  /** Model for final synthesis */
  synthesisModelTier: ModelTier;
  /** Timeout per agent in ms */
  agentTimeoutMs: number;
  /** Temperature for agents */
  temperature: number;
  /** Enable conflict resolution */
  enableConflictResolution: boolean;
  /** Conflict resolution strategy */
  conflictResolution: ConflictResolutionStrategy;
  /** Model tier distribution for spawning agents */
  modelTierDistribution?: {
    maximum: number;
    deep: number;
    standard: number;
    fast: number;
  };
}

/**
 * Default swarm configuration
 */
export const DEFAULT_SWARM_CONFIG: SwarmConfig = {
  leadModelTier: 'deep',
  agentModelTier: 'standard',
  maxAgents: 5,
  parallelAgents: 3,
  enableDebate: true,
  debateRounds: 2,
  synthesisModelTier: 'deep',
  agentTimeoutMs: 60000,
  temperature: 0.7,
  enableConflictResolution: true,
  conflictResolution: 'hybrid',
};

// ============================================================================
// Swarm State
// ============================================================================

/**
 * Swarm execution phase
 */
export type SwarmPhase =
  | 'initializing'
  | 'planning'
  | 'parallel_reasoning'
  | 'debate'
  | 'conflict_detection'
  | 'resolution'
  | 'synthesis'
  | 'complete'
  | 'error';

/**
 * Current state of the swarm (simple form for progress tracking)
 */
export interface SwarmState {
  /** Current phase */
  phase: SwarmPhase;
  /** Number of agents currently active */
  agentsActive: number;
  /** Number of agents completed */
  agentsComplete: number;
  /** Number of conflicts detected */
  conflictsDetected: number;
  /** Progress 0-1 */
  progress: number;
}

/**
 * Full swarm state (internal tracking)
 */
export interface SwarmStateFull {
  /** Original problem */
  problem: string;
  /** Current phase */
  phase: SwarmPhase;
  /** All agents in swarm */
  agents: Map<string, SwarmAgent>;
  /** Shared context (whiteboard) */
  sharedContext: string;
  /** Accumulated insights */
  insights: string[];
  /** Detected conflicts between agents */
  conflicts: AgentConflict[];
  /** Final result (when complete) */
  finalResult: SwarmResult | null;
  /** Started timestamp */
  startedAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * Conflict between agent outputs (internal)
 */
export interface AgentConflict {
  /** Conflict ID */
  id: string;
  /** Agents involved */
  agentIds: string[];
  /** Description of conflict */
  description: string;
  /** Conflicting positions */
  positions: Array<{
    agentId: string;
    position: string;
    confidence: number;
  }>;
  /** Resolution (if resolved) */
  resolution?: {
    selectedPosition: string;
    reasoning: string;
    resolvedBy: 'synthesis' | 'voting' | 'lead';
  };
  /** Resolved? */
  resolved: boolean;
}

// ============================================================================
// Swarm Result
// ============================================================================

/**
 * Contributing agent info
 */
export interface ContributingAgent {
  id: string;
  role: string;
  contribution: string;
  confidence: number;
}

/**
 * Final result from the swarm
 */
export interface SwarmResult {
  /** Final synthesized answer */
  answer: string;
  /** Overall confidence (0-1) */
  confidence: number;
  /** Reasoning steps */
  reasoning: SwarmReasoningStep[];
  /** Contributing agents */
  contributingAgents: ContributingAgent[];
  /** Conflict resolutions */
  conflictResolutions: ConflictResolution[];
  /** Key insights */
  insights: string[];
  /** Recommendations */
  recommendations: string[];
  /** Caveats */
  caveats: string[];
  /** Token usage */
  tokenUsage: TokenUsage;
  /** Latency in ms */
  latencyMs: number;
}

// ============================================================================
// Progress Events
// ============================================================================

/**
 * Swarm progress event types
 */
export type SwarmProgressEventType =
  | 'swarm_start'
  | 'swarm_initialized'
  | 'agents_spawned'
  | 'execution_started'
  | 'agent_created'
  | 'agent_thinking'
  | 'agent_complete'
  | 'debate_round'
  | 'conflict_detection_started'
  | 'conflicts_detected'
  | 'conflict_detected'
  | 'conflict_resolved'
  | 'resolution_started'
  | 'synthesis_start'
  | 'synthesis_started'
  | 'swarm_complete'
  | 'swarm_error'
  | 'error';

/**
 * Swarm progress event
 */
export interface SwarmProgressEvent {
  /** Event type */
  type: SwarmProgressEventType;
  /** Event message */
  message: string;
  /** Current state summary */
  state: SwarmState;
  /** Related agent (if applicable) */
  agent?: SwarmAgent;
  /** Related conflict (if applicable) */
  conflict?: AgentConflict;
  /** Timestamp */
  timestamp: Date;
}

// ============================================================================
// Debate Types
// ============================================================================

/**
 * A debate round between agents
 */
export interface DebateRound {
  /** Round number */
  round: number;
  /** Participating agents */
  participants: string[];
  /** Topic being debated */
  topic: string;
  /** Arguments from each agent */
  arguments: Array<{
    agentId: string;
    argument: string;
    rebuttal?: string;
    concession?: string;
  }>;
  /** Round outcome */
  outcome: string;
}

// ============================================================================
// Agent Prompts Types
// ============================================================================

/**
 * Agent prompt input
 */
export interface AgentPromptInput {
  /** The problem to solve */
  problem: string;
  /** Agent's role */
  role: AgentRole;
  /** Shared context from other agents */
  sharedContext?: string;
  /** Specific task for this agent */
  task?: string;
  /** Insights from other agents */
  otherInsights?: string[];
  /** Concerns from other agents */
  otherConcerns?: string[];
}
