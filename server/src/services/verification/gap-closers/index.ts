/**
 * Gap Closers - Production Readiness Verification Suite
 *
 * These agents work together to close the "Last 20% Gap" - the critical
 * difference between what AI can produce and what's truly production-ready.
 *
 * Architecture:
 * - Each agent focuses on a specific verification domain
 * - All agents can run independently or in coordination
 * - Results are aggregated into a unified quality score
 * - Integration with BuildLoopOrchestrator for automated verification
 *
 * Gap Closers:
 * 1. AccessibilityVerificationAgent - WCAG 2.1 AA compliance
 * 2. AdversarialTestingAgent - Security and robustness testing
 * 3. ErrorStateTestingAgent - Error handling completeness
 * 4. PerformanceVerificationAgent - Core Web Vitals and memory
 * 5. CrossBrowserTestingAgent - Browser matrix compatibility
 * 6. ExploratoryTestingAgent - Autonomous edge case discovery
 * 7. RealDataIntegrationEnforcer - Mock data elimination
 */

// =============================================================================
// EXPORTS
// =============================================================================

export {
    AccessibilityVerificationAgent,
    createAccessibilityVerifier,
    type AccessibilityResult,
    type AccessibilityConfig,
    type AccessibilityViolation,
} from './accessibility-verifier.js';

export {
    AdversarialTestingAgent,
    createAdversarialTester,
    type AdversarialResult,
    type AdversarialConfig,
    type AdversarialVulnerability,
    type AdversarialTestType,
} from './adversarial-tester.js';

export {
    ErrorStateTestingAgent,
    createErrorStateTester,
    type ErrorStateResult,
    type ErrorStateConfig,
    type ErrorStateIssue,
    type ErrorStateType,
} from './error-state-tester.js';

export {
    PerformanceVerificationAgent,
    createPerformanceVerifier,
    type PerformanceResult,
    type PerformanceConfig,
    type PerformanceIssue,
    type CoreWebVitals,
    type MemoryMetrics,
} from './performance-verifier.js';

export {
    CrossBrowserTestingAgent,
    createCrossBrowserTester,
    type CrossBrowserResult,
    type CrossBrowserConfig,
    type CrossBrowserIssue,
    type BrowserName,
    type BrowserTestResult,
} from './cross-browser-tester.js';

export {
    ExploratoryTestingAgent,
    createExploratoryTester,
    type ExploratoryResult,
    type ExploratoryConfig,
    type ExploratoryFinding,
} from './exploratory-tester.js';

export {
    RealDataIntegrationEnforcer,
    createRealDataEnforcer,
    type RealDataResult,
    type RealDataConfig,
    type MockDataViolation,
    type MockDataViolationType,
} from './real-data-enforcer.js';

export {
    GapCloserOrchestrator,
    createGapCloserOrchestrator,
    runQuickGapCheck,
    runProductionGapCheck,
    generateProductionReadinessReport,
    type GapCloserRunContext,
    type GapCloserEvent,
    type GapCloserPhase,
} from './orchestrator.js';

// =============================================================================
// V-JEPA 2 ENHANCED VERIFIERS (Phases 6-8)
// =============================================================================

export {
    // Visual Semantic Verifier (Phase 6)
    VisualSemanticVerifier,
    getVisualSemanticVerifier,
    createVisualSemanticVerifier,
    resetVisualSemanticVerifier,
    type VisualSemanticVerifierConfig,
    type VisualSemanticResult,

    // Temporal State Verifier (Phase 7)
    TemporalStateVerifier,
    getTemporalStateVerifier,
    createTemporalStateVerifier,
    resetTemporalStateVerifier,
    type TemporalStateVerifierConfig,
    type TemporalStateResult,

    // Backend Implementation Verifier (Phase 8)
    BackendImplementationVerifier,
    getBackendVerifier,
    createBackendVerifier,
    resetBackendVerifier,
    type BackendVerifierConfig,
    type BackendVerificationResult,

    // Common types
    type VerificationSeverity,
    type VerificationIssue,
    type BaseVerificationResult,
} from './vjepa2-verifiers.js';

// =============================================================================
// COMBINED TYPES
// =============================================================================

import type { AccessibilityResult, AccessibilityViolation } from './accessibility-verifier.js';
import type { AdversarialResult } from './adversarial-tester.js';
import type { ErrorStateResult } from './error-state-tester.js';
import type { PerformanceResult } from './performance-verifier.js';
import type { CrossBrowserResult } from './cross-browser-tester.js';
import type { ExploratoryResult } from './exploratory-tester.js';
import type { RealDataResult } from './real-data-enforcer.js';

/**
 * Combined result from all gap closers
 */
export interface GapCloserResults {
    accessibility?: AccessibilityResult;
    adversarial?: AdversarialResult;
    errorState?: ErrorStateResult;
    performance?: PerformanceResult;
    crossBrowser?: CrossBrowserResult;
    exploratory?: ExploratoryResult;
    realData?: RealDataResult;

    // Aggregated metrics
    overallScore: number;
    overallPassed: boolean;
    criticalIssues: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;

    // Summary
    summary: {
        domain: string;
        score: number;
        passed: boolean;
        issues: number;
    }[];

