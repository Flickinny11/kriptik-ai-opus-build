/**
 * Multi-Agent Reasoning Swarm
 *
 * Exports for the multi-agent reasoning system.
 */

// Types
export * from './types.js';

// Agent Factory
export { AgentFactory, createAgentFactory } from './agent-factory.js';

// Agent Coordinator
export { AgentCoordinator, createAgentCoordinator } from './coordinator.js';

// Conflict Resolution
export {
  ConflictDetector,
  ConflictResolver,
  createConflictDetector,
  createConflictResolver,
} from './conflict-resolution.js';
export type { ConflictDetectionResult, ResolutionStrategy } from './conflict-resolution.js';

// Synthesis
export { SwarmSynthesisEngine, createSwarmSynthesisEngine } from './synthesis.js';
export type { SynthesisInput, SynthesizedOutput } from './synthesis.js';

// Swarm Engine
export {
  SwarmEngine,
  getSwarmEngine,
  createSwarmEngine,
  resetSwarmEngine,
} from './swarm-engine.js';
export type { SwarmEngineOptions, ReasoningSwarmInput } from './swarm-engine.js';
