/**
 * Context Services Exports
 *
 * This module provides enterprise-grade context management with:
 * - User Context: User preferences and session management
 * - Context Lock: Hard rules for context reading/writing
 * - Hindsight Memory: 4-network AI-native memory architecture
 *
 * December 2025 Features:
 * - SHA-256 based context verification (zero token overhead)
 * - Immutable context contracts
 * - Phase-gated progression
 * - Cross-network memory queries
 */

export {
    UserContextService,
    getUserContextService,
    type UserContextMemory,
    type UserPreferences,
    type DecisionRecord,
    type CodePattern,
    type FeedbackRecord,
    type SessionSnapshot,
    type ContextSharingSettings,
} from './user-context.js';

export {
    ContextGate,
    ContextViolationError,
    createContextGate,
    createSoftContextGate,
    type ContextLock,
    type ContextState,
    type ContextHash,
    type ContextViolation,
    type ContextRule,
    type ContextRequirement,
    type ArtifactRequirement,
} from './context-lock.js';

export {
    HindsightMemory,
    createHindsightMemory,
    getHindsightMemory,
    clearHindsightMemory,
    type HindsightMemoryState,
    type WorldFactsNetwork,
    type AgentExperiencesNetwork,
    type EntitySummariesNetwork,
    type EvolvingBeliefsNetwork,
    type AntiSlopRule,
    type AppSoulDefinition,
    type ProjectConstraint,
    type TechnicalRequirement,
    type DecisionEntry,
    type ToolCallEntry,
    type ErrorRecoveryEntry,
    type PhaseHistoryEntry,
    type CodeChangeEntry,
    type ComponentRelation,
    type IntegrationPoint,
    type QualityMetric,
    type QualityThreshold,
    type ApproachPreference,
    type RiskAssessment,
    type ConfidenceScore,
} from './hindsight-memory.js';

