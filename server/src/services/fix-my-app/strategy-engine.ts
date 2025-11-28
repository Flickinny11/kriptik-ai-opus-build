/**
 * Strategy Engine Service
 * 
 * Determines the optimal fix strategy based on intent analysis, error timeline,
 * and code quality. Decides between repair, partial rebuild, or full rebuild.
 */

import { v4 as uuidv4 } from 'uuid';
import { createClaudeService, CLAUDE_MODELS } from '../ai/claude-service.js';
import type {
    IntentSummary,
    ImplementationGap,
    ErrorTimeline,
    CodeAnalysis,
    FixStrategy,
    FixApproach,
    StartingPoint,
    FeatureFix,
} from './types.js';

// Cost estimates per model/token (approximate)
const COST_PER_1K_OUTPUT_TOKENS = 0.015; // Sonnet 4.5 average

export class StrategyEngine {
    private claudeService: ReturnType<typeof createClaudeService>;

    constructor(userId: string, projectId: string) {
        this.claudeService = createClaudeService({
            agentType: 'planning',
            projectId,
            userId,
            systemPrompt: `You are an expert at determining the most efficient strategy to fix broken applications.
Your goal is to minimize cost and time while maximizing the chance of success.
Always preserve what's working when possible.`,
        });
    }

    /**
     * Calculate error severity score (0-100)
     */
    private calculateErrorSeverity(errorTimeline: ErrorTimeline): number {
        if (!errorTimeline.firstError) return 0;

        let score = 20; // Base score for having any error

        // Add for error count
        score += Math.min(errorTimeline.errorCount * 5, 30);

        // Add for cascading failures
        if (errorTimeline.cascadingFailures) score += 20;

        // Add for bad fixes
        score += Math.min(errorTimeline.badFixes.length * 10, 20);

        // Add for root cause severity
        const severeCauses = ['architecture', 'fundamental', 'design', 'structural'];
        if (severeCauses.some(c => errorTimeline.rootCause.toLowerCase().includes(c))) {
            score += 10;
        }

        return Math.min(score, 100);
    }

    /**
     * Calculate implementation gap severity (0-100)
     */
    private calculateGapSeverity(gaps: ImplementationGap[]): number {
        if (gaps.length === 0) return 0;

        let score = 0;

        for (const gap of gaps) {
            switch (gap.severity) {
                case 'critical': score += 20; break;
                case 'major': score += 10; break;
                case 'minor': score += 5; break;
            }

            if (gap.status === 'missing') score += 5;
            if (gap.status === 'broken') score += 10;
        }

        return Math.min(score, 100);
    }

    /**
     * Estimate time to fix a feature
     */
    private estimateFeatureFixTime(gap: ImplementationGap): number {
        const baseTime: Record<string, number> = {
            missing: 10,
            partial: 6,
            broken: 8,
            incorrect: 7,
        };

        const severityMultiplier: Record<string, number> = {
            critical: 1.5,
            major: 1.2,
            minor: 1.0,
        };

        return Math.round(
            (baseTime[gap.status] || 8) * (severityMultiplier[gap.severity] || 1.0)
        );
    }

    /**
     * Estimate cost based on estimated token usage
     */
    private estimateCost(totalMinutes: number, complexity: 'low' | 'medium' | 'high'): number {
        // Rough estimate: 1 minute of work = ~2000 output tokens
        const tokensPerMinute: Record<string, number> = {
            low: 1500,
            medium: 2000,
            high: 3000,
        };

        const tokens = totalMinutes * tokensPerMinute[complexity];
        return Math.round((tokens / 1000) * COST_PER_1K_OUTPUT_TOKENS * 100) / 100;
    }

