/**
 * Developer Mode Services
 *
 * Services for managing Developer Mode functionality:
 * - Individual agent management
 * - Multi-agent orchestration
 * - Verification mode scaling
 * - Credit calculation
 * - Git integration
 * - Sandbox environments
 */

// Agent Service - Individual agent management
export {
    DeveloperModeAgentService,
    getDeveloperModeAgentService,
    createDeveloperModeAgentService,
    type AgentStatus,
    type AgentModel,
    type AgentConfig,
    type AgentTaskConfig,
    type AgentProgress,
    type AgentLogEntry,
    type Agent,
} from './agent-service.js';

// Orchestrator - Multi-agent coordination
export {
    DeveloperModeOrchestrator,
    getDeveloperModeOrchestrator,
    createDeveloperModeOrchestrator,
    type SessionStatus,
    type VerificationMode,
    type SessionConfig,
    type Session,
    type DeployAgentRequest,
    type MergeQueueItem,
} from './orchestrator.js';

// Verification Mode Scaling - Flexible verification levels
export {
    VerificationModeScaler,
    getVerificationModeScaler,
    createVerificationModeScaler,
    VERIFICATION_MODES,
    type VerificationModeConfig,
    type VerificationAgentConfig,
    type ScaledVerificationResult,
} from './verification-modes.js';

// Credit Calculator - Cost tracking and estimation
export {
    CreditCalculatorService,
    createCreditCalculator,
    MODEL_PRICING,
    type ModelPricing,
    type CostEstimate,
    type UsageRecord,
    type UsageSummary,
    type CreditBalance,
} from './credit-calculator.js';

// Git Branch Manager - Worktree isolation
export {
    GitBranchManager,
    createGitBranchManager,
    type WorktreeConfig,
    type BranchInfo,
    type WorktreeInfo,
    type CommitInfo,
    type MergeResult,
    type PRInfo,
} from './git-branch-manager.js';

// Sandbox Service - Preview environments
export {
    SandboxService,
    createSandboxService,
    type SandboxConfig,
    type SandboxInstance,
    type SandboxStatus,
} from './sandbox-service.js';

// PR Integration - Pull request creation
export {
    PRIntegrationService,
    createPRIntegrationService,
    type PRProvider,
    type PRProviderConfig,
    type PRCreateRequest,
    type PRResponse,
    type PRUpdateRequest,
} from './pr-integration.js';

// Feature Agent Types - Higher-level orchestration UI/state
export type {
    FeatureAgentConfig,
    FeatureAgentStatus,
    ImplementationPlan,
    ImplementationPhase,
    PhaseStep,
    RequiredCredential,
    GhostModeAgentConfig,
} from './types.js';

