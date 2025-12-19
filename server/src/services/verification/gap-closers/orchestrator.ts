/**
 * Gap Closer Orchestrator
 *
 * Coordinates all gap-closing verification agents to ensure production readiness.
 * Integrates with:
 * - VerificationSwarm (existing 6-agent system)
 * - EnhancedBuildLoop (Cursor 2.1+ features)
 * - BuildLoopOrchestrator (6-phase build)
 * - FeatureAgentService (feature implementation)
 *
 * The orchestrator runs gap closers at appropriate phases:
 * - Stage 1 (Frontend): Accessibility, basic error states
 * - Stage 2 (Backend): Performance, exploratory testing
 * - Stage 3 (Production): ALL gap closers at full strictness
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type { Page, Browser, BrowserContext } from 'playwright';

import {
    createAccessibilityVerifier,
    type AccessibilityResult,
} from './accessibility-verifier.js';

import {
    createAdversarialTester,
    type AdversarialResult,
} from './adversarial-tester.js';

import {
    createErrorStateTester,
    type ErrorStateResult,
} from './error-state-tester.js';

import {
    createPerformanceVerifier,
    type PerformanceResult,
} from './performance-verifier.js';

import {
    createCrossBrowserTester,
    type CrossBrowserResult,
} from './cross-browser-tester.js';

import {
    createExploratoryTester,
    type ExploratoryResult,
} from './exploratory-tester.js';

import {
    createRealDataEnforcer,
    type RealDataResult,
} from './real-data-enforcer.js';

import {
    type GapCloserResults,
    type GapCloserConfig,
    DEFAULT_GAP_CLOSER_CONFIG,
    calculateAggregateScore,
    aggregateIssues,
    generateGapCloserSummary,
} from './index.js';

// =============================================================================
// TYPES
// =============================================================================

export type GapCloserPhase = 'pre-build' | 'during-build' | 'post-build' | 'pre-deploy';

export interface GapCloserRunContext {
    buildId: string;
    projectId: string;
    userId: string;
    projectPath: string;
    previewUrl: string;
    stage: 'stage1' | 'stage2' | 'stage3';
    phase: GapCloserPhase;
    browser?: Browser;
    page?: Page;
    context?: BrowserContext;
}

export interface GapCloserEvent {
    type: 'started' | 'agent_started' | 'agent_completed' | 'agent_failed' | 'completed' | 'failed';
    buildId: string;
    agent?: string;
    result?: any;
    error?: string;
    timestamp: Date;
}

// =============================================================================
// STAGE-BASED CONFIGURATION
// =============================================================================

/**
 * Get gap closer configuration based on build stage
 * Stage 1: Basic checks (accessibility, error states)
 * Stage 2: Extended checks (performance, exploratory)
 * Stage 3: Full production checks (ALL agents)
 */
function getStageConfig(stage: 'stage1' | 'stage2' | 'stage3'): GapCloserConfig {
    switch (stage) {
        case 'stage1':
            return {
                ...DEFAULT_GAP_CLOSER_CONFIG,
                enableAccessibility: true,
                enableAdversarial: false,
                enableErrorState: true,
                enablePerformance: false,
                enableCrossBrowser: false,
                enableExploratory: false,
                enableRealData: false, // Mock data OK in stage 1
                stage: 'stage1',
            };

        case 'stage2':
            return {
                ...DEFAULT_GAP_CLOSER_CONFIG,
                enableAccessibility: true,
                enableAdversarial: true,
                enableErrorState: true,
                enablePerformance: true,
                enableCrossBrowser: false, // Too resource intensive for stage 2
                enableExploratory: true,
                enableRealData: false, // Mock data still OK in stage 2
                stage: 'stage2',
            };

        case 'stage3':
            return {
                ...DEFAULT_GAP_CLOSER_CONFIG,
                enableAccessibility: true,
                enableAdversarial: true,
                enableErrorState: true,
                enablePerformance: true,
                enableCrossBrowser: true, // Full browser matrix
                enableExploratory: true,
                enableRealData: true, // MUST have real data
                stage: 'stage3',
            };
    }
}

// =============================================================================
// GAP CLOSER ORCHESTRATOR
// =============================================================================

export class GapCloserOrchestrator extends EventEmitter {
    private buildId: string;
    private config: GapCloserConfig;
    private isRunning: boolean = false;