    /**
     * Determine the optimal fix strategy
     */
    async determineStrategy(
        intent: IntentSummary,
        gaps: ImplementationGap[],
        errorTimeline: ErrorTimeline,
        codeAnalysis: CodeAnalysis
    ): Promise<FixStrategy> {
        const errorSeverity = this.calculateErrorSeverity(errorTimeline);
        const gapSeverity = this.calculateGapSeverity(gaps);
        const codeQuality = codeAnalysis.qualityScore;

        // Count critical issues
        const criticalGaps = gaps.filter(g => g.severity === 'critical');
        const hasSeriousErrors = errorSeverity > 50;
        const hasGoodRollbackPoint = !!errorTimeline.lastKnownGoodState;

        let approach: FixApproach;
        let startingPoint: StartingPoint;
        let rollbackTo: number | undefined;
        let confidence: number;
        let reasoning: string;

        // Decision tree
        if (errorSeverity < 30 && gapSeverity < 20 && codeQuality > 60) {
            // Minor issues - simple repair
            approach = 'repair';
            startingPoint = 'current';
            confidence = 0.9;
            reasoning = 'Minor issues detected. Can be fixed by targeted repairs without major changes.';
        } else if (hasGoodRollbackPoint && errorSeverity < 60 && 
                   errorTimeline.lastKnownGoodState!.messageNumber > 10) {
            // Moderate issues with good rollback point
            approach = 'rebuild_partial';
            startingPoint = 'rollback_version';
            rollbackTo = errorTimeline.lastKnownGoodState!.messageNumber;
            confidence = 0.85;
            reasoning = `Found a good rollback point at message ${rollbackTo} where the app was working. Will restore to that state and re-implement fixes correctly.`;
        } else if (codeQuality > 50 && criticalGaps.length < 3 && !hasSeriousErrors) {
            // Decent code quality, fixable issues
            approach = 'rebuild_partial';
            startingPoint = 'current';
            confidence = 0.8;
            reasoning = 'Code quality is acceptable. Will preserve working UI/components and fix broken features.';
        } else if (codeQuality > 30 && intent.designPreferences.mentions.length > 0) {
            // User invested in design - preserve it
            approach = 'rebuild_partial';
            startingPoint = 'current';
            confidence = 0.75;
            reasoning = 'User has invested in the design. Will preserve UI/styling and rebuild functionality.';
        } else {
            // Severe issues - full rebuild
            approach = 'rebuild_full';
            startingPoint = 'clean_slate';
            confidence = 0.95;
            reasoning = 'Severe issues require a fresh start. Will rebuild from the original intent using best practices.';
        }

        // Calculate what to preserve
        // Note: gaps only contains features that are NOT fully implemented
        // Working features are derived from intent minus gaps
        const gapFeatureNames = new Set(gaps.map(g => g.featureName.toLowerCase()));
        const allFeatures = [...intent.primaryFeatures, ...intent.secondaryFeatures];
        const workingFeatureNames = allFeatures
            .filter(f => !gapFeatureNames.has(f.name.toLowerCase()))
            .map(f => f.name);

        const preserve = {
            uiDesign: approach !== 'rebuild_full' && codeQuality > 40,
            componentStructure: approach === 'repair',
            styling: codeQuality > 30 || intent.designPreferences.mentions.length > 0,
            workingFeatures: workingFeatureNames,
        };

        // Create feature fix list - all gaps need fixing
        const featuresToFix: FeatureFix[] = gaps.map(gap => ({
            featureId: gap.featureId,
            featureName: gap.featureName,
            fixType: gap.status === 'missing' ? 'implement' : gap.status === 'broken' ? 'repair' : 'rewrite',
            description: gap.suggestedFix,
            estimatedMinutes: this.estimateFeatureFixTime(gap),
        }));

        // Calculate total time
        const baseTime: Record<FixApproach, number> = {
            repair: 5,
            rebuild_partial: 10,
            rebuild_full: 20,
        };
        const totalMinutes = baseTime[approach] + featuresToFix.reduce((sum, f) => sum + f.estimatedMinutes, 0);

        // Estimate cost
        const complexity = approach === 'rebuild_full' ? 'high' : approach === 'rebuild_partial' ? 'medium' : 'low';
        const estimatedCost = this.estimateCost(totalMinutes, complexity);

        return {
            approach,
            startingPoint,
            rollbackTo,
            preserve,
            featuresToFix,
            estimatedTimeMinutes: totalMinutes,
            estimatedCost,
            confidence,
            reasoning,
        };
    }

