/**
 * Debug Services - Runtime context for error analysis
 */

export {
    RuntimeDebugContextService,
    getRuntimeDebugContext,
    createRuntimeDebugContext,
    type RuntimeError,
    type DebugSession,
    type DebugHypothesis,
    type VariableState,
    type ExecutionFrame,
    type NetworkRequest,
    type InstrumentationConfig,
} from './runtime-debug-context.js';

// V-JEPA 2 Debug Enhancement
export {
    VJEPA2DebugEnhancer,
    getVJEPA2DebugEnhancer,
    resetVJEPA2DebugEnhancer,
    type VisualDebugFrame,
    type VisualDebugTimeline,
    type VisualErrorAnalysis,
    type EnhancedDebugSession,
} from './vjepa2-debug-enhancer.js';
