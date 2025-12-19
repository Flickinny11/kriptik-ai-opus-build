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
