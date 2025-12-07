/**
 * Verification Mode Scaling Service
 *
 * Provides different levels of verification for Developer Mode agents.
 * Unlike Ultimate Builder which always runs the full 6-agent swarm,
 * Developer Mode allows users to choose their verification level:
 *
 * - Quick: Fast check (error + placeholder only)
 * - Standard: Balanced (+ code quality + security)
 * - Thorough: Detailed (+ visual + design style)
 * - Full Swarm: Complete 6-agent verification
 *
 * This allows faster iteration for simple tasks while still
 * providing comprehensive verification when needed.
 */

import { EventEmitter } from 'events';
import { createVerificationSwarm } from '../verification/swarm.js';
import type { IntentContract, IntentAppSoul } from '../ai/intent-lock.js';

// =============================================================================
// TYPES
// =============================================================================

export type VerificationMode = 'quick' | 'standard' | 'thorough' | 'full_swarm';

export interface VerificationModeConfig {
    name: string;
    description: string;
    agents: VerificationAgentConfig[];
    estimatedTimeMs: number;
    estimatedCredits: number;
    minScoreForPass: number;
}

export interface VerificationAgentConfig {
    type: 'error_checker' | 'code_quality' | 'visual_verifier' | 'security_scanner' | 'placeholder_eliminator' | 'design_style';
    enabled: boolean;
    required: boolean; // If true, must pass for overall pass
    weight: number; // Weight in overall score (0-1)
}

export interface ScaledVerificationResult {
    mode: VerificationMode;
    passed: boolean;
    overallScore: number;
    verdict: 'APPROVED' | 'NEEDS_WORK' | 'BLOCKED' | 'REJECTED';
    results: {
        [key: string]: {
            passed: boolean;
            score: number;
            blocking: boolean;
            issues: string[];
        } | null;
    };
    blockers: string[];
    warnings: string[];
    estimatedCreditsUsed: number;
    durationMs: number;
}

// =============================================================================
// MODE CONFIGURATIONS
// =============================================================================

export const VERIFICATION_MODES: Record<VerificationMode, VerificationModeConfig> = {
    quick: {
        name: 'Quick Check',
        description: 'Fast verification for simple changes. Checks for errors and placeholders only.',
        agents: [
            { type: 'error_checker', enabled: true, required: true, weight: 0.6 },
            { type: 'placeholder_eliminator', enabled: true, required: true, weight: 0.4 },
            { type: 'code_quality', enabled: false, required: false, weight: 0 },
            { type: 'visual_verifier', enabled: false, required: false, weight: 0 },
            { type: 'security_scanner', enabled: false, required: false, weight: 0 },
            { type: 'design_style', enabled: false, required: false, weight: 0 },
        ],
        estimatedTimeMs: 5000,
        estimatedCredits: 2,
        minScoreForPass: 70,
    },
    standard: {
        name: 'Standard Verification',
        description: 'Balanced verification including code quality and security checks.',
        agents: [
            { type: 'error_checker', enabled: true, required: true, weight: 0.35 },
            { type: 'placeholder_eliminator', enabled: true, required: true, weight: 0.15 },
            { type: 'code_quality', enabled: true, required: false, weight: 0.25 },
            { type: 'security_scanner', enabled: true, required: false, weight: 0.25 },
            { type: 'visual_verifier', enabled: false, required: false, weight: 0 },
            { type: 'design_style', enabled: false, required: false, weight: 0 },
        ],
        estimatedTimeMs: 20000,
        estimatedCredits: 8,
        minScoreForPass: 75,
    },
    thorough: {
        name: 'Thorough Verification',
        description: 'Comprehensive verification including visual checks and design style.',
        agents: [
            { type: 'error_checker', enabled: true, required: true, weight: 0.25 },
            { type: 'placeholder_eliminator', enabled: true, required: true, weight: 0.1 },
            { type: 'code_quality', enabled: true, required: false, weight: 0.2 },
            { type: 'security_scanner', enabled: true, required: false, weight: 0.15 },
            { type: 'visual_verifier', enabled: true, required: false, weight: 0.15 },
            { type: 'design_style', enabled: true, required: false, weight: 0.15 },
        ],
        estimatedTimeMs: 60000,
        estimatedCredits: 25,
        minScoreForPass: 80,
    },
    full_swarm: {
        name: 'Full Swarm Verification',
        description: 'Complete 6-agent verification swarm. Maximum quality assurance.',
        agents: [
            { type: 'error_checker', enabled: true, required: true, weight: 0.2 },
            { type: 'placeholder_eliminator', enabled: true, required: true, weight: 0.1 },
            { type: 'code_quality', enabled: true, required: true, weight: 0.2 },
            { type: 'security_scanner', enabled: true, required: true, weight: 0.15 },
            { type: 'visual_verifier', enabled: true, required: false, weight: 0.15 },
            { type: 'design_style', enabled: true, required: true, weight: 0.2 },
        ],
        estimatedTimeMs: 120000,
        estimatedCredits: 50,
        minScoreForPass: 85,
    },
};

