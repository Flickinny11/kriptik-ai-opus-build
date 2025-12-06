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
} from './build-loop.js';

