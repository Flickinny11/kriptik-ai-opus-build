/**
 * Swarm Engine
 * 
 * Main orchestrator for multi-agent reasoning swarm.
 * Coordinates agent spawning, execution, conflict resolution, and synthesis.
 */

import type {
  SwarmConfig,
  SwarmResult,
  SwarmAgent,
  AgentResult,
  SwarmProgressEvent,
  SwarmState,
  DebateRound,
} from './types.js';
import { AgentFactory } from './agent-factory.js';
import { AgentCoordinator } from './coordinator.js';
import { ConflictDetector, ConflictResolver } from './conflict-resolution.js';
import { SwarmSynthesisEngine } from './synthesis.js';
import { DEFAULT_SWARM_CONFIG } from './types.js';

// ============================================================================
// Types
// ============================================================================

export interface SwarmEngineOptions {
  config?: Partial<SwarmConfig>;
  onProgress?: (event: SwarmProgressEvent) => void;
}

export interface ReasoningSwarmInput {
  problem: string;
  context?: string;
  customAgents?: Array<{
    role: string;
    systemPrompt?: string;
    modelTier?: SwarmAgent['modelTier'];
  }>;
}

// ============================================================================
// Swarm Engine Class
// ============================================================================

export class SwarmEngine {
  private config: SwarmConfig;
  private agentFactory: AgentFactory;
  private coordinator: AgentCoordinator;
  private conflictDetector: ConflictDetector;
  private conflictResolver: ConflictResolver;
  private synthesisEngine: SwarmSynthesisEngine;
  private onProgress?: (event: SwarmProgressEvent) => void;
  
  // State tracking
  private agents: SwarmAgent[] = [];
  private results: AgentResult[] = [];
  private debateRounds: DebateRound[] = [];
  private state: SwarmState = {
    phase: 'initializing',
    agentsActive: 0,
    agentsComplete: 0,
    conflictsDetected: 0,
    progress: 0,
  };
  
  constructor(options: SwarmEngineOptions = {}) {
    this.config = { ...DEFAULT_SWARM_CONFIG, ...options.config };
    this.onProgress = options.onProgress;
    
    this.agentFactory = new AgentFactory(this.config);
    this.coordinator = new AgentCoordinator(this.config);
    this.conflictDetector = new ConflictDetector(this.config);
    this.conflictResolver = new ConflictResolver(this.config);
    this.synthesisEngine = new SwarmSynthesisEngine(this.config);
  }
  