// =============================================================================
// VERIFICATION MODE SCALER
// =============================================================================

export class VerificationModeScaler extends EventEmitter {
    /**
     * Get configuration for a verification mode
     */
    getModeConfig(mode: VerificationMode): VerificationModeConfig {
        return VERIFICATION_MODES[mode];
    }

    /**
     * Get all available modes
     */
    getAllModes(): Array<{ mode: VerificationMode; config: VerificationModeConfig }> {
        return Object.entries(VERIFICATION_MODES).map(([mode, config]) => ({
            mode: mode as VerificationMode,
            config,
        }));
    }

    /**
     * Run scaled verification based on mode
     */
    async runVerification(
        mode: VerificationMode,
        projectId: string,
        orchestrationRunId: string,
        feature: {
            id: string;
            description: string;
            files: string[];
        },
        code: Map<string, string>,
        intentContract?: IntentContract
    ): Promise<ScaledVerificationResult> {
        const startTime = Date.now();
        const config = this.getModeConfig(mode);

        this.emit('verification:started', { mode, featureId: feature.id });

        const results: ScaledVerificationResult['results'] = {};
        const blockers: string[] = [];
        const warnings: string[] = [];
        let totalScore = 0;
        let totalWeight = 0;
        let allRequiredPassed = true;
        let creditsUsed = 0;

        // Run enabled agents
        for (const agentConfig of config.agents) {
            if (!agentConfig.enabled) {
                results[agentConfig.type] = null;
                continue;
            }

            try {
                const agentResult = await this.runAgent(
                    agentConfig.type,
                    projectId,
                    orchestrationRunId,
                    feature,
                    code,
                    intentContract
                );

                results[agentConfig.type] = {
                    passed: agentResult.passed,
                    score: agentResult.score,
                    blocking: agentConfig.required && !agentResult.passed,
                    issues: agentResult.issues,
                };

                // Calculate weighted score
                if (agentConfig.weight > 0) {
                    totalScore += agentResult.score * agentConfig.weight;
                    totalWeight += agentConfig.weight;
                }

                // Track blocking issues
                if (agentConfig.required && !agentResult.passed) {
                    allRequiredPassed = false;
                    blockers.push(`${agentConfig.type}: ${agentResult.issues.join(', ')}`);
                } else if (!agentResult.passed) {
                    warnings.push(`${agentConfig.type}: ${agentResult.issues.join(', ')}`);
                }

                // Track credit usage (rough estimate per agent)
                creditsUsed += this.getAgentCreditCost(agentConfig.type);

                this.emit('verification:agent-complete', {
                    mode,
                    featureId: feature.id,
                    agentType: agentConfig.type,
                    passed: agentResult.passed,
                    score: agentResult.score,
                });

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                results[agentConfig.type] = {
                    passed: false,
                    score: 0,
                    blocking: agentConfig.required,
                    issues: [errorMessage],
                };

                if (agentConfig.required) {
                    allRequiredPassed = false;
                    blockers.push(`${agentConfig.type}: ${errorMessage}`);
                }
            }
        }

        // Calculate final score
        const overallScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
        const passed = allRequiredPassed && overallScore >= config.minScoreForPass;

        // Determine verdict
        let verdict: ScaledVerificationResult['verdict'];
        if (blockers.length > 0) {
            verdict = 'BLOCKED';
        } else if (!passed) {
            verdict = 'NEEDS_WORK';
        } else if (overallScore >= 90) {
            verdict = 'APPROVED';
        } else {
            verdict = 'APPROVED';
        }

        const durationMs = Date.now() - startTime;

        const result: ScaledVerificationResult = {
            mode,
            passed,
            overallScore,
            verdict,
            results,
            blockers,
            warnings,
            estimatedCreditsUsed: creditsUsed,
            durationMs,
        };

        this.emit('verification:completed', { mode, featureId: feature.id, result });

        return result;
    }

