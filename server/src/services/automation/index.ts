/**
 * Automation Services Index
 *
 * Exports all automation-related services for the "Approve and Watch" feature
 */

export {
    BrowserAutomationService,
    createBrowserAutomationService,
    type ConsoleLog,
    type NetworkRequest,
    type BrowserActionResult,
    type BrowserConfig,
    type ElementInfo,
} from './browser-service.js';

export {
    BuildMonitorService,
    createBuildMonitorService,
    type BuildError,
    type Fix,
    type FixAttempt,
    type BuildLog,
    type BuildResult,
    type BuildMonitorConfig,
    type DeploymentProvider,
} from './build-monitor.js';

export {
    VisualVerificationService,
    createVisualVerificationService,
    type VisualIssue,
    type VisualVerificationResult,
    type ComponentVerificationResult,
    type DesignAnalysis,
} from './visual-verifier.js';

export {
    AutonomousBuildController,
    createAutonomousBuildController,
    getAutonomousBuildController,
    type BuildPhase,
    type CredentialRequest,
    type VerificationStep,
    type FeaturePlan,
    type ImplementationPlan,
    type AutonomousBuildState,
    type BuildEvent,
} from './autonomous-controller.js';

// =============================================================================
// ULTIMATE AI-FIRST BUILDER - 6-Phase Build Loop
// =============================================================================

export {
    BuildLoopOrchestrator,
    createBuildLoopOrchestrator,
    startBuildLoop,
    type BuildLoopPhase,
    type BuildStage,
    type BuildMode,
    type BuildLoopConfig,
    type BuildLoopState,
    type BuildLoopEvent,
    // SESSION 5: Runtime options for autonomous mode control
    type BuildLoopOptions,
} from './build-loop.js';

// =============================================================================
// ULTIMATE AI-FIRST BUILDER - 4-Level Error Escalation
// =============================================================================

export {
    ErrorEscalationEngine,
    createErrorEscalationEngine,
    type EscalationLevel,
    type ErrorCategory,
    type BuildError as EscalationBuildError,
    type Fix as EscalationFix,
    type FileChange,
    type EscalationConfig,
    type EscalationState,
    type EscalationResult,
} from './error-escalation.js';

// =============================================================================
// BUILD FREEZE SERVICE - Pause/Resume with Full Context Preservation
// =============================================================================

export {
    BuildFreezeService,
    getBuildFreezeService,
    createBuildFreezeService,
    type FreezeReason,
    type FreezeContext,
    type ResumeContext,
    type FrozenBuild,
    type FileState,
    type TaskProgress,
    type FreezeServiceEvent,
} from './build-freeze-service.js';

// =============================================================================
// BUILD LOOP BRIDGE - Bi-directional Integration Between Enhanced & Main Loops
// =============================================================================

export {
    BuildLoopBridge,
    getOrCreateBridge,
    getBridge,
    cleanupBridge,
    type BridgeState,
    type BridgeEvent,
} from './build-loop-bridge.js';
