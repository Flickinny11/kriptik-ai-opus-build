/**
 * Integration Services Index
 *
 * Exports for advanced orchestration and integration features.
 */

export {
    AdvancedOrchestrationService,
    getAdvancedOrchestration,
    createAdvancedOrchestration,
    shutdownOrchestration,
    shutdownAllOrchestrations,
    type AdvancedOrchestrationConfig,
    type GenerationContext,
    type InterruptCheckResult,
    type ContinuousVerificationState,
    type VideoStreamState,
    type ShadowPatternContext,
} from './advanced-orchestration.js';
