/**
 * AI Services Module
 *
 * Exports all AI-related services for KripTik
 */

// Core AI services
export * from './helicone-client.js';
export * from './claude-service.js';

// Model routing (OpenRouter) - use explicit exports to avoid conflicts
export {
    ModelRouter,
    getModelRouter,
    resetModelRouter,
    analyzeTask,
    MODELS,
    type ModelConfig,
    type ModelTier,
    type RouterConfig,
    type GenerationRequest,
    type GenerationResponse as RouterGenerationResponse,
    type TaskAnalysis,
} from './model-router.js';

// Specialized AI capabilities
export * from './image-to-code.js';
export * from './self-healing.js';
export * from './test-generator.js';

// Context Loading & Memory Harness (Anthropic-style)
export {
    loadProjectContext,
    formatContextForPrompt,
    formatContextSummary,
    hasProjectContext,
    getMissingArtifacts,
    parseProgressLog,
    ARTIFACT_PATHS,
    type LoadedContext,
    type ContextLoadOptions,
    type TaskItem as ContextTaskItem,
    type TaskListState as ContextTaskListState,
    type CurrentTask as ContextCurrentTask,
    type FeatureItem,
    type FeatureListState,
    type BuildState as ContextBuildState,
    type IntentContract,
    type VerificationEntry,
    type IssueResolution as ContextIssueResolution,
    type ProgressEntry,
} from './context-loader.js';

// Git Integration Helper
export {
    initializeGitRepo,
    hasGitRepo,
    getGitLog,
    getGitLogOneline,
    getGitDiff,
    getGitDiffFull,
    getFileDiff,
    hasUncommittedChanges,
    getGitStatus,
    commitChanges,
    commitFiles,
    getLastCommitHash,
    getLastCommitShortHash,
    getCurrentBranch,
    createBranch,
    checkoutBranch,
    generateGitignore,
    resetToCommit,
    stashChanges,
    popStash,
    getFileAtCommit,
    type GitLogEntry,
    type GitStatus,
    type GitCommitResult,
} from './git-helper.js';

// Artifact Management (Enhanced)
export {
    ArtifactManager,
    createArtifactManager,
    createSessionLogEntry,
    type SessionLog,
    type BuildState,
    type IssueResolution,
    type VerificationHistoryEntry,
    type ProjectArtifacts,
    type TaskItem,
    type TaskListState,
    type CurrentTask,
    type ProgressEntry as ArtifactProgressEntry,
    type GitAwareSnapshot,
} from './artifacts.js';