  /**
   * Execute multi-agent reasoning swarm
   */
  async reason(input: ReasoningSwarmInput): Promise<SwarmResult> {
    const startTime = Date.now();
    
    try {
      // Phase 1: Initialize agents
      this.updateState('initializing', 0.05);
      this.emitProgress('swarm_initialized', 'Initializing reasoning swarm');
      
      if (input.customAgents && input.customAgents.length > 0) {
        // Use custom agent configurations
        this.agents = input.customAgents.map(ca => 
          this.agentFactory.createAgent(
            ca.role,
            ca.systemPrompt,
            ca.modelTier || 'deep'
          )
        );
      } else {
        // Spawn default agent team
        this.agents = this.agentFactory.spawnTeam(input.problem);
      }
      
      this.emitProgress('agents_spawned', `Spawned ${this.agents.length} reasoning agents`);
      
      // Phase 2: Parallel agent execution
      this.updateState('parallel_reasoning', 0.1, this.agents.length, 0);
      this.emitProgress('execution_started', 'Starting parallel agent execution');
      
      this.results = await this.coordinator.executeParallel(
        this.agents,
        input.problem,
        input.context,
        (event) => {
          this.onProgress?.(event);
          if (event.type === 'agent_complete') {
            this.state.agentsComplete++;
            this.state.progress = 0.1 + (0.4 * this.state.agentsComplete / this.agents.length);
          }
        }
      );
      
      // Phase 3: Conflict detection
      this.updateState('conflict_detection', 0.55);
      this.emitProgress('conflict_detection_started', 'Analyzing for conflicts');
      
      const conflictResult = await this.conflictDetector.detectConflicts(this.results);
      this.state.conflictsDetected = conflictResult.conflicts.length;
      
      this.emitProgress(
        'conflicts_detected',
        `Detected ${conflictResult.conflicts.length} conflicts (${conflictResult.severity} severity)`
      );
      
      // Phase 4: Run debates if significant conflicts exist
      if (conflictResult.severity !== 'none' && this.config.debateRounds > 0) {
        this.updateState('debate', 0.6);
        
        for (let round = 1; round <= this.config.debateRounds; round++) {
          // Select agents for debate based on conflicts
          const debatingAgents = this.selectDebatingAgents(conflictResult.conflicts);
          
          if (debatingAgents.length >= 2) {
            const debateRound = await this.coordinator.runDebate(
              debatingAgents,
              input.problem,
              conflictResult.summary,
              round,
              this.onProgress
            );
            this.debateRounds.push(debateRound);
          }
        }
      }
      
      // Phase 5: Conflict resolution
      this.updateState('resolution', 0.7);
      this.emitProgress('resolution_started', 'Resolving conflicts');
      
      const resolutions = await this.conflictResolver.resolveConflicts(
        conflictResult.conflicts,
        this.results,
        input.problem,
        this.config.conflictResolution
      );
      
      // Phase 6: Synthesis
      this.updateState('synthesis', 0.85);
      this.emitProgress('synthesis_started', 'Synthesizing final answer');
      
      const swarmResult = await this.synthesisEngine.synthesize({
        problem: input.problem,
        results: this.results,
        conflicts: conflictResult.conflicts,
        resolutions,
        sharedContext: input.context,
      });
      
      // Finalize
      this.updateState('complete', 1.0);
      swarmResult.latencyMs = Date.now() - startTime;
      
      this.emitProgress('swarm_complete', 'Multi-agent reasoning complete');
      
      return swarmResult;
      
    } catch (error) {
      this.updateState('error', this.state.progress);
      this.emitProgress('swarm_error', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
  
  /**
   * Execute with streaming progress
   */
  async *reasonStream(input: ReasoningSwarmInput): AsyncGenerator<SwarmProgressEvent | SwarmResult> {
    const events: SwarmProgressEvent[] = [];
    let result: SwarmResult | null = null;
    
    const wrappedEngine = new SwarmEngine({
      config: this.config,
      onProgress: (event) => {
        events.push(event);
      },
    });
    
    // Start reasoning in background
    const reasoningPromise = wrappedEngine.reason(input).then(r => {
      result = r;
    });
    
    // Yield events as they come
    let lastEventIndex = 0;
    while (result === null) {
      // Check for new events
      while (lastEventIndex < events.length) {
        yield events[lastEventIndex];
        lastEventIndex++;
      }
      
      // Small delay to prevent tight loop
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Yield any remaining events
    while (lastEventIndex < events.length) {
      yield events[lastEventIndex];
      lastEventIndex++;
    }
    
    // Wait for promise to complete and yield result
    await reasoningPromise;
    
    if (result) {
      yield result;
    }
  }
  
  /**
   * Get current swarm state
   */
  getState(): SwarmState {
    return { ...this.state };
  }
  
  /**
   * Get all agents
   */
  getAgents(): SwarmAgent[] {
    return [...this.agents];
  }
  
  /**
   * Get all results
   */
  getResults(): AgentResult[] {
    return [...this.results];
  }
  
  /**
   * Get debate history
   */
  getDebates(): DebateRound[] {
    return [...this.debateRounds];
  }
  
  /**
   * Update state and emit progress
   */
  private updateState(
    phase: SwarmState['phase'],
    progress: number,
    agentsActive: number = this.state.agentsActive,
    agentsComplete: number = this.state.agentsComplete
  ): void {
    this.state = {
      phase,
      progress,
      agentsActive,
      agentsComplete,
      conflictsDetected: this.state.conflictsDetected,
    };
  }
  
  /**
   * Emit progress event
   */
  private emitProgress(type: SwarmProgressEvent['type'], message: string): void {
    this.onProgress?.({
      type,
      message,
      state: { ...this.state },
      timestamp: new Date(),
    });
  }
  
  /**
   * Select agents for debate based on conflicts
   */
  private selectDebatingAgents(conflicts: Array<{ agents: string[] }>): SwarmAgent[] {
    // Get unique agent IDs involved in conflicts
    const involvedAgentIds = new Set(
      conflicts.flatMap(c => c.agents)
    );
    
    // Return agents involved in conflicts
    return this.agents.filter(a => involvedAgentIds.has(a.id));
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

let defaultSwarmEngine: SwarmEngine | null = null;

/**
 * Get or create default swarm engine
 */
export function getSwarmEngine(options?: SwarmEngineOptions): SwarmEngine {
  if (!defaultSwarmEngine) {
    defaultSwarmEngine = new SwarmEngine(options);
  }
  return defaultSwarmEngine;
}

/**
 * Create new swarm engine
 */
export function createSwarmEngine(options?: SwarmEngineOptions): SwarmEngine {
  return new SwarmEngine(options);
}

/**
 * Reset default swarm engine
 */
export function resetSwarmEngine(): void {
  defaultSwarmEngine = null;
}

export default SwarmEngine;