    timestamp: Date;
    duration: number;
}

/**
 * Configuration for running gap closers
 */
export interface GapCloserConfig {
    enableAccessibility: boolean;
    enableAdversarial: boolean;
    enableErrorState: boolean;
    enablePerformance: boolean;
    enableCrossBrowser: boolean;
    enableExploratory: boolean;
    enableRealData: boolean;
    stage: 'stage1' | 'stage2' | 'stage3';
    parallelExecution: boolean;
    timeout: number;
}

/**
 * Default configuration for gap closers
 */
export const DEFAULT_GAP_CLOSER_CONFIG: GapCloserConfig = {
    enableAccessibility: true,
    enableAdversarial: true,
    enableErrorState: true,
    enablePerformance: true,
    enableCrossBrowser: false, // Disabled by default due to resource intensity
    enableExploratory: true,
    enableRealData: true,
    stage: 'stage3',
    parallelExecution: true,
    timeout: 300000, // 5 minutes
};

// =============================================================================
// AGGREGATE SCORING
// =============================================================================

/**
 * Calculate aggregate score from all gap closer results
 */
export function calculateAggregateScore(results: GapCloserResults): number {
    const scores: number[] = [];
    const weights: Record<string, number> = {
        accessibility: 1.5,  // WCAG compliance is critical
        adversarial: 2.0,    // Security is most important
        errorState: 1.2,     // Error handling important
        performance: 1.3,    // Performance affects UX
        crossBrowser: 1.0,   // Compatibility important
        exploratory: 1.0,    // Edge cases matter
        realData: 1.5,       // No mock data in production
    };

    if (results.accessibility) {
        scores.push(results.accessibility.score * weights.accessibility);
    }
    if (results.adversarial) {
        scores.push(results.adversarial.score * weights.adversarial);
    }
    if (results.errorState) {
        scores.push(results.errorState.score * weights.errorState);
    }
    if (results.performance) {
        scores.push(results.performance.score * weights.performance);
    }
    if (results.crossBrowser) {
        scores.push(results.crossBrowser.score * weights.crossBrowser);
    }
    if (results.exploratory) {
        scores.push(results.exploratory.score * weights.exploratory);
    }
    if (results.realData) {
        scores.push(results.realData.score * weights.realData);
    }

    if (scores.length === 0) {
        return 0;
    }

    const totalWeight = Object.values(weights)
        .filter((_, i) => i < scores.length)
        .reduce((a, b) => a + b, 0);

    return Math.round(scores.reduce((a, b) => a + b, 0) / totalWeight);
}

/**
 * Aggregate issue counts from all results
 */
export function aggregateIssues(results: GapCloserResults): {
    critical: number;
    high: number;
    medium: number;
    low: number;
} {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };

    const countBySeverity = (items: Array<{ severity: string }>) => {
        items.forEach((item) => {
            if (item.severity in counts) {
                counts[item.severity as keyof typeof counts]++;
            }
        });
    };

    if (results.accessibility?.violations) {
        countBySeverity(results.accessibility.violations.map((v: AccessibilityViolation) => ({
            severity: v.impact === 'critical' ? 'critical' : v.impact === 'serious' ? 'high' : v.impact === 'moderate' ? 'medium' : 'low'
        })));
    }

    if (results.adversarial?.vulnerabilities) {
        countBySeverity(results.adversarial.vulnerabilities);
    }

    if (results.errorState?.issues) {
        countBySeverity(results.errorState.issues);
    }

    if (results.performance?.issues) {
        countBySeverity(results.performance.issues);
    }

    if (results.crossBrowser?.issues) {
        countBySeverity(results.crossBrowser.issues);
    }

    if (results.exploratory?.findings) {
        countBySeverity(results.exploratory.findings);
    }

    if (results.realData?.violations) {
        countBySeverity(results.realData.violations);
    }

    return counts;
}

/**
 * Generate summary for all gap closers
 */
export function generateGapCloserSummary(results: GapCloserResults): string[] {
    const summaries: string[] = [];

    if (results.accessibility) {
        summaries.push(`Accessibility: ${results.accessibility.score}/100 (${results.accessibility.violations.length} violations)`);
    }
    if (results.adversarial) {
        summaries.push(`Security: ${results.adversarial.score}/100 (${results.adversarial.vulnerabilities.length} vulnerabilities)`);
    }
    if (results.errorState) {
        summaries.push(`Error Handling: ${results.errorState.score}/100 (${results.errorState.issues.length} issues)`);
    }
    if (results.performance) {
        summaries.push(`Performance: ${results.performance.score}/100 (${results.performance.issues.length} issues)`);
    }
    if (results.crossBrowser) {
        summaries.push(`Cross-Browser: ${results.crossBrowser.score}/100 (${results.crossBrowser.issues.length} issues)`);
    }
    if (results.exploratory) {
        summaries.push(`Exploratory: ${results.exploratory.score}/100 (${results.exploratory.findings.length} findings)`);
    }
    if (results.realData) {
        summaries.push(`Real Data: ${results.realData.score}/100 (${results.realData.violations.length} violations)`);
    }

    return summaries;
}
