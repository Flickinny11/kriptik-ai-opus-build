/**
 * Core Services - Three-Mode Architecture
 *
 * Exports shared execution context and utilities for:
 * - Builder Mode
 * - Developer Mode
 * - Agents Mode
 */

export {
    type ExecutionMode,
    type ExecutionContext,
    type ExecutionContextConfig,
    createExecutionContext,
    createBuilderContext,
    createDeveloperContext,
    createAgentsContext,
    getOrCreateContext,
    getContext,
    shutdownAllContexts,
} from './execution-context.js';