    /**
     * Generate alternative strategies
     */
    async generateAlternatives(
        primaryStrategy: FixStrategy,
        intent: IntentSummary,
        gaps: ImplementationGap[],
        errorTimeline: ErrorTimeline
    ): Promise<FixStrategy[]> {
        const alternatives: FixStrategy[] = [];

        // If primary is repair, offer partial rebuild as alternative
        if (primaryStrategy.approach === 'repair') {
            alternatives.push({
                ...primaryStrategy,
                approach: 'rebuild_partial',
                startingPoint: 'current',
                estimatedTimeMinutes: Math.round(primaryStrategy.estimatedTimeMinutes * 1.5),
                estimatedCost: Math.round(primaryStrategy.estimatedCost * 1.5 * 100) / 100,
                confidence: Math.min(primaryStrategy.confidence + 0.05, 0.95),
                reasoning: 'Alternative: Partial rebuild will be more thorough but take longer.',
            });
        }

        // If rollback available, always offer it as alternative
        if (errorTimeline.lastKnownGoodState && primaryStrategy.startingPoint !== 'rollback_version') {
            alternatives.push({
                ...primaryStrategy,
                approach: 'rebuild_partial',
                startingPoint: 'rollback_version',
                rollbackTo: errorTimeline.lastKnownGoodState.messageNumber,
                confidence: 0.85,
                reasoning: `Alternative: Rollback to message ${errorTimeline.lastKnownGoodState.messageNumber} and rebuild from known working state.`,
            });
        }

        // If not full rebuild, offer it as nuclear option
        if (primaryStrategy.approach !== 'rebuild_full') {
            alternatives.push({
                approach: 'rebuild_full',
                startingPoint: 'clean_slate',
                preserve: {
                    uiDesign: false,
                    componentStructure: false,
                    styling: true, // Keep color preferences
                    workingFeatures: [],
                },
                featuresToFix: intent.primaryFeatures.map(f => ({
                    featureId: f.id,
                    featureName: f.name,
                    fixType: 'implement' as const,
                    description: f.description,
                    estimatedMinutes: 5,
                })),
                estimatedTimeMinutes: 20 + intent.primaryFeatures.length * 5,
                estimatedCost: this.estimateCost(20 + intent.primaryFeatures.length * 5, 'high'),
                confidence: 0.95,
                reasoning: 'Nuclear option: Complete rebuild from scratch using your original requirements. Highest confidence but takes longest.',
            });
        }

        return alternatives;
    }

    /**
     * AI-assisted strategy refinement
     */
    async refineStrategy(
        strategy: FixStrategy,
        userFeedback: string
    ): Promise<FixStrategy> {
        const prompt = `Refine this fix strategy based on user feedback.

CURRENT STRATEGY:
${JSON.stringify(strategy, null, 2)}

USER FEEDBACK:
${userFeedback}

Adjust the strategy to incorporate the user's preferences while maintaining effectiveness.

Return the refined strategy as JSON (same structure as input).`;

        const response = await this.claudeService.generate(prompt, {
            model: CLAUDE_MODELS.SONNET_4_5,
            maxTokens: 16000,
            useExtendedThinking: true,
            thinkingBudgetTokens: 8000,
        });

        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return strategy;
        }

        return JSON.parse(jsonMatch[0]);
    }
}

export function createStrategyEngine(userId: string, projectId: string): StrategyEngine {
    return new StrategyEngine(userId, projectId);
}

