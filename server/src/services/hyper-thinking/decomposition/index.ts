/**
 * Task Decomposition Module
 *
 * Exports for the task decomposition engine.
 */

// Types
export * from './types.js';

// Strategies
export {
  FunctionalDecomposition,
  DataFlowDecomposition,
  ArchitecturalDecomposition,
  TemporalDecomposition,
  HybridDecomposition,
  getDecompositionStrategy,
  selectBestStrategy,
  type IDecompositionStrategy,
} from './strategies.js';

// Dependency Analyzer
export {
  DependencyAnalyzer,
  createDependencyAnalyzer,
} from './dependency-analyzer.js';

// Engine
export {
  DecompositionEngine,
  getDecompositionEngine,
  createDecompositionEngine,
  resetDecompositionEngine,
} from './engine.js';
