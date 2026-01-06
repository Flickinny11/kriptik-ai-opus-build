/**
 * Verification Services Index
 *
 * Exports all verification-related services for the Ultimate AI-First Builder
 */

// 6-Agent Verification Swarm (Orchestrator)
export {
    VerificationSwarm,
    createVerificationSwarm,
    type VerificationAgentType,
    type VerificationResult,
    type VerificationIssue,
    type SwarmConfig,
    type SwarmState,
    type CombinedVerificationResult,
} from './swarm.js';

// Anti-Slop Detector - Phase 7 Design System
export {
    AntiSlopDetector,
    createAntiSlopDetector,
    type AntiSlopScore,
    type AntiSlopViolation,
    type AntiSlopRule,
} from './anti-slop-detector.js';

// ============================================================================
// INDIVIDUAL VERIFICATION AGENTS (6-Agent Swarm Members)
// ============================================================================

// Agent 1: Error Checker - BLOCKING
export {
    ErrorCheckerAgent,
    createErrorCheckerAgent,
    type DetectedError,
    type ErrorCheckResult,
    type ErrorCheckerConfig,
    type ErrorSeverity,
    type ErrorCategory,
} from './error-checker.js';

// Agent 2: Code Quality - NON-BLOCKING
export {
    CodeQualityAgent,
    createCodeQualityAgent,
    type QualityIssue,
    type QualityMetrics,
    type CodeQualityResult,
    type CodeQualityConfig,
    type QualityIssueType,
    type QualityIssueSeverity,
} from './code-quality.js';

// Agent 3: Visual Verifier - BLOCKING
export {
    VisualVerifierAgent,
    createVisualVerifierAgent,
    type VisualIssue,
    type VisualVerificationResult,
    type VisualVerifierConfig,
    type VisualIssueType,
    type VisualIssueSeverity,
    type ViewportConfig,
} from './visual-verifier.js';

// Agent 4: Security Scanner - NON-BLOCKING
export {
    SecurityScannerAgent,
    createSecurityScannerAgent,
    type SecurityVulnerability,
    type SecurityScanResult,
    type SecurityScannerConfig,
    type SecurityVulnerabilityType,
    type SecuritySeverity,
} from './security-scanner.js';

// Agent 5: Placeholder Eliminator - BLOCKING
export {
    PlaceholderEliminatorAgent,
    createPlaceholderEliminatorAgent,
    type PlaceholderViolation,
    type PlaceholderScanResult,
    type PlaceholderEliminatorConfig,
    type PlaceholderType,
} from './placeholder-eliminator.js';

// Agent 6: Design Style Agent - NON-BLOCKING
export {
    DesignStyleAgent,
    createDesignStyleAgent,
    type DesignViolation,
    type DesignStyleResult,
    type DesignStyleConfig,
    type DesignPrinciple,
    type DesignViolationSeverity,
    type DesignScores,
} from './design-style-agent.js';

// ============================================================================
// ENHANCED VERIFICATION CAPABILITIES
// ============================================================================

// Gemini Video Analyzer - Real-time video understanding for browser verification
export {
    GeminiVideoAnalyzer,
    getGeminiVideoAnalyzer,
    createGeminiVideoAnalyzer,
    type VideoAnalysisConfig,
    type VideoAnalysisResult,
    type UIElement,
    type Interaction,
    type VideoFrame,
} from './gemini-video-analyzer.js';

// ============================================================================
// GPU VERIFICATION (PROMPT 7) - GPU Build Loop Integration
// ============================================================================

// GPU Verification Service - Endpoint health, cost validation, performance checks
export {
    GPUVerificationService,
    createGPUVerificationService,
    type GPUVerificationAgentType,
    type GPUVerificationResult,
    type GPUVerificationIssue,
    type GPUMetrics,
    type GPUVerificationConfig,
    type CombinedGPUVerificationResult,
} from './gpu-verification.js';