    constructor(buildId: string, stage: 'stage1' | 'stage2' | 'stage3' = 'stage3') {
        super();
        this.buildId = buildId;
        this.config = getStageConfig(stage);
    }

    /**
     * Run all enabled gap closers
     */
    async run(context: GapCloserRunContext): Promise<GapCloserResults> {
        if (this.isRunning) {
            throw new Error('Gap closer orchestrator is already running');
        }

        this.isRunning = true;
        const startTime = Date.now();

        console.log(`[GapCloserOrchestrator] Starting gap closers for build ${context.buildId}`);
        console.log(`[GapCloserOrchestrator] Stage: ${context.stage}, Phase: ${context.phase}`);

        this.emitEvent('started', context.buildId);

        const results: GapCloserResults = {
            overallScore: 100,
            overallPassed: true,
            criticalIssues: 0,
            highIssues: 0,
            mediumIssues: 0,
            lowIssues: 0,
            summary: [],
            timestamp: new Date(),
            duration: 0,
        };

        try {
            // Run agents based on configuration
            const agentPromises: Promise<void>[] = [];

            if (this.config.enableAccessibility && context.page) {
                agentPromises.push(this.runAccessibility(context, results));
            }

            if (this.config.enableAdversarial && context.page && context.context) {
                agentPromises.push(this.runAdversarial(context, results));
            }

            if (this.config.enableErrorState && context.page) {
                agentPromises.push(this.runErrorState(context, results));
            }

            if (this.config.enablePerformance && context.page) {
                agentPromises.push(this.runPerformance(context, results));
            }

            if (this.config.enableCrossBrowser) {
                agentPromises.push(this.runCrossBrowser(context, results));
            }

            if (this.config.enableExploratory && context.page && context.context) {
                agentPromises.push(this.runExploratory(context, results));
            }

            if (this.config.enableRealData) {
                agentPromises.push(this.runRealData(context, results));
            }

            // Run in parallel or sequentially based on config
            if (this.config.parallelExecution) {
                await Promise.allSettled(agentPromises);
            } else {
                for (const promise of agentPromises) {
                    await promise;
                }
            }

            // Calculate final metrics
            const issues = aggregateIssues(results);
            results.criticalIssues = issues.critical;
            results.highIssues = issues.high;
            results.mediumIssues = issues.medium;
            results.lowIssues = issues.low;
            results.overallScore = calculateAggregateScore(results);
            results.overallPassed = issues.critical === 0 && results.overallScore >= 70;
            results.summary = generateGapCloserSummary(results).map(s => ({
                domain: s.split(':')[0],
                score: parseInt(s.match(/(\d+)\/100/)?.[1] || '0'),
                passed: !s.includes('FAILED'),
                issues: parseInt(s.match(/\((\d+)/)?.[1] || '0'),
            }));
            results.duration = Date.now() - startTime;

            console.log(`[GapCloserOrchestrator] Complete: score=${results.overallScore}, passed=${results.overallPassed}`);
            this.emitEvent('completed', context.buildId, undefined, results);

        } catch (error: any) {
            console.error('[GapCloserOrchestrator] Fatal error:', error);
            results.overallPassed = false;
            results.duration = Date.now() - startTime;
            this.emitEvent('failed', context.buildId, undefined, undefined, error.message);
        }

        this.isRunning = false;
        return results;
    }

    // =========================================================================
    // INDIVIDUAL AGENT RUNNERS
    // =========================================================================

    private async runAccessibility(context: GapCloserRunContext, results: GapCloserResults): Promise<void> {
        this.emitEvent('agent_started', context.buildId, 'accessibility');

        try {
            const verifier = createAccessibilityVerifier(context.buildId);
            const result = await verifier.verify(context.page!, context.previewUrl);
            results.accessibility = result;
            this.emitEvent('agent_completed', context.buildId, 'accessibility', result);
        } catch (error: any) {
            console.error('[GapCloser] Accessibility failed:', error);
            this.emitEvent('agent_failed', context.buildId, 'accessibility', undefined, error.message);
        }
    }

    private async runAdversarial(context: GapCloserRunContext, results: GapCloserResults): Promise<void> {
        this.emitEvent('agent_started', context.buildId, 'adversarial');

        try {
            const tester = createAdversarialTester(context.buildId);
            const result = await tester.test(context.page!, context.context!, context.previewUrl);
            results.adversarial = result;
            this.emitEvent('agent_completed', context.buildId, 'adversarial', result);
        } catch (error: any) {
            console.error('[GapCloser] Adversarial failed:', error);
            this.emitEvent('agent_failed', context.buildId, 'adversarial', undefined, error.message);
        }
    }

    private async runErrorState(context: GapCloserRunContext, results: GapCloserResults): Promise<void> {
        this.emitEvent('agent_started', context.buildId, 'errorState');

        try {
            const tester = createErrorStateTester(context.buildId);
            const result = await tester.test(context.page!, context.previewUrl);
            results.errorState = result;
            this.emitEvent('agent_completed', context.buildId, 'errorState', result);
        } catch (error: any) {
            console.error('[GapCloser] ErrorState failed:', error);
            this.emitEvent('agent_failed', context.buildId, 'errorState', undefined, error.message);
        }
    }

    private async runPerformance(context: GapCloserRunContext, results: GapCloserResults): Promise<void> {
        this.emitEvent('agent_started', context.buildId, 'performance');

        try {
            const verifier = createPerformanceVerifier(context.buildId);
            const result = await verifier.verify(context.page!, context.previewUrl);
            results.performance = result;
            this.emitEvent('agent_completed', context.buildId, 'performance', result);
        } catch (error: any) {
            console.error('[GapCloser] Performance failed:', error);
            this.emitEvent('agent_failed', context.buildId, 'performance', undefined, error.message);
        }
    }

    private async runCrossBrowser(context: GapCloserRunContext, results: GapCloserResults): Promise<void> {
        this.emitEvent('agent_started', context.buildId, 'crossBrowser');

        try {
            const tester = createCrossBrowserTester(context.buildId);
            const result = await tester.test(context.previewUrl);
            results.crossBrowser = result;
            this.emitEvent('agent_completed', context.buildId, 'crossBrowser', result);
        } catch (error: any) {
            console.error('[GapCloser] CrossBrowser failed:', error);
            this.emitEvent('agent_failed', context.buildId, 'crossBrowser', undefined, error.message);
        }
    }

    private async runExploratory(context: GapCloserRunContext, results: GapCloserResults): Promise<void> {
        this.emitEvent('agent_started', context.buildId, 'exploratory');

        try {
            const tester = createExploratoryTester(context.buildId, {
                maxDuration: 60000, // 1 minute for orchestrated runs
                maxActions: 100,
            });
            const result = await tester.explore(context.page!, context.context!, context.previewUrl);
            results.exploratory = result;
            this.emitEvent('agent_completed', context.buildId, 'exploratory', result);
        } catch (error: any) {
            console.error('[GapCloser] Exploratory failed:', error);
            this.emitEvent('agent_failed', context.buildId, 'exploratory', undefined, error.message);
        }
    }

    private async runRealData(context: GapCloserRunContext, results: GapCloserResults): Promise<void> {
        this.emitEvent('agent_started', context.buildId, 'realData');

        try {
            const enforcer = createRealDataEnforcer(context.buildId, {
                stage: context.stage,
            });
            const result = await enforcer.enforce(context.projectPath, context.page);
            results.realData = result;
            this.emitEvent('agent_completed', context.buildId, 'realData', result);
        } catch (error: any) {
            console.error('[GapCloser] RealData failed:', error);
            this.emitEvent('agent_failed', context.buildId, 'realData', undefined, error.message);
        }
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    private emitEvent(
        type: GapCloserEvent['type'],
        buildId: string,
        agent?: string,
        result?: any,
        error?: string
    ): void {
        const event: GapCloserEvent = {
            type,
            buildId,
            agent,
            result,
            error,
            timestamp: new Date(),
        };
        this.emit(type, event);
        this.emit('gap_closer_event', event);
    }

    /**
     * Get current configuration
     */
    getConfig(): GapCloserConfig {
        return { ...this.config };
    }

    /**
     * Update configuration
     */
    setConfig(config: Partial<GapCloserConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Check if orchestrator is currently running
     */
    isActive(): boolean {
        return this.isRunning;
    }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createGapCloserOrchestrator(
    buildId: string,
    stage: 'stage1' | 'stage2' | 'stage3' = 'stage3'
): GapCloserOrchestrator {
    return new GapCloserOrchestrator(buildId, stage);
}

// =============================================================================
// INTEGRATION HELPERS
// =============================================================================

/**
 * Quick gap check for feature verification
 * Runs a subset of gap closers appropriate for the current stage
 */
export async function runQuickGapCheck(
    buildId: string,
    projectPath: string,
    previewUrl: string,
    page: Page,
    context: BrowserContext,
    stage: 'stage1' | 'stage2' | 'stage3' = 'stage2'
): Promise<GapCloserResults> {
    const orchestrator = createGapCloserOrchestrator(buildId, stage);

    // For quick checks, reduce exploratory testing
    orchestrator.setConfig({
        enableCrossBrowser: false, // Too slow for quick checks
        timeout: 60000, // 1 minute max
    });

    return await orchestrator.run({
        buildId,
        projectId: '', // Not needed for quick check
        userId: '',
        projectPath,
        previewUrl,
        stage,
        phase: 'during-build',
        page,
        context,
    });
}

/**
 * Full production gap check
 * Runs ALL gap closers with maximum strictness
 */
export async function runProductionGapCheck(
    buildId: string,
    projectId: string,
    userId: string,
    projectPath: string,
    previewUrl: string,
    page: Page,
    context: BrowserContext
): Promise<GapCloserResults> {
    const orchestrator = createGapCloserOrchestrator(buildId, 'stage3');

    return await orchestrator.run({
        buildId,
        projectId,
        userId,
        projectPath,
        previewUrl,
        stage: 'stage3',
        phase: 'pre-deploy',
        page,
        context,
    });
}

/**
 * Generate a production readiness report
 */
export function generateProductionReadinessReport(results: GapCloserResults): string {
    const lines: string[] = [
        `# Production Readiness Report`,
        ``,
        `## Overall Assessment`,
        `- **Score**: ${results.overallScore}/100`,
        `- **Status**: ${results.overallPassed ? 'READY FOR PRODUCTION' : 'NOT READY'}`,
        `- **Duration**: ${(results.duration / 1000).toFixed(1)}s`,
        ``,
        `## Issue Summary`,
        `- Critical: ${results.criticalIssues}`,
        `- High: ${results.highIssues}`,
        `- Medium: ${results.mediumIssues}`,
        `- Low: ${results.lowIssues}`,
        ``,
        `## Domain Scores`,
    ];

    for (const s of results.summary) {
        lines.push(`- **${s.domain}**: ${s.score}/100 (${s.passed ? 'PASS' : 'FAIL'}, ${s.issues} issues)`);
    }

    // Blocking issues
    if (results.criticalIssues > 0) {
        lines.push(``, `## BLOCKING ISSUES`);
        lines.push(`There are ${results.criticalIssues} critical issues that must be resolved before deployment.`);

        if (results.adversarial?.vulnerabilities.filter(v => v.severity === 'critical').length) {
            lines.push(`- Security vulnerabilities detected`);
        }
        if (results.realData?.violations.filter(v => v.severity === 'critical').length) {
            lines.push(`- Mock data detected in production code`);
        }
        if (results.accessibility?.violations.filter(v => v.impact === 'critical').length) {
            lines.push(`- Critical accessibility violations`);
        }
    }

    // Recommendations
    lines.push(``, `## Recommendations`);
    if (results.overallPassed) {
        lines.push(`The application meets production readiness requirements.`);
        if (results.highIssues > 0) {
            lines.push(`However, consider addressing ${results.highIssues} high-priority issues before launch.`);
        }
    } else {
        lines.push(`Address all critical issues before deploying to production.`);
        lines.push(`Focus on:`);
        if (results.adversarial && !results.adversarial.passed) {
            lines.push(`- Security hardening`);
        }
        if (results.accessibility && !results.accessibility.passed) {
            lines.push(`- Accessibility compliance`);
        }
        if (results.realData && !results.realData.passed) {
            lines.push(`- Removing mock data and connecting real APIs`);
        }
        if (results.errorState && !results.errorState.passed) {
            lines.push(`- Error state handling`);
        }
    }

    return lines.join('\n');
}