    /**
     * Run a single verification agent
     */
    private async runAgent(
        agentType: string,
        projectId: string,
        orchestrationRunId: string,
        feature: { id: string; description: string; files: string[] },
        code: Map<string, string>,
        intentContract?: IntentContract
    ): Promise<{ passed: boolean; score: number; issues: string[] }> {
        // Use the existing verification swarm agents
        const userId = 'developer-mode'; // System user for developer mode verification
        const swarm = createVerificationSwarm(orchestrationRunId, projectId, userId);

        // Create a feature object for the swarm
        const now = new Date().toISOString();
        const featureObj = {
            id: feature.id,
            buildIntentId: 'developer-mode-intent',
            orchestrationRunId,
            projectId,
            featureId: feature.id,
            category: 'functional' as const,
            description: feature.description,
            priority: 1,
            implementationSteps: [],
            visualRequirements: [],
            filesModified: feature.files,
            passes: false,
            assignedAgent: null,
            assignedAt: null,
            verificationStatus: {
                errorCheck: 'pending' as const,
                codeQuality: 'pending' as const,
                visualVerify: 'pending' as const,
                placeholderCheck: 'pending' as const,
                designStyle: 'pending' as const,
                securityScan: 'pending' as const,
            },
            verificationScores: null,
            buildAttempts: 0,
            lastBuildAt: null,
            passedAt: null,
            createdAt: now,
            updatedAt: now,
        };

        // Run verification
        const result = await swarm.verifyFeature(featureObj, code);

        // Extract the specific agent's result
        switch (agentType) {
            case 'error_checker':
                return {
                    passed: result.results.errorCheck?.passed ?? false,
                    score: result.results.errorCheck?.score ?? 0,
                    issues: result.results.errorCheck?.issues.map(i => i.description) ?? [],
                };
            case 'code_quality':
                return {
                    passed: result.results.codeQuality?.passed ?? true,
                    score: result.results.codeQuality?.score ?? 80,
                    issues: result.results.codeQuality?.issues.map(i => i.description) ?? [],
                };
            case 'visual_verifier':
                return {
                    passed: result.results.visualVerify?.passed ?? true,
                    score: result.results.visualVerify?.score ?? 80,
                    issues: result.results.visualVerify?.issues.map(i => i.description) ?? [],
                };
            case 'security_scanner':
                return {
                    passed: result.results.securityScan?.passed ?? true,
                    score: result.results.securityScan?.score ?? 100,
                    issues: result.results.securityScan?.issues.map(i => i.description) ?? [],
                };
            case 'placeholder_eliminator':
                return {
                    passed: result.results.placeholderCheck?.passed ?? false,
                    score: result.results.placeholderCheck?.passed ? 100 : 0,
                    issues: result.results.placeholderCheck?.issues.map(i => i.description) ?? [],
                };
            case 'design_style':
                return {
                    passed: result.results.designStyle?.passed ?? true,
                    score: result.results.designStyle?.score ?? 80,
                    issues: result.results.designStyle?.issues.map(i => i.description) ?? [],
                };
            default:
                return { passed: true, score: 80, issues: [] };
        }
    }

    /**
     * Create a minimal intent contract for standalone verification
     */
    private createMinimalIntent(): IntentContract {
        return {
            id: 'minimal-intent',
            projectId: 'unknown',
            userId: 'unknown',
            appType: 'utility',
            appSoul: 'utility' as IntentAppSoul,
            coreValueProp: 'Utility application',
            successCriteria: [],
            userWorkflows: [],
            visualIdentity: {
                soul: 'utility' as IntentAppSoul,
                primaryEmotion: 'clarity',
                depthLevel: 'medium',
                motionPhilosophy: 'subtle',
            },
            antiPatterns: [],
            locked: false,
            originalPrompt: '',
            generatedBy: 'developer-mode',
            thinkingTokensUsed: 0,
            createdAt: new Date().toISOString(),
        };
    }

    /**
     * Get credit cost for each agent type
     */
    private getAgentCreditCost(agentType: string): number {
        const costs: Record<string, number> = {
            error_checker: 1,
            placeholder_eliminator: 1,
            code_quality: 3,
            security_scanner: 3,
            visual_verifier: 8,
            design_style: 10,
        };
        return costs[agentType] || 2;
    }

    /**
     * Recommend a verification mode based on task characteristics
     */
    recommendMode(taskCharacteristics: {
        filesChanged: number;
        isVisualChange: boolean;
        isSecuritySensitive: boolean;
        hasNewComponents: boolean;
        userPreference?: VerificationMode;
    }): VerificationMode {
        // If user has a preference, respect it
        if (taskCharacteristics.userPreference) {
            return taskCharacteristics.userPreference;
        }

        // Security-sensitive changes should use full swarm
        if (taskCharacteristics.isSecuritySensitive) {
            return 'full_swarm';
        }

        // Visual changes or new components need thorough checking
        if (taskCharacteristics.isVisualChange || taskCharacteristics.hasNewComponents) {
            return 'thorough';
        }

        // Many files changed suggests more comprehensive check
        if (taskCharacteristics.filesChanged > 5) {
            return 'standard';
        }

        // Simple changes can use quick check
        if (taskCharacteristics.filesChanged <= 2) {
            return 'quick';
        }

        return 'standard';
    }
}

// =============================================================================
// FACTORY
// =============================================================================

let scaler: VerificationModeScaler | null = null;

export function getVerificationModeScaler(): VerificationModeScaler {
    if (!scaler) {
        scaler = new VerificationModeScaler();
    }
    return scaler;
}

export function createVerificationModeScaler(): VerificationModeScaler {
    return new VerificationModeScaler();
}

