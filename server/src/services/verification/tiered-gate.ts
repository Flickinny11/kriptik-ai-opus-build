/**
 * Tiered Verification Gate System
 *
 * Phase 2: Smart Verification Gating (Tiered)
 *
 * KripTik is meant to complete the entire app without needing to stop.
 * The verification loop is a GATE - nothing moves forward until verified.
 *
 * Tier 1 (Instant): Runs continuously during build
 * - Error Checker: TypeScript/ESLint errors (blocking)
 * - Placeholder Eliminator: Zero tolerance (blocking)
 *
 * Tier 2 (Depth-Adaptive): Runs at feature completion
 * - Security Scanner: Vulnerabilities (blocking on critical/high)
 * - Code Quality: Patterns and practices (85+ required)
 * - Visual Verifier: Anti-slop, design quality (85+ required)
 * - Design Style: Soul matching (85+ required)
 *
 * Gate Status:
 * - OPEN: All tiers passed, can proceed
 * - BLOCKED: One or more checks failed, must fix
 * - PENDING: Verification in progress
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
    VerificationSwarm,
    type VerificationAgentType,
    type CombinedVerificationResult,
    type SwarmMode,
    type QuickVerificationResults,
} from './swarm.js';
import type { Feature } from '../ai/feature-list.js';
import type { IntentContract } from '../ai/intent-lock.js';

// =============================================================================
// TYPES
// =============================================================================

export type GateStatus = 'OPEN' | 'BLOCKED' | 'PENDING' | 'NOT_STARTED';

export type TierLevel = 'TIER_1' | 'TIER_2';

export interface TierConfig {
    level: TierLevel;
    agents: VerificationAgentType[];
    isBlocking: boolean;
    minScore: number;
    runContinuously: boolean;
    intervalMs?: number;
}

export interface TierResult {
    level: TierLevel;
    passed: boolean;
    score: number;
    blockers: string[];
    agentResults: Map<VerificationAgentType, AgentResult>;
    timestamp: Date;
    durationMs: number;
}

export interface AgentResult {
    agent: VerificationAgentType;
    passed: boolean;
    score: number | null;
    issues: string[];
    isBlocker: boolean;
    timestamp: Date;
}

export interface GateState {
    status: GateStatus;
    tier1: TierResult | null;
    tier2: TierResult | null;
    currentFeatureId: string | null;
    lastGateCheck: Date | null;
    blockedSince: Date | null;
    consecutiveBlockedCount: number;
    totalGateChecks: number;
    totalBlockedEvents: number;
}

export interface GateCheckResult {
    gateId: string;
    status: GateStatus;
    canProceed: boolean;
    blockers: string[];
    tier1Result: TierResult | null;
    tier2Result: TierResult | null;
    recommendations: string[];
    estimatedTimeToUnblock: number | null; // in seconds
}

// =============================================================================
// TIER CONFIGURATIONS
// =============================================================================

export const TIER_1_CONFIG: TierConfig = {
    level: 'TIER_1',
    agents: ['error_checker', 'placeholder_eliminator'],
    isBlocking: true, // ALWAYS blocks on failure
    minScore: 100, // Must be perfect
    runContinuously: true,
    intervalMs: 5000, // Every 5 seconds during builds
};

export const TIER_2_CONFIG: TierConfig = {
    level: 'TIER_2',
    agents: ['security_scanner', 'code_quality', 'visual_verifier', 'design_style'],
    isBlocking: true, // Blocks on critical/high severity
    minScore: 85, // 85+ required to pass
    runContinuously: false,
    // Runs at feature completion
};

// =============================================================================
// TIERED VERIFICATION GATE
// =============================================================================

export class TieredVerificationGate extends EventEmitter {
    private projectId: string;
    private userId: string;
    private orchestrationRunId: string;
    private swarm: VerificationSwarm;
    private intent: IntentContract | null = null;
    private state: GateState;
    private tier1Interval: NodeJS.Timeout | null = null;
    private isRunning: boolean = false;
    private projectPath: string;

    constructor(
        projectId: string,
        userId: string,
        orchestrationRunId: string,
        projectPath: string = `/tmp/builds/${projectId}`
    ) {
        super();
        this.projectId = projectId;
        this.userId = userId;
        this.orchestrationRunId = orchestrationRunId;
        this.projectPath = projectPath;
        this.swarm = new VerificationSwarm(orchestrationRunId, projectId, userId, {}, projectPath);

        this.state = {
            status: 'NOT_STARTED',
            tier1: null,
            tier2: null,
            currentFeatureId: null,
            lastGateCheck: null,
            blockedSince: null,
            consecutiveBlockedCount: 0,
            totalGateChecks: 0,
            totalBlockedEvents: 0,
        };
    }

    /**
     * Set the Intent Contract for verification
     */
    setIntent(intent: IntentContract): void {
        this.intent = intent;
        this.swarm.setIntent(intent);
    }

    /**
     * Set project path for verification
     */
    setProjectPath(path: string): void {
        this.projectPath = path;
        this.swarm.setProjectPath(path);
    }

    /**
     * Start continuous Tier 1 verification
     * Runs every 5 seconds during active builds
     */
    startContinuousVerification(): void {
        if (this.isRunning) return;

        this.isRunning = true;
        this.state.status = 'PENDING';

        console.log('[TieredGate] Starting continuous Tier 1 verification');

        // Run immediately
        this.runTier1Check();

        // Then on interval
        this.tier1Interval = setInterval(() => {
            this.runTier1Check();
        }, TIER_1_CONFIG.intervalMs);

        this.emit('gate_started', { tier: 'TIER_1' });
    }

    /**
     * Stop continuous verification
     */
    stopContinuousVerification(): void {
        if (this.tier1Interval) {
            clearInterval(this.tier1Interval);
            this.tier1Interval = null;
        }
        this.isRunning = false;
        console.log('[TieredGate] Stopped continuous verification');
        this.emit('gate_stopped', {});
    }

    /**
     * Run Tier 1 instant checks
     */
    private async runTier1Check(): Promise<TierResult> {
        const startTime = Date.now();
        const agentResults = new Map<VerificationAgentType, AgentResult>();
        const blockers: string[] = [];
        let passed = true;

        try {
            // Run quick verification checks
            const quickResults = await this.swarm.runQuickChecks({
                projectId: this.projectId,
                sandboxPath: this.projectPath,
                checkTypes: ['errors', 'placeholders'],
            });

            // Parse results into agent results
            if (quickResults.hasBlockers) {
                passed = false;
                blockers.push(...quickResults.blockers);
            }

            // Error checker result
            const errorIssues = quickResults.issues.filter(i =>
                i.includes('TS') || i.includes('error') || i.includes('ESLint')
            );
            agentResults.set('error_checker', {
                agent: 'error_checker',
                passed: errorIssues.length === 0,
                score: errorIssues.length === 0 ? 100 : Math.max(0, 100 - errorIssues.length * 10),
                issues: errorIssues,
                isBlocker: errorIssues.length > 0,
                timestamp: new Date(),
            });

            // Placeholder result
            const placeholderIssues = quickResults.issues.filter(i =>
                i.includes('TODO') || i.includes('FIXME') || i.includes('placeholder') ||
                i.includes('lorem') || i.includes('Coming soon')
            );
            agentResults.set('placeholder_eliminator', {
                agent: 'placeholder_eliminator',
                passed: placeholderIssues.length === 0,
                score: placeholderIssues.length === 0 ? 100 : 0,
                issues: placeholderIssues,
                isBlocker: placeholderIssues.length > 0,
                timestamp: new Date(),
            });

            if (errorIssues.length > 0) {
                passed = false;
                blockers.push(`TypeScript/ESLint: ${errorIssues.length} errors`);
            }
            if (placeholderIssues.length > 0) {
                passed = false;
                blockers.push(`Placeholders: ${placeholderIssues.length} found (ZERO TOLERANCE)`);
            }

        } catch (error) {
            console.error('[TieredGate] Tier 1 check failed:', error);
            passed = false;
            blockers.push(`Tier 1 verification error: ${(error as Error).message}`);
        }

        const tier1Result: TierResult = {
            level: 'TIER_1',
            passed,
            score: passed ? 100 : 0,
            blockers,
            agentResults,
            timestamp: new Date(),
            durationMs: Date.now() - startTime,
        };

        this.state.tier1 = tier1Result;
        this.state.lastGateCheck = new Date();
        this.state.totalGateChecks++;

        if (!passed) {
            if (this.state.status !== 'BLOCKED') {
                this.state.blockedSince = new Date();
                this.state.totalBlockedEvents++;
            }
            this.state.status = 'BLOCKED';
            this.state.consecutiveBlockedCount++;
        } else {
            this.state.consecutiveBlockedCount = 0;
            // Only set to OPEN if tier2 also passed (or not required yet)
            if (!this.state.tier2 || this.state.tier2.passed) {
                this.state.status = 'OPEN';
                this.state.blockedSince = null;
            }
        }

        this.emit('tier1_complete', tier1Result);
        return tier1Result;
    }

    /**
     * Run Tier 2 depth verification
     * Called at feature completion
     */
    async runTier2Check(feature: Feature, fileContents: Map<string, string>): Promise<TierResult> {
        const startTime = Date.now();
        const agentResults = new Map<VerificationAgentType, AgentResult>();
        const blockers: string[] = [];

        console.log(`[TieredGate] Running Tier 2 depth verification for feature: ${feature.featureId}`);
        this.state.currentFeatureId = feature.featureId;
        this.state.status = 'PENDING';

        try {
            // Run full feature verification through swarm
            const combinedResult = await this.swarm.verifyFeature(feature, fileContents);

            // Map swarm results to tier results
            const resultMap: { [key: string]: keyof CombinedVerificationResult['results'] } = {
                'security_scanner': 'securityScan',
                'code_quality': 'codeQuality',
                'visual_verifier': 'visualVerify',
                'design_style': 'designStyle',
            };

            for (const agent of TIER_2_CONFIG.agents) {
                const resultKey = resultMap[agent];
                const agentResultData = combinedResult.results[resultKey];

                if (agentResultData) {
                    const isBlocker = !agentResultData.passed ||
                        (agentResultData.score !== undefined && agentResultData.score < TIER_2_CONFIG.minScore);

                    agentResults.set(agent, {
                        agent,
                        passed: agentResultData.passed,
                        score: agentResultData.score ?? null,
                        issues: agentResultData.issues.map(i => i.description),
                        isBlocker,
                        timestamp: new Date(agentResultData.timestamp),
                    });

                    if (isBlocker) {
                        blockers.push(`${agent}: ${agentResultData.details}`);
                    }
                }
            }

            // Check combined verdict
            if (combinedResult.verdict === 'BLOCKED' || combinedResult.verdict === 'REJECTED') {
                blockers.push(...combinedResult.blockers);
            }

        } catch (error) {
            console.error('[TieredGate] Tier 2 check failed:', error);
            blockers.push(`Tier 2 verification error: ${(error as Error).message}`);
        }

        const passed = blockers.length === 0;
        const scores = Array.from(agentResults.values())
            .map(r => r.score)
            .filter((s): s is number => s !== null);
        const avgScore = scores.length > 0
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            : 0;

        const tier2Result: TierResult = {
            level: 'TIER_2',
            passed,
            score: avgScore,
            blockers,
            agentResults,
            timestamp: new Date(),
            durationMs: Date.now() - startTime,
        };

        this.state.tier2 = tier2Result;
        this.state.lastGateCheck = new Date();
        this.state.totalGateChecks++;

        if (!passed) {
            if (this.state.status !== 'BLOCKED') {
                this.state.blockedSince = new Date();
                this.state.totalBlockedEvents++;
            }
            this.state.status = 'BLOCKED';
            this.state.consecutiveBlockedCount++;
        } else {
            // Only OPEN if tier1 also passed
            if (this.state.tier1?.passed !== false) {
                this.state.status = 'OPEN';
                this.state.blockedSince = null;
                this.state.consecutiveBlockedCount = 0;
            }
        }

        this.emit('tier2_complete', tier2Result);
        return tier2Result;
    }

    /**
     * Full gate check - returns whether the build can proceed
     * This is THE gate - nothing moves forward unless this returns canProceed: true
     */
    async checkGate(feature: Feature, fileContents: Map<string, string>): Promise<GateCheckResult> {
        const gateId = uuidv4();
        const recommendations: string[] = [];
        let estimatedTimeToUnblock: number | null = null;

        console.log(`[TieredGate] Full gate check for feature: ${feature.featureId}`);

        // Run both tiers
        const tier1Result = await this.runTier1Check();
        const tier2Result = await this.runTier2Check(feature, fileContents);

        const allBlockers = [
            ...tier1Result.blockers,
            ...tier2Result.blockers,
        ];

        // Generate recommendations based on blockers
        if (tier1Result.blockers.some(b => b.includes('TypeScript'))) {
            recommendations.push('Run `npm run build` locally to see full error details');
            recommendations.push('Focus on fixing type errors first - they often cascade');
            estimatedTimeToUnblock = 60; // 1 minute per error estimate
        }

        if (tier1Result.blockers.some(b => b.includes('Placeholder'))) {
            recommendations.push('Search for TODO, FIXME, lorem ipsum in your code');
            recommendations.push('Replace placeholder content with real implementation');
            estimatedTimeToUnblock = (estimatedTimeToUnblock || 0) + 30;
        }

        if (tier2Result.blockers.some(b => b.includes('security'))) {
            recommendations.push('Check for exposed API keys and move to environment variables');
            recommendations.push('Review any dangerouslySetInnerHTML usage');
            estimatedTimeToUnblock = (estimatedTimeToUnblock || 0) + 120;
        }

        if (tier2Result.blockers.some(b => b.includes('design'))) {
            recommendations.push('Review design against Intent Contract visual identity');
            recommendations.push('Ensure minimum Anti-Slop score of 85');
            estimatedTimeToUnblock = (estimatedTimeToUnblock || 0) + 180;
        }

        const canProceed = tier1Result.passed && tier2Result.passed;
        const status: GateStatus = canProceed ? 'OPEN' : 'BLOCKED';

        this.state.status = status;

        const result: GateCheckResult = {
            gateId,
            status,
            canProceed,
            blockers: allBlockers,
            tier1Result,
            tier2Result,
            recommendations,
            estimatedTimeToUnblock: canProceed ? null : estimatedTimeToUnblock,
        };

        this.emit('gate_check_complete', result);

        // Log gate status
        if (canProceed) {
            console.log(`[TieredGate] ✅ GATE OPEN - Feature ${feature.featureId} can proceed`);
        } else {
            console.log(`[TieredGate] ❌ GATE BLOCKED - ${allBlockers.length} issues must be fixed`);
            allBlockers.forEach(b => console.log(`  - ${b}`));
        }

        return result;
    }

    /**
     * Get current gate state
     */
    getState(): GateState {
        return { ...this.state };
    }

    /**
     * Get formatted status for display
     */
    getFormattedStatus(): {
        status: GateStatus;
        message: string;
        tier1Status: string;
        tier2Status: string;
        blockerCount: number;
        isBlocked: boolean;
    } {
        const tier1Status = this.state.tier1
            ? (this.state.tier1.passed ? '✅ Passed' : `❌ ${this.state.tier1.blockers.length} blockers`)
            : '⏳ Pending';

        const tier2Status = this.state.tier2
            ? (this.state.tier2.passed ? `✅ Score: ${this.state.tier2.score}` : `❌ ${this.state.tier2.blockers.length} blockers`)
            : '⏳ Pending';

        const blockerCount = (this.state.tier1?.blockers.length || 0) + (this.state.tier2?.blockers.length || 0);

        let message = '';
        switch (this.state.status) {
            case 'OPEN':
                message = 'All verification gates passed. Build can proceed.';
                break;
            case 'BLOCKED':
                message = `${blockerCount} issues blocking progress. Fix before proceeding.`;
                break;
            case 'PENDING':
                message = 'Verification in progress...';
                break;
            case 'NOT_STARTED':
                message = 'Verification not yet started.';
                break;
        }

        return {
            status: this.state.status,
            message,
            tier1Status,
            tier2Status,
            blockerCount,
            isBlocked: this.state.status === 'BLOCKED',
        };
    }

    /**
     * Force re-verification of both tiers
     */
    async revalidate(feature: Feature, fileContents: Map<string, string>): Promise<GateCheckResult> {
        console.log('[TieredGate] Force revalidation requested');
        return this.checkGate(feature, fileContents);
    }

    /**
     * Get detailed blocker information for debugging
     */
    getBlockerDetails(): {
        tier: TierLevel;
        agent: VerificationAgentType;
        issues: string[];
        severity: 'critical' | 'high' | 'medium';
    }[] {
        const details: {
            tier: TierLevel;
            agent: VerificationAgentType;
            issues: string[];
            severity: 'critical' | 'high' | 'medium';
        }[] = [];

        if (this.state.tier1) {
            for (const [agent, result] of this.state.tier1.agentResults) {
                if (result.isBlocker) {
                    details.push({
                        tier: 'TIER_1',
                        agent,
                        issues: result.issues,
                        severity: agent === 'placeholder_eliminator' ? 'critical' : 'high',
                    });
                }
            }
        }

        if (this.state.tier2) {
            for (const [agent, result] of this.state.tier2.agentResults) {
                if (result.isBlocker) {
                    details.push({
                        tier: 'TIER_2',
                        agent,
                        issues: result.issues,
                        severity: agent === 'security_scanner' ? 'critical' : 'high',
                    });
                }
            }
        }

        return details;
    }

    /**
     * Shutdown the gate
     */
    shutdown(): void {
        this.stopContinuousVerification();
        this.removeAllListeners();
    }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create a new TieredVerificationGate instance
 */
export function createTieredGate(
    projectId: string,
    userId: string,
    orchestrationRunId: string,
    projectPath?: string
): TieredVerificationGate {
    return new TieredVerificationGate(projectId, userId, orchestrationRunId, projectPath);
}

/**
 * Get gate configuration for UI display
 */
export function getGateConfiguration(): {
    tier1: TierConfig;
    tier2: TierConfig;
    description: string;
} {
    return {
        tier1: TIER_1_CONFIG,
        tier2: TIER_2_CONFIG,
        description: 'Tiered verification ensures 100% quality. Tier 1 runs continuously, Tier 2 at feature completion. Nothing proceeds until ALL gates are OPEN.',
    };
}

export default TieredVerificationGate;
